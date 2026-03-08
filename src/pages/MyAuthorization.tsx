import { useEffect, useState } from 'react';
import { Shield, CheckCircle2, XCircle, Building2, Users, Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { supabase } from '@/integrations/supabase/client';
import { 
  PERMISSION_LABELS, 
  getRestrictionReason,
  ModulePermissions 
} from '@/types/modules';

interface Department {
  id: string;
  name: string;
}

export default function MyAuthorization() {
  const { profile, user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const { 
    module, 
    role, 
    permissions, 
    moduleInfo, 
    roleInfo,
    isRestrictedModule 
  } = useModulePermissions();
  
  const [userDepartments, setUserDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserDepartments = async () => {
      if (!user || !profile?.client_id) {
        setLoading(false);
        return;
      }

      if (isRestrictedModule) {
        // Fetch from user_departments junction table
        const { data } = await supabase
          .from('user_departments')
          .select('department_id, departments(id, name)')
          .eq('user_id', user.id);
        
        if (data) {
          setUserDepartments(
            data
              .filter(d => d.departments)
              .map(d => ({ 
                id: (d.departments as any).id, 
                name: (d.departments as any).name 
              }))
          );
        }
      } else if (profile.department_id) {
        // Core module: single department from profile
        const { data } = await supabase
          .from('departments')
          .select('id, name')
          .eq('id', profile.department_id)
          .single();
        
        if (data) {
          setUserDepartments([data]);
        }
      }
      
      setLoading(false);
    };

    fetchUserDepartments();
  }, [user, profile, isRestrictedModule]);

  const handleReportInconsistency = async () => {
    if (!user || !profile?.client_id) return;

    try {
      // Create a notification for all super admins in the organization
      const { data: superAdmins } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'super_admin');

      if (superAdmins && superAdmins.length > 0) {
        const notifications = superAdmins.map(admin => ({
          user_id: admin.user_id,
          client_id: profile.client_id!,
          type: 'authorization_report',
          title: language === 'fr' 
            ? 'Signalement d\'incohérence de droits'
            : 'Authorization Inconsistency Report',
          message: language === 'fr'
            ? `${profile.full_name || profile.email} signale une incohérence dans ses droits d'accès.`
            : `${profile.full_name || profile.email} reported an authorization inconsistency.`,
          metadata: {
            reporter_id: user.id,
            reporter_email: profile.email,
            reporter_role: role,
            reporter_module: module,
          },
        }));

        await supabase.from('notifications').insert(notifications);

        toast({
          title: language === 'fr' ? 'Signalement envoyé' : 'Report sent',
          description: language === 'fr' 
            ? 'Un administrateur examinera votre demande.'
            : 'An administrator will review your request.',
        });
      }
    } catch (error) {
      console.error('Error reporting inconsistency:', error);
      toast({
        variant: 'destructive',
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: language === 'fr' 
          ? 'Impossible d\'envoyer le signalement.'
          : 'Unable to send report.',
      });
    }
  };

  const getModuleIcon = () => {
    switch (moduleInfo.icon) {
      case 'lock': return <Lock className="h-5 w-5" />;
      case 'shield': return <Shield className="h-5 w-5" />;
      default: return <Building2 className="h-5 w-5" />;
    }
  };

  const getModuleBadgeColor = () => {
    switch (module) {
      case 'fiscal': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-serif font-semibold">
          {language === 'fr' ? 'Mon Habilitation' : 'My Authorization'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {language === 'fr' 
            ? 'Consultez vos droits et responsabilités dans DigiCam'
            : 'View your rights and responsibilities in DigiCam'}
        </p>
      </div>

      {/* Role & Module Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {language === 'fr' ? 'Mon Rôle' : 'My Role'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge variant="secondary" className="text-base px-3 py-1">
                {language === 'fr' ? roleInfo.labelFr : roleInfo.labelEn}
              </Badge>
              <p className="text-sm text-muted-foreground">
                {language === 'fr' ? roleInfo.descriptionFr : roleInfo.descriptionEn}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              {getModuleIcon()}
              <span className="text-primary">
                {language === 'fr' ? 'Module Actif' : 'Active Module'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge className={getModuleBadgeColor()}>
                {language === 'fr' ? moduleInfo.labelFr : moduleInfo.labelEn}
              </Badge>
              <p className="text-sm text-muted-foreground">
                {language === 'fr' ? moduleInfo.descriptionFr : moduleInfo.descriptionEn}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Departments */}
      {userDepartments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {language === 'fr' ? 'Mes Départements' : 'My Departments'}
            </CardTitle>
            <CardDescription>
              {isRestrictedModule 
                ? (language === 'fr' 
                    ? 'Vous avez accès aux documents de ces départements'
                    : 'You have access to documents from these departments')
                : (language === 'fr'
                    ? 'Votre département actuel'
                    : 'Your current department')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {userDepartments.map(dept => (
                <Badge key={dept.id} variant="outline" className="text-sm">
                  {dept.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Permissions Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {language === 'fr' ? 'Matrice des Permissions' : 'Permissions Matrix'}
          </CardTitle>
          <CardDescription>
            {language === 'fr' 
              ? 'Ce que vous pouvez et ne pouvez pas faire'
              : 'What you can and cannot do'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Allowed */}
          <div>
            <h3 className="font-medium text-green-700 dark:text-green-400 flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-5 w-5" />
              {language === 'fr' ? 'Ce que je peux faire' : 'What I can do'}
            </h3>
            <div className="space-y-2">
              {allowedPermissions.map(p => (
                <div 
                  key={p.key} 
                  className="flex items-center gap-2 text-sm p-2 rounded bg-green-50 dark:bg-green-950/30"
                >
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <span>{language === 'fr' ? p.labelFr : p.labelEn}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Denied */}
          <div>
            <h3 className="font-medium text-red-700 dark:text-red-400 flex items-center gap-2 mb-3">
              <XCircle className="h-5 w-5" />
              {language === 'fr' ? 'Ce que je ne peux pas faire' : 'What I cannot do'}
            </h3>
            <div className="space-y-2">
              {deniedPermissions.map(p => {
                const reason = getRestrictionReason(p.key as keyof ModulePermissions, role, module, language);
                return (
                  <div 
                    key={p.key} 
                    className="flex items-start gap-2 text-sm p-2 rounded bg-red-50 dark:bg-red-950/30"
                  >
                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span>{language === 'fr' ? p.labelFr : p.labelEn}</span>
                      {reason && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {reason}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Module-specific warnings */}
      {permissions.requiresImmutability && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              {language === 'fr' ? 'Mode Immutabilité WORM' : 'WORM Immutability Mode'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {language === 'fr' 
                ? 'Ce module impose une immutabilité totale. Les documents ne peuvent pas être modifiés ou supprimés une fois créés. Chaque modification crée une nouvelle version.'
                : 'This module enforces total immutability. Documents cannot be modified or deleted once created. Each modification creates a new version.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Report Inconsistency */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">
                {language === 'fr' 
                  ? 'Signaler une incohérence de droits'
                  : 'Report authorization inconsistency'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {language === 'fr'
                  ? 'Si vous pensez que vos droits ne correspondent pas à votre fonction'
                  : 'If you believe your rights don\'t match your function'}
              </p>
            </div>
            <Button variant="outline" onClick={handleReportInconsistency}>
              <Send className="h-4 w-4 mr-2" />
              {language === 'fr' ? 'Signaler' : 'Report'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
