import { useEffect, useState } from 'react';
import { Shield, CheckCircle2, XCircle, Building2, Users, Send, Globe } from 'lucide-react';
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

// Ultra Admin platform permissions (separate from module-based permissions)
const ULTRA_ADMIN_PERMISSIONS = {
  allowed: [
    { fr: 'Créer des organisations', en: 'Create organizations' },
    { fr: 'Gérer les organisations', en: 'Manage organizations' },
    { fr: 'Voir les utilisateurs (toutes organisations)', en: 'View users (all organizations)' },
    { fr: 'Voir les logs d\'activité (toutes organisations)', en: 'View activity logs (all organizations)' },
    { fr: 'Voir les statistiques globales', en: 'View global statistics' },
    { fr: 'Gérer les rôles', en: 'Manage roles' },
  ],
  denied: [
    { fr: 'Accéder aux documents des organisations (confidentialité)', en: 'Access organization documents (confidentiality)' },
    { fr: 'Télécharger des documents', en: 'Download documents' },
    { fr: 'Uploader des documents', en: 'Upload documents' },
  ],
};

export default function MyAuthorization() {
  const { profile, user, isUltraAdmin, isClientAdmin } = useAuth();
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
  const isRestrictedITAdmin = isClientAdmin && isRestrictedModule;

  useEffect(() => {
    const fetchUserDepartments = async () => {
      if (!user || !profile?.client_id) {
        setLoading(false);
        return;
      }

      if (isRestrictedModule) {
        // First check user_departments table (many-to-many)
        const { data } = await supabase
          .from('user_departments')
          .select('department_id, departments(id, name)')
          .eq('user_id', user.id);

        if (data && data.length > 0) {
          setUserDepartments(
            data
              .filter(d => d.departments)
              .map(d => ({
                id: (d.departments as any).id,
                name: (d.departments as any).name
              }))
          );
        } else if (profile.department_id) {
          // Fallback: check profile.department_id (single department assignment)
          const { data: deptData } = await supabase
            .from('departments')
            .select('id, name')
            .eq('id', profile.department_id)
            .single();

          if (deptData) {
            setUserDepartments([deptData]);
          }
        }
      } else if (profile.department_id) {
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

    if (isUltraAdmin) {
      setLoading(false);
    } else {
      fetchUserDepartments();
    }
  }, [user, profile, isRestrictedModule, isUltraAdmin]);

  const handleReportInconsistency = async () => {
    if (!user || !profile?.client_id) return;

    try {
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
      case 'shield': return <Shield className="h-5 w-5" />;
      default: return <Building2 className="h-5 w-5" />;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // ==================== ULTRA ADMIN VIEW ====================
  if (isUltraAdmin) {
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

        {/* Role & Access Level */}
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
                <Badge variant="secondary" className="text-base px-3 py-1 bg-destructive/10 text-destructive border-destructive/20">
                  Ultra Admin
                </Badge>
                <p className="text-sm text-muted-foreground">
                  {language === 'fr'
                    ? 'Personnel DigiCam - Gestion de la plateforme et des organisations'
                    : 'DigiCam Staff - Platform and organization management'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                <span className="text-primary">
                  {language === 'fr' ? 'Niveau d\'Accès' : 'Access Level'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Badge className="bg-primary/10 text-primary border-primary/20 text-base px-3 py-1">
                  {language === 'fr' ? 'Plateforme' : 'Platform'}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  {language === 'fr'
                    ? 'Accès administrateur à l\'ensemble de la plateforme DigiCam. Vous pouvez gérer les organisations, consulter les logs et voir les statistiques globales.'
                    : 'Administrator access to the entire DigiCam platform. You can manage organizations, view logs and see global statistics.'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ultra Admin Permissions Matrix */}
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
                {ULTRA_ADMIN_PERMISSIONS.allowed.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-sm p-2 rounded bg-green-50 dark:bg-green-950/30"
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <span>{language === 'fr' ? p.fr : p.en}</span>
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
                {ULTRA_ADMIN_PERMISSIONS.denied.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-sm p-2 rounded bg-red-50 dark:bg-red-950/30"
                  >
                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span>{language === 'fr' ? p.fr : p.en}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {language === 'fr'
                          ? 'Confidentialité client — l\'Ultra Admin ne peut pas accéder au contenu des documents'
                          : 'Client confidentiality — Ultra Admin cannot access document content'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ==================== IT ADMIN (RESTRICTED MODULE) VIEW ====================
  if (isRestrictedITAdmin) {
    const departmentLabel = userDepartments[0]?.name || (language === 'fr' ? 'Non assigné' : 'Unassigned');

    const canDoItems = [
      language === 'fr' ? 'Importer des documents' : 'Upload documents',
      language === 'fr' ? 'Voir l’historique de mes téléversements' : 'View my upload history',
      language === 'fr' ? 'Assigner des documents à un département' : 'Assign documents to a department',
    ];

    const cannotDoItems = [
      language === 'fr' ? 'Rechercher des documents' : 'Search documents',
      language === 'fr' ? 'Consulter des documents' : 'View documents',
      language === 'fr' ? 'Télécharger des documents' : 'Download documents',
      language === 'fr' ? 'Gérer les utilisateurs' : 'Manage users',
      language === 'fr' ? 'Voir les logs d’activité' : 'View activity logs',
      language === 'fr' ? 'Voir les statistiques' : 'View analytics',
      language === 'fr' ? 'Gérer les départements' : 'Manage departments',
    ];

    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-serif font-semibold">
            {language === 'fr' ? 'Mon Habilitation' : 'My Authorization'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === 'fr'
              ? 'Vos droits dans le module Administratif'
              : 'Your rights in the Administrative module'}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{language === 'fr' ? 'Mon Rôle' : 'My Role'}</CardTitle></CardHeader>
            <CardContent><Badge variant="destructive">IT Admin</Badge></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{language === 'fr' ? 'Mon Module' : 'My Module'}</CardTitle></CardHeader>
            <CardContent><Badge variant="secondary">{language === 'fr' ? 'Administratif' : 'Administrative'}</Badge></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{language === 'fr' ? 'Mon Département' : 'My Department'}</CardTitle></CardHeader>
            <CardContent><Badge variant="outline">{departmentLabel}</Badge></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{language === 'fr' ? 'Ce que je peux faire' : 'What I can do'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {canDoItems.map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm p-2 rounded bg-success/10">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{language === 'fr' ? 'Ce que je ne peux pas faire' : 'What I cannot do'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cannotDoItems.map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm p-2 rounded bg-destructive/10">
                <XCircle className="h-4 w-4 text-destructive" />
                <span>{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-warning">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              {language === 'fr'
                ? 'Dans le module Administratif, la personne qui importe les documents n\'est pas celle qui les consulte. Cette séparation garantit la sécurité et la traçabilité de vos archives. Pour toute question, contactez votre Super Administrateur.'
                : 'In the Administrative module, the person uploading documents is not the one consulting them. This separation guarantees security and traceability. For any question, contact your Super Admin.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ==================== STANDARD USER VIEW ====================
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
