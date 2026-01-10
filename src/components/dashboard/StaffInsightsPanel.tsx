import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { TrendingUp, Clock, Eye, FileText, Search, Download, Upload, Edit, Trash2, Share2 } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ActivityItem {
  id: string;
  action_type: string;
  created_at: string;
  search_query?: string | null;
  documents?: { title: string } | null;
  user_name?: string | null;
}

interface MostViewedDocument {
  id: string;
  title: string;
  document_type: string;
  confidentiality_level: string;
  view_count: number;
}

interface StaffInsightsPanelProps {
  activities: ActivityItem[];
  mostViewedDocs: MostViewedDocument[];
  maxItems?: number;
}

const confidentialityColors: Record<string, string> = {
  public: 'bg-success/10 text-success border-success/20',
  internal: 'bg-warning/10 text-warning border-warning/20',
  confidential: 'bg-destructive/10 text-destructive border-destructive/20',
};

const actionConfig: Record<string, { 
  icon: typeof Search; 
  color: string; 
  bgColor: string;
  label: { fr: string; en: string };
}> = {
  search: { icon: Search, color: 'text-info', bgColor: 'bg-info/10', label: { fr: 'Recherche', en: 'Search' } },
  view: { icon: Eye, color: 'text-success', bgColor: 'bg-success/10', label: { fr: 'Consultation', en: 'View' } },
  download: { icon: Download, color: 'text-warning', bgColor: 'bg-warning/10', label: { fr: 'Téléchargement', en: 'Download' } },
  upload: { icon: Upload, color: 'text-primary', bgColor: 'bg-primary/10', label: { fr: 'Téléversement', en: 'Upload' } },
  update: { icon: Edit, color: 'text-accent-foreground', bgColor: 'bg-accent', label: { fr: 'Mise à jour', en: 'Update' } },
  delete: { icon: Trash2, color: 'text-destructive', bgColor: 'bg-destructive/10', label: { fr: 'Suppression', en: 'Delete' } },
  share: { icon: Share2, color: 'text-info', bgColor: 'bg-info/10', label: { fr: 'Partage', en: 'Share' } },
};

export function StaffInsightsPanel({ 
  activities, 
  mostViewedDocs, 
  maxItems = 8 
}: StaffInsightsPanelProps) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('popular');
  const dateLocale = language === 'fr' ? fr : enUS;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return language === 'fr' 
        ? `Aujourd'hui à ${format(date, 'HH:mm', { locale: dateLocale })}`
        : `Today at ${format(date, 'h:mm a', { locale: dateLocale })}`;
    }
    if (isYesterday(date)) {
      return language === 'fr'
        ? `Hier à ${format(date, 'HH:mm', { locale: dateLocale })}`
        : `Yesterday at ${format(date, 'h:mm a', { locale: dateLocale })}`;
    }
    return format(date, 'dd MMM HH:mm', { locale: dateLocale });
  };

  const getActivityDescription = (activity: ActivityItem) => {
    const config = actionConfig[activity.action_type];
    if (!config) return activity.action_type;
    let description = config.label[language];
    if (activity.action_type === 'search' && activity.search_query) {
      description += `: "${activity.search_query}"`;
    } else if (activity.documents?.title) {
      description += `: ${activity.documents.title}`;
    }
    return description;
  };

  const displayedActivities = activities.slice(0, maxItems);

  return (
    <Card>
      <CardHeader className="pb-2">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="popular" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">{t('dashboard.popularDocuments')}</span>
              <span className="sm:hidden">{language === 'fr' ? 'Populaires' : 'Popular'}</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">{t('dashboard.recentActivity')}</span>
              <span className="sm:hidden">{language === 'fr' ? 'Activité' : 'Activity'}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="pt-4">
        {activeTab === 'popular' ? (
          mostViewedDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <TrendingUp className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">{language === 'fr' ? 'Aucune donnée disponible' : 'No data available'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {mostViewedDocs.map((doc, index) => (
                <div 
                  key={doc.id} 
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/documents/${doc.id}`)}
                >
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 text-primary font-semibold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{doc.title}</p>
                    <Badge 
                      variant="outline" 
                      className={cn('text-xs mt-1', confidentialityColors[doc.confidentiality_level])}
                    >
                      {t(`documents.${doc.confidentiality_level}`)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    <span className="text-sm font-medium">{doc.view_count}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          displayedActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">{language === 'fr' ? 'Aucune activité récente' : 'No recent activity'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedActivities.map((activity) => {
                const config = actionConfig[activity.action_type] || {
                  icon: FileText,
                  color: 'text-muted-foreground',
                  bgColor: 'bg-muted',
                  label: { fr: activity.action_type, en: activity.action_type }
                };
                const Icon = config.icon;

                return (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className={cn('p-2 rounded-lg flex-shrink-0', config.bgColor)}>
                      <Icon className={cn('h-4 w-4', config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {getActivityDescription(activity)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(activity.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
