import { useEffect, useState } from 'react';
import { Plus, Upload as UploadIcon, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UploadModal } from '@/components/documents/UploadModal';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function Upload() {
  const navigate = useNavigate();
  const { profile, canManageDocuments, isSuperAdmin, isUltraAdmin, isClientSuspended, clientModule } = useAuth();
  const { t, language } = useLanguage();
  const [departments, setDepartments] = useState<{ id: string; name: string; archived_at: string | null }[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(true);

  // Check if Super Admin is in Administrative module (cannot upload - separation of concerns)
  const isAdminSuperAdmin = isSuperAdmin && clientModule === 'admin_publique';

  useEffect(() => {
    // Redirect Super Admin in Administrative module - cannot upload
    if (isAdminSuperAdmin) {
      toast.error(
        language === 'fr' 
          ? 'En module Administratif, le Super Admin ne peut pas téléverser de documents (séparation des tâches)'
          : 'In Administrative module, Super Admin cannot upload documents (separation of duties)',
        { duration: 4000 }
      );
      navigate('/documents', { replace: true });
      return;
    }

    // Redirect Ultra Admin (no client) to Clients page
    if (isSuperAdmin && !profile?.client_id && isUltraAdmin) {
      toast.info(
        language === 'fr' 
          ? 'Veuillez sélectionner une organisation pour téléverser des documents'
          : 'Please select an organization to upload documents',
        { duration: 4000 }
      );
      navigate('/clients', { replace: true });
      return;
    }

    // Redirect suspended clients
    if (isClientSuspended) {
      toast.error(
        language === 'fr' 
          ? 'Téléversements désactivés - organisation suspendue'
          : 'Uploads disabled - organization suspended',
        { duration: 4000 }
      );
      navigate('/documents', { replace: true });
      return;
    }

    if (profile?.client_id) {
      fetchDepartments();
    }
  }, [profile?.client_id, isAdminSuperAdmin, isUltraAdmin, isSuperAdmin, isClientSuspended, navigate, language]);

  const fetchDepartments = async () => {
    if (!profile?.client_id) return;

    const { data } = await supabase
      .from('departments')
      .select('id, name, archived_at')
      .eq('client_id', profile.client_id);

    setDepartments(data || []);
  };

  if (!canManageDocuments) {
    return <Navigate to="/dashboard" replace />;
  }

  // Show nothing while redirecting for Fiscal Super Admin or suspended clients
  if (isFiscalSuperAdmin || isClientSuspended) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-serif font-semibold">{t('documents.uploadDocument')}</h2>
        <p className="text-muted-foreground">
          Téléversez un nouveau document dans l'archive
        </p>
      </div>

      {/* Upload Area */}
      <div className="max-w-2xl mx-auto">
        <div
          className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setUploadModalOpen(true)}
        >
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <UploadIcon className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-medium mb-2">
            {t('common.dragAndDrop')}
          </h3>
          <p className="text-muted-foreground text-sm mb-4">
            {t('common.supportedFormats')}: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX, PPT, PPTX
          </p>
          <Button className="btn-institutional">
            <Plus className="h-4 w-4 mr-2" />
            {t('common.selectFile')}
          </Button>
        </div>

        {/* Instructions */}
        <div className="mt-8 p-6 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-3">Instructions</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Les documents doivent être préalablement numérisés et OCRisés</span>
            </li>
            <li className="flex items-start gap-2">
              <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Remplissez les métadonnées avec précision pour faciliter la recherche</span>
            </li>
            <li className="flex items-start gap-2">
              <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Sélectionnez le niveau de confidentialité approprié</span>
            </li>
            <li className="flex items-start gap-2">
              <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Ajoutez des étiquettes pertinentes pour améliorer la découvrabilité</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Upload Modal */}
      <UploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        departments={departments}
      />
    </div>
  );
}