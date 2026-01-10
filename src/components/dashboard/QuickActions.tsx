import { Upload, FolderPlus, Tag, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

interface QuickActionsProps {
  onImportClick: () => void;
  onCreateFolderClick?: () => void;
  onCreateTagClick?: () => void;
}

export function QuickActions({ 
  onImportClick, 
  onCreateFolderClick,
  onCreateTagClick 
}: QuickActionsProps) {
  const { isClientAdmin, canManageDocuments, isClientSuspended } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();

  const actions = [
    {
      label: language === 'fr' ? 'Importer' : 'Import',
      icon: Upload,
      onClick: onImportClick,
      show: canManageDocuments && !isClientSuspended,
      primary: true,
    },
    {
      label: language === 'fr' ? 'Créer dossier' : 'Create Folder',
      icon: FolderPlus,
      onClick: onCreateFolderClick,
      show: isClientAdmin && onCreateFolderClick,
    },
    {
      label: language === 'fr' ? 'Créer étiquette' : 'Create Tag',
      icon: Tag,
      onClick: onCreateTagClick,
      show: isClientAdmin && onCreateTagClick,
    },
    {
      label: language === 'fr' ? 'Inviter utilisateur' : 'Invite User',
      icon: UserPlus,
      onClick: () => navigate('/users'),
      show: isClientAdmin,
    },
  ];

  const visibleActions = actions.filter(a => a.show);

  if (visibleActions.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-serif">
          {language === 'fr' ? 'Actions rapides' : 'Quick Actions'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {visibleActions.map((action, index) => (
            <Button
              key={index}
              variant={action.primary ? 'default' : 'outline'}
              size="sm"
              onClick={action.onClick}
              className={action.primary ? 'btn-institutional' : ''}
            >
              <action.icon className="h-4 w-4 mr-2" />
              {action.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
