import { useState, useEffect } from 'react';
import { TrendingUp, Users, Eye, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { startOfDay, subDays, format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface TrendingDocument {
  id: string;
  title: string;
  document_type: string;
  confidentiality_level: string;
  view_count: number;
  unique_viewers: number;
}

interface OrganizationTrendsProps {
  className?: string;
  maxItems?: number;
}

const confidentialityColors: Record<string, string> = {
  public: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  internal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  confidential: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export function OrganizationTrends({ className, maxItems = 5 }: OrganizationTrendsProps) {
  const { profile } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const dateLocale = language === 'fr' ? fr : enUS;
  
  const [trendingDocs, setTrendingDocs] = useState<TrendingDocument[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [weekTopDoc, setWeekTopDoc] = useState<TrendingDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.client_id) {
      fetchTrends();
    }
  }, [profile?.client_id]);

  const fetchTrends = async () => {
    if (!profile?.client_id) return;

    setLoading(true);
    try {
      const today = startOfDay(new Date());
      const sevenDaysAgo = startOfDay(subDays(new Date(), 7));

      // Get today's activity
      const { data: todayLogs } = await supabase
        .from('activity_logs')
        .select('document_id, user_id, documents(id, title, document_type, confidentiality_level)')
        .eq('client_id', profile.client_id)
        .eq('action_type', 'view')
        .gte('created_at', today.toISOString())
        .not('document_id', 'is', null);

      if (todayLogs) {
        // Count views per document today
        const docViewsToday: Record<string, { doc: any; views: number; viewers: Set<string> }> = {};
        todayLogs.forEach((log: any) => {
          if (log.documents) {
            if (!docViewsToday[log.document_id]) {
              docViewsToday[log.document_id] = { doc: log.documents, views: 0, viewers: new Set() };
            }
            docViewsToday[log.document_id].views++;
            docViewsToday[log.document_id].viewers.add(log.user_id);
          }
        });

        const sortedToday = Object.entries(docViewsToday)
          .map(([id, data]) => ({
            id,
            title: data.doc.title,
            document_type: data.doc.document_type,
            confidentiality_level: data.doc.confidentiality_level,
            view_count: data.views,
            unique_viewers: data.viewers.size,
          }))
          .sort((a, b) => b.unique_viewers - a.unique_viewers || b.view_count - a.view_count)
          .slice(0, maxItems);

        setTrendingDocs(sortedToday);
        setTodayCount(Object.keys(docViewsToday).length);
      }

      // Get week's top document
      const { data: weekLogs } = await supabase
        .from('activity_logs')
        .select('document_id, user_id, documents(id, title, document_type, confidentiality_level)')
        .eq('client_id', profile.client_id)
        .eq('action_type', 'view')
        .gte('created_at', sevenDaysAgo.toISOString())
        .not('document_id', 'is', null);

      if (weekLogs && weekLogs.length > 0) {
        const docViewsWeek: Record<string, { doc: any; views: number; viewers: Set<string> }> = {};
        weekLogs.forEach((log: any) => {
          if (log.documents) {
            if (!docViewsWeek[log.document_id]) {
              docViewsWeek[log.document_id] = { doc: log.documents, views: 0, viewers: new Set() };
            }
            docViewsWeek[log.document_id].views++;
            docViewsWeek[log.document_id].viewers.add(log.user_id);
          }
        });

        const topWeek = Object.entries(docViewsWeek)
          .map(([id, data]) => ({
            id,
            title: data.doc.title,
            document_type: data.doc.document_type,
            confidentiality_level: data.doc.confidentiality_level,
            view_count: data.views,
            unique_viewers: data.viewers.size,
          }))
          .sort((a, b) => b.unique_viewers - a.unique_viewers || b.view_count - a.view_count)[0];

        setWeekTopDoc(topWeek || null);
      }
    } catch (error) {
      console.error('Error fetching trends:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {language === 'fr' ? 'Tendances de l\'organisation' : 'Organization Trends'}
        </CardTitle>
        <CardDescription>
          {language === 'fr' 
            ? 'Ce que vos collègues consultent'
            : 'What your colleagues are viewing'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Week's top document */}
        {weekTopDoc && (
          <div 
            className="p-3 rounded-lg bg-primary/5 border border-primary/10 cursor-pointer hover:bg-primary/10 transition-colors"
            onClick={() => navigate(`/documents/${weekTopDoc.id}`)}
          >
            <div className="flex items-center gap-2 text-xs text-primary mb-1">
              <TrendingUp className="h-3 w-3" />
              {language === 'fr' ? 'Document le plus consulté cette semaine' : 'Most viewed this week'}
            </div>
            <p className="font-medium truncate">{weekTopDoc.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                {weekTopDoc.document_type.toUpperCase()}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {weekTopDoc.unique_viewers} {language === 'fr' ? 'personnes' : 'people'}
              </span>
            </div>
          </div>
        )}

        {/* Today's trending */}
        {trendingDocs.length > 0 ? (
          <div>
            <h4 className="text-sm font-medium mb-2 text-muted-foreground">
              {language === 'fr' ? 'Aujourd\'hui' : 'Today'}
            </h4>
            <ScrollArea className="max-h-[250px]">
              <div className="space-y-2">
                {trendingDocs.map((doc, index) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/documents/${doc.id}`)}
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {doc.unique_viewers} {language === 'fr' 
                            ? (doc.unique_viewers > 1 ? 'personnes' : 'personne')
                            : (doc.unique_viewers > 1 ? 'people' : 'person')}
                        </span>
                        <Badge className={cn('text-[10px] px-1 py-0 h-4', confidentialityColors[doc.confidentiality_level])}>
                          {doc.confidentiality_level}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <Eye className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">
              {language === 'fr' 
                ? 'Pas encore d\'activité aujourd\'hui'
                : 'No activity yet today'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}