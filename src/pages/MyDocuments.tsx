import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, FileText, Star, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/formatters';
import { useFavorites } from '@/hooks/useFavorites';
import { cn } from '@/lib/utils';

interface UploadRow {
  id: string;
  title: string;
  document_type: string;
  created_at: string;
  status: string | null;
  file_size: number | null;
  department_name: string;
  department_id: string | null;
}

const formatBytes = (bytes: number | null, language: 'fr' | 'en') => {
  if (!bytes) return language === 'fr' ? '—' : '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
};

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
  const { user, profile, isUltraAdmin } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { favoriteIds, toggleFavorite } = useFavorites();

  const [rows, setRows] = useState<UploadRow[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [favoriteDocs, setFavoriteDocs] = useState<Array<{ id: string; title: string; document_type: string }>>([]);
  const [loading, setLoading] = useState(true);

  const [filenameQuery, setFilenameQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

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
          .select('id, title, document_type, created_at, status, file_size, department_id, departments!documents_department_id_fkey(name)')
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
          status: doc.status,
          file_size: doc.file_size,
          department_name: doc.departments?.name || (language === 'fr' ? 'Général' : 'General'),
          department_id: doc.department_id,
        })),
      );
      setDepartments(deps || []);
      setLoading(false);
    };

    fetchUploads();
  }, [user, profile?.client_id, language, isUltraAdmin]);

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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'fr' ? 'Nom du document' : 'Document name'}</TableHead>
                  <TableHead>{language === 'fr' ? 'Type' : 'Type'}</TableHead>
                  <TableHead>{language === 'fr' ? 'Département' : 'Department'}</TableHead>
                  <TableHead>{language === 'fr' ? 'Date d’import' : 'Upload date'}</TableHead>
                  <TableHead>{language === 'fr' ? 'Statut OCR' : 'OCR status'}</TableHead>
                  <TableHead>{language === 'fr' ? 'Taille' : 'Size'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => {
                  const ocr = getOcrMeta(row.status, language);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.title}</TableCell>
                      <TableCell className="uppercase text-muted-foreground">{row.document_type}</TableCell>
                      <TableCell>{row.department_name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(row.created_at, language)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ocr.className}>{ocr.label}</Badge>
                      </TableCell>
                      <TableCell>{formatBytes(row.file_size, language)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
