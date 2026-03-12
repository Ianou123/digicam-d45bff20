import { useEffect, useMemo, useState } from 'react';
import { Upload as UploadIcon, FileText, Building2, Calendar, Clock3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UploadModal } from '@/components/documents/UploadModal';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

interface RecentUpload {
  id: string;
  title: string;
  document_type: string;
  created_at: string;
  status: string | null;
  department_name: string;
}

const statusMeta = (status: string | null, language: 'fr' | 'en') => {
  if (status && ['error', 'failed', 'ocr_error'].includes(status)) {
    return { label: language === 'fr' ? 'Erreur' : 'Error', className: 'bg-destructive/10 text-destructive border-destructive/20' };
  }
  if (status && ['processing', 'ocr_processing', 'pending_ocr'].includes(status)) {
    return { label: language === 'fr' ? 'En cours' : 'In progress', className: 'bg-warning/10 text-warning-foreground border-warning/20' };
  }
  return { label: language === 'fr' ? 'Terminé' : 'Completed', className: 'bg-success/10 text-success border-success/20' };
};

export function ITAdminDashboard() {
  const { user, profile } = useAuth();
  const { language } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; archived_at: string | null }>>([]);
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);
  const [stats, setStats] = useState({
    today: 0,
    month: 0,
    ocrProcessing: 0,
    departmentName: language === 'fr' ? 'Non assigné' : 'Unassigned',
    departmentCount: 0,
  });

  useEffect(() => {
    const loadData = async () => {
      if (!user || !profile?.client_id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const deptId = profile.department_id;

      const [
        { count: todayCount },
        { count: monthCount },
        { count: processingCount },
        { data: recentDocs },
        { data: deptInfo },
        { count: deptDocCount },
        { data: depList },
      ] = await Promise.all([
        supabase
          .from('documents')
          .select('id', { count: 'exact', head: true })
          .eq('uploaded_by', user.id)
          .is('deleted_at', null)
          .gte('created_at', todayStart),
        supabase
          .from('documents')
          .select('id', { count: 'exact', head: true })
          .eq('uploaded_by', user.id)
          .is('deleted_at', null)
          .gte('created_at', monthStart),
        supabase
          .from('documents')
          .select('id', { count: 'exact', head: true })
          .eq('uploaded_by', user.id)
          .is('deleted_at', null)
          .in('status', ['processing', 'ocr_processing', 'pending_ocr']),
        supabase
          .from('documents')
          .select('id, title, document_type, created_at, status, departments(name)')
          .eq('uploaded_by', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(10),
        deptId
          ? supabase.from('departments').select('name').eq('id', deptId).maybeSingle()
          : Promise.resolve({ data: null } as any),
        deptId
          ? supabase
            .from('documents')
            .select('id', { count: 'exact', head: true })
            .eq('department_id', deptId)
            .is('deleted_at', null)
          : Promise.resolve({ count: 0 } as any),
        supabase
          .from('departments')
          .select('id, name, archived_at')
          .eq('client_id', profile.client_id)
          .order('name', { ascending: true }),
      ]);

      setStats({
        today: todayCount || 0,
        month: monthCount || 0,
        ocrProcessing: processingCount || 0,
        departmentName: deptInfo?.name || (language === 'fr' ? 'Non assigné' : 'Unassigned'),
        departmentCount: deptDocCount || 0,
      });

      setRecentUploads(
        (recentDocs || []).map((doc: any) => ({
          id: doc.id,
          title: doc.title,
          document_type: doc.document_type,
          created_at: doc.created_at,
          status: doc.status,
          department_name: doc.departments?.name || (language === 'fr' ? 'Général' : 'General'),
        })),
      );

      setDepartments(depList || []);
      setLoading(false);
    };

    loadData();
  }, [user, profile?.client_id, profile?.department_id, language]);

  const firstName = useMemo(() => profile?.full_name?.split(' ')[0] || (language === 'fr' ? 'IT Admin' : 'IT Admin'), [profile?.full_name, language]);

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
        <h2 className="text-2xl font-serif font-semibold">
          {language === 'fr' ? `Bienvenue, ${firstName} 👋` : `Welcome, ${firstName} 👋`}
        </h2>
        <p className="text-muted-foreground">
          {language === 'fr' ? `Votre rôle : IT Admin — Département ${stats.departmentName}` : `Your role: IT Admin — Department ${stats.departmentName}`}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-success">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{language === 'fr' ? 'Importés Aujourd’hui' : 'Uploaded Today'}</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.today}</p></CardContent>
        </Card>

        <Card className="border-l-4 border-l-info">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{language === 'fr' ? 'Importés ce Mois' : 'Uploaded This Month'}</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.month}</p></CardContent>
        </Card>

        <Card className="border-l-4 border-l-warning">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{language === 'fr' ? 'En cours de traitement OCR' : 'OCR Processing'}</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.ocrProcessing}</p></CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{language === 'fr' ? 'Mon Département' : 'My Department'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{stats.departmentName}</p>
            <p className="text-sm text-muted-foreground">{stats.departmentCount} {language === 'fr' ? 'documents' : 'documents'}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="max-w-4xl mx-auto border-2 border-dashed">
        <CardContent className="p-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <UploadIcon className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-serif font-semibold mb-2">
            {language === 'fr' ? 'Importer des Documents' : 'Upload Documents'}
          </h3>
          <p className="text-muted-foreground mb-6">
            {language === 'fr'
              ? 'Glissez-déposez vos fichiers ou cliquez pour ajouter des documents à archiver'
              : 'Drag and drop files or click to add documents for archiving'}
          </p>
          <Button className="btn-institutional" onClick={() => setUploadOpen(true)}>
            {language === 'fr' ? 'Sélectionner des fichiers' : 'Select files'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-serif">{language === 'fr' ? 'Derniers Téléversements' : 'Recent Uploads'}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentUploads.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              {language === 'fr' ? 'Aucun téléversement récent' : 'No recent uploads'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'fr' ? 'Nom' : 'Name'}</TableHead>
                  <TableHead>{language === 'fr' ? 'Type' : 'Type'}</TableHead>
                  <TableHead>{language === 'fr' ? 'Département' : 'Department'}</TableHead>
                  <TableHead>{language === 'fr' ? 'Date' : 'Date'}</TableHead>
                  <TableHead>{language === 'fr' ? 'Statut OCR' : 'OCR status'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentUploads.map((doc) => {
                  const status = statusMeta(doc.status, language);
                  return (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.title}</TableCell>
                      <TableCell className="uppercase text-muted-foreground">{doc.document_type}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {doc.department_name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(doc.created_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={status.className}>
                          <Clock3 className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <UploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        departments={departments}
        onSuccess={() => {
          // Refresh dashboard data after upload
          if (user && profile?.client_id) {
            // Re-trigger the data load by setting loading
            setLoading(true);
            setTimeout(() => {
              window.location.reload();
            }, 100);
          }
        }}
      />
    </div>
  );
}
