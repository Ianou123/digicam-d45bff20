import { useState, useEffect } from 'react';
import { Bell, BellOff, Eye, Trash2, Loader2, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

interface FilterState {
  search: string;
  department: string;
  type: string;
  year: string;
  confidentiality: string;
  status?: string;
}

interface WatchedSearch {
  id: string;
  name: string;
  filters: FilterState;
  is_watched: boolean;
  last_matched_at: string | null;
  created_at: string;
}

interface WatchedSearchesListProps {
  onApplySearch?: (filters: FilterState) => void;
}

export function WatchedSearchesList({ onApplySearch }: WatchedSearchesListProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const dateLocale = language === 'fr' ? fr : enUS;
  
  const [searches, setSearches] = useState<WatchedSearch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchWatchedSearches();
    }
  }, [user]);

  const fetchWatchedSearches = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_watched', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSearches((data || []).map(s => ({
        id: s.id,
        name: s.name,
        filters: s.filters as unknown as FilterState,
        is_watched: s.is_watched ?? false,
        last_matched_at: s.last_matched_at,
        created_at: s.created_at,
      })));
    } catch (error) {
      console.error('Error fetching watched searches:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleWatch = async (search: WatchedSearch) => {
    try {
      const { error } = await supabase
        .from('saved_searches')
        .update({ is_watched: !search.is_watched })
        .eq('id', search.id);

      if (error) throw error;

      setSearches(prev => 
        prev.map(s => s.id === search.id ? { ...s, is_watched: !s.is_watched } : s)
      );

      toast.success(
        search.is_watched
          ? (language === 'fr' ? 'Surveillance désactivée' : 'Watch disabled')
          : (language === 'fr' ? 'Surveillance activée' : 'Watch enabled')
      );
    } catch (error) {
      console.error('Error toggling watch:', error);
    }
  };

  const deleteWatch = async (id: string) => {
    try {
      const { error } = await supabase
        .from('saved_searches')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSearches(prev => prev.filter(s => s.id !== id));
      toast.success(language === 'fr' ? 'Surveillance supprimée' : 'Watch removed');
    } catch (error) {
      console.error('Error deleting watch:', error);
    }
  };

  const getFilterSummary = (filters: FilterState) => {
    const parts: string[] = [];
    if (filters.search) parts.push(`"${filters.search}"`);
    if (filters.type) parts.push(filters.type.toUpperCase());
    if (filters.confidentiality) parts.push(filters.confidentiality);
    if (filters.year) parts.push(filters.year);
    return parts.join(' • ') || (language === 'fr' ? 'Tous les documents' : 'All documents');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (searches.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="text-muted-foreground mb-2">
            {language === 'fr' 
              ? 'Aucune recherche surveillée'
              : 'No watched searches'}
          </p>
          <p className="text-sm text-muted-foreground">
            {language === 'fr' 
              ? 'Utilisez le bouton "Surveiller" lors d\'une recherche pour recevoir des notifications'
              : 'Use the "Watch" button when searching to receive notifications'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          {language === 'fr' ? 'Recherches surveillées' : 'Watched Searches'}
        </CardTitle>
        <CardDescription>
          {language === 'fr' 
            ? 'Recevez une notification quand un nouveau document correspond'
            : 'Get notified when a new document matches'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-3">
            {searches.map(search => (
              <div
                key={search.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{search.name}</p>
                    {!search.is_watched && (
                      <Badge variant="secondary" className="text-xs">
                        {language === 'fr' ? 'Pausé' : 'Paused'}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-0.5">
                    {getFilterSummary(search.filters)}
                  </p>
                  {search.last_matched_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {language === 'fr' ? 'Dernière correspondance : ' : 'Last match: '}
                      {format(new Date(search.last_matched_at), 'PPp', { locale: dateLocale })}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {onApplySearch && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onApplySearch(search.filters)}
                      title={language === 'fr' ? 'Appliquer cette recherche' : 'Apply this search'}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  <Switch
                    checked={search.is_watched}
                    onCheckedChange={() => toggleWatch(search)}
                    title={search.is_watched 
                      ? (language === 'fr' ? 'Désactiver' : 'Disable')
                      : (language === 'fr' ? 'Activer' : 'Enable')
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteWatch(search.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}