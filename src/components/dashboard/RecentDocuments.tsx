import { FileText, Eye, ChevronRight, Sparkles, Download, Share2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Document {
  id: string;
  title: string;
  document_type: string;
  confidentiality_level: string;
  status?: string;
  created_at: string;
  updated_at: string;
  file_url?: string;
  department_id?: string | null;
  departments?: { name: string } | null;
}

interface RecentDocumentsProps {
  documents: Document[];
  onViewAll?: () => void;
  userDepartmentId?: string | null;
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

export function RecentDocuments({ documents, onViewAll, userDepartmentId }: RecentDocumentsProps) {
  const { language } = useLanguage();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const dateLocale = language === 'fr' ? fr : enUS;

  const handleOpenDocument = (id: string) => {
    navigate(`/documents/${id}`);
  };

  const handleDownload = async (e: React.MouseEvent, doc: Document) => {
    e.stopPropagation();
    if (!doc.file_url) {
      toast.error(language === 'fr' ? 'URL du fichier non disponible' : 'File URL not available');
      return;
    }
    
    // Log download activity
    if (user && profile?.client_id) {
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        client_id: profile.client_id,
        action_type: 'download' as const,
        document_id: doc.id,
      });
    }
    
    window.open(doc.file_url, '_blank');
    toast.success(language === 'fr' ? 'Téléchargement démarré' : 'Download started');
  };

  const handleShare = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigate(`/documents/${id}?tab=share`);
  };

  // Split documents into "Relevant to You" and "Global"
  const relevantDocs = userDepartmentId 
    ? documents.filter(doc => doc.department_id === userDepartmentId)
    : [];
  const globalDocs = userDepartmentId 
    ? documents.filter(doc => doc.department_id !== userDepartmentId)
    : documents;

  const renderDocument = (doc: Document, isRelevant: boolean = false) => {
    const status = statusConfig[doc.status || 'ready'];
    
    return (
      <div
        key={doc.id}
        className={cn(
          "flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors",
          isRelevant 
            ? "bg-primary/5 hover:bg-primary/10 border border-primary/10" 
            : "bg-muted/30 hover:bg-muted/50"
        )}
        onClick={() => handleOpenDocument(doc.id)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
            isRelevant ? "bg-primary/20" : "bg-primary/10"
          )}>
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">{doc.title}</p>
              {isRelevant && (
                <Sparkles className="h-3 w-3 text-primary flex-shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {doc.departments?.name && (
                <span className="mr-2">{doc.departments.name} •</span>
              )}
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
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={(e) => handleDownload(e, doc)}
            title={language === 'fr' ? 'Télécharger' : 'Download'}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={(e) => handleShare(e, doc.id)}
            title={language === 'fr' ? 'Partager' : 'Share'}
          >
            <Share2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
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
          <div className="space-y-4">
            {/* Relevant to You Section */}
            {relevantDocs.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Sparkles className="h-4 w-4" />
                  <span>{language === 'fr' ? 'Pour vous' : 'Relevant to You'}</span>
                </div>
                <div className="space-y-2">
                  {relevantDocs.map(doc => renderDocument(doc, true))}
                </div>
              </div>
            )}
            
            {/* Global Section */}
            {globalDocs.length > 0 && (
              <div className="space-y-2">
                {relevantDocs.length > 0 && (
                  <div className="text-sm font-medium text-muted-foreground">
                    {language === 'fr' ? 'Autres documents' : 'Other Documents'}
                  </div>
                )}
                <div className="space-y-2">
                  {globalDocs.map(doc => renderDocument(doc, false))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
