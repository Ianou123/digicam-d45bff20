import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Eye, Mail, TrendingUp, Clock, FileText, 
  Lightbulb, ArrowRight, FolderOpen, KeyRound, Share2, Star
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { startOfMonth } from 'date-fns';
import { useFavorites } from '@/hooks/useFavorites';
import { formatDate } from '@/lib/formatters';

interface ViewedDoc {
  id: string;
  title: string;
  document_type: string;
  viewed_at: string;
}

interface ActivityItem {
  id: string;
  action_type: string;
  created_at: string;
  search_query?: string | null;
  doc_title?: string | null;
}

interface MostViewedDoc {
  id: string;
  title: string;
  document_type: string;
  view_count: number;
}

const TIPS_FR = [
  'Utilisez Ctrl+K pour rechercher depuis n\'importe quelle page',
  'Vous pouvez envoyer un document à un collègue directement depuis la page de consultation',
  'Vos documents reçus apparaissent dans "Partagés avec moi"',
  'Cliquez sur un document pour voir son historique de versions',
  'Utilisez les filtres pour affiner vos recherches par type ou confidentialité',
];

const TIPS_EN = [
  'Use Ctrl+K to search from any page',
  'You can share a document with a colleague directly from the document page',
  'Documents shared with you appear in "Shared with me"',
  'Click on a document to see its version history',
  'Use filters to refine your searches by type or confidentiality',
];

