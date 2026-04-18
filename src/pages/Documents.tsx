import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Grid, List, ShieldAlert, Trash2, RotateCcw, Download, Loader2, User, X, Share2, FolderOpen, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { DocumentFilters } from '@/components/documents/DocumentFilters';
import { UploadModal } from '@/components/documents/UploadModal';
import { EmptyState } from '@/components/documents/EmptyState';
import { SearchResultCard } from '@/components/documents/SearchResultCard';
import { ConfidentialDownloadModal } from '@/components/documents/ConfidentialDownloadModal';
import { DocumentShareTab } from '@/components/documents/DocumentShareTab';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { downloadDocument } from '@/lib/storage';
import { usePinnedDocuments } from '@/hooks/usePinnedDocuments';
import { useFavorites } from '@/hooks/useFavorites';
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
  file_size: number | null;
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
  const { user, profile, canManageDocuments, isSuperAdmin, isClientSuspended, clientName, isUltraAdmin, isClientAdmin } = useAuth();
  const { t, language } = useLanguage();
  const { favoriteIds, isFavorite, toggleFavorite } = useFavorites();
  const { pinnedIds, pinningIds, togglePin, isPinned: isPinnedDoc } = usePinnedDocuments();

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
  const [favoriteDocs, setFavoriteDocs] = useState<any[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<{ id: string; title: string; document_type: string }[]>([]);
  const [watchLoading, setWatchLoading] = useState(false);
  const [deptDocCounts, setDeptDocCounts] = useState<Record<string, number>>({});

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
    if (isUltraAdmin) {
      navigate('/dashboard', { replace: true });
      return;
    }

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
  }, [ownerIdParam, isUltraAdmin, navigate]);

  useEffect(() => {
    fetchDocuments();
    fetchDepartments();
    fetchSearchHistory();
    fetchRecentlyViewed();
    if (isSuperAdmin) {
      fetchClients();
    }
  }, [profile?.client_id, isSuperAdmin]);

  useEffect(() => {
    fetchDocuments();
    setSelectedDocuments(new Set()); // Clear selection when view changes
  }, [filters, selectedClientId, showTrash, ownerIdParam]);

  // Fetch top 3 favorite documents
  useEffect(() => {
    const fetchFavDocs = async () => {
      if (!user || isUltraAdmin || favoriteIds.size === 0) {
        setFavoriteDocs([]);
        return;
      }
      const ids = Array.from(favoriteIds).slice(0, 3);
      const { data } = await supabase
        .from('documents')
        .select('id, title, document_type')
        .in('id', ids)
        .is('deleted_at', null);
      setFavoriteDocs(data || []);
    };
    fetchFavDocs();
  }, [user, favoriteIds, isUltraAdmin]);

  // Fetch recently viewed documents
  const fetchRecentlyViewed = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('activity_logs')
      .select('document_id')
      .eq('user_id', user.id)
      .eq('action_type', 'view')
      .not('document_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) {
      const uniqueIds = [...new Set(data.map(d => d.document_id).filter(Boolean))] as string[];
      const topIds = uniqueIds.slice(0, 4);
      if (topIds.length > 0) {
        const { data: docs } = await supabase
          .from('documents')
          .select('id, title, document_type')
          .in('id', topIds)
          .is('deleted_at', null);
        setRecentlyViewed(docs || []);
      }
    }
  };

  // Compute department doc counts when documents change
  useEffect(() => {
    if (!profile?.client_id) return;
    const fetchCounts = async () => {
      const { data } = await supabase
        .from('documents')
        .select('department_id')
        .eq('client_id', profile.client_id)
        .is('deleted_at', null);
      if (data) {
        const counts: Record<string, number> = { all: data.length };
        data.forEach(d => {
          const deptId = (d as any).department_id || 'general';
          counts[deptId] = (counts[deptId] || 0) + 1;
        });
        setDeptDocCounts(counts);
      }
    };
    fetchCounts();
  }, [profile?.client_id]);

  // Watch search handler (moved from WatchSearchButton)
  const handleWatchSearch = useCallback(async () => {
    if (!user || !profile?.client_id) return;
    const hasActiveFilters = filters.search || filters.department || filters.type || filters.year || filters.confidentiality;
    if (!hasActiveFilters) return;

    setWatchLoading(true);
    try {
      const parts: string[] = [];
      if (filters.search) parts.push(`"${filters.search}"`);
      if (filters.type) parts.push(filters.type.toUpperCase());
      if (filters.confidentiality) parts.push(filters.confidentiality);
      if (filters.year) parts.push(filters.year);
      const searchName = parts.join(' + ') || (language === 'fr' ? 'Recherche surveillée' : 'Watched Search');

      const sanitizedFilters = {
        ...filters,
        search: filters.search.replace(/[%_\\]/g, '').trim().substring(0, 100),
      };

      const { error } = await supabase
        .from('saved_searches')
        .insert([{
          user_id: user.id,
          client_id: profile.client_id,
          name: searchName,
          filters: sanitizedFilters as unknown as import('@/integrations/supabase/types').Json,
          is_pinned: false,
          is_watched: true,
        }]);

      if (error) throw error;
      toast.success(
        language === 'fr' ? `🔔 Surveillance activée : ${searchName}` : `🔔 Now watching: ${searchName}`,
        { description: language === 'fr' ? 'Vous serez notifié quand un nouveau document correspond' : 'You\'ll be notified when a new document matches' }
      );
    } catch (error) {
      console.error('Error creating watch:', error);
      toast.error(language === 'fr' ? 'Erreur lors de l\'activation de la surveillance' : 'Error activating watch');
    } finally {
      setWatchLoading(false);
    }
  }, [user, profile?.client_id, filters, language]);

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

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      client_id: profile.client_id,
      action_type: 'search' as const,
      search_query: query.trim(),
    });

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

    if (newFilters.search && newFilters.search !== previousSearch && newFilters.search.length >= 2) {
      const timeoutId = setTimeout(() => {
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
          file_size,
          deleted_at,
          ocr_text,
          status,
          uploaded_by,
          departments!documents_department_id_fkey(name)
        `)
        .order('created_at', { ascending: false });

      if (showTrash) {
        query = query.not('deleted_at', 'is', null);
      } else {
        query = query.is('deleted_at', null);
      }

      if (profile?.client_id) {
        query = query.eq('client_id', profile.client_id);
      }

      if (ownerIdParam) {
        query = query.eq('uploaded_by', ownerIdParam);
      }

      if (filters.department === 'general') {
        query = query.is('department_id', null);
      } else if (filters.department) {
        query = query.eq('department_id', filters.department);
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
        query = query.or(`title.ilike.%${filters.search}%,ocr_text.ilike.%${filters.search}%`);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;

      if (error) throw error;

      let filteredData = (data || []) as unknown as Document[];
      if (filters.search && filters.search.trim().length >= 2) {
        const searchLower = filters.search.toLowerCase().trim();
        filteredData = filteredData.filter(doc => {
          const titleMatch = doc.title?.toLowerCase().includes(searchLower);
          const ocrMatch = doc.ocr_text?.toLowerCase().includes(searchLower);
          const tagMatch = doc.tags?.some(tag =>
            tag.toLowerCase().includes(searchLower)
          );
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

    if (doc.confidentiality_level === 'confidential') {
      setPendingDownloadDoc(doc);
      setConfidentialModalOpen(true);
      return;
    }

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

  // Watched searches state
  const [watchedSearches, setWatchedSearches] = useState<{ id: string; name: string; filters: FilterState; is_watched: boolean }[]>([]);

  // Fetch watched searches
  useEffect(() => {
    const fetchWatched = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('saved_searches')
        .select('id, name, filters, is_watched')
        .eq('user_id', user.id)
        .eq('is_watched', true)
        .order('created_at', { ascending: false });
      if (data) {
        setWatchedSearches(data.map(s => ({
          id: s.id,
          name: s.name,
          filters: s.filters as unknown as FilterState,
          is_watched: s.is_watched ?? true,
        })));
      }
    };
    fetchWatched();
  }, [user]);

  const handleDeleteWatch = async (id: string) => {
    const { error } = await supabase.from('saved_searches').delete().eq('id', id);
    if (!error) {
      setWatchedSearches(prev => prev.filter(s => s.id !== id));
      toast.success(language === 'fr' ? 'Surveillance supprimée' : 'Watch removed');
    }
  };

  return (
    <div className="space-y-4">
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-semibold">{t('nav.documents')}</h2>
          <p className="text-sm text-muted-foreground">
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
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 rounded-r-none" onClick={() => setViewMode('list')}>
              <List className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 rounded-l-none" onClick={() => setViewMode('grid')}>
              <Grid className="h-4 w-4" />
            </Button>
          </div>
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

      {/* 1. Search Bar + Filters — AT THE TOP */}
      <DocumentFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        departments={departments}
        searchHistory={searchHistory}
        onSearchHistoryClick={handleSearchHistoryClick}
        onWatchSearch={handleWatchSearch}
        isWatchLoading={watchLoading}
      />

      {/* Active watched searches — compact inline chips with ✕ to cancel */}
      {watchedSearches.length > 0 && !showTrash && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Bell className="h-3 w-3" />
            {language === 'fr' ? 'Surveillées :' : 'Watching:'}
          </span>
          {watchedSearches.map(ws => (
            <Badge key={ws.id} variant="outline" className="gap-1 pr-1 text-xs">
              <Bell className="h-3 w-3 text-amber-500" />
              {ws.name}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-0.5 hover:bg-destructive/10 rounded-full p-0"
                onClick={() => handleDeleteWatch(ws.id)}
                title={language === 'fr' ? 'Annuler la surveillance' : 'Cancel watch'}
              >
                <X className="h-3 w-3 text-destructive" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* 2. Department Folder Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <button
          onClick={() => setFilters(prev => ({ ...prev, department: '' }))}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-colors',
            !filters.department
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card text-muted-foreground border-border hover:bg-muted'
          )}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          {language === 'fr' ? 'Tous les documents' : 'All documents'}
          {deptDocCounts.all != null && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{deptDocCounts.all}</Badge>
          )}
        </button>
        <button
          onClick={() => setFilters(prev => ({ ...prev, department: 'general' }))}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-colors',
            filters.department === 'general'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card text-muted-foreground border-border hover:bg-muted'
          )}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          {language === 'fr' ? 'Général' : 'General'}
          {deptDocCounts.general != null && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{deptDocCounts.general}</Badge>
          )}
        </button>
        {departments.filter(d => !d.archived_at).map(dept => (
          <button
            key={dept.id}
            onClick={() => setFilters(prev => ({ ...prev, department: dept.id }))}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-colors',
              filters.department === dept.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:bg-muted'
            )}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {dept.name}
            {deptDocCounts[dept.id] != null && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{deptDocCounts[dept.id]}</Badge>
            )}
          </button>
        ))}
      </div>

      {!loading && (
        <div className="flex items-center justify-between py-0.5">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{documents.length}</span>{' '}
            {language === 'fr'
              ? `document${documents.length !== 1 ? 's' : ''}`
              : `document${documents.length !== 1 ? 's' : ''}`}
            {filters.search ? ` — "${filters.search}"` : ''}
          </p>
        </div>
      )}

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
                isFavorite={isFavorite(doc.id)}
                onToggleFavorite={!showTrash ? toggleFavorite : undefined}
                isPinned={isPinnedDoc(doc.id)}
                isPinning={pinningIds.has(doc.id)}
                onTogglePin={
                  !showTrash && !isClientAdmin && doc.confidentiality_level !== 'confidential'
                    ? (d: any) =>
                        togglePin({
                          ...d,
                          file_url: doc.file_url,
                          file_size: doc.file_size,
                          department: doc.departments,
                        })
                    : undefined
                }
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

      {/* Share Modal */}
      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {language === 'fr' ? 'Partager le document' : 'Share Document'}
            </DialogTitle>
            <DialogDescription>
              {shareDocumentTitle}
            </DialogDescription>
          </DialogHeader>
          {shareDocumentId && <DocumentShareTab documentId={shareDocumentId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
