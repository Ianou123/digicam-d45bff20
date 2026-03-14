import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Grid, List, ShieldAlert, Trash2, RotateCcw, Download, Loader2, User, X, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { DocumentFilters } from '@/components/documents/DocumentFilters';
import { UploadModal } from '@/components/documents/UploadModal';
import { EmptyState } from '@/components/documents/EmptyState';
import { SearchResultCard } from '@/components/documents/SearchResultCard';
import { WatchSearchButton } from '@/components/documents/WatchSearchButton';
import { WatchedSearchesList } from '@/components/documents/WatchedSearchesList';
import { ConfidentialDownloadModal } from '@/components/documents/ConfidentialDownloadModal';
import { DocumentShareTab } from '@/components/documents/DocumentShareTab';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { downloadDocument } from '@/lib/storage';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Document {
  id: string;
  title: string;
  document_type: string;
  confidentiality_level: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  current_version: number;
  file_url: string;
  deleted_at: string | null;
  ocr_text: string | null;
  departments: { name: string } | null;
  status: string | null;
  uploaded_by: string;
}

interface FilterState {
  search: string;
  department: string;
  type: string;
  year: string;
  confidentiality: string;
  status: string;
}

interface Client {
  id: string;
  name: string;
}

interface OwnerProfile {
  id: string;
  full_name: string | null;
  email: string;
}