export function UserDashboard() {
  const navigate = useNavigate();
  const { user, profile, clientName } = useAuth();
  const { language } = useLanguage();
  const dateLocale = language === 'fr' ? fr : enUS;
  const { favoriteCount } = useFavorites();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    accessibleDocs: 0,
    viewedThisMonth: 0,
    receivedShares: 0,
    unreadShares: 0,
    searchesThisMonth: 0,
    searchSuccessRate: 0,
  });
  const [recentlyViewed, setRecentlyViewed] = useState<ViewedDoc[]>([]);
  const [myActivity, setMyActivity] = useState<ActivityItem[]>([]);
  const [mostViewed, setMostViewed] = useState<MostViewedDoc[]>([]);

  const tipIndex = useMemo(() => Math.floor(Math.random() * TIPS_FR.length), []);
  const tip = language === 'fr' ? TIPS_FR[tipIndex] : TIPS_EN[tipIndex];

  useEffect(() => {
    if (user && profile?.client_id) fetchData();
  }, [user, profile?.client_id]);

  const fetchData = async () => {
    if (!user || !profile?.client_id) return;
    const monthStart = startOfMonth(new Date()).toISOString();

    try {
      // Accessible documents count
      const { count: accessibleCount } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', profile.client_id)
        .is('deleted_at', null);

      // Viewed this month (personal)
      const { data: viewedLogs, error: viewedError } = await supabase
        .from('activity_logs')
        .select('document_id')
        .eq('user_id', user.id)
        .eq('action_type', 'view')
        .not('document_id', 'is', null)
        .gte('created_at', monthStart);
      if (viewedError) throw viewedError;
      const viewedUniqueCount = new Set((viewedLogs || []).map(v => v.document_id)).size;

      // Shares received
      const { data: sharesData } = await supabase
        .from('shares')
        .select('id, created_at')
        .eq('recipient_user_id', user.id);
      const receivedShares = sharesData?.length || 0;

      // Searches this month (personal)
      const { data: searchLogs } = await supabase
        .from('activity_logs')
        .select('id, search_query')
        .eq('user_id', user.id)
        .eq('action_type', 'search')
        .gte('created_at', monthStart);
      const searchCount = searchLogs?.length || 0;

      setStats({
        accessibleDocs: accessibleCount || 0,
        viewedThisMonth: viewedUniqueCount,
        receivedShares,
        unreadShares: 0,
        searchesThisMonth: searchCount,
        searchSuccessRate: 0,
      });

      // Recently viewed documents (unique, last 5)
      const { data: viewLogs } = await supabase
        .from('activity_logs')
        .select('document_id, created_at, documents(id, title, document_type)')
        .eq('user_id', user.id)
        .eq('action_type', 'view')
        .not('document_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (viewLogs) {
        const seen = new Set<string>();
        const unique: ViewedDoc[] = [];
        for (const log of viewLogs) {
          const doc = log.documents as any;
          if (doc && !seen.has(doc.id)) {
            seen.add(doc.id);
            unique.push({ id: doc.id, title: doc.title, document_type: doc.document_type, viewed_at: log.created_at });
            if (unique.length >= 5) break;
          }
        }
        setRecentlyViewed(unique);
      }

      // My activity (last 5 actions)
      const { data: activityData } = await supabase
        .from('activity_logs')
        .select('id, action_type, created_at, search_query, documents(title)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (activityData) {
        setMyActivity(activityData.map(a => ({
          id: a.id,
          action_type: a.action_type,
          created_at: a.created_at,
          search_query: a.search_query,
          doc_title: (a.documents as any)?.title || null,
        })));
      }

      // Most viewed docs in the org (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: orgViewLogs } = await supabase
        .from('activity_logs')
        .select('document_id, documents(id, title, document_type)')
        .eq('client_id', profile.client_id)
        .eq('action_type', 'view')
        .not('document_id', 'is', null)
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (orgViewLogs) {
        const counts: Record<string, { doc: any; count: number }> = {};
        orgViewLogs.forEach((log: any) => {
          if (log.document_id && log.documents) {
            if (!counts[log.document_id]) counts[log.document_id] = { doc: log.documents, count: 0 };
            counts[log.document_id].count++;
          }
        });
        setMostViewed(
          Object.entries(counts)
            .map(([, data]) => ({ id: data.doc.id, title: data.doc.title, document_type: data.doc.document_type, view_count: data.count }))
            .sort((a, b) => b.view_count - a.view_count)
            .slice(0, 5)
        );
      }
    } catch (error) {
      console.error('Error fetching user dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = (action: string, docTitle?: string | null, query?: string | null) => {
    const isFr = language === 'fr';
    switch (action) {
      case 'view': return isFr ? `Vous avez consulté '${docTitle || 'un document'}'` : `You viewed '${docTitle || 'a document'}'`;
      case 'download': return isFr ? `Vous avez téléchargé '${docTitle || 'un document'}'` : `You downloaded '${docTitle || 'a document'}'`;
      case 'search': return isFr ? `Vous avez recherché "${query || '...'}"` : `You searched for "${query || '...'}"`;
      case 'upload': return isFr ? `Vous avez importé '${docTitle || 'un document'}'` : `You uploaded '${docTitle || 'a document'}'`;
      default: return isFr ? `Action: ${action}` : `Action: ${action}`;
    }
  };

  const getDocTypeIcon = (type: string) => {
    return <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
  };

  const hasData = recentlyViewed.length > 0 || myActivity.length > 0;

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
        <h2 className="text-2xl font-serif font-semibold">
          {language === 'fr' ? 'Bonjour' : 'Hello'}, {profile?.full_name?.split(' ')[0] || (language === 'fr' ? 'Utilisateur' : 'User')}
        </h2>
        <p className="text-muted-foreground">
          {clientName && <span className="font-medium">{clientName}</span>}
          {clientName && ' — '}
          {formatDate(new Date(), language)}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card 
          className="border-l-4 border-l-green-500 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]"
          onClick={() => navigate('/documents')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === 'fr' ? 'Documents Accessibles' : 'Accessible Documents'}
            </CardTitle>
            <div className="p-2 rounded-lg bg-green-500/10">
              <FolderOpen className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.accessibleDocs}</div>
          </CardContent>
        </Card>

        <Card 
          className="border-l-4 border-l-blue-500 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]"
          onClick={() => navigate('/documents')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === 'fr' ? 'Consultés ce mois' : 'Viewed this month'}
            </CardTitle>
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Eye className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.viewedThisMonth}</div>
          </CardContent>
        </Card>

        <Card 
          className="border-l-4 border-l-orange-500 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]"
          onClick={() => navigate('/shared-with-me')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === 'fr' ? 'Reçus' : 'Received'}
            </CardTitle>
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Mail className="h-4 w-4 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.receivedShares}</div>
            {stats.unreadShares > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {stats.unreadShares} {language === 'fr' ? 'non lu(s)' : 'unread'}
              </p>
            )}
          </CardContent>
        </Card>

        <Card 
          className="border-l-4 border-l-yellow-500 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]"
          onClick={() => navigate('/my-favorites')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === 'fr' ? 'Documents Favoris' : 'Favorite Documents'}
            </CardTitle>
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Star className="h-4 w-4 text-yellow-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{favoriteCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card 
          className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] group border-2 border-transparent hover:border-primary/20"
          onClick={() => navigate('/documents')}
        >
          <CardContent className="p-6 flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Search className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base">{language === 'fr' ? 'Rechercher' : 'Search'}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {language === 'fr' 
                  ? 'Retrouvez n\'importe quel document en quelques secondes grâce à l\'OCR' 
                  : 'Find any document in seconds with OCR'}
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary transition-colors mt-1" />
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] group border-2 border-transparent hover:border-primary/20"
          onClick={() => navigate('/shared-with-me')}
        >
          <CardContent className="p-6 flex items-start gap-4">
            <div className="p-3 rounded-xl bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
              <Share2 className="h-6 w-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base">{language === 'fr' ? 'Partagés avec moi' : 'Shared with me'}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {language === 'fr' 
                  ? 'Voir les documents qu\'on m\'a envoyés' 
                  : 'View documents shared with me'}
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-orange-600 transition-colors mt-1" />
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      {hasData ? (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Left Column (60%) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Recently Viewed */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-serif flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {language === 'fr' ? 'Consultés Récemment' : 'Recently Viewed'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentlyViewed.length > 0 ? (
                  <div className="space-y-2">
                    {recentlyViewed.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => navigate(`/documents/${doc.id}`)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {getDocTypeIcon(doc.document_type)}
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{doc.title}</p>
                            <p className="text-xs text-muted-foreground uppercase">{doc.document_type}</p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                          {formatDistanceToNow(new Date(doc.viewed_at), { addSuffix: true, locale: dateLocale })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {language === 'fr' ? 'Aucun document consulté récemment' : 'No recently viewed documents'}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Most Viewed in Org */}
            {mostViewed.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-serif flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    {language === 'fr' ? 'Les Plus Consultés' : 'Most Viewed'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {mostViewed.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => navigate(`/documents/${doc.id}`)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {getDocTypeIcon(doc.document_type)}
                          <span className="font-medium text-sm truncate">{doc.title}</span>
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                          {doc.view_count} {language === 'fr' ? (doc.view_count > 1 ? 'vues' : 'vue') : (doc.view_count > 1 ? 'views' : 'view')}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column (40%) */}
          <div className="lg:col-span-2 space-y-6">
            {/* My Activity */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-serif flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  {language === 'fr' ? 'Mon Activité' : 'My Activity'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {myActivity.length > 0 ? (
                  <div className="space-y-3">
                    {myActivity.map((item) => (
                      <div key={item.id} className="flex items-start gap-3">
                        <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm">{getActionLabel(item.action_type, item.doc_title, item.search_query)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: dateLocale })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {language === 'fr' ? 'Aucune activité récente' : 'No recent activity'}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Tip */}
            <Card className="bg-primary/5 border-primary/10">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                    <Lightbulb className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{language === 'fr' ? 'Astuce' : 'Tip'}</p>
                    <p className="text-sm text-muted-foreground mt-1">{tip}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* Empty State */
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16 px-6">
            <div className="p-4 rounded-2xl bg-primary/10 mb-6">
              <FolderOpen className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-xl font-serif font-semibold mb-2">
              {language === 'fr' ? 'Votre espace est prêt' : 'Your workspace is ready'}
            </h3>
            <p className="text-muted-foreground text-center mb-8 max-w-md">
              {language === 'fr' 
                ? 'Votre administrateur n\'a pas encore importé de documents.' 
                : 'Your administrator hasn\'t imported documents yet.'}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {language === 'fr' ? 'En attendant, vous pouvez :' : 'In the meantime, you can:'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Card 
                className="cursor-pointer hover:shadow-md transition-all px-5 py-3 flex items-center gap-3"
                onClick={() => navigate('/documents')}
              >
                <Search className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{language === 'fr' ? 'Explorer la recherche' : 'Explore search'}</span>
              </Card>
              <Card 
                className="cursor-pointer hover:shadow-md transition-all px-5 py-3 flex items-center gap-3"
                onClick={() => navigate('/shared-with-me')}
              >
                <Share2 className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium">{language === 'fr' ? 'Documents partagés' : 'Shared documents'}</span>
              </Card>
              <Card 
                className="cursor-pointer hover:shadow-md transition-all px-5 py-3 flex items-center gap-3"
                onClick={() => navigate('/my-authorization')}
              >
                <KeyRound className="h-4 w-4 text-teal-600" />
                <span className="text-sm font-medium">{language === 'fr' ? 'Mes habilitations' : 'My authorization'}</span>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
