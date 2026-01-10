import { useState, useEffect } from 'react';
import { 
  Search, 
  FileQuestion, 
  TrendingDown, 
  Building2, 
  AlertTriangle,
  Calendar,
  Eye,
  Users,
  Loader2,
  FileText,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format, subDays, subMonths, differenceInDays } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

interface SearchWithNoResults {
  query_text: string;
  search_count: number;
  last_searched: string;
}

interface UnusedDocument {
  id: string;
  title: string;
  document_type: string;
  created_at: string;
  updated_at: string;
  view_count: number;
  days_since_view: number;
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

export default function AdminPulse() {
  const navigate = useNavigate();
  const { profile, isClientAdmin, isSuperAdmin } = useAuth();
  const { language } = useLanguage();
  const dateLocale = language === 'fr' ? fr : enUS;
  
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30');
  
  // Data states
  const [failedSearches, setFailedSearches] = useState<SearchWithNoResults[]>([]);
  const [unusedDocuments, setUnusedDocuments] = useState<UnusedDocument[]>([]);
  const [departmentActivity, setDepartmentActivity] = useState<DepartmentActivity[]>([]);
  const [totalMetrics, setTotalMetrics] = useState({
    totalSearches: 0,
    failedSearchRate: 0,
    totalDocuments: 0,
    unusedRate: 0,
  });

  useEffect(() => {
    if (profile?.client_id || isSuperAdmin) {
      fetchAllData();
    }
  }, [profile?.client_id, isSuperAdmin, timeRange]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchFailedSearches(),
      fetchUnusedDocuments(),
      fetchDepartmentActivity(),
    ]);
    setLoading(false);
  };

  const fetchFailedSearches = async () => {
    try {
      const startDate = subDays(new Date(), parseInt(timeRange)).toISOString();
      
      let query = supabase
        .from('search_logs')
        .select('query_text, result_count, created_at')
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });

      if (!isSuperAdmin && profile?.client_id) {
        query = query.eq('client_id', profile.client_id);
      }

      const { data: searchLogs } = await query;

      if (searchLogs) {
        // Group by query and filter those with 0 results
        const queryMap: Record<string, { count: number; lastSearched: string }> = {};
        let totalSearches = 0;
        let failedSearches = 0;

        searchLogs.forEach(log => {
          totalSearches++;
          if (log.result_count === 0) {
            failedSearches++;
            const normalized = log.query_text.toLowerCase().trim();
            if (!queryMap[normalized]) {
              queryMap[normalized] = { count: 0, lastSearched: log.created_at };
            }
            queryMap[normalized].count++;
            if (new Date(log.created_at) > new Date(queryMap[normalized].lastSearched)) {
              queryMap[normalized].lastSearched = log.created_at;
            }
          }
        });

        const failedSearchList = Object.entries(queryMap)
          .map(([query, data]) => ({
            query_text: query,
            search_count: data.count,
            last_searched: data.lastSearched,
          }))
          .sort((a, b) => b.search_count - a.search_count)
          .slice(0, 10);

        setFailedSearches(failedSearchList);
        setTotalMetrics(prev => ({
          ...prev,
          totalSearches,
          failedSearchRate: totalSearches > 0 ? Math.round((failedSearches / totalSearches) * 100) : 0,
        }));
      }
    } catch (error) {
      console.error('Error fetching failed searches:', error);
    }
  };

  const fetchUnusedDocuments = async () => {
    try {
      // Get all documents
      let docQuery = supabase
        .from('documents')
        .select('id, title, document_type, created_at, updated_at')
        .is('deleted_at', null);

      if (!isSuperAdmin && profile?.client_id) {
        docQuery = docQuery.eq('client_id', profile.client_id);
      }

      const { data: documents } = await docQuery;

      if (documents && documents.length > 0) {
        // Get view counts for these documents in the time range
        const startDate = subDays(new Date(), parseInt(timeRange)).toISOString();
        const documentIds = documents.map(d => d.id);

        const { data: viewLogs } = await supabase
          .from('activity_logs')
          .select('document_id')
          .in('document_id', documentIds)
          .eq('action_type', 'view')
          .gte('created_at', startDate);

        // Count views per document
        const viewCounts: Record<string, number> = {};
        viewLogs?.forEach(log => {
          if (log.document_id) {
            viewCounts[log.document_id] = (viewCounts[log.document_id] || 0) + 1;
          }
        });

        // Get last view date for each document
        const { data: lastViews } = await supabase
          .from('activity_logs')
          .select('document_id, created_at')
          .in('document_id', documentIds)
          .eq('action_type', 'view')
          .order('created_at', { ascending: false });

        const lastViewDates: Record<string, string> = {};
        lastViews?.forEach(log => {
          if (log.document_id && !lastViewDates[log.document_id]) {
            lastViewDates[log.document_id] = log.created_at;
          }
        });

        const unusedDocs = documents
          .map(doc => {
            const lastViewDate = lastViewDates[doc.id];
            const daysSinceView = lastViewDate 
              ? differenceInDays(new Date(), new Date(lastViewDate))
              : differenceInDays(new Date(), new Date(doc.created_at));

            return {
              id: doc.id,
              title: doc.title,
              document_type: doc.document_type,
              created_at: doc.created_at,
              updated_at: doc.updated_at,
              view_count: viewCounts[doc.id] || 0,
              days_since_view: daysSinceView,
            };
          })
          .filter(doc => doc.view_count === 0)
          .sort((a, b) => b.days_since_view - a.days_since_view)
          .slice(0, 10);

        setUnusedDocuments(unusedDocs);
        setTotalMetrics(prev => ({
          ...prev,
          totalDocuments: documents.length,
          unusedRate: documents.length > 0 
            ? Math.round((unusedDocs.length / documents.length) * 100) 
            : 0,
        }));
      }
    } catch (error) {
      console.error('Error fetching unused documents:', error);
    }
  };

  const fetchDepartmentActivity = async () => {
    try {
      // Get departments
      let deptQuery = supabase
        .from('departments')
        .select('id, name')
        .is('archived_at', null);

      if (!isSuperAdmin && profile?.client_id) {
        deptQuery = deptQuery.eq('client_id', profile.client_id);
      }

      const { data: departments } = await deptQuery;

      if (departments && departments.length > 0) {
        const startDate = subDays(new Date(), parseInt(timeRange)).toISOString();
        const departmentIds = departments.map(d => d.id);

        // Get documents per department
        let docsQuery = supabase
          .from('documents')
          .select('id, department_id')
          .in('department_id', departmentIds)
          .is('deleted_at', null);

        const { data: docs } = await docsQuery;

        // Get activity logs for these documents
        const docIds = docs?.map(d => d.id) || [];
        const docToDept: Record<string, string> = {};
        docs?.forEach(d => {
          if (d.department_id) docToDept[d.id] = d.department_id;
        });

        const { data: activityLogs } = await supabase
          .from('activity_logs')
          .select('action_type, document_id')
          .in('document_id', docIds)
          .gte('created_at', startDate);

        // Get user counts per department (use type assertion since types may not be updated)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, department_id')
          .not('department_id', 'is', null) as any;

        // Aggregate activity
        const deptActivityMap: Record<string, DepartmentActivity> = {};
        
        departments.forEach(dept => {
          deptActivityMap[dept.id] = {
            department_id: dept.id,
            department_name: dept.name,
            total_views: 0,
            total_downloads: 0,
            total_uploads: 0,
            total_searches: 0,
            user_count: 0,
          };
        });

        activityLogs?.forEach(log => {
          if (log.document_id) {
            const deptId = docToDept[log.document_id];
            if (deptId && deptActivityMap[deptId]) {
              if (log.action_type === 'view') deptActivityMap[deptId].total_views++;
              if (log.action_type === 'download') deptActivityMap[deptId].total_downloads++;
              if (log.action_type === 'upload') deptActivityMap[deptId].total_uploads++;
            }
          }
        });

        (profiles as any[])?.forEach((p: any) => {
          if (p.department_id && deptActivityMap[p.department_id]) {
            deptActivityMap[p.department_id].user_count++;
          }
        });

        const sortedActivity = Object.values(deptActivityMap)
          .sort((a, b) => (b.total_views + b.total_downloads) - (a.total_views + a.total_downloads));

        setDepartmentActivity(sortedActivity);
      }
    } catch (error) {
      console.error('Error fetching department activity:', error);
    }
  };

  // Check access
  if (!isClientAdmin && !isSuperAdmin) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">
          {language === 'fr' ? 'Accès réservé aux administrateurs' : 'Admin access only'}
        </p>
      </div>
    );
  }

  const maxActivity = Math.max(...departmentActivity.map(d => d.total_views + d.total_downloads), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-semibold flex items-center gap-2">
            <TrendingDown className="h-6 w-6" />
            {language === 'fr' ? 'Pulse Admin' : 'Admin Pulse'}
          </h2>
          <p className="text-muted-foreground">
            {language === 'fr' 
              ? 'Intelligence d\'usage : ce que cherchent vos utilisateurs'
              : 'Usage intelligence: what your users are searching for'}
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
          {/* Overview Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {language === 'fr' ? 'Recherches totales' : 'Total Searches'}
                    </p>
                    <p className="text-2xl font-bold">{totalMetrics.totalSearches}</p>
                  </div>
                  <Search className="h-8 w-8 text-muted-foreground/30" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {language === 'fr' ? 'Taux d\'échec' : 'Failure Rate'}
                    </p>
                    <p className="text-2xl font-bold text-amber-600">{totalMetrics.failedSearchRate}%</p>
                  </div>
                  <FileQuestion className="h-8 w-8 text-amber-600/30" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {language === 'fr' ? 'Documents totaux' : 'Total Documents'}
                    </p>
                    <p className="text-2xl font-bold">{totalMetrics.totalDocuments}</p>
                  </div>
                  <FileText className="h-8 w-8 text-muted-foreground/30" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {language === 'fr' ? 'Docs non consultés' : 'Unused Docs'}
                    </p>
                    <p className="text-2xl font-bold text-orange-600">{unusedDocuments.length}</p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-orange-600/30" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="searches" className="space-y-4">
            <TabsList>
              <TabsTrigger value="searches" className="gap-1.5">
                <Search className="h-4 w-4" />
                {language === 'fr' ? 'Recherches échouées' : 'Failed Searches'}
              </TabsTrigger>
              <TabsTrigger value="unused" className="gap-1.5">
                <Clock className="h-4 w-4" />
                {language === 'fr' ? 'Documents peu consultés' : 'Unused Documents'}
              </TabsTrigger>
              <TabsTrigger value="departments" className="gap-1.5">
                <Building2 className="h-4 w-4" />
                {language === 'fr' ? 'Par département' : 'By Department'}
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
                      ? 'Ces termes sont souvent recherchés mais ne trouvent aucun document'
                      : 'These terms are frequently searched but return no documents'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {failedSearches.length > 0 ? (
                    <div className="space-y-3">
                      {failedSearches.map((search, index) => (
                        <div 
                          key={search.query_text}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
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
                          <Badge variant="secondary" className="gap-1">
                            <Search className="h-3 w-3" />
                            {search.search_count} {language === 'fr' ? 'fois' : 'times'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>{language === 'fr' ? 'Aucune recherche échouée' : 'No failed searches'}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Unused Documents Tab */}
            <TabsContent value="unused">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    {language === 'fr' ? 'Documents potentiellement obsolètes' : 'Potentially Obsolete Documents'}
                  </CardTitle>
                  <CardDescription>
                    {language === 'fr' 
                      ? 'Documents non consultés sur la période sélectionnée'
                      : 'Documents not viewed in the selected period'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {unusedDocuments.length > 0 ? (
                    <div className="space-y-3">
                      {unusedDocuments.map((doc) => (
                        <div 
                          key={doc.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                          onClick={() => navigate(`/documents/${doc.id}`)}
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{doc.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {language === 'fr' ? 'Créé le' : 'Created'}: {format(new Date(doc.created_at), 'dd MMM yyyy', { locale: dateLocale })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="uppercase text-xs">
                              {doc.document_type}
                            </Badge>
                            <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                              {doc.days_since_view} {language === 'fr' ? 'jours' : 'days'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Eye className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>{language === 'fr' ? 'Tous les documents sont consultés' : 'All documents are being viewed'}</p>
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
                    {language === 'fr' 
                      ? 'Comparaison de l\'activité entre départements'
                      : 'Activity comparison between departments'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {departmentActivity.length > 0 ? (
                    <div className="space-y-4">
                      {departmentActivity.map((dept) => {
                        const totalActivity = dept.total_views + dept.total_downloads;
                        const activityPercent = (totalActivity / maxActivity) * 100;
                        
                        return (
                          <div key={dept.department_id} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{dept.department_name}</span>
                                <Badge variant="outline" className="text-xs gap-1">
                                  <Users className="h-3 w-3" />
                                  {dept.user_count}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Eye className="h-3 w-3" /> {dept.total_views}
                                </span>
                                <span className="flex items-center gap-1">
                                  <TrendingDown className="h-3 w-3" /> {dept.total_downloads}
                                </span>
                              </div>
                            </div>
                            <Progress value={activityPercent} className="h-2" />
                          </div>
                        );
                      })}
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
          </Tabs>
        </>
      )}
    </div>
  );
}
