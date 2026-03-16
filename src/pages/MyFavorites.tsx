import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Star, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/formatters';
import { useFavorites } from '@/hooks/useFavorites';

const formatBytes = (bytes: number | null, language: 'fr' | 'en') => {
  if (!bytes) return language === 'fr' ? '—' : '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
};

export default function MyFavorites() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { favoriteIds, toggleFavorite } = useFavorites();

  const [loading, setLoading] = useState(true);
  const [favoriteDocs, setFavoriteDocs] = useState<any[]>([]);

  useEffect(() => {
    const fetchFavoriteDocs = async () => {
      if (!user || favoriteIds.size === 0) {
        setFavoriteDocs([]);
        setLoading(false);
        return;
      }
      
      setLoading(true);
      const ids = Array.from(favoriteIds);
      
      const { data } = await supabase
        .from('documents')
        .select(`
          id, 
          title, 
          document_type, 
          created_at, 
          status, 
          file_size, 
          department_id, 
          departments!documents_department_id_fkey(name)
        `)
        .in('id', ids)
        .is('deleted_at', null);
        
      setFavoriteDocs(data || []);
      setLoading(false);
    };
    
    fetchFavoriteDocs();
  }, [user, favoriteIds]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[360px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-semibold">
          {language === 'fr' ? 'Mes Favoris' : 'My Favorites'}
        </h1>
        <p className="text-muted-foreground">
          {language === 'fr'
            ? 'Vos documents enregistrés pour y accéder rapidement'
            : 'Your saved documents for quick access'}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{language === 'fr' ? 'Liste de favoris' : 'Favorites List'}</CardTitle>
          <Badge variant="outline">{favoriteDocs.length}</Badge>
        </CardHeader>
        <CardContent>
          {favoriteDocs.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Star className="h-12 w-12 mx-auto mb-3 opacity-20 text-yellow-500" />
              <p className="font-medium text-lg">
                {language === 'fr' ? 'Aucun favori pour le moment' : 'No favorites yet'}
              </p>
              <p className="text-sm mt-1 mb-4">
                {language === 'fr' 
                  ? 'Cliquez sur l\'étoile à côté d\'un document pour l\'ajouter ici.' 
                  : 'Click the star icon next to a document to add it here.'}
              </p>
              <Button onClick={() => navigate('/documents')}>
                {language === 'fr' ? 'Parcourir les documents' : 'Browse documents'}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>{language === 'fr' ? 'Nom du document' : 'Document name'}</TableHead>
                  <TableHead>{language === 'fr' ? 'Type' : 'Type'}</TableHead>
                  <TableHead>{language === 'fr' ? 'Département' : 'Department'}</TableHead>
                  <TableHead>{language === 'fr' ? 'Date' : 'Date'}</TableHead>
                  <TableHead>{language === 'fr' ? 'Taille' : 'Size'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {favoriteDocs.map((doc) => (
                  <TableRow 
                    key={doc.id} 
                    className="cursor-pointer hover:bg-muted/50" 
                    onClick={() => navigate(`/documents/${doc.id}`)}
                  >
                    <TableCell onClick={(e) => { e.stopPropagation(); toggleFavorite(doc.id); }}>
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 hover:scale-110 transition-transform cursor-pointer" />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {doc.title}
                      </div>
                    </TableCell>
                    <TableCell className="uppercase text-xs text-muted-foreground">{doc.document_type}</TableCell>
                    <TableCell>{doc.departments?.name || (language === 'fr' ? 'Général' : 'General')}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-muted-foreground text-sm">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(doc.created_at, language)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatBytes(doc.file_size, language)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
