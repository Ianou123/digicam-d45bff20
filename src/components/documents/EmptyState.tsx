import { FileText, Search, Upload, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface EmptyStateProps {
  type: 'noResults' | 'noDocuments' | 'emptyTrash';
  searchQuery?: string;
  organizationName?: string;
  canUpload?: boolean;
  onUpload?: () => void;
}

export function EmptyState({ 
  type, 
  searchQuery, 
  organizationName,
  canUpload,
  onUpload 
}: EmptyStateProps) {
  const { language } = useLanguage();

  if (type === 'noResults' && searchQuery) {
    return (
      <div className="text-center py-12 border border-dashed border-border rounded-lg">
        <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">
          {language === 'fr' 
            ? `Aucun résultat pour "${searchQuery}"`
            : `No results for "${searchQuery}"`}
        </h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          {language === 'fr' 
            ? 'Vérifiez l\'orthographe ou essayez des termes différents. Vous pouvez également demander ce document à votre administrateur.'
            : 'Check your spelling or try different keywords. You can also request this document from your Admin.'}
        </p>
        <div className="mt-4 text-sm text-muted-foreground">
          <p className="font-medium mb-1">
            {language === 'fr' ? 'Suggestions :' : 'Suggestions:'}
          </p>
          <ul className="space-y-1">
            <li>
              {language === 'fr' 
                ? '• Utilisez des mots-clés plus généraux'
                : '• Use more general keywords'}
            </li>
            <li>
              {language === 'fr' 
                ? '• Vérifiez les filtres appliqués'
                : '• Check applied filters'}
            </li>
            <li>
              {language === 'fr' 
                ? '• Essayez de rechercher dans le texte OCR'
                : '• Try searching in OCR text'}
            </li>
          </ul>
        </div>
      </div>
    );
  }

  if (type === 'noDocuments') {
    return (
      <div className="text-center py-12 border border-dashed border-border rounded-lg">
        <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">
          {language === 'fr' 
            ? `Bienvenue${organizationName ? ` chez ${organizationName}` : ''}`
            : `Welcome${organizationName ? ` to ${organizationName}` : ''}`}
        </h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          {language === 'fr' 
            ? 'Votre bibliothèque est vide. '
            : 'Your library is empty. '}
          {canUpload 
            ? (language === 'fr' 
                ? 'Téléversez votre premier document pour commencer.'
                : 'Upload your first document to get started.')
            : (language === 'fr' 
                ? 'Demandez à votre administrateur de téléverser le premier document.'
                : 'Ask your Admin to upload the first document.')}
        </p>
        {canUpload && onUpload && (
          <Button className="mt-4" onClick={onUpload}>
            <Upload className="h-4 w-4 mr-2" />
            {language === 'fr' ? 'Téléverser un document' : 'Upload Document'}
          </Button>
        )}
      </div>
    );
  }

  if (type === 'emptyTrash') {
    return (
      <div className="text-center py-12 border border-dashed border-border rounded-lg">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">
          {language === 'fr' ? 'La corbeille est vide' : 'Trash is empty'}
        </h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          {language === 'fr' 
            ? 'Les documents supprimés apparaîtront ici.'
            : 'Deleted documents will appear here.'}
        </p>
      </div>
    );
  }

  return null;
}
