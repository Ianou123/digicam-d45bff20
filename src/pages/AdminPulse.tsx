import { useState, useEffect, useMemo } from 'react';
import { 
  Search, FileQuestion, TrendingDown, Building2, AlertTriangle,
  Calendar, Eye, Users, Loader2, FileText, Clock, Upload,
  Target, Timer, Archive, Activity, CheckCircle2, ArrowRight, Download as DownloadIcon
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format, subDays, differenceInDays } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface SearchWithNoResults {
  query_text: string;
  search_count: number;
  last_searched: string;
}

interface DepartmentActivity {
  department_id: string;
  department_name: string;
  total_views: number;
  total_downloads: number;
  total_uploads: number;
  total_searches: number;
  user_count: number;
}

interface PopularDocument {
  id: string;
  title: string;
  views: number;
  downloads: number;
}

interface PopularSearch {
  query: string;
  count: number;
}

export default function AdminPulse() {
  const navigate = useNavigate();
  const { user, profile, isClientAdmin, isSuperAdmin } = useAuth();
  const { language } = useLanguage();
  const dateLocale = language === 'fr' ? fr : enUS;
  
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30');
  
  const [failedSearches, setFailedSearches] = useState<SearchWithNoResults[]>([]);
  const [departmentActivity, setDepartmentActivity] = useState<DepartmentActivity[]>([]);
  const [popularDocuments, setPopularDocuments] = useState<PopularDocument[]>([]);
  const [popularSearches, setPopularSearches] = useState<PopularSearch[]>([]);
  const [metrics, setMetrics] = useState({
    totalSearches: 0,
    successfulSearches: 0,
    failedSearchRate: 0,
    timeSavedMinutes: 0,
    totalDocuments: 0,
    totalPages: 0,
    activeUsers: 0,
    totalUsers: 0,
    healthScore: 0,
  });

  useEffect(() => {
    if (profile?.client_id || isSuperAdmin) {
      fetchAllData();
    }
  }, [profile?.client_id, isSuperAdmin, timeRange]);

  useEffect(() => {
    const timeout = setTimeout(() => { if (loading) setLoading(false); }, 15000);
    return () => clearTimeout(timeout);
  }, [loading]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.allSettled([
      fetchFailedSearches(),
      fetchDepartmentActivity(),
      fetchPopularDocuments(),
      fetchHealthMetrics(),
    ]);
    setLoading(false);
  };

  const fetchFailedSearches = async () => {
    try {
      const startDate = subDays(new Date(), parseInt(timeRange)).toISOString();
      let query = supabase.from('search_logs').select('query_text, result_count, created_at')
        .gte('created_at', startDate).order('created_at', { ascending: false });
      if (!isSuperAdmin && profile?.client_id) query = query.eq('client_id', profile.client_id);
      const { data: searchLogs } = await query;

      if (searchLogs) {
        const queryMap: Record<string, { count: number; lastSearched: string }> = {};
        let totalSearches = 0, failedCount = 0;
        const allSearches: Record<string, number> = {};

        searchLogs.forEach(log => {
          totalSearches++;
          const normalized = log.query_text.toLowerCase().trim();
          allSearches[normalized] = (allSearches[normalized] || 0) + 1;
          if (log.result_count === 0) {
            failedCount++;
            if (!queryMap[normalized]) queryMap[normalized] = { count: 0, lastSearched: log.created_at };
            queryMap[normalized].count++;
            if (new Date(log.created_at) > new Date(queryMap[normalized].lastSearched)) {
              queryMap[normalized].lastSearched = log.created_at;
            }
          }
        });

        setFailedSearches(
          Object.entries(queryMap)
            .map(([q, d]) => ({ query_text: q, search_count: d.count, last_searched: d.lastSearched }))
            .sort((a, b) => b.search_count - a.search_count)
            .slice(0, 10)
        );

        setPopularSearches(
          Object.entries(allSearches)
            .map(([q, c]) => ({ query: q, count: c }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
        );

        const successRate = totalSearches > 0 ? ((totalSearches - failedCount) / totalSearches) : 1;
        setMetrics(prev => ({
          ...prev,
          totalSearches,
          successfulSearches: totalSearches - failedCount,
          failedSearchRate: totalSearches > 0 ? Math.round((failedCount / totalSearches) * 100) : 0,
          timeSavedMinutes: Math.round((totalSearches - failedCount) * 28),
        }));
      }
    } catch (error) {
      console.error('Error fetching failed searches:', error);
    }
  };

  const fetchPopularDocuments = async () => {
    try {
      const startDate = subDays(new Date(), parseInt(timeRange)).toISOString();
      let query = supabase.from('activity_logs').select('document_id, action_type')
        .in('action_type', ['view', 'download']).not('document_id', 'is', null)
        .gte('created_at', startDate);
      if (!isSuperAdmin && profile?.client_id) query = query.eq('client_id', profile.client_id);
      const { data: logs } = await query;

      if (logs && logs.length > 0) {
        const docStats: Record<string, { views: number; downloads: number }> = {};
        logs.forEach(l => {
          if (!l.document_id) return;
          if (!docStats[l.document_id]) docStats[l.document_id] = { views: 0, downloads: 0 };
          if (l.action_type === 'view') docStats[l.document_id].views++;
          else docStats[l.document_id].downloads++;
        });

        const topIds = Object.entries(docStats)
          .sort(([, a], [, b]) => (b.views + b.downloads) - (a.views + a.downloads))
          .slice(0, 10).map(([id]) => id);

        const { data: docs } = await supabase.from('documents').select('id, title').in('id', topIds);
        setPopularDocuments(topIds.map(id => ({
          id,
          title: docs?.find(d => d.id === id)?.title || 'Unknown',
          ...docStats[id],
        })));
      }
    } catch (error) {
      console.error('Error fetching popular documents:', error);
    }
  };

  const fetchDepartmentActivity = async () => {
    try {
      let deptQuery = supabase.from('departments').select('id, name').is('archived_at', null);
      if (!isSuperAdmin && profile?.client_id) deptQuery = deptQuery.eq('client_id', profile.client_id);
      const { data: departments } = await deptQuery;

      if (departments && departments.length > 0) {
        const startDate = subDays(new Date(), parseInt(timeRange)).toISOString();
        const { data: docs } = await supabase.from('documents').select('id, department_id')
          .in('department_id', departments.map(d => d.id)).is('deleted_at', null);

        const docToDept: Record<string, string> = {};
        docs?.forEach(d => { if (d.department_id) docToDept[d.id] = d.department_id; });

        const docIds = docs?.map(d => d.id) || [];
        const { data: activityLogs } = docIds.length > 0
          ? await supabase.from('activity_logs').select('action_type, document_id').in('document_id', docIds).gte('created_at', startDate)
          : { data: [] };

        const { data: profiles } = await supabase.from('profiles').select('id, department_id').not('department_id', 'is', null) as any;

        const deptMap: Record<string, DepartmentActivity> = {};
        departments.forEach(dept => {
          deptMap[dept.id] = { department_id: dept.id, department_name: dept.name, total_views: 0, total_downloads: 0, total_uploads: 0, total_searches: 0, user_count: 0 };
        });

        activityLogs?.forEach(log => {
          if (log.document_id) {
            const deptId = docToDept[log.document_id];
            if (deptId && deptMap[deptId]) {
              if (log.action_type === 'view') deptMap[deptId].total_views++;
              if (log.action_type === 'download') deptMap[deptId].total_downloads++;
              if (log.action_type === 'upload') deptMap[deptId].total_uploads++;
            }
          }
        });

        (profiles as any[])?.forEach((p: any) => {
          if (p.department_id && deptMap[p.department_id]) deptMap[p.department_id].user_count++;
        });

        setDepartmentActivity(Object.values(deptMap).sort((a, b) => (b.total_views + b.total_downloads) - (a.total_views + a.total_downloads)));
      }
    } catch (error) {
      console.error('Error fetching department activity:', error);
    }
  };

  const fetchHealthMetrics = async () => {
    try {
      // Total docs
      let docQuery = supabase.from('documents').select('*', { count: 'exact', head: true }).is('deleted_at', null);
      if (!isSuperAdmin && profile?.client_id) docQuery = docQuery.eq('client_id', profile.client_id);
      const { count: totalDocs } = await docQuery;

      // Total users + active users (logged in last 30 days)
      let userQuery = supabase.from('profiles').select('id, updated_at');
      if (!isSuperAdmin && profile?.client_id) userQuery = userQuery.eq('client_id', profile.client_id);
      const { data: users } = await userQuery;

      // Only count users that are in the org (exclude ultra_admins)
      const userIds = users?.map(u => u.id) || [];
      // Filter out ultra_admin users
      let filteredUserIds = userIds;
      if (userIds.length > 0) {
        const { data: ultraRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'ultra_admin').in('user_id', userIds);
        const ultraIds = new Set(ultraRoles?.map(r => r.user_id) || []);
        filteredUserIds = userIds.filter(id => !ultraIds.has(id));
      }

      const fallbackUserId = user?.id || profile?.id;
      if (filteredUserIds.length === 0 && fallbackUserId) {
        filteredUserIds = [fallbackUserId];
      }
      const totalUsers = filteredUserIds.length;

      const thirtyDaysAgo = subDays(new Date(), 30);
      let activeQuery = supabase.from('activity_logs').select('user_id').gte('created_at', thirtyDaysAgo.toISOString());
      if (!isSuperAdmin && profile?.client_id) activeQuery = activeQuery.eq('client_id', profile.client_id);
      const { data: activeData } = await activeQuery;
      const filteredSet = new Set(filteredUserIds);
      const activeUserIds = new Set((activeData?.map(a => a.user_id) || []).filter(id => filteredSet.has(id)));

      // Fetch search metrics fresh for health score (don't rely on stale state)
      const startDate = subDays(new Date(), parseInt(timeRange)).toISOString();
      let searchQuery = supabase.from('search_logs').select('result_count').gte('created_at', startDate);
      if (!isSuperAdmin && profile?.client_id) searchQuery = searchQuery.eq('client_id', profile.client_id);
      const { data: healthSearchLogs } = await searchQuery;
      const healthTotalSearches = healthSearchLogs?.length || 0;
      const healthSuccessful = healthSearchLogs?.filter(s => s.result_count > 0).length || 0;
      const searchSuccessRate = healthTotalSearches > 0 ? (healthSuccessful / healthTotalSearches) * 100 : 0;

      // Health score calculation — show -1 (no data) when platform is empty
      const hasData = (totalDocs || 0) > 0 || healthTotalSearches > 0 || activeUserIds.size > 0;
      let healthScore = -1;
      if (hasData) {
        const storageScore = Math.min(100, ((totalDocs || 0) / 50) * 100);
        const adoptionRate = totalUsers > 0 ? (activeUserIds.size / totalUsers) * 100 : 0;
        const archiveCoverage = searchSuccessRate;
        healthScore = Math.round((storageScore * 0.2) + (searchSuccessRate * 0.3) + (adoptionRate * 0.25) + (archiveCoverage * 0.25));
        healthScore = Math.min(100, Math.max(0, healthScore));
      }

      setMetrics(prev => ({
        ...prev,
        totalDocuments: totalDocs || 0,
        totalUsers,
        activeUsers: activeUserIds.size,
        healthScore,
      }));
    } catch (error) {
      console.error('Error fetching health metrics:', error);
    }
  };

  if (!isClientAdmin && !isSuperAdmin) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">{language === 'fr' ? 'Accès réservé aux administrateurs' : 'Admin access only'}</p>
      </div>
    );
  }

  const maxActivity = Math.max(...departmentActivity.map(d => d.total_views + d.total_downloads), 1);
  const timeSavedHours = Math.round(metrics.timeSavedMinutes / 60);
  const noHealthData = metrics.healthScore === -1;
  const healthColor = noHealthData ? 'text-muted-foreground' : metrics.healthScore >= 80 ? 'text-green-600' : metrics.healthScore >= 60 ? 'text-amber-600' : 'text-destructive';
  const healthLabel = noHealthData
    ? (language === 'fr' ? 'Aucune donnée' : 'No data')
    : metrics.healthScore >= 80
      ? (language === 'fr' ? 'Excellent' : 'Excellent')
      : metrics.healthScore >= 60
        ? (language === 'fr' ? 'À améliorer' : 'Needs improvement')
        : (language === 'fr' ? 'Action requise' : 'Action required');
  const healthBg = noHealthData ? 'bg-muted' : metrics.healthScore >= 80 ? 'bg-green-500' : metrics.healthScore >= 60 ? 'bg-amber-500' : 'bg-destructive';

  const deptChartData = departmentActivity.map(d => ({
    name: d.department_name.length > 12 ? d.department_name.slice(0, 12) + '…' : d.department_name,
    consultations: d.total_views,
    downloads: d.total_downloads,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-semibold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            {language === 'fr' ? 'Pulse Admin' : 'Admin Pulse'}
          </h2>
          <p className="text-muted-foreground">
            {language === 'fr' ? 'Intelligence d\'usage et santé de votre archive' : 'Usage intelligence & archive health'}
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">{language === 'fr' ? '7 derniers jours' : 'Last 7 days'}</SelectItem>
            <SelectItem value="30">{language === 'fr' ? '30 derniers jours' : 'Last 30 days'}</SelectItem>
            <SelectItem value="90">{language === 'fr' ? '90 derniers jours' : 'Last 90 days'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Section 2: Efficacité de la Numérisation */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-primary">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{language === 'fr' ? 'Temps économisé' : 'Time Saved'}</p>
                    <p className="text-2xl font-bold">{timeSavedHours}h</p>
                    <p className="text-xs text-muted-foreground">{language === 'fr' ? 'grâce à DigiCam' : 'with DigiCam'}</p>
                  </div>
                  <Timer className="h-8 w-8 text-primary/30" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{language === 'fr' ? 'Taux de complétude' : 'Completion Rate'}</p>
                    <p className="text-2xl font-bold">{metrics.totalSearches > 0 ? (100 - metrics.failedSearchRate) : 100}%</p>
                    <p className="text-xs text-muted-foreground">{language === 'fr' ? 'recherches réussies' : 'successful searches'}</p>
                  </div>
                  <Target className="h-8 w-8 text-green-500/30" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{language === 'fr' ? 'Recherches échouées' : 'Failed Searches'}</p>
                    <p className="text-2xl font-bold text-amber-600">{metrics.failedSearchRate}%</p>
                    <p className="text-xs text-muted-foreground">{failedSearches.length} {language === 'fr' ? 'termes uniques' : 'unique terms'}</p>
                  </div>
                  <FileQuestion className="h-8 w-8 text-amber-500/30" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{language === 'fr' ? 'Adoption utilisateurs' : 'User Adoption'}</p>
                    <p className="text-2xl font-bold">{metrics.activeUsers}/{metrics.totalUsers}</p>
                    <p className="text-xs text-muted-foreground">{language === 'fr' ? 'actifs ce mois' : 'active this month'}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-500/30" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Section 5: Health Score */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-6">
                <div className="relative h-24 w-24 flex-shrink-0">
                  <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor"
                      className={healthColor}
                      strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${noHealthData ? 0 : metrics.healthScore * 2.51} 251`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-xl font-bold ${healthColor}`}>{noHealthData ? '—' : metrics.healthScore}</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{language === 'fr' ? 'Rapport Santé' : 'Health Report'}</h3>
                  <p className={`text-sm font-medium ${healthColor}`}>{healthLabel}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === 'fr'
                      ? 'Basé sur le stockage, le taux de succès des recherches, l\'adoption utilisateur et la couverture archive'
                      : 'Based on storage, search success rate, user adoption and archive coverage'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Content Tabs */}
          <Tabs defaultValue="searches" className="space-y-4">
            <TabsList>
              <TabsTrigger value="searches" className="gap-1.5">
                <Search className="h-4 w-4" />
                {language === 'fr' ? 'Recherches échouées' : 'Failed Searches'}
              </TabsTrigger>
              <TabsTrigger value="departments" className="gap-1.5">
                <Building2 className="h-4 w-4" />
                {language === 'fr' ? 'Par département' : 'By Department'}
              </TabsTrigger>
              <TabsTrigger value="popular" className="gap-1.5">
                <Eye className="h-4 w-4" />
                {language === 'fr' ? 'Documents populaires' : 'Popular Documents'}
              </TabsTrigger>
            </TabsList>

            {/* Failed Searches Tab */}
            <TabsContent value="searches">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    {language === 'fr' ? 'Recherches fréquentes sans résultats' : 'Frequent Searches with No Results'}
                  </CardTitle>
                  <CardDescription>
                    {language === 'fr'
                      ? 'Ces termes sont recherchés mais ne trouvent aucun document — importez les documents manquants'
                      : 'These terms are searched but return no documents — import the missing documents'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {failedSearches.length > 0 ? (
                    <div className="space-y-3">
                      {failedSearches.map((search, index) => (
                        <div key={search.query_text} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-400 font-medium text-sm">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium">"{search.query_text}"</p>
                              <p className="text-xs text-muted-foreground">
                                {language === 'fr' ? 'Dernière recherche' : 'Last searched'}: {format(new Date(search.last_searched), 'dd MMM yyyy', { locale: dateLocale })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="gap-1">
                              <Search className="h-3 w-3" />
                              {search.search_count} {language === 'fr' ? 'fois' : 'times'}
                            </Badge>
                            <Button variant="ghost" size="sm" onClick={() => navigate('/upload')} className="gap-1 text-xs">
                              <Upload className="h-3 w-3" />
                              {language === 'fr' ? 'Importer' : 'Import'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500/50" />
                      <p>{language === 'fr' ? 'Aucune recherche échouée — votre archive est complète !' : 'No failed searches — your archive is complete!'}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Department Activity Tab */}
            <TabsContent value="departments">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {language === 'fr' ? 'Activité par département' : 'Activity by Department'}
                  </CardTitle>
                  <CardDescription>
                    {language === 'fr' ? 'Les départements à faible activité sont à encourager' : 'Low-activity departments need encouragement'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {departmentActivity.length > 0 ? (
                    <div className="space-y-6">
                      {/* Bar Chart */}
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={deptChartData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                            <Tooltip
                              contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                            />
                            <Bar dataKey="consultations" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={language === 'fr' ? 'Consultations' : 'Views'} />
                            <Bar dataKey="downloads" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name={language === 'fr' ? 'Téléchargements' : 'Downloads'} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Low activity alerts */}
                      {departmentActivity.filter(d => d.total_views + d.total_downloads === 0).length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                          <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">
                            ⚠️ {language === 'fr' ? 'Départements inactifs' : 'Inactive departments'}
                          </p>
                          {departmentActivity.filter(d => d.total_views + d.total_downloads === 0).map(d => (
                            <p key={d.department_id} className="text-xs text-amber-700 dark:text-amber-400">
                              {language === 'fr'
                                ? `Le département ${d.department_name} n'a effectué aucune activité sur la période`
                                : `Department ${d.department_name} had no activity in this period`}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>{language === 'fr' ? 'Aucune donnée de département' : 'No department data'}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Popular Documents Tab */}
            <TabsContent value="popular">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {language === 'fr' ? 'Top 10 Documents' : 'Top 10 Documents'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {popularDocuments.length > 0 ? (
                      <div className="space-y-3">
                        {popularDocuments.map((doc, i) => (
                          <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => navigate(`/documents/${doc.id}`)}>
                            <div className="flex items-center gap-3">
                              <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">{i + 1}</div>
                              <span className="text-sm font-medium truncate max-w-[200px]">{doc.title}</span>
                            </div>
                            <div className="flex gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{doc.views}</span>
                              <span className="flex items-center gap-1"><DownloadIcon className="h-3 w-3" />{doc.downloads}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">{language === 'fr' ? 'Aucune donnée' : 'No data'}</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Search className="h-5 w-5" />
                      {language === 'fr' ? 'Top 10 Recherches' : 'Top 10 Searches'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {popularSearches.length > 0 ? (
                      <div className="space-y-3">
                        {popularSearches.map((s, i) => (
                          <div key={s.query} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="h-7 w-7 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-bold">{i + 1}</div>
                              <span className="text-sm">"{s.query}"</span>
                            </div>
                            <Badge variant="secondary">{s.count}×</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">{language === 'fr' ? 'Aucune donnée' : 'No data'}</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

