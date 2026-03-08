import { HelpCircle, Building2, Shield, Users, FileText, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/contexts/LanguageContext';

interface GlossaryEntry {
  termFr: string;
  termEn: string;
  definitionFr: string;
  definitionEn: string;
  category: 'organisation' | 'role' | 'module' | 'metric';
}

const GLOSSARY: GlossaryEntry[] = [
  {
    termFr: 'Organisation Active',
    termEn: 'Active Organization',
    definitionFr: 'Organisation dont au moins un utilisateur s\'est connecté dans les 30 derniers jours.',
    definitionEn: 'Organization where at least one user has logged in within the last 30 days.',
    category: 'organisation',
  },
  {
    termFr: 'Organisation Inactive',
    termEn: 'Inactive Organization',
    definitionFr: 'Organisation sans activité depuis plus de 30 jours. Aucune action requise, mais peut nécessiter un suivi commercial.',
    definitionEn: 'Organization with no activity for over 30 days. No action required, but may need commercial follow-up.',
    category: 'organisation',
  },
  {
    termFr: 'Organisation Suspendue',
    termEn: 'Suspended Organization',
    definitionFr: 'Organisation dont l\'accès a été volontairement désactivé par un Ultra Admin (ex: impayé, non-conformité). Les utilisateurs ne peuvent plus se connecter.',
    definitionEn: 'Organization whose access has been intentionally disabled by an Ultra Admin (e.g., unpaid, non-compliance). Users can no longer log in.',
    category: 'organisation',
  },
  {
    termFr: 'Taux de Rétention',
    termEn: 'Retention Rate',
    definitionFr: 'Pourcentage d\'organisations toujours actives 30 jours après leur création. Un taux sain est > 80%.',
    definitionEn: 'Percentage of organizations still active 30 days after creation. A healthy rate is > 80%.',
    category: 'metric',
  },
  {
    termFr: 'Stockage Alloué',
    termEn: 'Allocated Storage',
    definitionFr: 'Espace disque réservé pour une organisation. Peut être augmenté depuis la page Organisation.',
    definitionEn: 'Disk space reserved for an organization. Can be increased from the Organization page.',
    category: 'metric',
  },
  {
    termFr: 'Module Core',
    termEn: 'Core Module',
    definitionFr: 'Module simplifié avec 2 rôles (Admin + Utilisateur). L\'Admin gère tout : upload, utilisateurs, logs. Départements optionnels. Idéal pour PME et cabinets.',
    definitionEn: 'Simplified module with 2 roles (Admin + User). The Admin manages everything: upload, users, logs. Optional departments. Ideal for SMBs and firms.',
    category: 'module',
  },
  {
    termFr: 'Module Administratif',
    termEn: 'Administrative Module',
    definitionFr: 'Module avancé avec 3 rôles (Super Admin + IT Admin + Utilisateur). Séparation des tâches : le Super Admin gère mais n\'uploade pas, l\'IT Admin uploade mais ne gère pas. Départements obligatoires. Idéal pour institutions et grandes entreprises.',
    definitionEn: 'Advanced module with 3 roles (Super Admin + IT Admin + User). Separation of duties: Super Admin manages but doesn\'t upload, IT Admin uploads but doesn\'t manage. Mandatory departments. Ideal for institutions and large enterprises.',
    category: 'module',
  },
  {
    termFr: 'Ultra Admin',
    termEn: 'Ultra Admin',
    definitionFr: 'Employé DigiCam. Peut créer et gérer les organisations, voir les logs globaux, mais ne peut PAS accéder au contenu des documents (confidentialité client).',
    definitionEn: 'DigiCam employee. Can create and manage organizations, view global logs, but CANNOT access document content (client confidentiality).',
    category: 'role',
  },
  {
    termFr: 'Super Admin',
    termEn: 'Super Admin',
    definitionFr: 'Responsable de l\'organisation. Autorité souveraine sur la gestion des utilisateurs, rôles, départements et logs. En module Administratif, ne peut pas uploader de documents.',
    definitionEn: 'Organization head. Sovereign authority over user, role, department, and log management. In Administrative module, cannot upload documents.',
    category: 'role',
  },
  {
    termFr: 'Admin IT',
    termEn: 'IT Admin',
    definitionFr: 'Opérateur documentaire (module Administratif uniquement). Upload et gestion technique des documents. N\'a pas accès aux outils d\'administration ou de recherche.',
    definitionEn: 'Document operator (Administrative module only). Upload and technical document management. No access to admin tools or search.',
    category: 'role',
  },
  {
    termFr: 'Utilisateur',
    termEn: 'User',
    definitionFr: 'Utilisateur standard. Accès en lecture seule : recherche, consultation et téléchargement. Aucun droit d\'upload ou de gestion.',
    definitionEn: 'Standard user. Read-only access: search, viewing and downloading. No upload or management rights.',
    category: 'role',
  },
];

const categoryIcons: Record<string, any> = {
  organisation: Building2,
  role: Users,
  module: Shield,
  metric: Activity,
};

const categoryLabels: Record<string, { fr: string; en: string }> = {
  organisation: { fr: 'Organisations', en: 'Organizations' },
  role: { fr: 'Rôles', en: 'Roles' },
  module: { fr: 'Modules', en: 'Modules' },
  metric: { fr: 'Indicateurs', en: 'Metrics' },
};

export default function Guide() {
  const { language } = useLanguage();

  const categories = ['organisation', 'module', 'role', 'metric'];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-serif font-semibold flex items-center gap-2">
          <HelpCircle className="h-6 w-6 text-primary" />
          {language === 'fr' ? 'Guide de la Plateforme' : 'Platform Guide'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {language === 'fr' 
            ? 'Définitions et explications des indicateurs'
            : 'Definitions and explanations of indicators'}
        </p>
      </div>

      {categories.map(category => {
        const entries = GLOSSARY.filter(e => e.category === category);
        const Icon = categoryIcons[category];
        const label = categoryLabels[category];

        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                {language === 'fr' ? label.fr : label.en}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {entries.map((entry, i) => (
                <div key={i}>
                  {i > 0 && <Separator className="mb-4" />}
                  <div className="space-y-1">
                    <h3 className="font-medium text-foreground">
                      {language === 'fr' ? entry.termFr : entry.termEn}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {language === 'fr' ? entry.definitionFr : entry.definitionEn}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
