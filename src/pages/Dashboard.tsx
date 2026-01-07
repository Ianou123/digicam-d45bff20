import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Users, Building2, TrendingUp, TrendingDown, HardDrive, CheckCircle, XCircle, AlertTriangle, UserX, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { UploadModal } from '@/components/documents/UploadModal';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { subDays, startOfDay, endOfDay } from 'date-fns';

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
  search_query?: string | null;
  documents: { title: string } | null;
}

interface ClientStatus {
  active: number;
  inactive: number;
  suspended: number;
}

interface ClientAttention {
  id: string;
  name: string;
  status: string;
  last_activity_at: string | null;
}

interface DeactivatedUser {
  id: string;
  email: string;
  full_name: string | null;
  client_id: string | null;
  clients: { name: string } | null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, isSuperAdmin, isClientAdmin, canManageDocuments } = useAuth();
  const { t, language } = useLanguage();
  
  const [stats, setStats] = useState({
    totalDocuments: 0,
    totalUsers: 0,
    totalClients: 0,
  });
  const [clientStatus, setClientStatus] = useState<ClientStatus>({ active: 0, inactive: 0, suspended: 0 });
  const [activityTrend, setActivityTrend] = useState({ current: 0, previous: 0, percentChange: 0 });
  const [recentDocuments, setRecentDocuments] = useState<Document[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [clientsNeedingAttention, setClientsNeedingAttention] = useState<ClientAttention[]>([]);
  const [deactivatedUsers, setDeactivatedUsers] = useState<DeactivatedUser[]>([]);
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
      // Fetch documents count (exclude trashed)
      let documentsQuery = supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null);
      
      if (!isSuperAdmin && profile?.client_id) {
        documentsQuery = documentsQuery.eq('client_id', profile.client_id);
      }
      
      const { count: docsCount } = await documentsQuery;

      // Super Admin specific data
      if (isSuperAdmin) {
        // Fetch client status counts
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, name, status, last_activity_at');

        if (clientsData) {
          const statusCounts: ClientStatus = { active: 0, inactive: 0, suspended: 0 };
          clientsData.forEach(c => {
            const status = c.status as 'active' | 'inactive' | 'suspended';
            if (statusCounts[status] !== undefined) {
              statusCounts[status]++;
            }
          });
          setClientStatus(statusCounts);

          // Clients needing attention (suspended or inactive for 30+ days)
          const thirtyDaysAgo = subDays(new Date(), 30);
          const attentionClients = clientsData
            .filter(c => 
              c.status === 'suspended' || 
              c.status === 'inactive' ||
              (c.last_activity_at && new Date(c.last_activity_at) < thirtyDaysAgo)
            )
            .slice(0, 5);
          setClientsNeedingAttention(attentionClients);
        }

        // Fetch deactivated users
        const { data: deactivatedUsersData } = await supabase
          .from('profiles')
          .select('id, email, full_name, client_id, clients(name)')
          .eq('status', 'deactivated')
          .limit(5);
        
        setDeactivatedUsers((deactivatedUsersData || []) as unknown as DeactivatedUser[]);

        // Fetch activity trend (last 7 days vs previous 7 days)
        const now = new Date();
        const sevenDaysAgo = startOfDay(subDays(now, 7));
        const fourteenDaysAgo = startOfDay(subDays(now, 14));

        const { count: currentWeekCount } = await supabase
          .from('activity_logs')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', sevenDaysAgo.toISOString());

        const { count: previousWeekCount } = await supabase
          .from('activity_logs')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', fourteenDaysAgo.toISOString())
          .lt('created_at', sevenDaysAgo.toISOString());

        const current = currentWeekCount || 0;
        const previous = previousWeekCount || 0;
        const percentChange = previous > 0 
          ? Math.round(((current - previous) / previous) * 100)
          : current > 0 ? 100 : 0;

        setActivityTrend({ current, previous, percentChange });
      }
      
      // Non-Super Admin: fetch recent documents
      if (!isSuperAdmin) {
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
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(5);

        if (profile?.client_id) {
          recentDocsQuery = recentDocsQuery.eq('client_id', profile.client_id);
        }

        const { data: recentDocs } = await recentDocsQuery;
        setRecentDocuments((recentDocs || []) as unknown as Document[]);
      }

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
      setRecentActivity((activityData || []) as unknown as ActivityItem[]);
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
    console.log('Download:', id);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-600 border-green-200">{language === 'fr' ? 'Actif' : 'Active'}</Badge>;
      case 'inactive':
        return <Badge variant="secondary">{language === 'fr' ? 'Inactif' : 'Inactive'}</Badge>;
      case 'suspended':
        return <Badge variant="destructive">{language === 'fr' ? 'Suspendu' : 'Suspended'}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Super Admin Dashboard
  if (isSuperAdmin) {
    return (
      <div className="space-y-6">
        {/* Welcome */}
        <div>
          <h2 className="text-2xl font-serif font-semibold">
            {t('dashboard.welcome')}, {profile?.full_name || 'Administrateur'}
          </h2>
          <p className="text-muted-foreground">
            {language === 'fr' ? 'Vue d\'ensemble de la plateforme' : 'Platform overview'}
          </p>
        </div>

        {/* Client Status Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{language === 'fr' ? 'Clients actifs' : 'Active Clients'}</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clientStatus.active}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-muted">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{language === 'fr' ? 'Clients inactifs' : 'Inactive Clients'}</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clientStatus.inactive}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-destructive">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{language === 'fr' ? 'Clients suspendus' : 'Suspended Clients'}</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clientStatus.suspended}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{language === 'fr' ? 'Activité (7j)' : 'Activity (7d)'}</CardTitle>
              {activityTrend.percentChange >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activityTrend.current}</div>
              <p className="text-xs text-muted-foreground">
                {activityTrend.percentChange >= 0 ? '+' : ''}{activityTrend.percentChange}% {language === 'fr' ? 'vs sem. préc.' : 'vs prev week'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatsCard
            title={t('dashboard.totalDocuments')}
            value={stats.totalDocuments}
            icon={FileText}
          />
          <StatsCard
            title={t('nav.users')}
            value={stats.totalUsers}
            icon={Users}
          />
          <StatsCard
            title={t('nav.clients')}
            value={stats.totalClients}
            icon={Building2}
          />
        </div>

        {/* Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Clients Needing Attention */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-serif">
                  {language === 'fr' ? 'Clients nécessitant attention' : 'Clients Needing Attention'}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/clients')}>
                  {language === 'fr' ? 'Voir tous' : 'View all'}
                </Button>
              </CardHeader>
              <CardContent>
                {clientsNeedingAttention.length > 0 ? (
                  <div className="space-y-3">
                    {clientsNeedingAttention.map((client) => (
                      <div 
                        key={client.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                        onClick={() => navigate('/clients')}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{client.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {client.last_activity_at 
                                ? `${language === 'fr' ? 'Dernière activité' : 'Last activity'}: ${new Date(client.last_activity_at).toLocaleDateString()}`
                                : language === 'fr' ? 'Aucune activité' : 'No activity'}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(client.status)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>{language === 'fr' ? 'Tous les clients sont en bonne santé' : 'All clients are healthy'}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Deactivated Users */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-serif">
                  {t('deactivation.deactivatedUsers')}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/users')}>
                  {language === 'fr' ? 'Voir tous' : 'View all'}
                </Button>
              </CardHeader>
              <CardContent>
                {deactivatedUsers.length > 0 ? (
                  <div className="space-y-3">
                    {deactivatedUsers.map((user) => (
                      <div 
                        key={user.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                        onClick={() => navigate('/users')}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                            <UserX className="h-5 w-5 text-destructive" />
                          </div>
                          <div>
                            <p className="font-medium">{user.full_name || user.email}</p>
                            <p className="text-xs text-muted-foreground">
                              {user.clients?.name || (language === 'fr' ? 'Aucune organisation' : 'No organization')}
                            </p>
                          </div>
                        </div>
                        <Badge variant="destructive">{t('deactivation.deactivated')}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>{t('deactivation.noDeactivatedUsers')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Activity */}
          <div>
            <RecentActivity 
              activities={recentActivity} 
              showUser={true}
            />
          </div>
        </div>
      </div>
    );
  }

  // Client Admin / Staff Dashboard (unchanged)
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
            <FileText className="h-4 w-4 mr-2" />
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
        {isClientAdmin && (
          <StatsCard
            title={t('nav.users')}
            value={stats.totalUsers}
            icon={Users}
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
                      profiles: null,
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
                      <FileText className="h-4 w-4 mr-2" />
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
            showUser={isClientAdmin}
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
