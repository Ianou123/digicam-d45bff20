import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ShieldAlert, Download } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface ConfidentialDownloadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  documentTitle: string;
}

export function ConfidentialDownloadModal({
  open,
  onOpenChange,
  onConfirm,
  documentTitle,
}: ConfidentialDownloadModalProps) {
  const { language } = useLanguage();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle className="text-lg font-semibold">
              {language === 'fr' ? 'Document Confidentiel' : 'Confidential Document'}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-sm text-muted-foreground mt-2">
            {language === 'fr' 
              ? `Ce document est marqué comme confidentiel. Assurez-vous d'être autorisé à le télécharger et à le partager.`
              : `This document is marked as confidential. Ensure you are authorized to download and share it.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="my-2 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium text-foreground truncate">{documentTitle}</p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {language === 'fr' ? 'Annuler' : 'Cancel'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <Download className="h-4 w-4 mr-2" />
            {language === 'fr' ? 'Télécharger quand même' : 'Download Anyway'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
