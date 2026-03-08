import { Upload, Search, UserPlus, Activity, Building2, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

interface QuickActionsProps {
  onImportClick: () => void;
}

export function QuickActions({ onImportClick }: QuickActionsProps) {
  const { isSuperAdmin, isClientAdmin, canManageDocuments, isClientSuspended } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();

  const isAdmin = isSuperAdmin || isClientAdmin;

  const actions = [
    {
      label: language === 'fr' ? 'Rechercher un document' : 'Search document',
      icon: Search,
      onClick: () => navigate('/documents'),
      show: true,
    },
    {
      label: language === 'fr' ? 'Importer un document' : 'Import document',
      icon: Upload,
      onClick: onImportClick,
      show: canManageDocuments && !isClientSuspended,
      primary: true,
    },
    {
      label: language === 'fr' ? 'Inviter un utilisateur' : 'Invite user',
      icon: UserPlus,
      onClick: () => navigate('/users'),
      show: isAdmin,
    },
    {
      label: language === 'fr' ? 'Voir les logs' : 'View logs',
      icon: Activity,
      onClick: () => navigate('/activity'),
      show: isAdmin,
    },
    {
      label: language === 'fr' ? 'Gérer les départements' : 'Manage departments',
      icon: Building2,
      onClick: () => navigate('/departments'),
      show: isAdmin,
    },
    {
      label: language === 'fr' ? 'Voir les statistiques' : 'View statistics',
      icon: BarChart3,
      onClick: () => navigate('/admin-pulse'),
      show: isAdmin,
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {visibleActions.map((action, index) => (
            <Button
              key={index}
              variant={action.primary ? 'default' : 'outline'}
              className={`h-auto py-4 flex flex-col items-center gap-2 ${action.primary ? 'btn-institutional' : 'hover:border-primary/50 hover:bg-primary/5'}`}
              onClick={action.onClick}
            >
              <action.icon className="h-5 w-5" />
              <span className="text-xs font-medium text-center leading-tight">{action.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
