import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Users, FileText, Eye, Download, Search as SearchIcon, Building2, Timer, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import { format, subDays, startOfDay, endOfDay, subMonths, startOfMonth } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';

interface TopClient {
  id: string;
  name: string;
  activityCount: number;
  trend: number;
}

export default function Analytics() {
  const { user, isUltraAdmin, isSuperAdmin, isClientAdmin, profile, clientModule } = useAuth();
  const { t, language } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDocuments: 0,
    totalUsers: 0,
    activeUsers: 0,
    totalViews: 0,
    totalDownloads: 0,
    totalSearches: 0,
    searchSuccessRate: 0,
    timeSavedHours: 0,
  });
  const [activityTrend, setActivityTrend] = useState({ current: 0, previous: 0, percentChange: 0 });
  const [dailyActivity, setDailyActivity] = useState<{ date: string; count: number }[]>([]);
  const [actionDistribution, setActionDistribution] = useState<{ name: string; value: number }[]>([]);
  const [topDocuments, setTopDocuments] = useState<{ title: string; views: number }[]>([]);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [departmentActivity, setDepartmentActivity] = useState<{ name: string; activity: number }[]>([]);
  const [documentEvolution, setDocumentEvolution] = useState<{ month: string; total: number }[]>([]);

  const isRestrictedModule = clientModule === 'admin_publique';
  const hasAccess = isUltraAdmin || isSuperAdmin || (isClientAdmin && !isRestrictedModule);

  useEffect(() => {
    if (hasAccess) fetchAnalytics();
  }, [hasAccess]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const { count: docsCount } = await supabase.from('documents').select('*', { count: 'exact', head: true }).is('deleted_at', null);

      // Users
      let userQuery = supabase.from('profiles').select('id, updated_at');
      if (!isUltraAdmin && !isSuperAdmin && profile?.client_id) userQuery = userQuery.eq('client_id', profile.client_id);
      const { data: usersData } = await userQuery;
      const fallbackUserId = user?.id || profile?.id;
      const totalUsers = (usersData?.length || 0) > 0 ? (usersData?.length || 0) : fallbackUserId ? 1 : 0;

      // Active users (had activity in last 30 days)
      const thirtyDaysAgo = subDays(new Date(), 30);
      let activeQuery = supabase.from('activity_logs').select('user_id').gte('created_at', thirtyDaysAgo.toISOString());
      if (!isUltraAdmin && !isSuperAdmin && profile?.client_id) activeQuery = activeQuery.eq('client_id', profile.client_id);
      const { data: activeData } = await activeQuery;
      // Only count users that belong to the fetched user list
      const userIdSet = new Set(usersData?.map(u => u.id) || []);
      const activeUserIds = new Set((activeData?.map(a => a.user_id) || []).filter(id => userIdSet.has(id)));

      // Activity logs
      const { data: activityData } = await supabase.from('activity_logs').select('action_type, document_id, client_id, created_at');

      const views = activityData?.filter(a => a.action_type === 'view').length || 0;
      const downloads = activityData?.filter(a => a.action_type === 'download').length || 0;
      const searches = activityData?.filter(a => a.action_type === 'search').length || 0;

      // Search success rate
      const { data: searchLogs } = await supabase.from('search_logs').select('result_count');
      const totalSearchLogs = searchLogs?.length || 0;
      const successfulSearches = searchLogs?.filter(s => s.result_count > 0).length || 0;
      const searchSuccessRate = totalSearchLogs > 0 ? Math.round((successfulSearches / totalSearchLogs) * 100) : 100;
      const timeSavedHours = Math.round((successfulSearches * 28) / 60);

      setStats({
        totalDocuments: docsCount || 0,
        totalUsers,
        activeUsers: activeUserIds.size,
        totalViews: views,
        totalDownloads: downloads,
        totalSearches: searches,
        searchSuccessRate,
        timeSavedHours,
      });

      // Activity trend
      const now = new Date();
      const sevenDaysAgo = startOfDay(subDays(now, 7));
      const fourteenDaysAgo = startOfDay(subDays(now, 14));
      const currentWeek = activityData?.filter(a => new Date(a.created_at) >= sevenDaysAgo).length || 0;
      const previousWeek = activityData?.filter(a => { const d = new Date(a.created_at); return d >= fourteenDaysAgo && d < sevenDaysAgo; }).length || 0;
      const percentChange = previousWeek > 0 ? Math.round(((currentWeek - previousWeek) / previousWeek) * 100) : currentWeek > 0 ? 100 : 0;
      setActivityTrend({ current: currentWeek, previous: previousWeek, percentChange });

      // Daily activity
      setDailyActivity(Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), 6 - i);
        const count = activityData?.filter(a => {
          const d = new Date(a.created_at);
          return d >= startOfDay(date) && d <= endOfDay(date);
        }).length || 0;
        return { date: format(date, 'EEE', { locale: language === 'fr' ? fr : enUS }), count };
      }));

      // Action distribution
      setActionDistribution([
        { name: t('activity.view'), value: views },
        { name: t('activity.download'), value: downloads },
        { name: t('activity.search'), value: searches },
        { name: t('activity.upload'), value: activityData?.filter(a => a.action_type === 'upload').length || 0 },
      ]);

      // Top documents
      const documentViews: Record<string, number> = {};
      activityData?.filter(a => a.action_type === 'view' && a.document_id).forEach(a => {
        documentViews[a.document_id!] = (documentViews[a.document_id!] || 0) + 1;
      });
      const topDocIds = Object.entries(documentViews).sort(([, a], [, b]) => b - a).slice(0, 5).map(([id]) => id);
      if (topDocIds.length > 0) {
        const { data: docs } = await supabase.from('documents').select('id, title').in('id', topDocIds);
        setTopDocuments(topDocIds.map(id => ({
          title: docs?.find(d => d.id === id)?.title || 'Unknown',
          views: documentViews[id],
        })));
      }

      // Department activity
      const { data: departments } = await supabase.from('departments').select('id, name').is('archived_at', null);
      if (departments && departments.length > 0) {
        const { data: docs } = await supabase.from('documents').select('id, department_id').in('department_id', departments.map(d => d.id)).is('deleted_at', null);
        const docToDept: Record<string, string> = {};
        docs?.forEach(d => { if (d.department_id) docToDept[d.id] = d.department_id; });
        
        const deptCounts: Record<string, number> = {};
        departments.forEach(d => { deptCounts[d.id] = 0; });
        activityData?.forEach(a => {
          if (a.document_id && docToDept[a.document_id]) {
            deptCounts[docToDept[a.document_id]]++;
          }
        });
        setDepartmentActivity(departments.map(d => ({
          name: d.name.length > 10 ? d.name.slice(0, 10) + '…' : d.name,
          activity: deptCounts[d.id] || 0,
        })).sort((a, b) => b.activity - a.activity));
      }

      // Document evolution (last 6 months cumulative)
      const { data: allDocs } = await supabase.from('documents').select('created_at').is('deleted_at', null).order('created_at');
      if (allDocs && allDocs.length > 0) {
        const months: { month: string; total: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const monthStart = startOfMonth(subMonths(new Date(), i));
          const count = allDocs.filter(d => new Date(d.created_at) <= endOfDay(subDays(startOfMonth(subMonths(new Date(), i - 1)), -1))).length;
          // Actually count cumulative up to end of that month
          const endOfThisMonth = i === 0 ? new Date() : startOfMonth(subMonths(new Date(), i - 1));
          const cumulative = allDocs.filter(d => new Date(d.created_at) <= endOfThisMonth).length;
          months.push({
            month: format(monthStart, 'MMM', { locale: language === 'fr' ? fr : enUS }),
            total: cumulative,
          });
        }
        setDocumentEvolution(months);
      }

      // Top clients (Ultra Admin only)
      if (isUltraAdmin) {
        const clientActivity: Record<string, { current: number; previous: number }> = {};
        activityData?.forEach(a => {
          if (!a.client_id) return;
          if (!clientActivity[a.client_id]) clientActivity[a.client_id] = { current: 0, previous: 0 };
          const d = new Date(a.created_at);
          if (d >= sevenDaysAgo) clientActivity[a.client_id].current++;
          else if (d >= fourteenDaysAgo) clientActivity[a.client_id].previous++;
        });
        const topClientIds = Object.entries(clientActivity).sort(([, a], [, b]) => (b.current + b.previous) - (a.current + a.previous)).slice(0, 5).map(([id]) => id);
        if (topClientIds.length > 0) {
          const { data: clientsData } = await supabase.from('clients').select('id, name').in('id', topClientIds);
          setTopClients(topClientIds.map(id => {
            const client = clientsData?.find(c => c.id === id);
            const activity = clientActivity[id];
            const trend = activity.previous > 0 ? Math.round(((activity.current - activity.previous) / activity.previous) * 100) : activity.current > 0 ? 100 : 0;
            return { id, name: client?.name || 'Unknown', activityCount: activity.current + activity.previous, trend };
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

  if (!hasAccess) return <Navigate to="/dashboard" replace />;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">{t('common.loading')}</p></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-serif font-semibold">{t('nav.analytics')}</h2>
        <p className="text-muted-foreground">{language === 'fr' ? 'Vue d\'ensemble des statistiques et de l\'utilisation' : 'Overview of statistics and usage'}</p>
      </div>

      {/* Stats Cards - Redesigned */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{language === 'fr' ? 'Documents Archivés' : 'Archived Documents'}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.totalDocuments}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{language === 'fr' ? 'Utilisateurs Actifs' : 'Active Users'}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsers}<span className="text-sm font-normal text-muted-foreground">/{stats.totalUsers}</span></div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{language === 'fr' ? 'Recherches ce mois' : 'Searches this month'}</CardTitle>
            <SearchIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.totalSearches}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{language === 'fr' ? 'Taux de Succès' : 'Success Rate'}</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.searchSuccessRate}%</div></CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{language === 'fr' ? 'Heures Économisées' : 'Hours Saved'}</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.timeSavedHours}h</div></CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {language === 'fr' ? 'Activité des 7 derniers jours' : 'Activity (Last 7 Days)'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyActivity}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Actions" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {language === 'fr' ? 'Distribution des actions' : 'Action Distribution'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={actionDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                    {actionDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 - NEW */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Department Activity Bar Chart */}
        {departmentActivity.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {language === 'fr' ? 'Activité par Département' : 'Activity by Department'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentActivity} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} width={100} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Bar dataKey="activity" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} name={language === 'fr' ? 'Actions' : 'Actions'} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Document Evolution Area Chart */}
        {documentEvolution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {language === 'fr' ? 'Évolution des Documents' : 'Document Evolution'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={documentEvolution}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.1)" name="Documents" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bottom Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{language === 'fr' ? 'Documents les plus consultés' : 'Most Viewed Documents'}</CardTitle>
          </CardHeader>
          <CardContent>
            {topDocuments.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">{language === 'fr' ? 'Aucune donnée disponible' : 'No data available'}</p>
            ) : (
              <div className="space-y-4">
                {topDocuments.map((doc, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">{index + 1}</div>
                    <div className="flex-1 min-w-0"><p className="font-medium truncate">{doc.title}</p></div>
                    <div className="flex items-center gap-1 text-muted-foreground"><Eye className="h-4 w-4" /><span>{doc.views}</span></div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {isUltraAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {language === 'fr' ? 'Clients les plus actifs' : 'Most Active Clients'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topClients.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{language === 'fr' ? 'Aucune donnée disponible' : 'No data available'}</p>
              ) : (
                <div className="space-y-4">
                  {topClients.map((client, index) => (
                    <div key={client.id} className="flex items-center gap-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">{index + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{client.name}</p>
                        <p className="text-xs text-muted-foreground">{client.activityCount} actions</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {client.trend >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
                        <span className={client.trend >= 0 ? 'text-green-600' : 'text-destructive'}>{client.trend >= 0 ? '+' : ''}{client.trend}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
