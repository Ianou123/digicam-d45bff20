import { 
  Search, 
  Eye, 
  Download, 
  Upload, 
  Edit, 
  Trash2, 
  Share2,
  FileText 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
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

interface ActivityTimelineProps {
  activities: ActivityItem[];
  showUser?: boolean;
  maxItems?: number;
}

const actionConfig: Record<string, { 
  icon: typeof Search; 
  color: string; 
  bgColor: string;
  label: { fr: string; en: string };
}> = {
  search: { 
    icon: Search, 
    color: 'text-info', 
    bgColor: 'bg-info/10',
    label: { fr: 'Recherche', en: 'Search' }
  },
  view: { 
    icon: Eye, 
    color: 'text-success', 
    bgColor: 'bg-success/10',
    label: { fr: 'Consultation', en: 'View' }
  },
  download: { 
    icon: Download, 
    color: 'text-warning', 
    bgColor: 'bg-warning/10',
    label: { fr: 'Téléchargement', en: 'Download' }
  },
  upload: { 
    icon: Upload, 
    color: 'text-primary', 
    bgColor: 'bg-primary/10',
    label: { fr: 'Téléversement', en: 'Upload' }
  },
  update: { 
    icon: Edit, 
    color: 'text-accent-foreground', 
    bgColor: 'bg-accent',
    label: { fr: 'Mise à jour', en: 'Update' }
  },
  delete: { 
    icon: Trash2, 
    color: 'text-destructive', 
    bgColor: 'bg-destructive/10',
    label: { fr: 'Suppression', en: 'Delete' }
  },
  share: { 
    icon: Share2, 
    color: 'text-info', 
    bgColor: 'bg-info/10',
    label: { fr: 'Partage', en: 'Share' }
  },
};

export function ActivityTimeline({ 
  activities, 
  showUser = false,
  maxItems = 10 
}: ActivityTimelineProps) {
  const { language } = useLanguage();
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
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-serif">
          {language === 'fr' ? 'Activité récente' : 'Recent Activity'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {displayedActivities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>{language === 'fr' ? 'Aucune activité récente' : 'No recent activity'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedActivities.map((activity, index) => {
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
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatTime(activity.created_at)}</span>
                      {showUser && activity.user_name && (
                        <>
                          <span>•</span>
                          <span>{activity.user_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
