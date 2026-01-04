import { 
  Search, 
  Eye, 
  Download, 
  Upload, 
  Edit, 
  Trash2,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDistanceToNow } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ActivityItem {
  id: string;
  action_type: string;
  created_at: string;
  search_query?: string | null;
  documents?: { title: string } | null;
}

interface RecentActivityProps {
  activities: ActivityItem[];
  showUser?: boolean;
}

const actionIcons: Record<string, any> = {
  search: Search,
  view: Eye,
  download: Download,
  upload: Upload,
  update: Edit,
  delete: Trash2,
};

const actionColors: Record<string, string> = {
  search: 'text-info bg-info/10',
  view: 'text-muted-foreground bg-muted',
  download: 'text-success bg-success/10',
  upload: 'text-primary bg-primary/10',
  update: 'text-warning bg-warning/10',
  delete: 'text-destructive bg-destructive/10',
};

export function RecentActivity({ activities, showUser = false }: RecentActivityProps) {
  const { t, language } = useLanguage();
  const dateLocale = language === 'fr' ? fr : enUS;

  const getActionLabel = (action: string) => {
    return t(`activity.${action}`);
  };

  const getActivityDescription = (activity: ActivityItem) => {
    if (activity.action_type === 'search' && activity.search_query) {
      return `"${activity.search_query}"`;
    }
    if (activity.documents?.title) {
      return activity.documents.title;
    }
    return '';
  };

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-serif">{t('nav.activity')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">{t('activity.noActivity')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-serif">{t('nav.activity')}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {activities.map((activity) => {
            const Icon = actionIcons[activity.action_type] || Eye;
            const colorClass = actionColors[activity.action_type] || 'text-muted-foreground bg-muted';
            
            return (
              <div key={activity.id} className="flex items-start gap-3 px-6 py-3">
                <div className={cn('p-2 rounded-lg flex-shrink-0', colorClass)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {getActionLabel(activity.action_type)}
                    </span>
                  </div>
                  {getActivityDescription(activity) && (
                    <p className="text-sm text-muted-foreground truncate">
                      {getActivityDescription(activity)}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(activity.created_at), { 
                      addSuffix: true, 
                      locale: dateLocale 
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}