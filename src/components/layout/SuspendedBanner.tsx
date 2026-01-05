import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function SuspendedBanner() {
  const { t } = useLanguage();

  return (
    <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-3">
      <div className="flex items-center gap-3 max-w-7xl mx-auto">
        <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-destructive">
            {t('suspension.banner')}
          </p>
          <p className="text-xs text-destructive/80">
            {t('suspension.contactAdmin')}
          </p>
        </div>
      </div>
    </div>
  );
}
