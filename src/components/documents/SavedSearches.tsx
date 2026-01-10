import { useState, useEffect } from 'react';
import { Bookmark, BookmarkPlus, X, Pin, PinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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

interface SavedSearch {
  id: string;
  name: string;
  filters: FilterState;
  is_pinned: boolean;
  created_at: string;
}

interface SavedSearchesProps {
  currentFilters: FilterState;
  onApplySearch: (filters: FilterState) => void;
}

export function SavedSearches({ currentFilters, onApplySearch }: SavedSearchesProps) {
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [newSearchName, setNewSearchName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  useEffect(() => {
    if (user) {
      fetchSavedSearches();
    }
  }, [user]);

  const fetchSavedSearches = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('user_id', user.id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (data) {
      setSavedSearches(data.map(s => ({
        ...s,
        filters: s.filters as unknown as FilterState,
      })));
    }
  };

  const hasActiveFilters = () => {
    return currentFilters.search || 
           currentFilters.department || 
           currentFilters.type || 
           currentFilters.year || 
           currentFilters.confidentiality;
  };

  const handleSaveSearch = async () => {
    if (!user || !profile?.client_id || !newSearchName.trim()) return;

    try {
      const { error } = await supabase
        .from('saved_searches')
        .insert([{
          user_id: user.id,
          client_id: profile.client_id,
          name: newSearchName.trim(),
          filters: currentFilters as unknown as Json,
          is_pinned: false,
        }]);

      if (error) throw error;

      toast.success(language === 'fr' ? 'Recherche sauvegardée' : 'Search saved');
      setNewSearchName('');
      setShowSaveForm(false);
      fetchSavedSearches();
    } catch (error) {
      console.error('Error saving search:', error);
      toast.error(language === 'fr' ? 'Erreur lors de la sauvegarde' : 'Error saving search');
    }
  };

  const handleDeleteSearch = async (id: string) => {
    try {
      const { error } = await supabase
        .from('saved_searches')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success(language === 'fr' ? 'Recherche supprimée' : 'Search deleted');
      fetchSavedSearches();
    } catch (error) {
      console.error('Error deleting search:', error);
    }
  };

  const handleTogglePin = async (search: SavedSearch) => {
    try {
      const { error } = await supabase
        .from('saved_searches')
        .update({ is_pinned: !search.is_pinned })
        .eq('id', search.id);

      if (error) throw error;

      fetchSavedSearches();
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  const handleApplySearch = (search: SavedSearch) => {
    onApplySearch(search.filters);
    setIsOpen(false);
  };

  const getFilterSummary = (filters: FilterState) => {
    const parts: string[] = [];
    if (filters.search) parts.push(`"${filters.search}"`);
    if (filters.type) parts.push(filters.type.toUpperCase());
    if (filters.confidentiality) parts.push(filters.confidentiality);
    if (filters.year) parts.push(filters.year);
    return parts.length > 0 ? parts.join(', ') : (language === 'fr' ? 'Tous' : 'All');
  };

  const pinnedSearches = savedSearches.filter(s => s.is_pinned);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Pinned searches as badges */}
      {pinnedSearches.map(search => (
        <Badge
          key={search.id}
          variant="secondary"
          className="cursor-pointer hover:bg-secondary/80 transition-colors gap-1"
          onClick={() => handleApplySearch(search)}
        >
          <Pin className="h-3 w-3" />
          {search.name}
        </Badge>
      ))}

      {/* Saved searches dropdown */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <Bookmark className="h-4 w-4" />
            {language === 'fr' ? 'Recherches' : 'Searches'}
            {savedSearches.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {savedSearches.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">
                {language === 'fr' ? 'Recherches sauvegardées' : 'Saved Searches'}
              </h4>
              {hasActiveFilters() && !showSaveForm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSaveForm(true)}
                >
                  <BookmarkPlus className="h-4 w-4 mr-1" />
                  {language === 'fr' ? 'Sauvegarder' : 'Save'}
                </Button>
              )}
            </div>

            {/* Save form */}
            {showSaveForm && (
              <div className="flex gap-2">
                <Input
                  placeholder={language === 'fr' ? 'Nom de la recherche...' : 'Search name...'}
                  value={newSearchName}
                  onChange={(e) => setNewSearchName(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveSearch();
                    if (e.key === 'Escape') setShowSaveForm(false);
                  }}
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveSearch} disabled={!newSearchName.trim()}>
                  {language === 'fr' ? 'OK' : 'Save'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowSaveForm(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* List of saved searches */}
            {savedSearches.length > 0 ? (
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-1">
                  {savedSearches.map(search => (
                    <div
                      key={search.id}
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer group"
                    >
                      <div 
                        className="flex-1 min-w-0"
                        onClick={() => handleApplySearch(search)}
                      >
                        <p className="font-medium text-sm truncate">{search.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {getFilterSummary(search.filters)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePin(search);
                        }}
                      >
                        {search.is_pinned ? (
                          <PinOff className="h-3.5 w-3.5" />
                        ) : (
                          <Pin className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSearch(search.id);
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {language === 'fr' 
                  ? 'Aucune recherche sauvegardée'
                  : 'No saved searches'}
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
