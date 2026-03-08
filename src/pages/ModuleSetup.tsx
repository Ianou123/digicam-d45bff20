import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Building2, Shield, Check, Loader2, Upload, Plus, X, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ClientModule, MODULE_INFO } from '@/types/modules';
import { cn } from '@/lib/utils';

const STEPS = ['org_info', 'module', 'departments'] as const;
type Step = typeof STEPS[number];

const moduleDetails: Record<ClientModule, {
  icon: typeof Building2;
  features: { fr: string[]; en: string[] };
  tagline: { fr: string; en: string };
}> = {
  core: {
    icon: Building2,
    features: {
      fr: [
        '2 rôles : Admin, Utilisateur',
        'L\'admin gère tout : upload, users, logs',
        'Départements optionnels',
        'Partage de documents entre utilisateurs',
        'Idéal pour : PME, cabinets, freelances',
      ],
      en: [
        '2 roles: Admin, User',
        'Admin manages everything: upload, users, logs',
        'Optional departments',
        'Document sharing between users',
        'Ideal for: SMBs, firms, freelancers',
      ],
    },
    tagline: {
      fr: 'Idéal pour les PME et équipes internes',
      en: 'Ideal for SMBs and internal teams',
    },
  },
  admin_publique: {
    icon: Shield,
    features: {
      fr: [
        '3 rôles : Super Admin, Admin IT, Utilisateur',
        'Séparation des tâches : Super Admin gère, Admin IT upload',
        'Départements obligatoires',
        'Journalisation obligatoire de toutes les actions',
        'Idéal pour : institutions, grandes entreprises',
      ],
      en: [
        '3 roles: Super Admin, IT Admin, User',
        'Separation of duties: Super Admin manages, IT Admin uploads',
        'Mandatory departments',
        'Mandatory logging of all actions',
        'Ideal for: institutions, large enterprises',
      ],
    },
    tagline: {
      fr: 'Pour institutions et grandes entreprises',
      en: 'For institutions and large enterprises',
    },
  },
};

