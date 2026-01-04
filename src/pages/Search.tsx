import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Clock, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Document {
  id: string;
  title: string;
  document_type: string;
  confidentiality_level: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  current_version: number;
  departments: { name: string } | null;
}

export default function SearchPage() {
  const navigate = useNavigate();
  const { user, profile, isSuperAdmin } = useAuth();
  const { t } = useLanguage();
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);

    try {
      let searchQuery = supabase
        .from('documents')
        .select(`
          id,
          title,
          document_type,
          confidentiality_level,
          created_at,
          updated_at,
          tags,
          current_version,
          departments(name)
        `)
        .or(`title.ilike.%${query}%,ocr_text.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!isSuperAdmin && profile?.client_id) {
        searchQuery = searchQuery.eq('client_id', profile.client_id);
      }

      const { data, error } = await searchQuery;

      if (error) throw error;

      setResults((data || []) as unknown as Document[]);

      // Log search activity
      if (user && profile?.client_id) {
        await supabase.from('activity_logs').insert({
          user_id: user.id,
          client_id: profile.client_id,
          action_type: 'search' as const,
          search_query: query,
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Erreur lors de la recherche');
    } finally {
      setLoading(false);
    }
  };

  const handleView = (id: string) => {
    navigate(`/documents/${id}`);
  };

  const handleDownload = async (id: string) => {
    if (user && profile?.client_id) {
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        client_id: profile.client_id,
        action_type: 'download' as const,
        document_id: id,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-2xl font-serif font-semibold mb-2">{t('nav.search')}</h2>
        <p className="text-muted-foreground mb-6">
          Recherchez dans les titres, le contenu OCR et les étiquettes
        </p>

        <form onSubmit={handleSearch} className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('documents.searchPlaceholder')}
            className="pl-12 pr-24 h-14 text-lg input-search"
          />
          <Button 
            type="submit" 
            className="absolute right-2 top-1/2 -translate-y-1/2 btn-institutional"
            disabled={loading || !query.trim()}
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              t('nav.search')
            )}
          </Button>
        </form>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : hasSearched ? (
        results.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {results.length} résultat{results.length !== 1 ? 's' : ''} pour "{query}"
            </p>
            <div className="space-y-3">
              {results.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={{
                    ...doc,
                    department: doc.departments,
                    profiles: null,
                  }}
                  onView={handleView}
                  onDownload={handleDownload}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">
              Aucun résultat pour "{query}"
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Essayez avec d'autres termes de recherche
            </p>
          </div>
        )
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-serif flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Conseils de recherche
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Utilisez des mots-clés spécifiques pour des résultats précis</li>
              <li>• La recherche s'effectue dans les titres et le contenu OCR</li>
              <li>• Les étiquettes (tags) sont également recherchables</li>
              <li>• Utilisez les filtres sur la page Documents pour affiner</li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}