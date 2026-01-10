import { 
  FileCheck, 
  FileClock, 
  Archive, 
  Lock, 
  Share2,
  FileText 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface StatusStats {
  processing: number;
  pendingValidation: number;
  archived: number;
  confidential: number;
  shared: number;
}

interface StatusCardsProps {
  stats: StatusStats;
  onCardClick?: (status: string) => void;
}

export function StatusCards({ stats, onCardClick }: StatusCardsProps) {
  const { language } = useLanguage();

  const cards = [
    {
      key: 'processing',
      label: language === 'fr' ? 'À traiter' : 'Processing',
      value: stats.processing,
      icon: FileClock,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-l-warning',
    },
    {
      key: 'pendingValidation',
      label: language === 'fr' ? 'À valider' : 'Pending Validation',
      value: stats.pendingValidation,
      icon: FileCheck,
      color: 'text-info',
      bgColor: 'bg-info/10',
      borderColor: 'border-l-info',
    },
    {
      key: 'archived',
      label: language === 'fr' ? 'Archives' : 'Archived',
      value: stats.archived,
      icon: Archive,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      borderColor: 'border-l-muted-foreground',
    },
    {
      key: 'confidential',
      label: language === 'fr' ? 'Confidentiels' : 'Confidential',
      value: stats.confidential,
      icon: Lock,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      borderColor: 'border-l-destructive',
    },
    {
      key: 'shared',
      label: language === 'fr' ? 'Partagés récents' : 'Recently Shared',
      value: stats.shared,
      icon: Share2,
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-l-success',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <Card 
          key={card.key}
          className={cn(
            'border-l-4 cursor-pointer transition-all hover:shadow-md',
            card.borderColor,
            onCardClick && 'hover:scale-[1.02]'
          )}
          onClick={() => onCardClick?.(card.key)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
            <div className={cn('p-2 rounded-lg', card.bgColor)}>
              <card.icon className={cn('h-4 w-4', card.color)} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
