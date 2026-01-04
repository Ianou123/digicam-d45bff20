import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Users, Building2, TrendingUp, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { UploadModal } from '@/components/documents/UploadModal';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

interface Document {
  id: string;
  title: string;
  document_type: string;
  confidentiality_level: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  current_version: number;
  departments: { name: string } | null;
}

interface ActivityItem {
  id: string;
  action_type: string;
  created_at: string;
  search_query?: string;
  documents: { title: string } | null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, isSuperAdmin, isClientAdmin, canManageDocuments } = useAuth();
  const { t } = useLanguage();
  
  const [stats, setStats] = useState({
    totalDocuments: 0,
    totalUsers: 0,
    totalClients: 0,
  });
  const [recentDocuments, setRecentDocuments] = useState<Document[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [profile?.client_id]);

  const fetchDashboardData = async () => {
    if (!profile?.client_id && !isSuperAdmin) {
      setLoading(false);
      return;
    }

    try {
      // Fetch documents count
      let documentsQuery = supabase
        .from('documents')
        .select('id', { count: 'exact', head: true });
      
      if (!isSuperAdmin && profile?.client_id) {
        documentsQuery = documentsQuery.eq('client_id', profile.client_id);
      }
      
      const { count: docsCount } = await documentsQuery;
      
      // Fetch recent documents
      let recentDocsQuery = supabase
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
          departments(name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!isSuperAdmin && profile?.client_id) {
        recentDocsQuery = recentDocsQuery.eq('client_id', profile.client_id);
      }

      const { data: recentDocs } = await recentDocsQuery;

      // Fetch recent activity
      let activityQuery = supabase
        .from('activity_logs')
        .select(`
          id,
          action_type,
          created_at,
          search_query,
          documents(title)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!isSuperAdmin && profile?.client_id) {
        activityQuery = activityQuery.eq('client_id', profile.client_id);
      }

      const { data: activityData } = await activityQuery;

      // Fetch departments
      if (profile?.client_id) {
        const { data: depts } = await supabase
          .from('departments')
          .select('id, name')
          .eq('client_id', profile.client_id);
        setDepartments(depts || []);
      }

      // Stats for admins
      let usersCount = 0;
      let clientsCount = 0;

      if (isSuperAdmin || isClientAdmin) {
        if (isSuperAdmin) {
          const { count } = await supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true });
          usersCount = count || 0;

          const { count: cCount } = await supabase
            .from('clients')
            .select('id', { count: 'exact', head: true });
          clientsCount = cCount || 0;
        } else if (profile?.client_id) {
          const { count } = await supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', profile.client_id);
          usersCount = count || 0;
        }
      }

      setStats({
        totalDocuments: docsCount || 0,
        totalUsers: usersCount,
        totalClients: clientsCount,
      });
      setRecentDocuments(recentDocs as Document[] || []);
      setRecentActivity(activityData as ActivityItem[] || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocument = (id: string) => {
    navigate(`/documents/${id}`);
  };

  const handleDownloadDocument = async (id: string) => {
    // Implementation for download
    console.log('Download:', id);
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
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-semibold">
            {t('dashboard.welcome')}, {profile?.full_name || 'Utilisateur'}
          </h2>
          <p className="text-muted-foreground">
            Voici un aperçu de votre espace documentaire
          </p>
        </div>
        {canManageDocuments && (
          <Button onClick={() => setUploadModalOpen(true)} className="btn-institutional">
            <Plus className="h-4 w-4 mr-2" />
            {t('documents.newDocument')}
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title={t('dashboard.totalDocuments')}
          value={stats.totalDocuments}
          icon={FileText}
          trend={{ value: 12, isPositive: true }}
        />
        {(isSuperAdmin || isClientAdmin) && (
          <StatsCard
            title={t('nav.users')}
            value={stats.totalUsers}
            icon={Users}
          />
        )}
        {isSuperAdmin && (
          <StatsCard
            title={t('nav.clients')}
            value={stats.totalClients}
            icon={Building2}
          />
        )}
        <StatsCard
          title="Ce mois"
          value={recentDocuments.length}
          icon={TrendingUp}
          description="Documents ajoutés"
        />
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Documents */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-serif">
                {t('dashboard.recentDocuments')}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/documents')}>
                Voir tout
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentDocuments.length > 0 ? (
                recentDocuments.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={{
                      ...doc,
                      department: doc.departments,
                      profiles: doc.profiles,
                    }}
                    onView={handleViewDocument}
                    onDownload={handleDownloadDocument}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>{t('documents.noDocuments')}</p>
                  {canManageDocuments && (
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
            </CardContent>
          </Card>
        </div>

        {/* Activity */}
        <div>
          <RecentActivity 
            activities={recentActivity} 
            showUser={isSuperAdmin || isClientAdmin}
          />
        </div>
      </div>

      {/* Upload Modal */}
      <UploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        departments={departments}
        onSuccess={fetchDashboardData}
      />
    </div>
  );
}