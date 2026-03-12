import { useState } from 'react';
import { Upload, Search, UserPlus, Activity, Building2, BarChart3, Copy, Check, ArrowRight } from 'lucide-react';
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
      label: language === 'fr' ? 'Rechercher' : 'Search',
      description: language === 'fr' ? 'Retrouvez n\'importe quel document en quelques secondes grâce à l\'OCR' : 'Find any document in seconds with OCR',
      icon: Search,
      iconColor: 'text-primary',
      iconBg: 'bg-primary/10 group-hover:bg-primary/20',
      arrowColor: 'group-hover:text-primary',
      onClick: () => navigate('/documents'),
      show: true,
    },
    {
      label: language === 'fr' ? 'Importer' : 'Import',
      description: language === 'fr' ? 'Ajoutez un nouveau document à vos archives en quelques clics' : 'Add a new document to your archives in a few clicks',
      icon: Upload,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-500/10 group-hover:bg-emerald-500/20',
      arrowColor: 'group-hover:text-emerald-600',
      onClick: onImportClick,
      show: canManageDocuments && !isClientSuspended,
    },
    {
      label: language === 'fr' ? 'Inviter un utilisateur' : 'Invite user',
      description: language === 'fr' ? 'Ajoutez un collaborateur à votre organisation' : 'Add a collaborator to your organization',
      icon: UserPlus,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-500/10 group-hover:bg-blue-500/20',
      arrowColor: 'group-hover:text-blue-600',
      onClick: () => setShowInviteModal(true),
      show: isAdmin,
    },
    {
      label: language === 'fr' ? 'Voir les logs' : 'View logs',
      description: language === 'fr' ? 'Consultez qui a accédé à quoi et quand' : 'See who accessed what and when',
      icon: Activity,
      iconColor: 'text-violet-600',
      iconBg: 'bg-violet-500/10 group-hover:bg-violet-500/20',
      arrowColor: 'group-hover:text-violet-600',
      onClick: () => navigate('/activity'),
      show: isAdmin,
    },
    {
      label: language === 'fr' ? 'Départements' : 'Departments',
      description: language === 'fr' ? 'Gérez la structure de votre organisation' : 'Manage your organization structure',
      icon: Building2,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-500/10 group-hover:bg-amber-500/20',
      arrowColor: 'group-hover:text-amber-600',
      onClick: () => navigate('/departments'),
      show: isAdmin,
    },
    {
      label: language === 'fr' ? 'Admin Pulse' : 'Admin Pulse',
      description: language === 'fr' ? 'Recherches échouées, efficacité et santé de vos archives' : 'Failed searches, efficiency and archive health',
      icon: BarChart3,
      iconColor: 'text-teal-600',
      iconBg: 'bg-teal-500/10 group-hover:bg-teal-500/20',
      arrowColor: 'group-hover:text-teal-600',
      onClick: () => navigate('/admin-pulse'),
      show: isAdmin,
    },
  ];

  const visibleActions = actions.filter(a => a.show);

  if (visibleActions.length === 0) return null;

  return (
    <>
      <div>
        <h3 className="text-lg font-serif font-semibold mb-4">
          {language === 'fr' ? 'Actions rapides' : 'Quick Actions'}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleActions.map((action, index) => (
            <Card
              key={index}
              className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] group border-2 border-transparent hover:border-primary/20"
              onClick={action.onClick}
            >
              <CardContent className="p-5 flex items-start gap-4">
                <div className={`p-3 rounded-xl ${action.iconBg} transition-colors flex-shrink-0`}>
                  <action.icon className={`h-5 w-5 ${action.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm">{action.label}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{action.description}</p>
                </div>
                <ArrowRight className={`h-4 w-4 text-muted-foreground/30 ${action.arrowColor} transition-colors mt-1 flex-shrink-0`} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

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
