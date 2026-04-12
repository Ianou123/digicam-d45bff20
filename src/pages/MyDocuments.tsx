import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Star, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { ConfidentialDownloadModal } from '@/components/documents/ConfidentialDownloadModal';
import { useFavorites } from '@/hooks/useFavorites';
import { usePinnedDocuments } from '@/hooks/usePinnedDocuments';
import { downloadDocument } from '@/lib/storage';
import { toast } from 'sonner';

interface UploadRow {
  id: string;
  title: string;
  document_type: string;
  created_at: string;
  updated_at: string;
  status: string | null;
  file_size: number | null;
  department_name: string;
  department_id: string | null;
  confidentiality_level: string;
  file_url: string;
  tags: string[];
  ocr_text: string | null;
  current_version: number;
  departments: { name: string } | null;
}

const getOcrMeta = (status: string | null, language: 'fr' | 'en') => {
  if (status && ['error', 'failed', 'ocr_error'].includes(status)) {
    return {
      label: language === 'fr' ? 'Erreur' : 'Error',
      className: 'bg-destructive/10 text-destructive border-destructive/20',
    };
  }

  if (status && ['processing', 'ocr_processing', 'pending_ocr'].includes(status)) {
    return {
      label: language === 'fr' ? 'En cours' : 'In progress',
      className: 'bg-warning/10 text-warning-foreground border-warning/20',
    };
  }

  return {
    label: language === 'fr' ? 'Terminé' : 'Completed',
    className: 'bg-success/10 text-success border-success/20',
  };
};

