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
  Tag,
  Share2,
  Archive,
  CheckCircle,
  Copy,
  Search,
  History,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Upload,
  XCircle,
  Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getSignedDocumentUrl, downloadDocument } from '@/lib/storage';
import { PdfViewer } from '@/components/documents/PdfViewer';
import { SignedImage } from '@/components/documents/SignedImage';
import { ConfidentialityBanner } from '@/components/documents/ConfidentialityBanner';
import { ConfidentialDownloadModal } from '@/components/documents/ConfidentialDownloadModal';
import { RelatedDocuments } from '@/components/documents/RelatedDocuments';
import { FrequentlyViewedTogether } from '@/components/documents/FrequentlyViewedTogether';
import { RequestUpdateButton } from '@/components/documents/RequestUpdateButton';
import { DocumentShareTab } from '@/components/documents/DocumentShareTab';
import { setPageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';

interface DocumentDetail {
  id: string;
  title: string;
  document_type: string;
  confidentiality_level: string;
  status: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  current_version: number;
  file_url: string;
  file_size: number | null;
  ocr_text: string | null;
  document_date: string | null;
  departments: { name: string } | null;
  uploaded_by: string;
  folder_id: string | null;
}

interface DocumentVersion {
  id: string;
  version_number: number;
  file_url: string;
  created_at: string;
  change_notes: string | null;
  uploaded_by: string;
  uploaded_by_name?: string;
}

interface AuditEvent {
  id: string;
  action_type: string;
  created_at: string;
  user_name?: string;
  metadata?: {
    action?: string;
    rejection_reason?: string;
    comment?: string;
    previous_status?: string;
    new_status?: string;
  } | null;
}

const confidentialityColors: Record<string, string> = {
  public: 'badge-public',
  internal: 'badge-internal',
  confidential: 'badge-confidential',
};

const statusConfig: Record<string, { label: { fr: string; en: string }; className: string; icon: typeof CheckCircle }> = {
  processing: { 
    label: { fr: 'En traitement', en: 'Processing' }, 
    className: 'bg-warning/10 text-warning-foreground border-warning/20',
    icon: Clock
  },
  ready: { 
    label: { fr: 'Prêt', en: 'Ready' }, 
    className: 'bg-success/10 text-success border-success/20',
    icon: CheckCircle
  },
  pending_validation: { 
    label: { fr: 'À valider', en: 'Pending Validation' }, 
    className: 'bg-info/10 text-info border-info/20',
    icon: Eye
  },
  rejected: { 
    label: { fr: 'Rejeté', en: 'Rejected' }, 
    className: 'bg-destructive/10 text-destructive border-destructive/20',
    icon: XCircle
  },
  archived: { 
    label: { fr: 'Archivé', en: 'Archived' }, 
    className: 'bg-muted text-muted-foreground',
    icon: Archive
  },
};

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile, canManageDocuments, isSuperAdmin, isClientAdmin, isClientSuspended, isStaff, clientModule } = useAuth();
  const { t, language } = useLanguage();
  const dateLocale = language === 'fr' ? fr : enUS;
  
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [uploaderName, setUploaderName] = useState<string | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfidentialModal, setShowConfidentialModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [proposeComment, setProposeComment] = useState('');
  const [ocrSearchQuery, setOcrSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('summary');

  useEffect(() => {
    if (id) {
      fetchDocument();
      fetchVersions();
      fetchAuditEvents();
    }
  }, [id]);

  const fetchDocument = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          id,
          title,
          document_type,
          confidentiality_level,
          status,
          created_at,
          updated_at,
          tags,
          current_version,
          file_url,
          file_size,
          ocr_text,
          document_date,
          uploaded_by,
          folder_id,
          departments!documents_department_id_fkey(name)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setDocument(data as unknown as DocumentDetail);
        
        // Set dynamic page title
        setPageTitle(data.title);
        
        // Fetch uploader name
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
      .select('id, version_number, file_url, created_at, change_notes, uploaded_by')
      .eq('document_id', id)
      .order('version_number', { ascending: false });

    if (data && data.length > 0) {
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
    }
  };

  const fetchAuditEvents = async () => {
    const { data } = await supabase
      .from('activity_logs')
      .select('id, action_type, created_at, user_id, metadata')
      .eq('document_id', id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      const userIds = [...new Set(data.map(e => e.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
      
      const eventsWithNames = data.map(e => ({
        id: e.id,
        action_type: e.action_type,
        created_at: e.created_at,
        user_name: profileMap.get(e.user_id) || undefined,
        metadata: e.metadata as AuditEvent['metadata'],
      }));
      
      setAuditEvents(eventsWithNames);
    }
  };

  const handleDownloadClick = () => {
    if (!document) return;
    
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

    const filename = `${document.title}.${document.document_type}`;
    const success = await downloadDocument(document.file_url, filename);
    
    if (!success) {
      toast.error(language === 'fr' ? 'Erreur de téléchargement' : 'Download error');
    }
    
    setShowConfidentialModal(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!document || !canManageDocuments) return;

    try {
      const { error } = await supabase
        .from('documents')
        .update({ status: newStatus })
        .eq('id', document.id);

      if (error) throw error;

      setDocument({ ...document, status: newStatus });
      toast.success(language === 'fr' ? 'Statut mis à jour' : 'Status updated');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(language === 'fr' ? 'Erreur lors de la mise à jour' : 'Error updating');
    }
  };

  const handleValidateDocument = async () => {
    if (!document || !canManageDocuments || !user || !profile?.client_id) return;

    try {
      const { error } = await supabase
        .from('documents')
        .update({ status: 'ready', updated_at: new Date().toISOString() })
        .eq('id', document.id);

      if (error) throw error;

      // Log the validation action
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        client_id: profile.client_id,
        action_type: 'update' as const,
        document_id: document.id,
        details: { action: 'validate', previous_status: 'pending_validation', new_status: 'ready' }
      });

      setDocument({ ...document, status: 'ready' });
      toast.success(language === 'fr' ? 'Document validé avec succès' : 'Document validated successfully');
    } catch (error) {
      console.error('Error validating document:', error);
      toast.error(language === 'fr' ? 'Erreur lors de la validation' : 'Validation error');
    }
  };

  const handleRejectDocument = async () => {
    if (!document || !canManageDocuments || !user || !profile?.client_id) return;

    try {
      const { error } = await supabase
        .from('documents')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', document.id);

      if (error) throw error;

      // Log the rejection action with reason
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        client_id: profile.client_id,
        action_type: 'update' as const,
        document_id: document.id,
        metadata: { 
          action: 'reject', 
          previous_status: 'pending_validation', 
          new_status: 'rejected',
          rejection_reason: rejectReason.trim() || null
        }
      });

      setDocument({ ...document, status: 'rejected' });
      setShowRejectModal(false);
      setRejectReason('');
      toast.success(language === 'fr' ? 'Document rejeté' : 'Document rejected');
    } catch (error) {
      console.error('Error rejecting document:', error);
      toast.error(language === 'fr' ? 'Erreur lors du rejet' : 'Rejection error');
    }
  };

  const handleResubmitDocument = async () => {
    if (!document || !canManageDocuments || !user || !profile?.client_id) return;

    try {
      const { error } = await supabase
        .from('documents')
        .update({ status: 'pending_validation', updated_at: new Date().toISOString() })
        .eq('id', document.id);

      if (error) throw error;

      // Log the resubmission action
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        client_id: profile.client_id,
        action_type: 'update' as const,
        document_id: document.id,
        metadata: { 
          action: 'resubmit', 
          previous_status: 'rejected', 
          new_status: 'pending_validation'
        }
      });

      setDocument({ ...document, status: 'pending_validation' });
      toast.success(language === 'fr' ? 'Document re-soumis pour validation' : 'Document resubmitted for validation');
    } catch (error) {
      console.error('Error resubmitting document:', error);
      toast.error(language === 'fr' ? 'Erreur lors de la re-soumission' : 'Resubmission error');
    }
  };

  const handleProposeModification = async () => {
    if (!document || !canManageDocuments || !user || !profile?.client_id) return;

    try {
      const { error } = await supabase
        .from('documents')
        .update({ status: 'pending_validation', updated_at: new Date().toISOString() })
        .eq('id', document.id);

      if (error) throw error;

      // Log the propose modification action with comment
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        client_id: profile.client_id,
        action_type: 'update' as const,
        document_id: document.id,
        metadata: { 
          action: 'propose_modification', 
          previous_status: document.status, 
          new_status: 'pending_validation',
          comment: proposeComment.trim() || null
        }
      });

      setDocument({ ...document, status: 'pending_validation' });
      setShowProposeModal(false);
      setProposeComment('');
      // Refresh audit events to show the new log
      fetchAuditEvents();
      toast.success(language === 'fr' ? 'Document soumis pour validation' : 'Document submitted for validation');
    } catch (error) {
      console.error('Error proposing modification:', error);
      toast.error(language === 'fr' ? 'Erreur lors de la soumission' : 'Submission error');
    }
  };

  const copyOcrText = () => {
    if (document?.ocr_text) {
      navigator.clipboard.writeText(document.ocr_text);
      toast.success(language === 'fr' ? 'Texte copié' : 'Text copied');
    }
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

  const highlightOcrText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) => 
      regex.test(part) ? <mark key={i} className="bg-warning/30 px-0.5 rounded">{part}</mark> : part
    );
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
        <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground mb-4">
          {language === 'fr' ? 'Document non trouvé' : 'Document not found'}
        </p>
        <Button variant="outline" onClick={() => navigate('/documents')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {language === 'fr' ? 'Retour aux documents' : 'Back to documents'}
        </Button>
      </div>
    );
  }

  const status = statusConfig[document.status] || statusConfig.ready;
  const StatusIcon = status.icon;
  const showConfidentialityBanner = document.confidentiality_level === 'internal' || document.confidentiality_level === 'confidential';

  return (
    <div className="space-y-4">
      {/* Confidentiality Banner */}
      {showConfidentialityBanner && (
        <ConfidentialityBanner level={document.confidentiality_level as 'internal' | 'confidential'} />
      )}

      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/documents')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-serif font-semibold truncate">{document.title}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className="uppercase text-xs">
              {document.document_type}
            </Badge>
            <Badge variant="outline" className={cn('text-xs', status.className)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label[language]}
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
          </div>
        </div>
      </div>

      {/* Split View Layout */}
      <div className="grid gap-4 lg:grid-cols-5 min-h-[calc(100vh-220px)]">
        {/* Left: Document Preview (3 cols) */}
        <div className="lg:col-span-3">
          <Card className="h-full">
            <CardContent className="p-4 h-full">
              {document.document_type === 'pdf' ? (
                <PdfViewer url={document.file_url} autoFit className="h-full" />
              ) : ['jpg', 'png', 'jpeg', 'gif', 'webp'].includes(document.document_type.toLowerCase()) ? (
                <div className="flex items-center justify-center h-full bg-muted/30 rounded-lg p-4">
                  <SignedImage
                    fileUrl={document.file_url}
                    alt={document.title}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
                  <FileText className="h-24 w-24 mb-4 opacity-20" />
                  <p className="text-center mb-4">
                    {language === 'fr' 
                      ? 'Aperçu non disponible pour ce type de fichier'
                      : 'Preview not available for this file type'}
                  </p>
                  <Button onClick={handleDownloadClick}>
                    <Download className="h-4 w-4 mr-2" />
                    {language === 'fr' ? 'Télécharger pour visualiser' : 'Download to view'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Tabs Panel (2 cols) */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            {/* Quick Actions */}
            <div className="p-4 border-b flex flex-wrap gap-2">
              {canManageDocuments && !isClientSuspended && document.status === 'pending_validation' && (
                <>
                  <Button size="sm" variant="default" onClick={handleValidateDocument}>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {language === 'fr' ? 'Valider' : 'Validate'}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setShowRejectModal(true)}>
                    <XCircle className="h-4 w-4 mr-1" />
                    {language === 'fr' ? 'Rejeter' : 'Reject'}
                  </Button>
                </>
              )}
              {canManageDocuments && !isClientSuspended && document.status === 'rejected' && (
                <Button size="sm" variant="default" onClick={handleResubmitDocument}>
                  <Upload className="h-4 w-4 mr-1" />
                  {language === 'fr' ? 'Re-soumettre' : 'Resubmit'}
                </Button>
              )}
              {isStaff && !isClientSuspended && document.status === 'ready' && (
                <Button size="sm" variant="default" onClick={() => setShowProposeModal(true)}>
                  <Send className="h-4 w-4 mr-1" />
                  {language === 'fr' ? 'Proposer des modifications' : 'Propose Changes'}
                </Button>
              )}
              {canManageDocuments && !isClientSuspended && document.status !== 'archived' && (
                <Button size="sm" variant="outline" onClick={() => handleStatusChange('archived')}>
                  <Archive className="h-4 w-4 mr-1" />
                  {language === 'fr' ? 'Archiver' : 'Archive'}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleDownloadClick}>
                <Download className="h-4 w-4 mr-1" />
                {t('documents.download')}
              </Button>
              {canManageDocuments && !isClientSuspended && (
                <Button size="sm" variant="outline" onClick={() => navigate(`/documents/${id}/edit`)}>
                  <Edit className="h-4 w-4 mr-1" />
                  {t('documents.edit')}
                </Button>
              )}
              {/* Request Update Button for Staff */}
              <RequestUpdateButton 
                documentId={document.id} 
                documentTitle={document.title}
                documentOwnerId={document.uploaded_by}
                documentCreatedAt={document.created_at}
              />
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-[calc(100%-60px)]">
              <TabsList className="grid grid-cols-3 lg:grid-cols-6 m-4 mb-0">
                <TabsTrigger value="summary" className="text-xs">
                  {language === 'fr' ? 'Résumé' : 'Summary'}
                </TabsTrigger>
                <TabsTrigger value="metadata" className="text-xs">
                  {language === 'fr' ? 'Méta' : 'Meta'}
                </TabsTrigger>
                <TabsTrigger value="ocr" className="text-xs">OCR</TabsTrigger>
                <TabsTrigger value="versions" className="text-xs">
                  {language === 'fr' ? 'Versions' : 'Versions'} ({versions.length})
                </TabsTrigger>
                <TabsTrigger value="share" className="text-xs">
                  {language === 'fr' ? 'Partage' : 'Share'}
                </TabsTrigger>
                <TabsTrigger value="audit" className="text-xs">
                  Audit ({auditEvents.length})
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 p-4">
                {/* Summary Tab */}
                <TabsContent value="summary" className="mt-0 space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">{document.title}</h3>
                    <div className="space-y-2 text-sm">
                      {document.departments && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{t('documents.department')}:</span>
                          <Badge variant="secondary">{document.departments.name}</Badge>
                        </div>
                      )}
                      {document.tags && document.tags.length > 0 && (
                        <div className="flex items-start gap-2">
                          <span className="text-muted-foreground">{t('documents.tags')}:</span>
                          <div className="flex flex-wrap gap-1">
                            {document.tags.map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">{t('documents.uploadDate')}</p>
                      <p className="font-medium">{format(new Date(document.created_at), 'PPP', { locale: dateLocale })}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t('documents.lastModified')}</p>
                      <p className="font-medium">{format(new Date(document.updated_at), 'PPP', { locale: dateLocale })}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t('documents.uploadedBy')}</p>
                      <p className="font-medium">{uploaderName || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{language === 'fr' ? 'Taille' : 'Size'}</p>
                      <p className="font-medium">{formatFileSize(document.file_size)}</p>
                    </div>
                  </div>
                </TabsContent>

                {/* Metadata Tab */}
                <TabsContent value="metadata" className="mt-0 space-y-4">
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground">{t('documents.title')}</label>
                      <Input value={document.title} disabled className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">{t('documents.type')}</label>
                      <Input value={document.document_type.toUpperCase()} disabled className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">{t('documents.confidentiality')}</label>
                      <Input value={formatConfidentiality(document.confidentiality_level)} disabled className="mt-1" />
                    </div>
                    {document.document_date && (
                      <div>
                        <label className="text-xs text-muted-foreground">
                          {language === 'fr' ? 'Date du document' : 'Document Date'}
                        </label>
                        <Input value={format(new Date(document.document_date), 'PPP', { locale: dateLocale })} disabled className="mt-1" />
                      </div>
                    )}
                  </div>
                  {canManageDocuments && !isClientSuspended && (
                    <Button variant="outline" className="w-full" onClick={() => navigate(`/documents/${id}/edit`)}>
                      <Edit className="h-4 w-4 mr-2" />
                      {language === 'fr' ? 'Modifier les métadonnées' : 'Edit Metadata'}
                    </Button>
                  )}
                </TabsContent>

                {/* OCR Tab */}
                <TabsContent value="ocr" className="mt-0 space-y-4">
                  {document.ocr_text ? (
                    <>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder={language === 'fr' ? 'Rechercher dans le texte...' : 'Search in text...'}
                            value={ocrSearchQuery}
                            onChange={(e) => setOcrSearchQuery(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                        <Button variant="outline" size="icon" onClick={copyOcrText}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4 max-h-[400px] overflow-y-auto">
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {highlightOcrText(document.ocr_text, ocrSearchQuery)}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>{language === 'fr' ? 'Aucun texte OCR disponible' : 'No OCR text available'}</p>
                    </div>
                  )}
                </TabsContent>

                {/* Versions Tab */}
                <TabsContent value="versions" className="mt-0 space-y-4">
                  {canManageDocuments && !isClientSuspended && (
                    <Button variant="outline" className="w-full" onClick={() => navigate(`/documents/${id}/edit`)}>
                      <Upload className="h-4 w-4 mr-2" />
                      {language === 'fr' ? 'Téléverser nouvelle version' : 'Upload New Version'}
                    </Button>
                  )}
                  {versions.length > 0 ? (
                    <div className="space-y-3">
                      {versions.map((version, index) => (
                        <div key={version.id} className={cn(
                          'p-3 rounded-lg border',
                          index === 0 ? 'border-primary bg-primary/5' : 'border-border'
                        )}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant={index === 0 ? 'default' : 'outline'}>
                                v{version.version_number}
                              </Badge>
                              {index === 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {language === 'fr' ? 'Actuelle' : 'Current'}
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(version.created_at), 'dd MMM yyyy HH:mm', { locale: dateLocale })}
                            </span>
                          </div>
                          {version.change_notes && (
                            <p className="text-sm text-muted-foreground mt-2">{version.change_notes}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {language === 'fr' ? 'Par' : 'By'} {version.uploaded_by_name || 'Unknown'}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="font-medium mb-1">
                        {language === 'fr' ? 'Première version' : 'First Version'}
                      </p>
                      <p className="text-sm">
                        {language === 'fr' 
                          ? 'C\'est la première version de ce document. L\'historique apparaîtra lorsque de nouvelles versions seront téléversées.'
                          : 'This is the first version of this document. History will appear when new versions are uploaded.'}
                      </p>
                    </div>
                  )}
                </TabsContent>

                {/* Share Tab */}
                <TabsContent value="share" className="mt-0 space-y-4">
                  <DocumentShareTab documentId={document.id} />
                </TabsContent>

                {/* Audit Tab */}
                <TabsContent value="audit" className="mt-0 space-y-4">
                  {auditEvents.length > 0 ? (
                    <div className="space-y-3">
                      {auditEvents.map((event) => {
                        const isRejection = event.metadata?.action === 'reject';
                        const isValidation = event.metadata?.action === 'validate';
                        const isResubmit = event.metadata?.action === 'resubmit';
                        const isProposeModification = event.metadata?.action === 'propose_modification';
                        
                        const getEventIcon = () => {
                          if (isRejection) return <XCircle className="h-4 w-4 text-destructive" />;
                          if (isValidation) return <CheckCircle className="h-4 w-4 text-success" />;
                          if (isResubmit) return <Upload className="h-4 w-4 text-info" />;
                          if (isProposeModification) return <Send className="h-4 w-4 text-primary" />;
                          return <Eye className="h-4 w-4 text-muted-foreground" />;
                        };
                        
                        const getEventLabel = () => {
                          if (isRejection) return language === 'fr' ? 'Document rejeté' : 'Document rejected';
                          if (isValidation) return language === 'fr' ? 'Document validé' : 'Document validated';
                          if (isResubmit) return language === 'fr' ? 'Document re-soumis' : 'Document resubmitted';
                          if (isProposeModification) return language === 'fr' ? 'Modifications proposées' : 'Changes proposed';
                          return t(`activity.${event.action_type}`);
                        };
                        
                        return (
                          <div key={event.id} className={cn(
                            "flex items-start gap-3 p-3 rounded-lg",
                            isRejection ? "bg-destructive/5 border border-destructive/20" : "hover:bg-muted/50"
                          )}>
                            <div className={cn(
                              "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                              isRejection ? "bg-destructive/10" : isValidation ? "bg-success/10" : isProposeModification ? "bg-primary/10" : "bg-muted"
                            )}>
                              {getEventIcon()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">
                                {getEventLabel()}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {event.user_name || 'Unknown'} • {format(new Date(event.created_at), 'dd MMM yyyy HH:mm', { locale: dateLocale })}
                              </p>
                              {isRejection && event.metadata?.rejection_reason && (
                                <div className="mt-2 p-2 bg-destructive/10 rounded text-sm text-destructive">
                                  <span className="font-medium">{language === 'fr' ? 'Motif : ' : 'Reason: '}</span>
                                  {event.metadata.rejection_reason}
                                </div>
                              )}
                              {isProposeModification && event.metadata?.comment && (
                                <div className="mt-2 p-2 bg-primary/10 rounded text-sm text-primary">
                                  <span className="font-medium">{language === 'fr' ? 'Commentaire : ' : 'Comment: '}</span>
                                  {event.metadata.comment}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="font-medium mb-1">
                        {language === 'fr' ? 'Aucun événement' : 'No activity yet'}
                      </p>
                      <p className="text-sm">
                        {language === 'fr' 
                          ? 'L\'historique des actions (consultation, téléchargement, etc.) apparaîtra ici.'
                          : 'Activity history (views, downloads, etc.) will appear here as users interact with this document.'}
                      </p>
                    </div>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </Card>
        </div>
      </div>

      {/* Related Documents Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <RelatedDocuments documentId={document.id} documentTags={document.tags || []} />
        <FrequentlyViewedTogether documentId={document.id} />
      </div>

      {/* Confidential Download Modal */}
      <ConfidentialDownloadModal
        open={showConfidentialModal}
        onOpenChange={setShowConfidentialModal}
        onConfirm={executeDownload}
        documentTitle={document.title}
      />

      {/* Reject Document Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'fr' ? 'Rejeter le document' : 'Reject Document'}
            </DialogTitle>
            <DialogDescription>
              {language === 'fr' 
                ? 'Le document sera renvoyé en traitement pour correction. Vous pouvez indiquer un motif de rejet.'
                : 'The document will be sent back for processing. You can provide a rejection reason.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">
                {language === 'fr' ? 'Motif du rejet (optionnel)' : 'Rejection reason (optional)'}
              </Label>
              <Textarea
                id="reject-reason"
                placeholder={language === 'fr' 
                  ? 'Ex: Informations manquantes, qualité insuffisante...'
                  : 'E.g.: Missing information, insufficient quality...'}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectModal(false)}>
              {language === 'fr' ? 'Annuler' : 'Cancel'}
            </Button>
            <Button variant="destructive" onClick={handleRejectDocument}>
              <XCircle className="h-4 w-4 mr-1" />
              {language === 'fr' ? 'Confirmer le rejet' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Propose Modification Modal */}
      <Dialog open={showProposeModal} onOpenChange={setShowProposeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'fr' ? 'Proposer des modifications' : 'Propose Changes'}
            </DialogTitle>
            <DialogDescription>
              {language === 'fr' 
                ? 'Le document sera soumis pour validation par un administrateur. Décrivez les modifications effectuées.'
                : 'The document will be submitted for admin validation. Describe the changes you made.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="propose-comment">
                {language === 'fr' ? 'Description des modifications' : 'Description of changes'}
              </Label>
              <Textarea
                id="propose-comment"
                placeholder={language === 'fr' 
                  ? 'Ex: Correction des informations de contact, mise à jour des dates...'
                  : 'E.g.: Fixed contact information, updated dates...'}
                value={proposeComment}
                onChange={(e) => setProposeComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProposeModal(false)}>
              {language === 'fr' ? 'Annuler' : 'Cancel'}
            </Button>
            <Button onClick={handleProposeModification}>
              <Send className="h-4 w-4 mr-1" />
              {language === 'fr' ? 'Soumettre pour validation' : 'Submit for Validation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
