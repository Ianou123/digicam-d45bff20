import { 
  FileText, 
  Lock, 
  Share2,
  Star
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface StatusStats {
  pendingValidation: number;
  archived: number;
  confidential: number;
  shared: number;
  favorites?: number;
}

interface StatusCardsProps {
  stats: StatusStats;
  onCardClick?: (status: string) => void;
}

export function StatusCards({ stats, onCardClick }: StatusCardsProps) {
  const { language } = useLanguage();

  const cards = [
    {
      key: 'archived',
      label: language === 'fr' ? 'Documents Archivés' : 'Archived Documents',
      value: stats.archived,
      icon: FileText,
      color: 'text-green-600',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-l-green-500',
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
      label: language === 'fr' ? 'Partagés Récents' : 'Recently Shared',
      value: stats.shared,
      icon: Share2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-l-blue-500',
    },
    {
      key: 'favorites',
      label: language === 'fr' ? 'Documents Favoris' : 'Favorite Documents',
      value: stats.favorites ?? 0,
      icon: Star,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-l-yellow-500',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card 
          key={card.key}
          className={cn(
            'border-l-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]',
            card.borderColor,
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
