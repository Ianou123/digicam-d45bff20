import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Users, FileText, Eye, Download, Search as SearchIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

export default function Analytics() {
  const { isSuperAdmin, isClientAdmin, profile } = useAuth();
  const { t, language } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDocuments: 0,
    totalUsers: 0,
    totalViews: 0,
    totalDownloads: 0,
    totalSearches: 0,
  });
  const [dailyActivity, setDailyActivity] = useState<{ date: string; count: number }[]>([]);
  const [actionDistribution, setActionDistribution] = useState<{ name: string; value: number }[]>([]);
  const [topDocuments, setTopDocuments] = useState<{ title: string; views: number }[]>([]);

  useEffect(() => {
    if (isSuperAdmin || isClientAdmin) {
      fetchAnalytics();
    }
  }, [isSuperAdmin, isClientAdmin]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch total documents
      const { count: docsCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true });

      // Fetch total users (profiles in org)
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch activity logs for stats
      const { data: activityData } = await supabase
        .from('activity_logs')
        .select('action_type, document_id, created_at');

      const views = activityData?.filter(a => a.action_type === 'view').length || 0;
      const downloads = activityData?.filter(a => a.action_type === 'download').length || 0;
      const searches = activityData?.filter(a => a.action_type === 'search').length || 0;

      setStats({
        totalDocuments: docsCount || 0,
        totalUsers: usersCount || 0,
        totalViews: views,
        totalDownloads: downloads,
        totalSearches: searches,
      });

      // Calculate daily activity for last 7 days
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), 6 - i);
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);
        const count = activityData?.filter(a => {
          const activityDate = new Date(a.created_at);
          return activityDate >= dayStart && activityDate <= dayEnd;
        }).length || 0;

        return {
          date: format(date, 'EEE', { locale: language === 'fr' ? fr : enUS }),
          count,
        };
      });
      setDailyActivity(last7Days);

      // Action distribution
      const actionCounts = {
        [t('activity.view')]: views,
        [t('activity.download')]: downloads,
        [t('activity.search')]: searches,
        [t('activity.upload')]: activityData?.filter(a => a.action_type === 'upload').length || 0,
      };
      setActionDistribution(
        Object.entries(actionCounts).map(([name, value]) => ({ name, value }))
      );

      // Top viewed documents
      const documentViews: Record<string, number> = {};
      activityData?.filter(a => a.action_type === 'view' && a.document_id).forEach(a => {
        documentViews[a.document_id!] = (documentViews[a.document_id!] || 0) + 1;
      });

      const topDocIds = Object.entries(documentViews)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([id]) => id);

      if (topDocIds.length > 0) {
        const { data: docs } = await supabase
          .from('documents')
          .select('id, title')
          .in('id', topDocIds);

        const topDocsWithViews = topDocIds.map(id => {
          const doc = docs?.find(d => d.id === id);
          return {
            title: doc?.title || 'Unknown',
            views: documentViews[id],
          };
        });
        setTopDocuments(topDocsWithViews);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

  if (!isSuperAdmin && !isClientAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-serif font-semibold">{t('nav.analytics')}</h2>
        <p className="text-muted-foreground">
          {language === 'fr' 
            ? 'Vue d\'ensemble des statistiques et de l\'utilisation'
            : 'Overview of statistics and usage'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('dashboard.totalDocuments')}
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDocuments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('users.title')}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('activity.view')}
            </CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalViews}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('activity.download')}
            </CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDownloads}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('activity.search')}
            </CardTitle>
            <SearchIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSearches}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily Activity Chart */}
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
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                    name={language === 'fr' ? 'Actions' : 'Actions'}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Action Distribution Pie Chart */}
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
                  <Pie
                    data={actionDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {actionDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Documents */}
      <Card>
        <CardHeader>
          <CardTitle>
            {language === 'fr' ? 'Documents les plus consultés' : 'Most Viewed Documents'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topDocuments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {language === 'fr' ? 'Aucune donnée disponible' : 'No data available'}
            </p>
          ) : (
            <div className="space-y-4">
              {topDocuments.map((doc, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.title}</p>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    <span>{doc.views}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