export default function ModuleSetup() {
  const [step, setStep] = useState<Step>('org_info');
  const [selectedModule, setSelectedModule] = useState<ClientModule | null>(null);
  const [loading, setLoading] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [newDeptName, setNewDeptName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { profile, refreshProfile, clientName } = useAuth();
  const { language } = useLanguage();

  // Pre-fill org name if already set
  useState(() => {
    if (clientName) setOrgName(clientName);
  });

  const stepIndex = STEPS.indexOf(step);
  const isAdminModule = selectedModule === 'admin_publique';
  const deptRequired = isAdminModule;

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error(language === 'fr' ? 'Le logo doit faire moins de 2 Mo' : 'Logo must be under 2 MB');
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addDepartment = () => {
    const name = newDeptName.trim();
    if (!name) return;
    if (departments.includes(name)) {
      toast.error(language === 'fr' ? 'Ce département existe déjà' : 'This department already exists');
      return;
    }
    setDepartments([...departments, name]);
    setNewDeptName('');
  };

  const removeDepartment = (index: number) => {
    setDepartments(departments.filter((_, i) => i !== index));
  };

  const handleNext = () => {
    if (step === 'org_info') {
      if (!orgName.trim()) {
        toast.error(language === 'fr' ? 'Le nom de l\'organisation est requis' : 'Organization name is required');
        return;
      }
      setStep('module');
    } else if (step === 'module') {
      if (!selectedModule) return;
      setStep('departments');
    }
  };

  const handleBack = () => {
    if (step === 'module') setStep('org_info');
    else if (step === 'departments') setStep('module');
  };

  const handleFinish = async () => {
    if (!profile?.client_id || !selectedModule) return;

    if (deptRequired && departments.length === 0) {
      toast.error(
        language === 'fr'
          ? 'Au moins un département est obligatoire pour le module Administratif'
          : 'At least one department is required for the Administrative module'
      );
      return;
    }

    setLoading(true);
    try {
      // 1. Upload logo if provided
      let logoUrl: string | null = null;
      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const path = `logos/${profile.client_id}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('documents')
          .upload(path, logoFile, { upsert: true });
        if (uploadErr) {
          console.error('Logo upload error:', uploadErr);
        } else {
          const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
          logoUrl = urlData.publicUrl;
        }
      }

      // 2. Update client: name, logo, module
      const updateData: Record<string, unknown> = {
        name: orgName.trim(),
        module: selectedModule,
        module_configured: true,
      };
      if (logoUrl) updateData.logo_url = logoUrl;

      const { error: clientErr } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', profile.client_id);
      if (clientErr) throw clientErr;

      // 3. Create departments
      if (departments.length > 0) {
        const deptRows = departments.map(name => ({
          name,
          client_id: profile.client_id!,
        }));
        const { error: deptErr } = await supabase
          .from('departments')
          .insert(deptRows);
        if (deptErr) throw deptErr;
      }

      await refreshProfile();
      toast.success(
        language === 'fr'
          ? 'Organisation configurée avec succès !'
          : 'Organization configured successfully!'
      );
      navigate('/dashboard');
    } catch (error) {
      console.error('Error during setup:', error);
      toast.error(
        language === 'fr'
          ? 'Erreur lors de la configuration'
          : 'Error during configuration'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <FileText className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="font-serif text-2xl font-semibold text-foreground">
            DigiCam
          </span>
        </div>
      </header>

      {/* Progress */}
      <div className="flex items-center justify-center gap-2 pt-6 pb-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
              i < stepIndex ? 'bg-primary text-primary-foreground' :
              i === stepIndex ? 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2' :
              'bg-muted text-muted-foreground'
            )}>
              {i < stepIndex ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('w-12 h-0.5', i < stepIndex ? 'bg-primary' : 'bg-muted')} />
            )}
          </div>
        ))}
      </div>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-4xl mx-auto w-full">
        {/* Step 1: Organization Info */}
        {step === 'org_info' && (
          <div className="w-full max-w-lg space-y-6 animate-fade-in">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-serif font-bold text-foreground mb-2">
                {language === 'fr' ? 'Votre organisation' : 'Your organization'}
              </h1>
              <p className="text-muted-foreground">
                {language === 'fr'
                  ? 'Commencez par identifier votre organisation.'
                  : 'Start by identifying your organization.'}
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">
                  {language === 'fr' ? 'Nom de l\'organisation *' : 'Organization name *'}
                </Label>
                <Input
                  id="orgName"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder={language === 'fr' ? 'Ex: Ministère de l\'Éducation' : 'Ex: Ministry of Education'}
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  {language === 'fr' ? 'Logo (optionnel)' : 'Logo (optional)'}
                </Label>
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <div className="relative">
                      <img
                        src={logoPreview}
                        alt="Logo"
                        className="h-16 w-16 rounded-lg object-cover border border-border"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="h-16 w-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Image className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {language === 'fr' ? 'Choisir un fichier' : 'Choose file'}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      PNG, JPG. Max 2 Mo.
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    className="hidden"
                    onChange={handleLogoSelect}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleNext} className="btn-institutional min-w-[140px]">
                {language === 'fr' ? 'Suivant' : 'Next'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Module Selection */}
        {step === 'module' && (
          <div className="w-full animate-fade-in">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-serif font-bold text-foreground mb-2">
                {language === 'fr' ? 'Choisissez votre module' : 'Choose your module'}
              </h1>
              <p className="text-muted-foreground max-w-xl mx-auto">
                {language === 'fr'
                  ? 'Le module détermine les règles de gouvernance, les permissions et le niveau de sécurité. Pour changer de module, contactez DigiCam.'
                  : 'The module determines governance rules, permissions and security level. To change module, contact DigiCam.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-8">
              {(['core', 'admin_publique'] as ClientModule[]).map((mod) => {
                const info = MODULE_INFO[mod];
                const details = moduleDetails[mod];
                const Icon = details.icon;
                const isSelected = selectedModule === mod;

                return (
                  <Card
                    key={mod}
                    className={cn(
                      'cursor-pointer transition-all duration-200 relative',
                      isSelected
                        ? 'ring-2 ring-primary shadow-lg'
                        : 'hover:shadow-md hover:border-primary/30'
                    )}
                    onClick={() => setSelectedModule(mod)}
                  >
                    {isSelected && (
                      <div className="absolute -top-3 -right-3 h-7 w-7 bg-primary rounded-full flex items-center justify-center">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                    <CardHeader className="text-center pb-2">
                      <div className={cn(
                        'h-14 w-14 rounded-xl flex items-center justify-center mx-auto mb-3',
                        mod === 'core' && 'bg-muted',
                        mod === 'admin_publique' && 'bg-blue-100 dark:bg-blue-900/30',
                      )}>
                        <Icon className={cn(
                          'h-7 w-7',
                          mod === 'core' && 'text-muted-foreground',
                          mod === 'admin_publique' && 'text-blue-600 dark:text-blue-400',
                        )} />
                      </div>
                      <CardTitle className="text-lg">
                        {language === 'fr' ? info.labelFr : info.labelEn}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {language === 'fr' ? details.tagline.fr : details.tagline.en}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        {language === 'fr' ? info.descriptionFr : info.descriptionEn}
                      </p>
                      <ul className="space-y-2">
                        {(language === 'fr' ? details.features.fr : details.features.en).map((feature, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                {language === 'fr' ? 'Retour' : 'Back'}
              </Button>
              <Button
                onClick={handleNext}
                disabled={!selectedModule}
                className="btn-institutional min-w-[140px]"
              >
                {language === 'fr' ? 'Suivant' : 'Next'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Departments */}
        {step === 'departments' && (
          <div className="w-full max-w-lg space-y-6 animate-fade-in">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-serif font-bold text-foreground mb-2">
                {language === 'fr' ? 'Départements' : 'Departments'}
              </h1>
              <p className="text-muted-foreground">
                {deptRequired
                  ? (language === 'fr'
                    ? 'En module Administratif, au moins un département est obligatoire pour structurer votre organisation.'
                    : 'In Administrative module, at least one department is required to structure your organization.')
                  : (language === 'fr'
                    ? 'Ajoutez des départements pour organiser vos équipes (optionnel en module Core).'
                    : 'Add departments to organize your teams (optional in Core module).')
                }
              </p>
            </div>

            {deptRequired && departments.length === 0 && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
                {language === 'fr'
                  ? '⚠ Au moins un département est requis pour continuer'
                  : '⚠ At least one department is required to continue'}
              </div>
            )}

            {/* Add department input */}
            <div className="flex gap-2">
              <Input
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                placeholder={language === 'fr' ? 'Nom du département' : 'Department name'}
                maxLength={80}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addDepartment();
                  }
                }}
              />
              <Button type="button" onClick={addDepartment} disabled={!newDeptName.trim()}>
                <Plus className="h-4 w-4 mr-1" />
                {language === 'fr' ? 'Ajouter' : 'Add'}
              </Button>
            </div>

            {/* Department list */}
            {departments.length > 0 && (
              <div className="space-y-2">
                {departments.map((dept, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{dept}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDepartment(i)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground text-center">
                  {departments.length} {language === 'fr' ? 'département(s)' : 'department(s)'}
                </p>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={handleBack}>
                {language === 'fr' ? 'Retour' : 'Back'}
              </Button>
              <Button
                onClick={handleFinish}
                disabled={loading || (deptRequired && departments.length === 0)}
                className="btn-institutional min-w-[180px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {language === 'fr' ? 'Configuration...' : 'Configuring...'}
                  </>
                ) : (
                  language === 'fr' ? 'Terminer la configuration' : 'Finish setup'
                )}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
