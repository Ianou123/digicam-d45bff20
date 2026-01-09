import { format, isToday, isYesterday } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, User } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Version {
  id: string;
  version_number: number;
  created_at: string;
  change_notes: string | null;
  uploaded_by_name?: string;
}

interface VersionHistoryProps {
  versions: Version[];
  currentVersion: number;
}

export function VersionHistory({ versions, currentVersion }: VersionHistoryProps) {
  const { t, language } = useLanguage();
  const dateLocale = language === 'fr' ? fr : enUS;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return language === 'fr' ? "Aujourd'hui" : 'Today';
    }
    if (isYesterday(date)) {
      return language === 'fr' ? 'Hier' : 'Yesterday';
    }
    return format(date, 'd MMM yyyy', { locale: dateLocale });
  };

  if (versions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-serif flex items-center gap-2">
          <History className="h-4 w-4" />
          {t('documents.versions')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-1 px-6 pb-4">
            {versions.map((version) => (
              <div
                key={version.id}
                className="flex items-start gap-3 py-3 border-b last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">
                      {language === 'fr' ? 'Version' : 'Version'} {version.version_number}
                    </span>
                    {version.version_number === currentVersion && (
                      <Badge 
                        variant="outline" 
                        className="text-xs bg-primary/10 text-primary border-primary/30"
                      >
                        {language === 'fr' ? 'Actuelle' : 'Current'}
                      </Badge>
                    )}
                    {version.version_number === 1 && (
                      <Badge 
                        variant="outline" 
                        className="text-xs"
                      >
                        {language === 'fr' ? 'Initial' : 'Initial'}
                      </Badge>
                    )}
                  </div>
                  
                  {version.change_notes && (
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {version.change_notes}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {version.uploaded_by_name && (
                      <>
                        <User className="h-3 w-3" />
                        <span>{version.uploaded_by_name}</span>
                        <span>—</span>
                      </>
                    )}
                    <span>{formatDate(version.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
