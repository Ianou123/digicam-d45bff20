import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Download, 
  Edit, 
  Calendar, 
  User, 
  Shield,
  FileText,
  Clock,
  Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { PdfViewer } from '@/components/documents/PdfViewer';
import { ConfidentialityBanner } from '@/components/documents/ConfidentialityBanner';
import { ConfidentialDownloadModal } from '@/components/documents/ConfidentialDownloadModal';
import { LatestBadge } from '@/components/documents/LatestBadge';
import { VersionHistory } from '@/components/documents/VersionHistory';

interface DocumentDetail {
  id: string;
  title: string;
  document_type: string;
  confidentiality_level: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  current_version: number;
  file_url: string;
  file_size: number | null;
  ocr_text: string | null;
  departments: { name: string } | null;
  uploaded_by: string;
}

interface DocumentVersion {
  id: string;
  version_number: number;
  file_url: string;
  created_at: string;
  change_notes: string | null;
  uploaded_by: string;
}

const confidentialityColors: Record<string, string> = {
  public: 'badge-public',
  internal: 'badge-internal',
  confidential: 'badge-confidential',
};

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile, canManageDocuments, isSuperAdmin, isClientAdmin, isClientSuspended } = useAuth();
  const { t, language } = useLanguage();
  const dateLocale = language === 'fr' ? fr : enUS;
  
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [uploaderName, setUploaderName] = useState<string | null>(null);
  const [versions, setVersions] = useState<(DocumentVersion & { uploaded_by_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfidentialModal, setShowConfidentialModal] = useState(false);

  useEffect(() => {
    if (id) {
      fetchDocument();
      if (canManageDocuments) {
        fetchVersions();
      }
    }
  }, [id, canManageDocuments]);

  const fetchDocument = async () => {
    try {
      const { data, error } = await supabase
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
          file_url,
          file_size,
          ocr_text,
          uploaded_by,
          departments(name)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setDocument(data as unknown as DocumentDetail);
        
        // Fetch uploader name separately
        if (data.uploaded_by) {
          const { data: uploaderData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', data.uploaded_by)
            .maybeSingle();
          
          setUploaderName(uploaderData?.full_name || null);
        }
      }

      // Log view
      if (user && profile?.client_id && data) {
        await supabase.from('activity_logs').insert({
          user_id: user.id,
          client_id: profile.client_id,
          action_type: 'view' as const,
          document_id: id,
        });
      }
    } catch (error) {
      console.error('Error fetching document:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVersions = async () => {
    const { data } = await supabase
      .from('document_versions')
      .select(`
        id,
        version_number,
        file_url,
        created_at,
        change_notes,
        uploaded_by
      `)
      .eq('document_id', id)
      .order('version_number', { ascending: false });

    if (data && data.length > 0) {
      // Fetch uploader names for all versions
      const uploaderIds = [...new Set(data.map(v => v.uploaded_by))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', uploaderIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
      
      const versionsWithNames = data.map(v => ({
        ...v,
        uploaded_by_name: profileMap.get(v.uploaded_by) || undefined,
      }));
      
      setVersions(versionsWithNames);
    } else {
      setVersions([]);
    }
  };

  const handleDownloadClick = () => {
    if (!document) return;
    
    // Show warning modal for confidential documents
    if (document.confidentiality_level === 'confidential') {
      setShowConfidentialModal(true);
    } else {
      executeDownload();
    }
  };

  const executeDownload = async () => {
    if (!document) return;

    if (user && profile?.client_id) {
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        client_id: profile.client_id,
        action_type: 'download' as const,
        document_id: document.id,
      });
    }

    try {
      // Fetch the file and create a blob to force download
      const response = await fetch(document.file_url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = window.document.createElement('a');
      link.href = blobUrl;
      link.download = `${document.title}.${document.document_type}`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      
      // Clean up the blob URL
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download error:', error);
      // Fallback: open in same tab
      window.location.href = document.file_url;
    }
    
    setShowConfidentialModal(false);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const formatConfidentiality = (level: string) => {
    switch (level) {
      case 'public': return t('documents.public');
      case 'internal': return t('documents.internal');
      case 'confidential': return t('documents.confidential');
      default: return level;
    }
  };

  // Format "Updated on DD MMM YYYY"
  const formatUpdatedOn = (dateString: string) => {
    const date = new Date(dateString);
    const formattedDate = format(date, 'd MMM yyyy', { locale: dateLocale });
    return language === 'fr' 
      ? `Mis à jour le ${formattedDate}`
      : `Updated on ${formattedDate}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Document non trouvé</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/documents')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour aux documents
        </Button>
      </div>
    );
  }

  const showConfidentialityBanner = document.confidentiality_level === 'internal' || document.confidentiality_level === 'confidential';

  return (
    <div className="space-y-6">
      {/* Confidentiality Banner */}
      {showConfidentialityBanner && (
        <ConfidentialityBanner level={document.confidentiality_level as 'internal' | 'confidential'} />
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/documents')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-serif font-semibold">{document.title}</h1>
              <LatestBadge />
            </div>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="outline" className="uppercase text-xs">
                {document.document_type}
              </Badge>
              <Badge 
                variant="outline" 
                className={cn('text-xs', confidentialityColors[document.confidentiality_level])}
              >
                <Shield className="h-3 w-3 mr-1" />
                {formatConfidentiality(document.confidentiality_level)}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Version {document.current_version}
              </span>
              <span className="text-sm text-muted-foreground">
                •
              </span>
              <span className="text-sm text-muted-foreground">
                {formatUpdatedOn(document.updated_at)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDownloadClick}>
            <Download className="h-4 w-4 mr-2" />
            {t('documents.download')}
          </Button>
          {canManageDocuments && !isClientSuspended && (
            <Button variant="outline" onClick={() => navigate(`/documents/${id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              {t('documents.edit')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Document Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-serif">
                {language === 'fr' ? 'Aperçu du document' : 'Document Preview'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {document.document_type === 'pdf' ? (
                <PdfViewer url={document.file_url} autoFit />
              ) : ['jpg', 'png', 'jpeg', 'gif', 'webp'].includes(document.document_type.toLowerCase()) ? (
                <img
                  src={document.file_url}
                  alt={document.title}
                  className="max-w-full h-auto rounded-lg"
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="h-16 w-16 mb-4 opacity-30" />
                  <p className="text-center">
                    {language === 'fr' 
                      ? 'Aperçu non disponible. Téléchargez pour visualiser.'
                      : 'Preview not available. Download to view.'}
                  </p>
                  <Button variant="outline" className="mt-4" onClick={handleDownloadClick}>
                    <Download className="h-4 w-4 mr-2" />
                    {language === 'fr' ? 'Télécharger pour visualiser' : 'Download to view'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* OCR Text */}
          {document.ocr_text && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-serif">{t('documents.ocrText')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-4 max-h-[300px] overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap">{document.ocr_text}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-serif">
                {language === 'fr' ? 'Informations' : 'Information'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('documents.uploadDate')}</p>
                  <p className="text-sm font-medium">
                    {format(new Date(document.created_at), 'PPP', { locale: dateLocale })}
                  </p>
                </div>
              </div>
              
              <Separator />
              
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('documents.lastModified')}</p>
                  <p className="text-sm font-medium">
                    {format(new Date(document.updated_at), 'PPP', { locale: dateLocale })}
                  </p>
                </div>
              </div>
              
              <Separator />
              
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('documents.uploadedBy')}</p>
                  <p className="text-sm font-medium">{uploaderName || 'N/A'}</p>
                </div>
              </div>

              {document.departments && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('documents.department')}</p>
                    <Badge variant="secondary">{document.departments.name}</Badge>
                  </div>
                </>
              )}

              <Separator />
              
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  {language === 'fr' ? 'Taille du fichier' : 'File size'}
                </p>
                <p className="text-sm font-medium">{formatFileSize(document.file_size)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          {document.tags && document.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-serif flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  {t('documents.tags')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {document.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Version History (Admin only) */}
          {(isSuperAdmin || isClientAdmin) && (
            <VersionHistory 
              versions={versions} 
              currentVersion={document.current_version} 
            />
          )}
        </div>
      </div>

      {/* Confidential Download Modal */}
      <ConfidentialDownloadModal
        open={showConfidentialModal}
        onOpenChange={setShowConfidentialModal}
        onConfirm={executeDownload}
        documentTitle={document.title}
      />
    </div>
  );
}
