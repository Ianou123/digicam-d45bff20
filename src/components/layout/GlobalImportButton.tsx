import { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UploadModal } from '@/components/documents/UploadModal';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function GlobalImportButton() {
  const { profile, canManageDocuments, isUltraAdmin, isSuperAdmin, isClientSuspended } = useAuth();
  const { language } = useLanguage();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string; archived_at: string | null }[]>([]);

  // Fetch departments for the modal
  useEffect(() => {
    if (profile?.client_id && canManageDocuments) {
      fetchDepartments();
    }
  }, [profile?.client_id, canManageDocuments]);

  // Keyboard shortcut "I" to open import
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // "I" key to open import modal
      if (e.key.toLowerCase() === 'i' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleImportClick();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [canManageDocuments, isSuperAdmin, isClientSuspended]);

  const fetchDepartments = async () => {
    if (!profile?.client_id) return;

    const { data } = await supabase
      .from('departments')
      .select('id, name, archived_at')
      .eq('client_id', profile.client_id);

    setDepartments(data || []);
  };

  const handleImportClick = () => {
    if (!canManageDocuments) {
      toast.error(
        language === 'fr'
          ? "Vous n'avez pas les droits pour importer des documents"
          : "You don't have permission to import documents"
      );
      return;
    }

    if (isSuperAdmin) {
      toast.info(
        language === 'fr'
          ? 'Sélectionnez une organisation pour importer des documents'
          : 'Select an organization to import documents'
      );
      return;
    }

    if (isClientSuspended) {
      toast.error(
        language === 'fr'
          ? 'Téléversements désactivés - organisation suspendue'
          : 'Uploads disabled - organization suspended'
      );
      return;
    }

    setUploadModalOpen(true);
  };

  // Don't render for ultra admin, super admin, or if user can't manage documents
  if (isUltraAdmin || isSuperAdmin || !canManageDocuments) {
    return null;
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleImportClick}
            className="btn-institutional gap-2"
            disabled={isClientSuspended}
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">
              {language === 'fr' ? 'Importer' : 'Import'}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {language === 'fr' ? 'Importer un document' : 'Import a document'} (I)
          </p>
        </TooltipContent>
      </Tooltip>

      <UploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        departments={departments}
      />
    </>
  );
}
