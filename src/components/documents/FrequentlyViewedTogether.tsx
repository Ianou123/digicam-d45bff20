import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface CoViewedDocument {
  id: string;
  title: string;
  document_type: string;
  confidentiality_level: string;
  strength: number;
}

interface FrequentlyViewedTogetherProps {
  documentId: string;
  className?: string;
  maxItems?: number;
}

const confidentialityColors: Record<string, string> = {
  public: 'bg-green-100 text-green-800 border-green-200',
  internal: 'bg-blue-100 text-blue-800 border-blue-200',
  confidential: 'bg-red-100 text-red-800 border-red-200',
};

export function FrequentlyViewedTogether({ documentId, className, maxItems = 5 }: FrequentlyViewedTogetherProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { t, language } = useLanguage();
  const [coViewedDocs, setCoViewedDocs] = useState<CoViewedDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCoViewedDocuments();
  }, [documentId, profile?.client_id]);

  const fetchCoViewedDocuments = async () => {
    if (!profile?.client_id) {
      setLoading(false);
      return;
    }

    try {
      // Fetch documents frequently viewed together using the document_relations table
      const { data: relations, error } = await supabase
        .from('document_relations')
        .select(`
          related_document_id,
          strength,
          documents!document_relations_related_document_id_fkey(
            id,
            title,
            document_type,
            confidentiality_level,
            deleted_at
          )
        `)
        .eq('source_document_id', documentId)
        .eq('relation_type', 'co_viewed')
        .order('strength', { ascending: false })
        .limit(maxItems);

      if (error) throw error;

      if (relations && relations.length > 0) {
        const docs: CoViewedDocument[] = relations
          .filter((r: any) => r.documents && !r.documents.deleted_at)
          .map((r: any) => ({
            id: r.documents.id,
            title: r.documents.title,
            document_type: r.documents.document_type,
            confidentiality_level: r.documents.confidentiality_level,
            strength: r.strength,
          }));

        setCoViewedDocs(docs);
      }
    } catch (error) {
      console.error('Error fetching co-viewed documents:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (coViewedDocs.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          {language === 'fr' ? 'Fréquemment vus ensemble' : 'Frequently Viewed Together'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {coViewedDocs.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
            onClick={() => navigate(`/documents/${doc.id}`)}
          >
            <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                {doc.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-xs uppercase">
                  {doc.document_type}
                </Badge>
                <Badge 
                  variant="outline" 
                  className={cn('text-xs', confidentialityColors[doc.confidentiality_level])}
                >
                  {doc.confidentiality_level === 'public' 
                    ? t('documents.public')
                    : doc.confidentiality_level === 'internal'
                    ? t('documents.internal')
                    : t('documents.confidential')}
                </Badge>
              </div>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              {doc.strength}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
