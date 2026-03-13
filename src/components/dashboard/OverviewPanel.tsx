import { FileText, Users, HardDrive, Building2, CheckCircle, AlertTriangle, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

interface OverviewPanelProps {
  totalDocuments: number;
  totalUsers: number;
  storageUsedMb: number;
  storageLimitMb: number;
  departmentsCount: number;
  failedSearchesThisWeek: number;
  storagePercent: number;
}

export function OverviewPanel({
  totalDocuments,
  totalUsers,
  storageUsedMb,
  storageLimitMb,
  departmentsCount,
  failedSearchesThisWeek,
  storagePercent,
}: OverviewPanelProps) {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const hasAlerts = failedSearchesThisWeek > 0 || storagePercent > 80;
  const formattedStorageUsed =
    storageUsedMb >= 1024 ? `${(storageUsedMb / 1024).toFixed(1)} Go` : `${storageUsedMb} Mo`;
  const formattedStorageLimit =
    storageLimitMb >= 1024 ? `${(storageLimitMb / 1024).toFixed(0)} Go` : `${storageLimitMb} Mo`;

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-serif">
            {language === 'fr' ? "Vue d'Ensemble" : 'Overview'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>{language === 'fr' ? 'Total documents' : 'Total documents'}</span>
            </div>
            <span className="font-semibold">{totalDocuments}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{language === 'fr' ? 'Total utilisateurs' : 'Total users'}</span>
            </div>
            <span className="font-semibold">{totalUsers}</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <span>{language === 'fr' ? 'Stockage utilisé' : 'Storage used'}</span>
              </div>
              <span className="font-semibold text-sm">
                {formattedStorageUsed} / {formattedStorageLimit}
              </span>
            </div>
            <Progress value={storagePercent} className="h-2" />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>{language === 'fr' ? 'Départements' : 'Departments'}</span>
            </div>
            <span className="font-semibold">{departmentsCount}</span>
          </div>
        </CardContent>
      </Card>

      {/* Alerts Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-serif">
            {language === 'fr' ? 'Alertes' : 'Alerts'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasAlerts ? (
            <div className="space-y-3">
              {failedSearchesThisWeek > 0 && (
                <div 
                  className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-200 dark:border-amber-800 cursor-pointer hover:bg-amber-500/15 transition-colors"
                  onClick={() => navigate('/admin-pulse')}
                >
                  <Search className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      {failedSearchesThisWeek} {language === 'fr' ? 'recherches échouées cette semaine' : 'failed searches this week'}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                      {language === 'fr' ? 'Voir sur Admin Pulse →' : 'View on Admin Pulse →'}
                    </p>
                  </div>
                </div>
              )}
              {storagePercent > 80 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-200 dark:border-orange-800">
                  <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                    {language === 'fr' ? `Stockage à ${storagePercent}%` : `Storage at ${storagePercent}%`}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500/50" />
              <p className="text-sm font-medium">
                {language === 'fr' ? '✅ Tout fonctionne normalement' : '✅ Everything is working normally'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