export default function Documents() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile, canManageDocuments, isSuperAdmin, isClientSuspended, clientName } = useAuth();
  const { t, language } = useLanguage();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string; archived_at: string | null }[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Trash & Selection state
  const [showTrash, setShowTrash] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [bulkActionDialogOpen, setBulkActionDialogOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'trash' | 'restore' | 'delete'>('trash');

  // Confidential download modal state
  const [confidentialModalOpen, setConfidentialModalOpen] = useState(false);
  const [pendingDownloadDoc, setPendingDownloadDoc] = useState<Document | null>(null);

  // Share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareDocumentId, setShareDocumentId] = useState<string | null>(null);
  const [shareDocumentTitle, setShareDocumentTitle] = useState<string>('');

  // Owner filter from URL
  const ownerIdParam = searchParams.get('owner');
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfile | null>(null);

  // Initialize filters from URL params
  const [filters, setFilters] = useState<FilterState>(() => ({
    search: searchParams.get('search') || '',
    department: searchParams.get('department') || '',
    type: searchParams.get('type') || '',
    year: searchParams.get('year') || '',
    confidentiality: searchParams.get('confidentiality') || '',
    status: searchParams.get('status') || '',
  }));

  // Fetch owner profile if filtering by owner
  useEffect(() => {
    const fetchOwnerProfile = async () => {
      if (!ownerIdParam) {
        setOwnerProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', ownerIdParam)
        .maybeSingle();

      if (!error && data) {
        setOwnerProfile(data);
      }
    };

    fetchOwnerProfile();
  }, [ownerIdParam]);

  useEffect(() => {
    fetchDocuments();
    fetchDepartments();
    fetchSearchHistory();
    if (isSuperAdmin) {
      fetchClients();
    }
  }, [profile?.client_id, isSuperAdmin]);

  useEffect(() => {
    fetchDocuments();
    setSelectedDocuments(new Set()); // Clear selection when view changes
  }, [filters, selectedClientId, showTrash, ownerIdParam]);

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, name')
      .order('name');
    setClients(data || []);
  };

  const fetchSearchHistory = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('activity_logs')
      .select('search_query')
      .eq('user_id', user.id)
      .eq('action_type', 'search')
      .not('search_query', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      const uniqueSearches = [...new Set(data.map(d => d.search_query).filter(Boolean))] as string[];
      setSearchHistory(uniqueSearches.slice(0, 5));
    }
  };

  const logSearch = async (query: string, resultCount?: number) => {
    if (!user || !profile?.client_id || !query.trim()) return;

    // Log to activity_logs for existing functionality
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      client_id: profile.client_id,
      action_type: 'search' as const,
      search_query: query.trim(),
    });

    // Log to search_logs for V2 analytics (write-only for now)
    await supabase.from('search_logs').insert({
      user_id: user.id,
      client_id: profile.client_id,
      query_text: query.trim(),
      result_count: resultCount ?? 0,
    });

    fetchSearchHistory();
  };

  // Track when user clicks a search result
  const logSearchResultClick = async (documentId: string) => {
    if (!user || !profile?.client_id || !filters.search.trim()) return;

    // Log the click as a new search_logs entry with clicked_document_id
    await supabase.from('search_logs').insert({
      user_id: user.id,
      client_id: profile.client_id,
      query_text: filters.search.trim(),
      result_count: documents.length,
      clicked_document_id: documentId,
    });
  };

  const handleFiltersChange = (newFilters: FilterState) => {
    const previousSearch = filters.search;
    setFilters(newFilters);

    // Defer search logging to after documents have loaded
    if (newFilters.search && newFilters.search !== previousSearch && newFilters.search.length >= 2) {
      const timeoutId = setTimeout(() => {
        // Note: result_count will be logged with a small delay after documents load
        logSearch(newFilters.search, documents.length);
      }, 1500);
      return () => clearTimeout(timeoutId);
    }
  };

  const handleSearchHistoryClick = (query: string) => {
    setFilters(prev => ({ ...prev, search: query }));
  };

  const fetchDepartments = async () => {
    if (!profile?.client_id) return;

    let query = supabase.from('departments').select('id, name, archived_at');
    query = query.eq('client_id', profile.client_id);

    const { data } = await query;
    setDepartments(data || []);
  };

  const fetchDocuments = async () => {
    if (!profile?.client_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('documents')
        .select(`
          id,
          title,
          document_type,
          confidentiality_level,
          created_at,
          updated_at,
          tags,
          current_version,
          file_url,
          deleted_at,
          ocr_text,
          status,
          uploaded_by,
          departments!documents_department_id_fkey(name)
        `)
        .order('created_at', { ascending: false });

      // Filter by trash status
      if (showTrash) {
        query = query.not('deleted_at', 'is', null);
      } else {
        query = query.is('deleted_at', null);
      }

      // Apply client filter
      if (profile?.client_id) {
        query = query.eq('client_id', profile.client_id);
      }

      // Apply owner filter if specified in URL
      if (ownerIdParam) {
        query = query.eq('uploaded_by', ownerIdParam);
      }

      // Apply filters
      if (filters.department === 'general') {
        // Show only "Général" documents (no department assigned = shared with all)
        query = query.is('department_id', null);
      } else if (filters.department) {
        // When filtering by a specific department, also include "Général" docs (null department)
        query = query.or(`department_id.eq.${filters.department},department_id.is.null`);
      }
      if (filters.type) {
        query = query.eq('document_type', filters.type as any);
      }
      if (filters.confidentiality) {
        query = query.eq('confidentiality_level', filters.confidentiality as any);
      }
      if (filters.year) {
        const startDate = `${filters.year}-01-01`;
        const endDate = `${filters.year}-12-31`;
        query = query.gte('created_at', startDate).lte('created_at', endDate);
      }
      if (filters.search) {
        // Search in title and ocr_text using partial matching (ilike)
        // Note: For tags, we search title/OCR. Tag search is best done with frontend filtering
        // since PostgREST cs (contains) requires exact match
        query = query.or(`title.ilike.%${filters.search}%,ocr_text.ilike.%${filters.search}%`);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Apply STRICT client-side validation for search results
      // This ensures no false positives - search term MUST actually exist in the document
      let filteredData = (data || []) as unknown as Document[];
      if (filters.search && filters.search.trim().length >= 2) {
        const searchLower = filters.search.toLowerCase().trim();
        filteredData = filteredData.filter(doc => {
          // Strictly validate that the search term exists in title, OCR, or tags
          const titleMatch = doc.title?.toLowerCase().includes(searchLower);
          const ocrMatch = doc.ocr_text?.toLowerCase().includes(searchLower);
          const tagMatch = doc.tags?.some(tag =>
            tag.toLowerCase().includes(searchLower)
          );
          // Document MUST have an actual match - no fuzzy false positives
          return titleMatch || ocrMatch || tagMatch;
        });
      }

      setDocuments(filteredData);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error(language === 'fr' ? 'Erreur lors du chargement des documents' : 'Error loading documents');
    } finally {
      setLoading(false);
    }
  };

  const handleView = async (id: string) => {
    if (user && profile?.client_id) {
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        client_id: profile.client_id,
        action_type: 'view' as const,
        document_id: id,
      });
    }
    navigate(`/documents/${id}`);
  };

  const handleDownload = async (id: string) => {
    const doc = documents.find(d => d.id === id);
    if (!doc) return;

    // Check if document is confidential - trigger warning modal
    if (doc.confidentiality_level === 'confidential') {
      setPendingDownloadDoc(doc);
      setConfidentialModalOpen(true);
      return;
    }

    // Execute download directly for non-confidential docs
    await executeDownload(doc);
  };

  const executeDownload = async (doc: Document) => {
    if (user && profile?.client_id) {
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        client_id: profile.client_id,
        action_type: 'download' as const,
        document_id: doc.id,
      });
    }

    const filename = `${doc.title}.${doc.document_type}`;
    const success = await downloadDocument(doc.file_url, filename);

    if (!success) {
      toast.error(t('common.error'));
    }

    // Reset modal state
    setPendingDownloadDoc(null);
    setConfidentialModalOpen(false);
  };

  const handleConfidentialDownloadConfirm = () => {
    if (pendingDownloadDoc) {
      executeDownload(pendingDownloadDoc);
    }
  };

  const handleEdit = (id: string) => {
    navigate(`/documents/${id}/edit`);
  };

  const handleShare = (id: string) => {
    const doc = documents.find(d => d.id === id);
    setShareDocumentId(id);
    setShareDocumentTitle(doc?.title || '');
    setShareModalOpen(true);
  };

  // Soft delete - move to trash
  const handleMoveToTrash = async (ids: string[]) => {
    try {
      const { error } = await supabase
        .from('documents')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', ids);

      if (error) throw error;

      toast.success(t('documents.movedToTrash'));
      setSelectedDocuments(new Set());
      fetchDocuments();
    } catch (error) {
      console.error('Error moving to trash:', error);
      toast.error(language === 'fr' ? 'Erreur lors du déplacement' : 'Error moving to trash');
    }
  };

  // Restore from trash
  const handleRestore = async (ids: string[]) => {
    try {
      const { error } = await supabase
        .from('documents')
        .update({ deleted_at: null })
        .in('id', ids);

      if (error) throw error;

      toast.success(t('documents.restored'));
      setSelectedDocuments(new Set());
      fetchDocuments();
    } catch (error) {
      console.error('Error restoring:', error);
      toast.error(language === 'fr' ? 'Erreur lors de la restauration' : 'Error restoring');
    }
  };

  // Permanent delete
  const handlePermanentDelete = async (ids: string[]) => {
    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .in('id', ids);

      if (error) throw error;

      if (user && profile?.client_id) {
        for (const id of ids) {
          await supabase.from('activity_logs').insert({
            user_id: user.id,
            client_id: profile.client_id,
            action_type: 'delete' as const,
            document_id: id,
          });
        }
      }

      toast.success(t('documents.permanentlyDeleted'));
      setSelectedDocuments(new Set());
      fetchDocuments();
    } catch (error) {
      console.error('Error deleting permanently:', error);
      toast.error(language === 'fr' ? 'Erreur lors de la suppression' : 'Error deleting');
    }
  };

  const handleBulkDownload = async () => {
    const selectedDocs = documents.filter(d => selectedDocuments.has(d.id));

    for (const doc of selectedDocs) {
      if (user && profile?.client_id) {
        await supabase.from('activity_logs').insert({
          user_id: user.id,
          client_id: profile.client_id,
          action_type: 'download' as const,
          document_id: doc.id,
        });
      }

      const filename = `${doc.title}.${doc.document_type}`;
      await downloadDocument(doc.file_url, filename);
    }

    setSelectedDocuments(new Set());
  };

  const confirmBulkAction = (type: 'trash' | 'restore' | 'delete') => {
    setBulkActionType(type);
    setBulkActionDialogOpen(true);
  };

  const executeBulkAction = async () => {
    const ids = Array.from(selectedDocuments);
    setBulkActionDialogOpen(false);

    switch (bulkActionType) {
      case 'trash':
        await handleMoveToTrash(ids);
        break;
      case 'restore':
        await handleRestore(ids);
        break;
      case 'delete':
        await handlePermanentDelete(ids);
        break;
    }
  };

  const confirmDelete = (id: string) => {
    if (showTrash) {
      setSelectedDocuments(new Set([id]));
      confirmBulkAction('delete');
    } else {
      setSelectedDocuments(new Set([id]));
      confirmBulkAction('trash');
    }
  };

  const handleRestoreSingle = (id: string) => {
    handleRestore([id]);
  };

  const toggleDocumentSelection = (id: string) => {
    const newSelection = new Set(selectedDocuments);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedDocuments(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedDocuments.size === documents.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(documents.map(d => d.id)));
    }
  };

  const getBulkActionDialogContent = () => {
    switch (bulkActionType) {
      case 'trash':
        return {
          title: language === 'fr' ? 'Déplacer vers la corbeille' : 'Move to trash',
          description: t('documents.confirmMoveToTrash'),
        };
      case 'restore':
        return {
          title: language === 'fr' ? 'Restaurer les documents' : 'Restore documents',
          description: language === 'fr' ? 'Les documents seront restaurés.' : 'Documents will be restored.',
        };
      case 'delete':
        return {
          title: language === 'fr' ? 'Supprimer définitivement' : 'Delete permanently',
          description: t('documents.confirmPermanentDelete'),
        };
    }
  };

  const dialogContent = getBulkActionDialogContent();

  const handleClearOwnerFilter = () => {
    searchParams.delete('owner');
    setSearchParams(searchParams);
  };

  const ownerDisplayName = ownerProfile?.full_name || ownerProfile?.email?.split('@')[0] || '';

  return (
    <div className="space-y-6">
      {/* Owner Filter Chip */}
      {ownerIdParam && ownerProfile && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">
            {language === 'fr' ? 'Filtre actif:' : 'Active filter:'}
          </span>
          <Badge variant="secondary" className="gap-1.5 pr-1">
            <User className="h-3 w-3" />
            {language === 'fr' ? 'Propriétaire' : 'Owner'}: {ownerDisplayName}
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 ml-1 hover:bg-secondary-foreground/10 rounded-full p-0"
              onClick={handleClearOwnerFilter}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        </div>
      )}

      {/* Super Admin Warning - only shown to Super Admins viewing cross-org data, not regular admins */}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-semibold">{t('nav.documents')}</h2>
          <p className="text-muted-foreground">
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                {language === 'fr' ? 'Recherche en cours...' : 'Searching...'}
              </span>
            ) : (
              <>
                {documents.length} {language === 'fr' ? 'résultat' : 'result'}{documents.length !== 1 ? 's' : ''} {language === 'fr' ? 'trouvé' : 'found'}{documents.length !== 1 && language === 'fr' ? 's' : ''}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Trash Toggle */}
          {canManageDocuments && !isSuperAdmin && (
            <Tabs value={showTrash ? 'trash' : 'active'} onValueChange={(v) => setShowTrash(v === 'trash')}>
              <TabsList>
                <TabsTrigger value="active">{t('documents.activeDocuments')}</TabsTrigger>
                <TabsTrigger value="trash" className="flex items-center gap-1">
                  <Trash2 className="h-3 w-3" />
                  {t('documents.trash')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}


          <div className="flex items-center border border-border rounded-md">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-9 w-9 rounded-r-none"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-9 w-9 rounded-l-none"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
          </div>
          {/* Hide upload button for Super Admin and suspended clients */}
          {canManageDocuments && !isSuperAdmin && !isClientSuspended && !showTrash && (
            <Button onClick={() => setUploadModalOpen(true)} className="btn-institutional">
              <Plus className="h-4 w-4 mr-2" />
              {t('documents.newDocument')}
            </Button>
          )}
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedDocuments.size > 0 && canManageDocuments && !isSuperAdmin && !isClientSuspended && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
          <span className="text-sm text-muted-foreground">
            {t('documents.selectedCount').replace('{count}', selectedDocuments.size.toString())}
          </span>
          <div className="flex-1" />
          {!showTrash ? (
            <>
              <Button variant="outline" size="sm" onClick={handleBulkDownload}>
                <Download className="h-4 w-4 mr-1" />
                {t('documents.bulkDownload')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => confirmBulkAction('trash')}>
                <Trash2 className="h-4 w-4 mr-1" />
                {t('documents.moveToTrash')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => confirmBulkAction('restore')}>
                <RotateCcw className="h-4 w-4 mr-1" />
                {t('documents.restore')}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => confirmBulkAction('delete')}>
                <Trash2 className="h-4 w-4 mr-1" />
                {t('documents.deletePermanently')}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="flex-1">
          <DocumentFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            departments={departments}
            searchHistory={searchHistory}
            onSearchHistoryClick={handleSearchHistoryClick}
          />
        </div>
        {/* Watch Search Button - appears when filters are active */}
        <WatchSearchButton currentFilters={filters} />
      </div>

      {/* Watched Searches */}
      <WatchedSearchesList />

      {/* Select All Header */}
      {documents.length > 0 && canManageDocuments && !isSuperAdmin && !isClientSuspended && (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selectedDocuments.size === documents.length && documents.length > 0}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm text-muted-foreground">
            {selectedDocuments.size === documents.length ? t('documents.deselectAll') : t('documents.selectAll')}
          </span>
        </div>
      )}

      {/* Documents */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : documents.length > 0 ? (
        /* Use SearchResultCard when there's an active search, otherwise DocumentCard */
        filters.search && filters.search.length >= 2 ? (
          <div className="space-y-3">
            {documents.map((doc) => {
              const matchedInContent = doc.ocr_text
                ? doc.ocr_text.toLowerCase().includes(filters.search.toLowerCase())
                : false;
              return (
                <SearchResultCard
                  key={doc.id}
                  document={{
                    id: doc.id,
                    title: doc.title,
                    document_type: doc.document_type,
                    file_size: null,
                    updated_at: doc.updated_at,
                    ocr_text: doc.ocr_text,
                  }}
                  searchQuery={filters.search}
                  matchedInContent={matchedInContent}
                  onView={handleView}
                  onClickTrack={logSearchResultClick}
                />
              );
            })}
          </div>
        ) : (
          <div className={viewMode === 'grid'
            ? 'grid gap-4 md:grid-cols-2 lg:grid-cols-3'
            : 'space-y-3'
          }>
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={{
                  ...doc,
                  department: doc.departments,
                  profiles: null,
                }}
                isInTrash={showTrash}
                selected={selectedDocuments.has(doc.id)}
                onSelect={canManageDocuments && !isSuperAdmin && !isClientSuspended ? () => toggleDocumentSelection(doc.id) : undefined}
                onView={handleView}
                onDownload={handleDownload}
                onShare={!showTrash ? handleShare : undefined}
                onEdit={!isSuperAdmin && !isClientSuspended && !showTrash ? handleEdit : undefined}
                onDelete={!isSuperAdmin && !isClientSuspended ? confirmDelete : undefined}
                onRestore={showTrash && !isSuperAdmin && !isClientSuspended ? handleRestoreSingle : undefined}
              />
            ))}
          </div>
        )
      ) : documents.length === 0 ? (
        showTrash ? (
          <EmptyState type="emptyTrash" />
        ) : ownerIdParam && ownerProfile ? (
          <EmptyState
            type="noResults"
            searchQuery={language === 'fr'
              ? `documents de ${ownerDisplayName}`
              : `documents by ${ownerDisplayName}`}
          />
        ) : filters.search ? (
          <EmptyState
            type="noResults"
            searchQuery={filters.search}
          />
        ) : (
          <EmptyState
            type="noDocuments"
            organizationName={clientName || undefined}
            canUpload={canManageDocuments && !isSuperAdmin && !isClientSuspended}
            onUpload={() => setUploadModalOpen(true)}
          />
        )
      ) : null}
      {/* Upload Modal - only for non-super admin */}
      {!isSuperAdmin && (
        <UploadModal
          open={uploadModalOpen}
          onOpenChange={setUploadModalOpen}
          departments={departments}
          onSuccess={fetchDocuments}
        />
      )}

      {/* Bulk Action Confirmation */}
      <AlertDialog open={bulkActionDialogOpen} onOpenChange={setBulkActionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogContent.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {dialogContent.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeBulkAction}
              className={bulkActionType === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confidential Download Warning Modal */}
      <ConfidentialDownloadModal
        open={confidentialModalOpen}
        onOpenChange={setConfidentialModalOpen}
        onConfirm={handleConfidentialDownloadConfirm}
        documentTitle={pendingDownloadDoc?.title || ''}
      />
    </div>
  );
}