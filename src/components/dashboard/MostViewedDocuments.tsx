import { Eye, FileText, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface MostViewedDocument {
  id: string;
  title: string;
  document_type: string;
  confidentiality_level: string;
  view_count: number;
}

interface MostViewedDocumentsProps {
  documents: MostViewedDocument[];
  className?: string;
}

const confidentialityColors: Record<string, string> = {
  public: 'bg-success/10 text-success border-success/20',
  internal: 'bg-warning/10 text-warning border-warning/20',
  confidential: 'bg-destructive/10 text-destructive border-destructive/20',
};

export function MostViewedDocuments({ documents, className }: MostViewedDocumentsProps) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const getConfidentialityLabel = (level: string) => {
    return t(`documents.${level}`);
  };

  if (documents.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {language === 'fr' ? 'Documents populaires' : 'Popular Documents'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Eye className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">{language === 'fr' ? 'Aucune donnée disponible' : 'No data available'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg font-serif flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          {language === 'fr' ? 'Documents populaires' : 'Popular Documents'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {documents.map((doc, index) => (
            <div 
              key={doc.id} 
              className="flex items-center gap-3 px-6 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => navigate(`/documents/${doc.id}`)}
            >
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 text-primary font-semibold text-sm">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{doc.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge 
                    variant="outline" 
                    className={cn('text-xs', confidentialityColors[doc.confidentiality_level])}
                  >
                    {getConfidentialityLabel(doc.confidentiality_level)}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Eye className="h-4 w-4" />
                <span className="text-sm font-medium">{doc.view_count}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
