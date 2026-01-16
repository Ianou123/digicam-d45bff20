import { useState } from 'react';
import { Eye, EyeOff, Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

interface FilterState {
  search: string;
  department: string;
  type: string;
  year: string;
  confidentiality: string;
  status?: string;
}

interface WatchSearchButtonProps {
  currentFilters: FilterState;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

// Sanitize search query to prevent SQL pattern injection
const sanitizeSearchQuery = (query: string): string => {
  if (!query) return '';
  // Remove SQL ILIKE wildcards and limit length
  return query
    .replace(/[%_\\]/g, '') // Remove wildcards
    .trim()
    .substring(0, 100); // Limit length
};

export function WatchSearchButton({ 
  currentFilters, 
  variant = 'outline',
  size = 'sm' 
}: WatchSearchButtonProps) {
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);

  const hasActiveFilters = () => {
    return currentFilters.search || 
           currentFilters.department || 
           currentFilters.type || 
           currentFilters.year || 
           currentFilters.confidentiality;
  };

  const handleWatch = async () => {
    if (!user || !profile?.client_id || !hasActiveFilters()) return;

    setLoading(true);
    try {
      // Create a descriptive name for the watched search
      const parts: string[] = [];
      if (currentFilters.search) parts.push(`"${currentFilters.search}"`);
      if (currentFilters.type) parts.push(currentFilters.type.toUpperCase());
      if (currentFilters.confidentiality) parts.push(currentFilters.confidentiality);
      if (currentFilters.year) parts.push(currentFilters.year);
      
      const searchName = parts.join(' + ') || (language === 'fr' ? 'Recherche surveillée' : 'Watched Search');

      // Sanitize search query before saving
      const sanitizedFilters = {
        ...currentFilters,
        search: sanitizeSearchQuery(currentFilters.search),
      };

      const { error } = await supabase
        .from('saved_searches')
        .insert([{
          user_id: user.id,
          client_id: profile.client_id,
          name: searchName,
          filters: sanitizedFilters as unknown as Json,
          is_pinned: false,
          is_watched: true,
        }]);

      if (error) throw error;

      // Log the action
      await supabase.from('activity_logs').insert([{
        user_id: user.id,
        client_id: profile.client_id,
        action_type: 'update' as const,
        metadata: { 
          action: 'watch_search', 
          filters: JSON.stringify(currentFilters),
          search_name: searchName
        }
      }]);

      toast.success(
        language === 'fr' 
          ? `Surveillance activée : ${searchName}`
          : `Now watching: ${searchName}`,
        {
          description: language === 'fr'
            ? 'Vous serez notifié quand un nouveau document correspond'
            : 'You\'ll be notified when a new document matches'
        }
      );
    } catch (error) {
      console.error('Error creating watch:', error);
      toast.error(
        language === 'fr' 
          ? 'Erreur lors de l\'activation de la surveillance'
          : 'Error activating watch'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!hasActiveFilters()) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size={size}
          onClick={handleWatch}
          disabled={loading}
          className="gap-1.5"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {size !== 'icon' && (
            <span>
              {language === 'fr' ? 'Surveiller' : 'Watch'}
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {language === 'fr' 
            ? 'Recevoir une notification quand un nouveau document correspond à cette recherche'
            : 'Get notified when a new document matches this search'}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}