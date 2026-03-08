import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Users, Building2, TrendingUp, TrendingDown, CheckCircle, XCircle, AlertTriangle, UserX, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { StatusCards } from '@/components/dashboard/StatusCards';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { ActivityTimeline } from '@/components/dashboard/ActivityTimeline';
import { RecentDocuments } from '@/components/dashboard/RecentDocuments';
import { StaffInsightsPanel } from '@/components/dashboard/StaffInsightsPanel';
import { OrganizationTrends } from '@/components/dashboard/OrganizationTrends';
import { UploadModal } from '@/components/documents/UploadModal';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { subDays, startOfDay } from 'date-fns';

interface Document {
  id: string;
  title: string;
  document_type: string;
  confidentiality_level: string;
  status?: string;
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
  user_name?: string | null;
  profiles?: { full_name: string | null; email: string } | null;
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

interface StatusStats {
  pendingValidation: number;
  archived: number;
  confidential: number;
  shared: number;
}

interface MostViewedDoc {
  id: string;
  title: string;
  document_type: string;
  confidentiality_level: string;
  view_count: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, isUltraAdmin, isSuperAdmin, isClientAdmin, canManageDocuments, isClientSuspended } = useAuth();
  const { t, language } = useLanguage();
  
  const [stats, setStats] = useState({
    totalDocuments: 0,
    totalUsers: 0,
    totalClients: 0,
  });
  const [statusStats, setStatusStats] = useState<StatusStats>({
    pendingValidation: 0,
    archived: 0,
    confidential: 0,
    shared: 0,
  });
  const [clientStatus, setClientStatus] = useState<ClientStatus>({ active: 0, inactive: 0, suspended: 0 });
  const [activityTrend, setActivityTrend] = useState({ current: 0, previous: 0, percentChange: 0 });
  const [recentDocuments, setRecentDocuments] = useState<Document[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [clientsNeedingAttention, setClientsNeedingAttention] = useState<ClientAttention[]>([]);
  const [deactivatedUsers, setDeactivatedUsers] = useState<DeactivatedUser[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string; archived_at: string | null }[]>([]);
  const [mostViewedDocs, setMostViewedDocs] = useState<MostViewedDoc[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [profile?.client_id]);

  const fetchDashboardData = async () => {
    if (!profile?.client_id && !isSuperAdmin && !isUltraAdmin) {
      setLoading(false);
      return;
    }

    try {
      // Fetch documents count (exclude trashed)
      let documentsQuery = supabase
        .from('documents')
        .select('id, status, confidentiality_level', { count: 'exact' })
        .is('deleted_at', null);
      
      if (!isUltraAdmin && !isSuperAdmin && profile?.client_id) {
        documentsQuery = documentsQuery.eq('client_id', profile.client_id);
      } else if (isSuperAdmin && profile?.client_id) {
        documentsQuery = documentsQuery.eq('client_id', profile.client_id);
      }
      
      const { data: documentsData, count: docsCount } = await documentsQuery;

      // Calculate status stats from documents data
      if (documentsData) {
        const statusCounts: StatusStats = {
          pendingValidation: 0,
          archived: 0,
          confidential: 0,
          shared: 0,
        };
        
        documentsData.forEach((doc: any) => {
          if (doc.status === 'pending_validation') statusCounts.pendingValidation++;
          if (doc.status === 'archived') statusCounts.archived++;
          if (doc.confidentiality_level === 'confidential') statusCounts.confidential++;
        });
        
        // Count shared documents (last 7 days)
        const sevenDaysAgo = startOfDay(subDays(new Date(), 7));
        const { count: sharedCount } = await supabase
          .from('shares')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', sevenDaysAgo.toISOString());
        
        statusCounts.shared = sharedCount || 0;
        setStatusStats(statusCounts);
      }

      // Ultra Admin specific data (platform-level)
      if (isUltraAdmin) {
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
      
      // Fetch recent documents for all users
      // Prioritize user's department documents first
      const userDeptId = profile?.department_id;
      
      let recentDocsQuery = supabase
        .from('documents')
        .select(`
          id,
          title,
          document_type,
          confidentiality_level,
          status,
          created_at,
          updated_at,
          tags,
          current_version,
          department_id,
          departments(name)
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(10); // Fetch more to allow sorting

      if (!isUltraAdmin && profile?.client_id) {
        recentDocsQuery = recentDocsQuery.eq('client_id', profile.client_id);
      } else if (isSuperAdmin && profile?.client_id) {
        recentDocsQuery = recentDocsQuery.eq('client_id', profile.client_id);
      }

      const { data: recentDocs } = await recentDocsQuery;
      
      // Sort to prioritize user's department documents first
      let sortedDocs = recentDocs || [];
      if (userDeptId && sortedDocs.length > 0) {
        sortedDocs = [
          ...sortedDocs.filter((d: any) => d.department_id === userDeptId),
          ...sortedDocs.filter((d: any) => d.department_id !== userDeptId),
        ].slice(0, 5);
      } else {
        sortedDocs = sortedDocs.slice(0, 5);
      }
      
      setRecentDocuments(sortedDocs as unknown as Document[]);

      // Fetch recent activity with user information
      let activityQuery = supabase
        .from('activity_logs')
        .select(`
          id,
          action_type,
          created_at,
          search_query,
          user_id,
          documents(title),
          profiles:user_id(full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!isUltraAdmin && profile?.client_id) {
        activityQuery = activityQuery.eq('client_id', profile.client_id);
      } else if (isSuperAdmin && profile?.client_id) {
        activityQuery = activityQuery.eq('client_id', profile.client_id);
      }

      const { data: activityData } = await activityQuery;

      // Fetch departments
      if (profile?.client_id) {
        const { data: depts } = await supabase
          .from('departments')
          .select('id, name, archived_at')
          .eq('client_id', profile.client_id);
        setDepartments(depts || []);

        // Fetch most viewed documents for staff (non-admin users)
        if (!isClientAdmin) {
          const thirtyDaysAgo = startOfDay(subDays(new Date(), 30));
          const { data: viewLogs } = await supabase
            .from('activity_logs')
            .select('document_id, documents(id, title, document_type, confidentiality_level)')
            .eq('action_type', 'view')
            .eq('client_id', profile.client_id)
            .gte('created_at', thirtyDaysAgo.toISOString())
            .not('document_id', 'is', null);

          if (viewLogs && viewLogs.length > 0) {
            // Count views per document
            const viewCounts: Record<string, { doc: any; count: number }> = {};
            viewLogs.forEach((log: any) => {
              if (log.document_id && log.documents) {
                if (!viewCounts[log.document_id]) {
                  viewCounts[log.document_id] = { doc: log.documents, count: 0 };
                }
                viewCounts[log.document_id].count++;
              }
            });

            // Sort by count and take top 5
            const sortedDocs = Object.entries(viewCounts)
              .map(([id, data]) => ({
                id,
                title: data.doc.title,
                document_type: data.doc.document_type,
                confidentiality_level: data.doc.confidentiality_level,
                view_count: data.count,
              }))
              .sort((a, b) => b.view_count - a.view_count)
              .slice(0, 5);

            setMostViewedDocs(sortedDocs);
          }
        }
      }

      // Stats for admins
      let usersCount = 0;
      let clientsCount = 0;

      if (isUltraAdmin || isSuperAdmin || isClientAdmin) {
        if (isUltraAdmin) {
          const { count } = await supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true });
          usersCount = count || 0;

          const { count: cCount } = await supabase
            .from('clients')
            .select('id', { count: 'exact', head: true });
          clientsCount = cCount || 0;
        } else if (isSuperAdmin && profile?.client_id) {
          const { count } = await supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', profile.client_id);
          usersCount = count || 0;
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
      // Map activity data to include user_name
      const mappedActivity = (activityData || []).map((activity: any) => ({
        ...activity,
        user_name: activity.profiles?.full_name || activity.profiles?.email?.split('@')[0] || null,
      }));
      setRecentActivity(mappedActivity as ActivityItem[]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusCardClick = (status: string) => {
    // Navigate to documents with filter
    const filterMap: Record<string, string> = {
      pendingValidation: 'status=pending_validation',
      archived: 'status=archived',
      confidential: 'confidentiality=confidential',
      shared: 'shared=recent',
    };
    navigate(`/documents?${filterMap[status] || ''}`);
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

  // Ultra Admin Dashboard (Platform overview - clients, organizations)
  if (isUltraAdmin) {
    return (
      <div className="space-y-6">
        {/* Welcome */}
        <div>
          <h2 className="text-2xl font-serif font-semibold">
            {t('dashboard.welcome')}, {profile?.full_name || 'Administrateur'}
          </h2>
          <p className="text-muted-foreground">
            {language === 'fr' ? 'Centre de contrôle de la plateforme DigiCam' : 'DigiCam Platform Control Center'}
          </p>
        </div>

        {/* Platform Health Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{language === 'fr' ? 'Organisations Actives' : 'Active Organizations'}</CardTitle>
              <Building2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clientStatus.active}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {clientStatus.inactive > 0 && `${clientStatus.inactive} ${language === 'fr' ? 'inactive(s)' : 'inactive'}`}
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{language === 'fr' ? 'Utilisateurs Totaux' : 'Total Users'}</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{language === 'fr' ? 'Documents Traités' : 'Documents Processed'}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalDocuments}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-primary hover:shadow-md transition-shadow">
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

        {/* Content Grid: Activity Feed + Attention Alerts */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Activity Feed (60%) */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-serif">
                  {language === 'fr' ? 'Activité Récente' : 'Recent Activity'}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/activity')}>
                  {language === 'fr' ? 'Voir tout →' : 'View all →'}
                </Button>
              </CardHeader>
              <CardContent>
                {recentActivity.length > 0 ? (
                  <div className="space-y-3">
                    {recentActivity.slice(0, 10).map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{activity.user_name || 'Utilisateur'}</span>
                            {' '}
                            <span className="text-muted-foreground">
                              {activity.action_type === 'view' && (language === 'fr' ? 'a consulté un document' : 'viewed a document')}
                              {activity.action_type === 'upload' && (language === 'fr' ? 'a uploadé un document' : 'uploaded a document')}
                              {activity.action_type === 'download' && (language === 'fr' ? 'a téléchargé un document' : 'downloaded a document')}
                              {activity.action_type === 'search' && (language === 'fr' ? 'a effectué une recherche' : 'performed a search')}
                              {activity.action_type === 'update' && (language === 'fr' ? 'a modifié un document' : 'updated a document')}
                              {activity.action_type === 'delete' && (language === 'fr' ? 'a supprimé un document' : 'deleted a document')}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(activity.created_at).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US', { 
                              hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' 
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>{language === 'fr' ? 'Aucune activité récente' : 'No recent activity'}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Attention Alerts (40%) */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-serif">
                  {language === 'fr' ? 'Organisations Nécessitant Attention' : 'Organizations Needing Attention'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {clientsNeedingAttention.length > 0 ? (
                  <div className="space-y-3">
                    {clientsNeedingAttention.map((client) => (
                      <div 
                        key={client.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                        onClick={() => navigate(`/clients/${client.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-10 w-10 rounded-lg flex items-center justify-center",
                            client.status === 'suspended' ? 'bg-destructive/10' : 'bg-amber-500/10'
                          )}>
                            {client.status === 'suspended' 
                              ? <AlertTriangle className="h-5 w-5 text-destructive" />
                              : <AlertTriangle className="h-5 w-5 text-amber-500" />
                            }
                          </div>
                          <div>
                            <p className="font-medium text-sm">{client.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {client.status === 'suspended' 
                                ? (language === 'fr' ? 'Suspendue' : 'Suspended')
                                : (language === 'fr' ? 'Inactivité prolongée' : 'Extended inactivity')
                              }
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(client.status)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500/30" />
                    <p className="font-medium">
                      {language === 'fr' ? '✅ Tout est normal' : '✅ All is well'}
                    </p>
                    <p className="text-sm mt-1">
                      {language === 'fr' ? 'Aucune action requise.' : 'No action required.'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Deactivated Users */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-serif">
                  {language === 'fr' ? 'Utilisateurs Désactivés' : 'Deactivated Users'}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/users?status=deactivated')}>
                  {language === 'fr' ? 'Gérer' : 'Manage'}
                </Button>
              </CardHeader>
              <CardContent>
                {deactivatedUsers.length > 0 ? (
                  <div className="space-y-3">
                    {deactivatedUsers.map((user) => (
                      <div 
                        key={user.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
                            <UserX className="h-4 w-4 text-destructive" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{user.full_name || user.email}</p>
                            <p className="text-xs text-muted-foreground">
                              {user.clients?.name || (language === 'fr' ? 'Sans organisation' : 'No organization')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <UserCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{language === 'fr' ? 'Aucun utilisateur désactivé' : 'No deactivated users'}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Empty State CTA if no orgs */}
        {stats.totalClients === 0 && (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {language === 'fr' ? 'Prêt à démarrer ?' : 'Ready to start?'}
              </h3>
              <p className="text-muted-foreground text-center mb-4 max-w-md">
                {language === 'fr' 
                  ? 'Créez votre première organisation pour commencer à gérer des documents sur la plateforme DigiCam.'
                  : 'Create your first organization to start managing documents on the DigiCam platform.'}
              </p>
              <Button 
                onClick={() => navigate('/clients')} 
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                <Building2 className="h-4 w-4 mr-2" />
                {language === 'fr' ? 'Créer une organisation →' : 'Create an organization →'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Super Admin / Client Admin / Staff Dashboard (document-focused)
  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-serif font-semibold">
          {t('dashboard.welcome')}, {profile?.full_name?.split(' ')[0] || (language === 'fr' ? 'Utilisateur' : 'User')}
        </h2>
        <p className="text-muted-foreground">
          {language === 'fr' 
            ? 'Prenez le contrôle de vos documents en 5 secondes'
            : 'Take control of your documents in 5 seconds'}
        </p>
      </div>

      {/* Status Cards */}
      <StatusCards stats={statusStats} onCardClick={handleStatusCardClick} />

      {/* Quick Actions */}
      <QuickActions 
        onImportClick={() => {
          if (isClientSuspended) return;
          setUploadModalOpen(true);
        }}
      />

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Documents */}
        <div className="lg:col-span-2">
          <RecentDocuments 
            documents={recentDocuments}
            onViewAll={() => navigate('/documents')}
            userDepartmentId={profile?.department_id}
          />
        </div>

        {/* Activity Timeline or Staff Insights Panel */}
        <div className="space-y-6">
          {(isSuperAdmin || isClientAdmin) ? (
            <ActivityTimeline activities={recentActivity} maxItems={8} />
          ) : (
            <StaffInsightsPanel 
              activities={recentActivity} 
              mostViewedDocs={mostViewedDocs} 
              maxItems={8} 
            />
          )}
          {/* Organization Trends for Super Admins and Client Admins */}
          {(isSuperAdmin || isClientAdmin) && <OrganizationTrends maxItems={5} />}
        </div>
      </div>

      {/* Upload Modal */}
      <UploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        departments={departments}
        onSuccess={() => fetchDashboardData()}
      />
    </div>
  );
}
