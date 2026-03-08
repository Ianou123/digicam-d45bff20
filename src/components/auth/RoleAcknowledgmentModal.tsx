import { CheckCircle2, XCircle, Shield, Building2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/contexts/LanguageContext';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { 
  PERMISSION_LABELS, 
  getRestrictionReason,
  ModulePermissions 
} from '@/types/modules';

interface RoleAcknowledgmentModalProps {
  open: boolean;
  onAcknowledge: () => Promise<void>;
}

export function RoleAcknowledgmentModal({ open, onAcknowledge }: RoleAcknowledgmentModalProps) {
  const { language } = useLanguage();
  const { 
    module, 
    role, 
    permissions, 
    moduleInfo, 
    roleInfo 
  } = useModulePermissions();

  const getModuleIcon = () => {
    switch (moduleInfo.icon) {
      case 'lock': return <Lock className="h-6 w-6" />;
      case 'shield': return <Shield className="h-6 w-6" />;
      default: return <Building2 className="h-6 w-6" />;
    }
  };

  const getModuleBadgeColor = () => {
    switch (module) {
      case 'admin_publique': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      default: return 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300';
    }
  };

  const allowedPermissions = PERMISSION_LABELS.filter(p => {
    const value = permissions[p.key as keyof ModulePermissions];
    return typeof value === 'boolean' && value === true;
  });

  const deniedPermissions = PERMISSION_LABELS.filter(p => {
    const value = permissions[p.key as keyof ModulePermissions];
    return typeof value === 'boolean' && value === false;
  });

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            {getModuleIcon()}
            {language === 'fr' 
              ? 'Confirmation de Rôle et Responsabilités' 
              : 'Role and Responsibilities Confirmation'}
          </DialogTitle>
          <DialogDescription>
            {language === 'fr'
              ? 'Veuillez prendre connaissance de vos droits et responsabilités avant de continuer.'
              : 'Please review your rights and responsibilities before continuing.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6 pr-4">
            {/* Role & Module */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-2">
                  {language === 'fr' ? 'Votre rôle' : 'Your role'}
                </p>
                <Badge variant="secondary" className="text-base">
                  {language === 'fr' ? roleInfo.labelFr : roleInfo.labelEn}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  {language === 'fr' ? roleInfo.descriptionFr : roleInfo.descriptionEn}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-2">
                  {language === 'fr' ? 'Module actif' : 'Active module'}
                </p>
                <Badge className={getModuleBadgeColor()}>
                  {language === 'fr' ? moduleInfo.labelFr : moduleInfo.labelEn}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  {language === 'fr' ? moduleInfo.descriptionFr : moduleInfo.descriptionEn}
                </p>
              </div>
            </div>

            <Separator />

            {/* Permissions */}
            <div className="space-y-4">
              <h3 className="font-medium">
                {language === 'fr' ? 'Vos permissions' : 'Your permissions'}
              </h3>
              
              {/* Allowed */}
              <div className="space-y-2">
                <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {language === 'fr' ? 'Ce que vous pouvez faire :' : 'What you can do:'}
                </p>
                <div className="grid gap-1 pl-6">
                  {allowedPermissions.map(p => (
                    <div key={p.key} className="text-sm flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                      {language === 'fr' ? p.labelFr : p.labelEn}
                    </div>
                  ))}
                </div>
              </div>

              {/* Denied */}
              <div className="space-y-2">
                <p className="text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  {language === 'fr' ? 'Ce que vous ne pouvez pas faire :' : 'What you cannot do:'}
                </p>
                <div className="grid gap-1 pl-6">
                  {deniedPermissions.map(p => {
                    const reason = getRestrictionReason(p.key as keyof ModulePermissions, role, module, language);
                    return (
                      <div key={p.key} className="text-sm">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
                          {language === 'fr' ? p.labelFr : p.labelEn}
                        </div>
                        {reason && (
                          <p className="text-xs text-muted-foreground ml-5">{reason}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button onClick={onAcknowledge} className="w-full sm:w-auto">
            {language === 'fr' 
              ? 'Je comprends et j\'accepte' 
              : 'I understand and accept'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
