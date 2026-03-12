import { useState, useCallback } from 'react';
import { Upload, X, FileText, Loader2, Eye, Clock, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: { id: string; name: string; archived_at?: string | null }[];
  onSuccess?: () => void;
}

type DocumentType = 'pdf' | 'jpg' | 'png' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'ppt' | 'pptx';
type ConfidentialityLevel = 'public' | 'internal' | 'confidential';

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

type UploadStep = 'form' | 'uploading' | 'processing' | 'complete';

export function UploadModal({ open, onOpenChange, departments, onSuccess }: UploadModalProps) {
  const { t, language } = useLanguage();
  const { user, profile, isClientAdmin } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<UploadStep>('form');
  const [progress, setProgress] = useState(0);
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    departmentId: '',
    confidentiality: 'internal' as ConfidentialityLevel,
    tags: '',
    ocrText: '',
    documentDate: '',
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFile = (selectedFile: File) => {
    const docType = fileTypeMap[selectedFile.type];
    if (!docType) {
      toast.error(language === 'fr' ? 'Type de fichier non supporté' : 'Unsupported file type');
      return;
    }
    setFile(selectedFile);

    // Create preview for images
    if (['image/jpeg', 'image/png'].includes(selectedFile.type)) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }

    if (!formData.title) {
      setFormData(prev => ({ ...prev, title: selectedFile.name.replace(/\.[^/.]+$/, '') }));
    }
  };

  const simulateOcrProcessing = async (docId: string) => {
    // Simulate OCR processing with progress
    setStep('processing');
    setProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 300);

    // Simulate OCR delay (2-4 seconds)
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));

    clearInterval(progressInterval);
    setProgress(100);

    // Update document status to 'ready'
    await supabase
      .from('documents')
      .update({ status: 'ready' })
      .eq('id', docId);

    setStep('complete');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !user || !profile?.client_id) {
      toast.error(language === 'fr' ? 'Veuillez sélectionner un fichier' : 'Please select a file');
      return;
    }

    setStep('uploading');
    setProgress(0);

    try {
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const sanitizedName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 50);
      const filePath = `${profile.client_id}/${Date.now()}_${sanitizedName}.${fileExt}`;

      setProgress(20);

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setProgress(50);

      // Store the file path (not public URL) since bucket is private
      // Signed URLs will be generated when accessing the file
      const filePathForDb = filePath;

      // Create document record with 'processing' status
      const docType = fileTypeMap[file.type] as DocumentType;
      const tags = formData.tags.split(',').map(t => t.trim()).filter(Boolean);

      const { data: insertedDoc, error: insertError } = await supabase
        .from('documents')
        .insert({
          client_id: profile.client_id,
          title: formData.title,
          document_type: docType,
          department_id: formData.departmentId || null,
          confidentiality_level: formData.confidentiality,
          tags,
          ocr_text: formData.ocrText || null,
          file_url: filePathForDb,
          file_size: file.size,
          uploaded_by: user.id,
          status: 'processing',
          document_date: formData.documentDate || null,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      setProgress(70);
      setUploadedDocId(insertedDoc.id);

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        client_id: profile.client_id,
        action_type: 'upload',
        document_id: insertedDoc.id,
        metadata: { title: formData.title, document_type: docType },
      });

      // Simulate OCR processing
      await simulateOcrProcessing(insertedDoc.id);

    } catch (error) {
      console.error('Upload error:', error);
      toast.error(language === 'fr' ? 'Erreur lors du téléversement' : 'Upload error');
      setStep('form');
    }
  };

  const handleComplete = () => {
    if (uploadedDocId) {
      onOpenChange(false);
      resetForm();
      onSuccess?.();
      // IT Admin cannot view documents — don't navigate
      if (!isClientAdmin) {
        navigate(`/documents/${uploadedDocId}`);
      }
    }
  };

  const handleUploadAnother = () => {
    onSuccess?.();
    resetForm();
  };

  const handleClose = () => {
    if (step === 'form') {
      onOpenChange(false);
      resetForm();
    }
  };

  const resetForm = () => {
    setFile(null);
    setPreviewUrl(null);
    setStep('form');
    setProgress(0);
    setUploadedDocId(null);
    setFormData({
      title: '',
      departmentId: '',
      confidentiality: 'internal',
      tags: '',
      ocrText: '',
      documentDate: '',
    });
  };

  const getStepContent = () => {
    switch (step) {
      case 'uploading':
        return (
          <div className="py-12 text-center space-y-4">
            <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <div>
              <h3 className="font-medium text-lg">
                {language === 'fr' ? 'Téléversement en cours...' : 'Uploading...'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {file?.name}
              </p>
            </div>
            <Progress value={progress} className="w-full max-w-xs mx-auto" />
            <p className="text-xs text-muted-foreground">{Math.round(progress)}%</p>
          </div>
        );

      case 'processing':
        return (
          <div className="py-12 text-center space-y-4">
            <div className="h-16 w-16 mx-auto rounded-full bg-warning/10 flex items-center justify-center">
              <Clock className="h-8 w-8 text-warning animate-spin" />
            </div>
            <div>
              <h3 className="font-medium text-lg">
                {language === 'fr' ? 'Traitement OCR en cours...' : 'Processing OCR...'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {language === 'fr'
                  ? 'Extraction du texte et indexation'
                  : 'Extracting text and indexing'}
              </p>
            </div>
            <Progress value={progress} className="w-full max-w-xs mx-auto" />
            <p className="text-xs text-muted-foreground">{Math.round(progress)}%</p>
          </div>
        );

      case 'complete':
        return (
          <div className="py-12 text-center space-y-4">
            <div className="h-16 w-16 mx-auto rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <div>
              <h3 className="font-medium text-lg">
                {language === 'fr' ? 'Document prêt !' : 'Document ready!'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {formData.title}
              </p>
            </div>
            {isClientAdmin ? (
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={handleComplete}>
                  {language === 'fr' ? 'Fermer' : 'Close'}
                </Button>
                <Button onClick={handleUploadAnother} className="btn-institutional">
                  <Upload className="h-4 w-4 mr-2" />
                  {language === 'fr' ? 'Importer un autre' : 'Upload Another'}
                </Button>
              </div>
            ) : (
              <Button onClick={handleComplete} className="btn-institutional">
                <Eye className="h-4 w-4 mr-2" />
                {language === 'fr' ? 'Voir le document' : 'View Document'}
              </Button>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {t('documents.uploadDocument')}
          </DialogTitle>
        </DialogHeader>

        {step !== 'form' ? (
          getStepContent()
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* File Drop Zone with Preview */}
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer',
                dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
                file ? 'bg-muted/50' : ''
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />

              {file ? (
                <div className="flex items-center gap-4">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="h-20 w-20 object-cover rounded-lg" />
                  ) : (
                    <div className="h-20 w-20 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-10 w-10 text-primary" />
                    </div>
                  )}
                  <div className="text-left flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setPreviewUrl(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {t('common.dragAndDrop')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, JPG, PNG, DOC, DOCX, XLS, XLSX, PPT, PPTX
                  </p>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Title */}
              <div className="col-span-2 space-y-2">
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
                  value={formData.departmentId}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, departmentId: v === 'unassigned' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('documents.allDepartments')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">
                      {t('documents.unassigned')}
                    </SelectItem>
                    {departments
                      .filter(dept => !dept.archived_at)
                      .map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
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

              {/* Document Date */}
              <div className="space-y-2">
                <Label htmlFor="documentDate">
                  {language === 'fr' ? 'Date du document' : 'Document Date'}
                </Label>
                <Input
                  id="documentDate"
                  type="date"
                  value={formData.documentDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, documentDate: e.target.value }))}
                />
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
              <div className="col-span-2 space-y-2">
                <Label htmlFor="ocrText">{t('documents.ocrText')}</Label>
                <Textarea
                  id="ocrText"
                  value={formData.ocrText}
                  onChange={(e) => setFormData(prev => ({ ...prev, ocrText: e.target.value }))}
                  rows={2}
                  placeholder={language === 'fr' ? 'Texte OCR (optionnel, sera extrait automatiquement)' : 'OCR text (optional, will be extracted automatically)'}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={!file} className="btn-institutional">
                <Upload className="h-4 w-4 mr-2" />
                {t('documents.uploadDocument')}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
