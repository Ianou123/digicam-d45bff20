import { useState } from 'react';
import { Upload, Search, UserPlus, Activity, Building2, BarChart3, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface QuickActionsProps {
  onImportClick: () => void;
}

export function QuickActions({ onImportClick }: QuickActionsProps) {
  const { isSuperAdmin, isClientAdmin, canManageDocuments, isClientSuspended, clientInviteCode } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const isAdmin = isSuperAdmin || isClientAdmin;

  const handleCopyCode = async () => {
    if (!clientInviteCode) return;
    try {
      await navigator.clipboard.writeText(clientInviteCode);
      setCopied(true);
      toast.success(language === 'fr' ? 'Code copié !' : 'Code copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(language === 'fr' ? 'Erreur lors de la copie' : 'Failed to copy');
    }
  };

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
      onClick: () => setShowInviteModal(true),
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
    <>
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

      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {language === 'fr' ? 'Inviter un utilisateur' : 'Invite a user'}
            </DialogTitle>
            <DialogDescription>
              {language === 'fr'
                ? 'Partagez ce code d\'invitation avec les personnes que vous souhaitez ajouter à votre organisation. Elles pourront l\'utiliser lors de leur inscription.'
                : 'Share this invite code with people you want to add to your organization. They can use it during sign up.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 mt-2">
            <Input
              readOnly
              value={clientInviteCode || '—'}
              className="font-mono text-lg tracking-widest text-center bg-muted"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyCode}
              disabled={!clientInviteCode}
              className="shrink-0"
            >
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
