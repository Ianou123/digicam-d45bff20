import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

export function useFavorites() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    if (!user) {
      setFavoriteIds(new Set());
      setFavoriteCount(0);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('document_favorites')
      .select('document_id')
      .eq('user_id', user.id);

    if (!error && data) {
      setFavoriteIds(new Set(data.map(d => d.document_id)));
      setFavoriteCount(data.length);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const toggleFavorite = useCallback(async (documentId: string) => {
    if (!user) return;

    const isFav = favoriteIds.has(documentId);

    if (isFav) {
      // Remove
      const { error } = await supabase
        .from('document_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('document_id', documentId);

      if (!error) {
        setFavoriteIds(prev => {
          const next = new Set(prev);
          next.delete(documentId);
          return next;
        });
        setFavoriteCount(c => c - 1);
        toast.success(language === 'fr' ? 'Retiré des favoris' : 'Removed from favorites');
      }
    } else {
      // Add
      const { error } = await supabase
        .from('document_favorites')
        .insert({ user_id: user.id, document_id: documentId });

      if (!error) {
        setFavoriteIds(prev => new Set(prev).add(documentId));
        setFavoriteCount(c => c + 1);
        toast.success(language === 'fr' ? 'Ajouté aux favoris' : 'Added to favorites');
      }
    }
  }, [user, favoriteIds, language]);

  const isFavorite = useCallback((documentId: string) => favoriteIds.has(documentId), [favoriteIds]);

  return { favoriteIds, favoriteCount, loading, isFavorite, toggleFavorite, refetch: fetchFavorites };
}
