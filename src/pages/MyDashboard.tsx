import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Eye, 
  Download, 
  FileText, 
  Clock,
  TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

interface ActivityItem {
  id: string;
  action_type: string;
  created_at: string;
  search_query?: string;
  document_id?: string;
  documents?: { 
    id: string;
    title: string;
    document_type: string;
    confidentiality_level: string;
    created_at: string;
    updated_at: string;
    tags: string[];
    current_version: number;
  } | null;
}

export default function MyDashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { t, language } = useLanguage();
  const dateLocale = language === 'fr' ? fr : enUS;
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSearches: 0,
    totalViews: 0,
    totalDownloads: 0,
  });
  const [recentSearches, setRecentSearches] = useState<ActivityItem[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<ActivityItem[]>([]);
  const [mostViewed, setMostViewed] = useState<{ document_id: string; count: number; documents: any }[]>([]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Get search count
      const { count: searchCount } = await supabase
        .from('activity_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('action_type', 'search');

      // Get view count
      const { count: viewCount } = await supabase
        .from('activity_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('action_type', 'view');

      // Get download count
      const { count: downloadCount } = await supabase
        .from('activity_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('action_type', 'download');

      setStats({
        totalSearches: searchCount || 0,
        totalViews: viewCount || 0,
        totalDownloads: downloadCount || 0,
      });

      // Get recent searches
      const { data: searches } = await supabase
        .from('activity_logs')
        .select('id, action_type, created_at, search_query')
        .eq('user_id', user.id)
        .eq('action_type', 'search')
        .not('search_query', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentSearches(searches || []);

      // Get recently viewed documents
      const { data: viewed } = await supabase
        .from('activity_logs')
        .select(`
          id, 
          action_type, 
          created_at, 
          document_id,
          documents(
            id,
            title,
            document_type,
            confidentiality_level,
            created_at,
            updated_at,
            tags,
            current_version
          )
        `)
        .eq('user_id', user.id)
        .eq('action_type', 'view')
        .not('document_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5);

      // Filter unique documents
      const uniqueViewed = viewed?.filter((item, index, self) => 
        index === self.findIndex(t => t.document_id === item.document_id)
      ) || [];

      setRecentlyViewed(uniqueViewed);

      // Get most viewed documents (simplified - just getting recent views grouped)
      const { data: viewLogs } = await supabase
        .from('activity_logs')
        .select(`
          document_id,
          documents(
            id,
            title,
            document_type,
            confidentiality_level,
            created_at,
            updated_at,
            tags,
            current_version
          )
        `)
        .eq('user_id', user.id)
        .eq('action_type', 'view')
        .not('document_id', 'is', null);

      // Count views per document
      const viewCounts: Record<string, { count: number; documents: any }> = {};
      viewLogs?.forEach(log => {
        if (log.document_id && log.documents) {
          if (!viewCounts[log.document_id]) {
            viewCounts[log.document_id] = { count: 0, documents: log.documents };
          }
          viewCounts[log.document_id].count++;
        }
      });

      const sortedViews = Object.entries(viewCounts)
        .map(([document_id, data]) => ({ document_id, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setMostViewed(sortedViews);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocument = (id: string) => {
    navigate(`/documents/${id}`);
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
      {/* Header */}
      <div>
        <h2 className="text-2xl font-serif font-semibold">{t('nav.myDashboard')}</h2>
        <p className="text-muted-foreground">
          Votre activité et vos documents consultés
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          title={t('dashboard.recentSearches')}
          value={stats.totalSearches}
          icon={Search}
        />
        <StatsCard
          title="Documents consultés"
          value={stats.totalViews}
          icon={Eye}
        />
        <StatsCard
          title="Téléchargements"
          value={stats.totalDownloads}
          icon={Download}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Searches */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-serif flex items-center gap-2">
              <Search className="h-5 w-5" />
              {t('dashboard.recentSearches')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentSearches.length > 0 ? (
              <div className="space-y-3">
                {recentSearches.map((search) => (
                  <div
                    key={search.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">"{search.search_query}"</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(search.created_at), { 
                        addSuffix: true, 
                        locale: dateLocale 
                      })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucune recherche récente</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Most Viewed */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-serif flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t('dashboard.mostViewed')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mostViewed.length > 0 ? (
              <div className="space-y-3">
                {mostViewed.map((item) => (
                  <div
                    key={item.document_id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => handleViewDocument(item.document_id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium truncate">{item.documents?.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {item.count} vue{item.count > 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Eye className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucun document consulté</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recently Viewed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('dashboard.recentlyViewed')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentlyViewed.length > 0 ? (
            <div className="space-y-3">
              {recentlyViewed.map((item) => item.documents && (
                <DocumentCard
                  key={item.id}
                  document={{
                    id: item.documents.id,
                    title: item.documents.title,
                    document_type: item.documents.document_type,
                    confidentiality_level: item.documents.confidentiality_level,
                    created_at: item.documents.created_at,
                    updated_at: item.documents.updated_at,
                    tags: item.documents.tags || [],
                    current_version: item.documents.current_version,
                    department: null,
                    profiles: null,
                  }}
                  onView={handleViewDocument}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucun document récemment consulté</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}