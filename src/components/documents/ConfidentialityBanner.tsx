import { Lock, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface ConfidentialityBannerProps {
  level: 'internal' | 'confidential';
  className?: string;
}

export function ConfidentialityBanner({ level, className }: ConfidentialityBannerProps) {
  const { language } = useLanguage();
  
  const isConfidential = level === 'confidential';
  
  const getMessage = () => {
    if (isConfidential) {
      return language === 'fr' 
        ? 'Document confidentiel — Usage strictement restreint'
        : 'Confidential document — Strictly restricted use';
    }
    return language === 'fr' 
      ? 'Document interne — Usage interne uniquement'
      : 'Internal document — Internal use only';
  };

  return (
    <div 
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium",
        isConfidential 
          ? "bg-destructive/10 text-destructive border border-destructive/20"
          : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
        className
      )}
    >
      {isConfidential ? (
        <Shield className="h-4 w-4 flex-shrink-0" />
      ) : (
        <Lock className="h-4 w-4 flex-shrink-0" />
      )}
      <span>{getMessage()}</span>
    </div>
  );
}
