import { FileText, Eye, Download, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Document {
  id: string;
  title: string;
  document_type: string;
  confidentiality_level: string;
  status?: string;
  created_at: string;
  updated_at: string;
}

interface RecentDocumentsProps {
  documents: Document[];
  onViewAll?: () => void;
}

const statusConfig: Record<string, { label: { fr: string; en: string }; className: string }> = {
  processing: { 
    label: { fr: 'En traitement', en: 'Processing' }, 
    className: 'bg-warning/10 text-warning-foreground border-warning/20' 
  },
  ready: { 
    label: { fr: 'Prêt', en: 'Ready' }, 
    className: 'bg-success/10 text-success border-success/20' 
  },
  pending_validation: { 
    label: { fr: 'À valider', en: 'Pending' }, 
    className: 'bg-info/10 text-info border-info/20' 
  },
  archived: { 
    label: { fr: 'Archivé', en: 'Archived' }, 
    className: 'bg-muted text-muted-foreground' 
  },
};

const confidentialityColors: Record<string, string> = {
  public: 'badge-public',
  internal: 'badge-internal',
  confidential: 'badge-confidential',
};

export function RecentDocuments({ documents, onViewAll }: RecentDocumentsProps) {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const dateLocale = language === 'fr' ? fr : enUS;

  const handleOpenDocument = (id: string) => {
    navigate(`/documents/${id}`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg font-serif">
          {language === 'fr' ? 'Derniers documents' : 'Recent Documents'}
        </CardTitle>
        {onViewAll && (
          <Button variant="ghost" size="sm" onClick={onViewAll}>
            {language === 'fr' ? 'Voir tous' : 'View all'}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>{language === 'fr' ? 'Aucun document récent' : 'No recent documents'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => {
              const status = statusConfig[doc.status || 'ready'];
              
              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleOpenDocument(doc.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{doc.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(doc.updated_at), 'dd MMM yyyy', { locale: dateLocale })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {status && (
                      <Badge variant="outline" className={cn('text-xs', status.className)}>
                        {status.label[language]}
                      </Badge>
                    )}
                    <Badge 
                      variant="outline" 
                      className={cn('text-xs', confidentialityColors[doc.confidentiality_level])}
                    >
                      {doc.confidentiality_level === 'public' 
                        ? (language === 'fr' ? 'Public' : 'Public')
                        : doc.confidentiality_level === 'internal'
                        ? (language === 'fr' ? 'Interne' : 'Internal')
                        : (language === 'fr' ? 'Confidentiel' : 'Confidential')
                      }
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