export default function MyDocuments() {
  const { user, profile, isUltraAdmin, isSuperAdmin, isClientAdmin, isClientSuspended, canManageDocuments } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const { favoriteIds, toggleFavorite, isFavorite } = useFavorites();
  const { pinningIds, togglePin, isPinned: isPinnedDoc } = usePinnedDocuments();

  const [rows, setRows] = useState<UploadRow[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [favoriteDocs, setFavoriteDocs] = useState<Array<{ id: string; title: string; document_type: string }>>([]);
  const [loading, setLoading] = useState(true);

  const [filenameQuery, setFilenameQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [confidentialModalOpen, setConfidentialModalOpen] = useState(false);
  const [pendingDownloadDoc, setPendingDownloadDoc] = useState<UploadRow | null>(null);

  useEffect(() => {
    const fetchUploads = async () => {
      if (isUltraAdmin) {
        setLoading(false);
        return;
      }

      if (!user || !profile?.client_id) {
        setLoading(false);
        return;
      }

      setLoading(true);

      const [{ data: docs }, { data: deps }] = await Promise.all([
        supabase
          .from('documents')
          .select(
            'id, title, document_type, created_at, updated_at, status, file_size, file_url, confidentiality_level, tags, ocr_text, current_version, department_id, departments!documents_department_id_fkey(name)',
          )
          .eq('uploaded_by', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('departments')
          .select('id, name')
          .eq('client_id', profile.client_id)
          .is('archived_at', null)
          .order('name', { ascending: true }),
      ]);

      setRows(
        (docs || []).map((doc: any) => ({
          id: doc.id,
          title: doc.title,
          document_type: doc.document_type,
          created_at: doc.created_at,
          updated_at: doc.updated_at,
          status: doc.status,
          file_size: doc.file_size,
          department_name: doc.departments?.name || (language === 'fr' ? 'Général' : 'General'),
          department_id: doc.department_id,
          confidentiality_level: doc.confidentiality_level,
          file_url: doc.file_url,
          tags: doc.tags || [],
          ocr_text: doc.ocr_text,
          current_version: doc.current_version,
          departments: doc.departments?.name ? { name: doc.departments.name } : null,
        })),
      );
      setDepartments(deps || []);
      setLoading(false);
    };

    fetchUploads();
  }, [user, profile?.client_id, language, isUltraAdmin]);

  // Fetch favorite documents
  useEffect(() => {
    const fetchFavDocs = async () => {
      if (!user || favoriteIds.size === 0) {
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
  }, [user, favoriteIds]);

  const filteredRows = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return rows.filter((row) => {
      const matchesFilename = !filenameQuery.trim() || row.title.toLowerCase().includes(filenameQuery.toLowerCase());

      const matchesDepartment =
        departmentFilter === 'all' ||
        (departmentFilter === 'none' ? !row.department_id : row.department_id === departmentFilter);

      const ocrState = getOcrMeta(row.status, language).label;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'done' && ocrState === (language === 'fr' ? 'Terminé' : 'Completed')) ||
        (statusFilter === 'processing' && ocrState === (language === 'fr' ? 'En cours' : 'In progress')) ||
        (statusFilter === 'error' && ocrState === (language === 'fr' ? 'Erreur' : 'Error'));

      const createdAt = new Date(row.created_at);
      const matchesDate =
        dateFilter === 'all' ||
        (dateFilter === 'today' && createdAt >= startOfToday) ||
        (dateFilter === 'week' && createdAt >= startOfWeek) ||
        (dateFilter === 'month' && createdAt >= startOfMonth);

      return matchesFilename && matchesDepartment && matchesStatus && matchesDate;
    });
  }, [rows, filenameQuery, departmentFilter, statusFilter, dateFilter, language]);

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
    const doc = rows.find((d) => d.id === id);
    if (!doc) return;

    if (doc.confidentiality_level === 'confidential') {
      setPendingDownloadDoc(doc);
      setConfidentialModalOpen(true);
      return;
    }

    await executeDownload(doc);
  };

  const executeDownload = async (doc: UploadRow) => {
    if (user && profile?.client_id) {
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        client_id: profile.client_id,
        action_type: 'download' as const,
        document_id: doc.id,
      });
    }

    const filename = `${doc.title}.${doc.document_type}`;
    const success = await downloadDocument(doc.file_url, filename, doc.id);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[360px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-semibold">
          {language === 'fr' ? 'Mes Téléversements' : 'My Uploads'}
        </h1>
        <p className="text-muted-foreground">
          {language === 'fr'
            ? 'Historique complet de vos imports de documents'
            : 'Complete history of your document uploads'}
        </p>
      </div>



      <Card>
        <CardHeader>
          <CardTitle className="text-base">{language === 'fr' ? 'Filtres' : 'Filters'}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="relative md:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={filenameQuery}
              onChange={(e) => setFilenameQuery(e.target.value)}
              placeholder={language === 'fr' ? 'Nom du document...' : 'Document name...'}
              className="pl-9"
            />
          </div>

          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger>
              <SelectValue placeholder={language === 'fr' ? 'Par département' : 'By department'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === 'fr' ? 'Tous les départements' : 'All departments'}</SelectItem>
              <SelectItem value="none">{language === 'fr' ? 'Général' : 'General'}</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger>
              <SelectValue placeholder={language === 'fr' ? 'Par date' : 'By date'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === 'fr' ? 'Toutes les dates' : 'All dates'}</SelectItem>
              <SelectItem value="today">{language === 'fr' ? 'Aujourd’hui' : 'Today'}</SelectItem>
              <SelectItem value="week">{language === 'fr' ? '7 derniers jours' : 'Last 7 days'}</SelectItem>
              <SelectItem value="month">{language === 'fr' ? 'Ce mois' : 'This month'}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder={language === 'fr' ? 'Par statut OCR' : 'By OCR status'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === 'fr' ? 'Tous les statuts' : 'All statuses'}</SelectItem>
              <SelectItem value="done">{language === 'fr' ? 'Terminé' : 'Completed'}</SelectItem>
              <SelectItem value="processing">{language === 'fr' ? 'En cours' : 'In progress'}</SelectItem>
              <SelectItem value="error">{language === 'fr' ? 'Erreur' : 'Error'}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{language === 'fr' ? 'Historique' : 'History'}</CardTitle>
          <Badge variant="outline">{filteredRows.length}</Badge>
        </CardHeader>
        <CardContent>
          {filteredRows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              {language === 'fr' ? 'Aucun téléversement trouvé' : 'No uploads found'}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredRows.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={{
                    id: doc.id,
                    title: doc.title,
                    document_type: doc.document_type,
                    confidentiality_level: doc.confidentiality_level,
                    created_at: doc.created_at,
                    updated_at: doc.updated_at,
                    tags: doc.tags,
                    current_version: doc.current_version,
                    file_size: doc.file_size,
                    ocr_text: doc.ocr_text,
                    department: doc.departments,
                    profiles: null,
                  }}
                  isFavorite={isFavorite(doc.id)}
                  onToggleFavorite={(id) => toggleFavorite(id)}
                  isPinned={isPinnedDoc(doc.id)}
                  isPinning={pinningIds.has(doc.id)}
                  onTogglePin={
                    !isClientAdmin && doc.confidentiality_level !== 'confidential'
                      ? (d) =>
                          togglePin({
                            ...d,
                            file_url: doc.file_url,
                            file_size: doc.file_size,
                            department: doc.departments,
                          })
                      : undefined
                  }
                  onView={handleView}
                  onDownload={handleDownload}
                  onEdit={
                    canManageDocuments && !isSuperAdmin && !isClientSuspended
                      ? (id) => navigate(`/documents/${id}/edit`)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfidentialDownloadModal
        open={confidentialModalOpen}
        onOpenChange={setConfidentialModalOpen}
        onConfirm={handleConfidentialDownloadConfirm}
        documentTitle={pendingDownloadDoc?.title || ''}
      />
    </div>
  );
}
