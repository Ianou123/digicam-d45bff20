import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Grid, List, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { DocumentFilters } from '@/components/documents/DocumentFilters';
import { UploadModal } from '@/components/documents/UploadModal';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  departments: { name: string } | null;
}

interface FilterState {
  search: string;
  department: string;
  type: string;
  year: string;
  confidentiality: string;
}

interface Client {
  id: string;
  name: string;
}

export default function Documents() {
  const navigate = useNavigate();
  const { user, profile, canManageDocuments, isSuperAdmin } = useAuth();
  const { t, language } = useLanguage();
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    department: '',
    type: '',
    year: '',
    confidentiality: '',
  });

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
  }, [filters, selectedClientId]);

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

  const logSearch = async (query: string) => {
    if (!user || !profile?.client_id || !query.trim()) return;

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      client_id: profile.client_id,
      action_type: 'search' as const,
      search_query: query.trim(),
    });

    fetchSearchHistory();
  };

  const handleFiltersChange = (newFilters: FilterState) => {
    const previousSearch = filters.search;
    setFilters(newFilters);
    
    // Log search when user changes the search term
    if (newFilters.search && newFilters.search !== previousSearch && newFilters.search.length >= 2) {
      // Debounce: only log after user stops typing
      const timeoutId = setTimeout(() => {
        logSearch(newFilters.search);
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  };

  const handleSearchHistoryClick = (query: string) => {
    setFilters(prev => ({ ...prev, search: query }));
  };

  const fetchDepartments = async () => {
    if (!profile?.client_id && !isSuperAdmin) return;

    let query = supabase.from('departments').select('id, name');
    
    if (!isSuperAdmin && profile?.client_id) {
      query = query.eq('client_id', profile.client_id);
    }

    const { data } = await query;
    setDepartments(data || []);
  };

  const fetchDocuments = async () => {
    if (!profile?.client_id && !isSuperAdmin) {
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
          departments(name)
        `)
        .order('created_at', { ascending: false });

      // Apply client filter for Super Admin
      if (isSuperAdmin && selectedClientId !== 'all') {
        query = query.eq('client_id', selectedClientId);
      } else if (!isSuperAdmin && profile?.client_id) {
        query = query.eq('client_id', profile.client_id);
      }

      // Apply filters
      if (filters.department) {
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

      const { data, error } = await query;

      if (error) throw error;
      setDocuments((data || []) as unknown as Document[]);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Erreur lors du chargement des documents');
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

    if (user && profile?.client_id) {
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        client_id: profile.client_id,
        action_type: 'download' as const,
        document_id: id,
      });
    }

    window.open(doc.file_url, '_blank');
  };

  const handleEdit = (id: string) => {
    navigate(`/documents/${id}/edit`);
  };

  const handleDelete = async () => {
    if (!documentToDelete) return;

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentToDelete);

      if (error) throw error;

      if (user && profile?.client_id) {
        await supabase.from('activity_logs').insert({
          user_id: user.id,
          client_id: profile.client_id,
          action_type: 'delete' as const,
          document_id: documentToDelete,
        });
      }

      toast.success('Document supprimé');
      fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  const confirmDelete = (id: string) => {
    setDocumentToDelete(id);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Super Admin Warning */}
      {isSuperAdmin && (
        <Alert variant="destructive" className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">
            {language === 'fr' ? 'Accès système' : 'System-level access'}
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            {language === 'fr' 
              ? 'Les modifications ici affectent directement les données des clients. Utilisez les vues spécifiques aux clients quand possible.'
              : 'Changes here directly affect client data. Use client-specific views when possible.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-semibold">{t('nav.documents')}</h2>
          <p className="text-muted-foreground">
            {documents.length} document{documents.length !== 1 ? 's' : ''} trouvé{documents.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Organization Filter for Super Admin */}
          {isSuperAdmin && (
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={language === 'fr' ? 'Toutes les organisations' : 'All organizations'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === 'fr' ? 'Toutes les organisations' : 'All organizations'}</SelectItem>
                {clients.map(client => (
                  <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          {/* Hide upload button for Super Admin */}
          {canManageDocuments && !isSuperAdmin && (
            <Button onClick={() => setUploadModalOpen(true)} className="btn-institutional">
              <Plus className="h-4 w-4 mr-2" />
              {t('documents.newDocument')}
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <DocumentFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        departments={departments}
        searchHistory={searchHistory}
        onSearchHistoryClick={handleSearchHistoryClick}
      />

      {/* Documents */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : documents.length > 0 ? (
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
              onView={handleView}
              onDownload={handleDownload}
              onEdit={!isSuperAdmin ? handleEdit : undefined}
              onDelete={!isSuperAdmin ? confirmDelete : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <p className="text-muted-foreground">{t('documents.noDocuments')}</p>
          {canManageDocuments && !isSuperAdmin && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setUploadModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('documents.uploadDocument')}
            </Button>
          )}
        </div>
      )}

      {/* Upload Modal - only for non-super admin */}
      {!isSuperAdmin && (
        <UploadModal
          open={uploadModalOpen}
          onOpenChange={setUploadModalOpen}
          departments={departments}
          onSuccess={fetchDocuments}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le document sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('documents.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}