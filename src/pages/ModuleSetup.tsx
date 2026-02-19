import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Building2, Shield, Lock, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ClientModule, MODULE_INFO } from '@/types/modules';
import { cn } from '@/lib/utils';

const moduleDetails: Record<ClientModule, {
  icon: typeof Building2;
  features: { fr: string[]; en: string[] };
  tagline: { fr: string; en: string };
}> = {
  core: {
    icon: Building2,
    features: {
      fr: [
        'Gestion documentaire complète (CRUD)',
        'Deux rôles : Super Admin et Staff (pas d\'Admin IT)',
        'Super Admin gère documents, utilisateurs et départements',
        'Partage de documents entre utilisateurs',
        'Recherche avancée et filtres',
      ],
      en: [
        'Full document management (CRUD)',
        'Two roles: Super Admin and Staff (no IT Admin)',
        'Super Admin manages documents, users and departments',
        'Document sharing between users',
        'Advanced search and filters',
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
        'Staff en lecture seule (consultation uniquement)',
        'Admin IT restreint aux opérations documentaires',
        'Accès multi-départements pour les agents',
        'Journalisation obligatoire de toutes les actions',
        'Annuaire interne visible pour tous',
      ],
      en: [
        'Staff in read-only mode (view only)',
        'IT Admin restricted to document operations',
        'Multi-department access for agents',
        'Mandatory logging of all actions',
        'Internal directory visible to all',
      ],
    },
    tagline: {
      fr: 'Pour ministères et collectivités territoriales',
      en: 'For ministries and public entities',
    },
  },
  fiscal: {
    icon: Lock,
    features: {
      fr: [
        'Immutabilité WORM — aucune suppression possible',
        'Staff en lecture seule stricte',
        'Admin IT restreint aux opérations documentaires',
        'Journal immutable avec hash de fichier',
        'Traçabilité totale et non-répudiation',
      ],
      en: [
        'WORM immutability — no deletion possible',
        'Staff in strict read-only mode',
        'IT Admin restricted to document operations',
        'Immutable log with file hash',
        'Full traceability and non-repudiation',
      ],
    },
    tagline: {
      fr: 'Pour DGI, Douanes, Trésor — Haute sécurité',
      en: 'For Tax, Customs, Treasury — High security',
    },
  },
};

export default function ModuleSetup() {
  const [selectedModule, setSelectedModule] = useState<ClientModule | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const { language } = useLanguage();

  const handleConfirm = async () => {
    if (!selectedModule || !profile?.client_id) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({ module: selectedModule, module_configured: true })
        .eq('id', profile.client_id);

      if (error) throw error;

      await refreshProfile();
      toast.success(
        language === 'fr' 
          ? 'Module configuré avec succès' 
          : 'Module configured successfully'
      );
      navigate('/dashboard');
    } catch (error) {
      console.error('Error setting module:', error);
      toast.error(
        language === 'fr' 
          ? 'Erreur lors de la configuration' 
          : 'Error during configuration'
      );
    } finally {
      setLoading(false);
    }
  };

  const modules: ClientModule[] = ['core', 'admin_publique', 'fiscal'];

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

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-5xl mx-auto w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif font-bold text-foreground mb-2">
            {language === 'fr' 
              ? 'Choisissez votre module' 
              : 'Choose your module'}
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {language === 'fr'
              ? 'Le module détermine les règles de gouvernance, les permissions et le niveau de sécurité de votre organisation. Ce choix est définitif — contactez DigiCam pour le modifier.'
              : 'The module determines governance rules, permissions and security level for your organization. This choice is permanent — contact DigiCam to change it.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-8">
          {modules.map((mod) => {
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
                    mod === 'fiscal' && 'bg-amber-100 dark:bg-amber-900/30',
                  )}>
                    <Icon className={cn(
                      'h-7 w-7',
                      mod === 'core' && 'text-muted-foreground',
                      mod === 'admin_publique' && 'text-blue-600 dark:text-blue-400',
                      mod === 'fiscal' && 'text-amber-600 dark:text-amber-400',
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

        <Button
          size="lg"
          className="btn-institutional min-w-[200px]"
          onClick={handleConfirm}
          disabled={!selectedModule || loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {language === 'fr' ? 'Configuration...' : 'Configuring...'}
            </>
          ) : (
            language === 'fr' ? 'Confirmer le module' : 'Confirm module'
          )}
        </Button>
      </main>
    </div>
  );
}
