import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Save, Loader2, FileText, History, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { Navigate } from 'react-router-dom';

interface Document {
  id: string;
  title: string;
  document_type: string;
  confidentiality_level: string;
  tags: string[];
  ocr_text: string | null;
  department_id: string | null;
  current_version: number;
  file_url: string;
  client_id: string;
}

interface Department {
  id: string;
  name: string;
  archived_at: string | null;
}

interface DocumentVersion {
  id: string;
  version_number: number;
  file_url: string;
  created_at: string;
  change_notes: string | null;
  file_size: number | null;
}

type ConfidentialityLevel = 'public' | 'internal' | 'confidential';
type DocumentType = 'pdf' | 'jpg' | 'png' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'ppt' | 'pptx';

const fileTypeMap: Record<string, DocumentType> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};

export default function DocumentEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile, canManageDocuments, isSuperAdmin, isClientSuspended } = useAuth();
  const { t, language } = useLanguage();
  const dateLocale = language === 'fr' ? fr : enUS;

  const [document, setDocument] = useState<Document | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Version upload modal
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [versionChangeNotes, setVersionChangeNotes] = useState('');
  const [uploadingVersion, setUploadingVersion] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    departmentId: '',
    confidentiality: 'internal' as ConfidentialityLevel,
    tags: '',
    ocrText: '',
  });

  useEffect(() => {
    if (id) {
      fetchDocument();
      fetchDepartments();
      fetchVersions();
    }
  }, [id]);

  const fetchDocument = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setDocument(data as Document);
        setFormData({
          title: data.title,
          departmentId: data.department_id || '',
          confidentiality: data.confidentiality_level as ConfidentialityLevel,
          tags: (data.tags || []).join(', '),
          ocrText: data.ocr_text || '',
        });
      }
    } catch (error) {
      console.error('Error fetching document:', error);
      toast.error(language === 'fr' ? 'Erreur lors du chargement' : 'Error loading document');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    if (!profile?.client_id) return;

    const { data } = await supabase
      .from('departments')
      .select('id, name, archived_at')
      .eq('client_id', profile.client_id);

    setDepartments(data || []);
  };

  const fetchVersions = async () => {
    const { data } = await supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', id)
      .order('version_number', { ascending: false });

    setVersions((data || []) as DocumentVersion[]);
  };

  const handleSave = async () => {
    if (!document || !user || !profile?.client_id) return;

    setSaving(true);
    try {
      const tags = formData.tags.split(',').map(t => t.trim()).filter(Boolean);

      const { error } = await supabase
        .from('documents')
        .update({
          title: formData.title,
          department_id: formData.departmentId || null,
          confidentiality_level: formData.confidentiality,
          tags,
          ocr_text: formData.ocrText || null,
        })
        .eq('id', document.id);

      if (error) throw error;

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        client_id: profile.client_id,
        action_type: 'update',
        document_id: document.id,
        metadata: { title: formData.title },
      });

      toast.success(language === 'fr' ? 'Document mis à jour' : 'Document updated');
      navigate(`/documents/${document.id}`);
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error(language === 'fr' ? 'Erreur lors de la sauvegarde' : 'Error saving document');
    } finally {
      setSaving(false);
    }
  };

  const handleVersionUpload = async () => {
    if (!newVersionFile || !document || !user || !profile?.client_id) return;

    // Validate file type matches document type
    const newFileType = fileTypeMap[newVersionFile.type];
    if (newFileType !== document.document_type) {
      toast.error(
        language === 'fr'
          ? `Le type de fichier doit être ${document.document_type.toUpperCase()}`
          : `File type must be ${document.document_type.toUpperCase()}`
      );
      return;
    }

    setUploadingVersion(true);
    try {
      // Upload new file
      const fileExt = newVersionFile.name.split('.').pop();
      const sanitizedName = document.title
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 50);
      const filePath = `${profile.client_id}/${Date.now()}_${sanitizedName}_v${document.current_version + 1}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, newVersionFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const newVersion = document.current_version + 1;

      // Insert version record
      const { error: versionError } = await supabase
        .from('document_versions')
        .insert({
          document_id: document.id,
          version_number: newVersion,
          file_url: urlData.publicUrl,
          file_size: newVersionFile.size,
          uploaded_by: user.id,
          change_notes: versionChangeNotes || null,
        });

      if (versionError) throw versionError;

      // Update document with new version
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          current_version: newVersion,
          file_url: urlData.publicUrl,
          file_size: newVersionFile.size,
        })
        .eq('id', document.id);

      if (updateError) throw updateError;

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        client_id: profile.client_id,
        action_type: 'update',
        document_id: document.id,
        metadata: { new_version: newVersion, change_notes: versionChangeNotes },
      });

      toast.success(
        language === 'fr'
          ? `Version ${newVersion} téléversée`
          : `Version ${newVersion} uploaded`
      );

      setVersionModalOpen(false);
      setNewVersionFile(null);
      setVersionChangeNotes('');
      fetchDocument();
      fetchVersions();
    } catch (error) {
      console.error('Error uploading version:', error);
      toast.error(language === 'fr' ? 'Erreur lors du téléversement' : 'Error uploading version');
    } finally {
      setUploadingVersion(false);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  // Access control
  if (!canManageDocuments || isSuperAdmin || isClientSuspended) {
    return <Navigate to="/documents" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {language === 'fr' ? 'Document non trouvé' : 'Document not found'}
        </p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/documents')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {language === 'fr' ? 'Retour aux documents' : 'Back to documents'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/documents/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-serif font-semibold">
              {language === 'fr' ? 'Modifier le document' : 'Edit Document'}
            </h1>
            <p className="text-muted-foreground">
              {document.title} • v{document.current_version}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setVersionModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {language === 'fr' ? 'Nouvelle version' : 'New Version'}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {t('common.save')}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Form */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{language === 'fr' ? 'Métadonnées' : 'Metadata'}</CardTitle>
              <CardDescription>
                {language === 'fr' 
                  ? 'Modifiez les informations du document'
                  : 'Edit document information'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">{t('documents.title')} *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  required
                />
              </div>

              {/* Department */}
              <div className="space-y-2">
                <Label>{t('documents.department')}</Label>
                <Select
                  value={formData.departmentId || 'unassigned'}
                  onValueChange={(v) => setFormData(prev => ({ 
                    ...prev, 
                    departmentId: v === 'unassigned' ? '' : v 
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">
                      {t('documents.unassigned')}
                    </SelectItem>
                    {departments
                      .filter(dept => !dept.archived_at || dept.id === formData.departmentId)
                      .map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name} {dept.archived_at ? '(archivé)' : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Confidentiality */}
              <div className="space-y-2">
                <Label>{t('documents.confidentiality')} *</Label>
                <Select
                  value={formData.confidentiality}
                  onValueChange={(v: ConfidentialityLevel) => 
                    setFormData(prev => ({ ...prev, confidentiality: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">{t('documents.public')}</SelectItem>
                    <SelectItem value="internal">{t('documents.internal')}</SelectItem>
                    <SelectItem value="confidential">{t('documents.confidential')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label htmlFor="tags">{t('documents.tags')}</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="tag1, tag2, tag3"
                />
              </div>

              {/* OCR Text */}
              <div className="space-y-2">
                <Label htmlFor="ocrText">{t('documents.ocrText')}</Label>
                <Textarea
                  id="ocrText"
                  value={formData.ocrText}
                  onChange={(e) => setFormData(prev => ({ ...prev, ocrText: e.target.value }))}
                  rows={6}
                  placeholder={language === 'fr' 
                    ? 'Texte extrait par OCR (optionnel)'
                    : 'OCR extracted text (optional)'}
                />
                <p className="text-xs text-muted-foreground">
                  {t('documents.ocrHint')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Version History */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4" />
                {t('documents.versions')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {language === 'fr' ? 'Aucune version antérieure' : 'No previous versions'}
                </p>
              ) : (
                versions.map((version) => (
                  <div
                    key={version.id}
                    className="p-3 rounded-lg bg-muted/50 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant={version.version_number === document.current_version ? 'default' : 'secondary'}>
                        v{version.version_number}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(version.file_size)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(version.created_at), 'PPp', { locale: dateLocale })}
                    </p>
                    {version.change_notes && (
                      <p className="text-xs text-muted-foreground italic">
                        "{version.change_notes}"
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {language === 'fr' ? 'Fichier actuel' : 'Current File'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                <span className="font-medium uppercase">{document.document_type}</span>
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={() => window.open(document.file_url, '_blank')}
              >
                {language === 'fr' ? 'Voir le fichier' : 'View File'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Version Upload Modal */}
      <Dialog open={versionModalOpen} onOpenChange={setVersionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'fr' ? 'Téléverser une nouvelle version' : 'Upload New Version'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div
              className={`
                border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
                ${newVersionFile ? 'bg-muted/50 border-primary' : 'border-border hover:border-primary/50'}
              `}
              onClick={() => window.document.getElementById('version-file-input')?.click()}
            >
              <input
                id="version-file-input"
                type="file"
                className="hidden"
                accept={`.${document.document_type}`}
                onChange={(e) => e.target.files?.[0] && setNewVersionFile(e.target.files[0])}
              />
              {newVersionFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="text-left">
                    <p className="font-medium text-sm">{newVersionFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(newVersionFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {language === 'fr' 
                      ? `Sélectionner un fichier ${document.document_type.toUpperCase()}`
                      : `Select a ${document.document_type.toUpperCase()} file`}
                  </p>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="changeNotes">{t('documents.changeNotes')}</Label>
              <Textarea
                id="changeNotes"
                value={versionChangeNotes}
                onChange={(e) => setVersionChangeNotes(e.target.value)}
                rows={3}
                placeholder={language === 'fr' 
                  ? 'Décrivez les modifications apportées...'
                  : 'Describe the changes made...'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVersionModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleVersionUpload} 
              disabled={!newVersionFile || uploadingVersion}
            >
              {uploadingVersion ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {language === 'fr' ? 'Téléverser' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
