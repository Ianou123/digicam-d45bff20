import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function LatestBadge() {
  const { language } = useLanguage();
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 cursor-help"
          variant="outline"
        >
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {language === 'fr' ? 'Dernière version' : 'Latest'}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">
          {language === 'fr' 
            ? 'Ceci est la version la plus récente approuvée.'
            : 'This is the most recent approved version.'}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
