import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Download, Clock, Eye, FolderOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { EmptyState } from '@/components/documents/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { downloadDocument } from '@/lib/storage';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Document {
  id: string;
  title: string;
  document_type: string;
  confidentiality_level: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  current_version: number;
  file_url?: string;
  department: { name: string } | null;
  profiles: { full_name: string | null } | null;
}

export default function MyDocuments() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { language } = useLanguage();

  const [uploadedDocs, setUploadedDocs] = useState<Document[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('uploaded');

  useEffect(() => {
    if (user && profile?.client_id) {
      fetchData();
    }
  }, [user, profile?.client_id]);

  const fetchData = async () => {
    if (!user || !profile?.client_id) return;
    setLoading(true);

    try {
      // Fetch documents uploaded by the current user
      const { data: uploaded } = await supabase
        .from('documents')
        .select(`
          id, title, document_type, confidentiality_level,
          created_at, updated_at, tags, current_version, file_url,
          department:departments(name),
          profiles:profiles!documents_uploaded_by_fkey(full_name)
        `)
        .eq('uploaded_by', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50);

      setUploadedDocs((uploaded as unknown as Document[]) || []);

      // Fetch recently viewed (from activity logs)
      const { data: viewLogs } = await supabase
        .from('activity_logs')
        .select('document_id')
        .eq('user_id', user.id)
        .eq('action_type', 'view')
        .not('document_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (viewLogs && viewLogs.length > 0) {
        const uniqueIds = [...new Set(viewLogs.map(l => l.document_id).filter(Boolean))].slice(0, 10);

        const { data: viewedDocs } = await supabase
          .from('documents')
          .select(`
            id, title, document_type, confidentiality_level,
            created_at, updated_at, tags, current_version, file_url,
            department:departments(name),
            profiles:profiles!documents_uploaded_by_fkey(full_name)
          `)
          .in('id', uniqueIds as string[])
          .is('deleted_at', null);

        // Sort by the order they were viewed
        const orderedDocs = uniqueIds
          .map(id => (viewedDocs as unknown as Document[])?.find(d => d.id === id))
          .filter(Boolean) as Document[];

        setRecentlyViewed(orderedDocs);
      }
    } catch (error) {
      console.error('Error fetching my documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (id: string) => navigate(`/documents/${id}`);

  const handleDownload = async (id: string) => {
    const doc = [...uploadedDocs, ...recentlyViewed].find(d => d.id === id);
    if (!doc?.file_url) return;
    try {
      await downloadDocument(doc.file_url, doc.title);
    } catch {
      toast.error(language === 'fr' ? 'Erreur de téléchargement' : 'Download error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-serif font-semibold">
          {language === 'fr' ? 'Mes Documents' : 'My Documents'}
        </h2>
        <p className="text-muted-foreground">
          {language === 'fr'
            ? 'Vos documents uploadés et récemment consultés'
            : 'Your uploaded and recently viewed documents'}
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="uploaded" className="gap-2">
            <FileText className="h-4 w-4" />
            {language === 'fr' ? 'Mes uploads' : 'My uploads'}
            {uploadedDocs.length > 0 && (
              <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                {uploadedDocs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="recent" className="gap-2">
            <Clock className="h-4 w-4" />
            {language === 'fr' ? 'Consultés récemment' : 'Recently viewed'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="uploaded" className="mt-4">
          {uploadedDocs.length > 0 ? (
            <div className="space-y-3">
              {uploadedDocs.map(doc => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onView={handleView}
                  onDownload={handleDownload}
                />
              ))}
            </div>
          ) : (
            <EmptyState type="noDocuments" />
          )}
        </TabsContent>

        <TabsContent value="recent" className="mt-4">
          {recentlyViewed.length > 0 ? (
            <div className="space-y-3">
              {recentlyViewed.map(doc => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onView={handleView}
                  onDownload={handleDownload}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Eye className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                {language === 'fr' ? 'Aucun document consulté récemment' : 'No recently viewed documents'}
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
