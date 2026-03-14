// Module types for DigiCam Archive
export type ClientModule = 'core' | 'admin_publique';

// App role types - includes ultra_admin for DigiCam staff
export type AppRole = 'ultra_admin' | 'super_admin' | 'client_admin' | 'staff';

// Permission definitions per role and module
export interface ModulePermissions {
  // Document permissions
  canViewDocuments: boolean;
  canUploadDocuments: boolean;
  canEditDocuments: boolean;
  canDeleteDocuments: boolean;
  canDownloadDocuments: boolean;
  
  // User management permissions
  canManageUsers: boolean;
  canManageRoles: boolean;
  
  // Department/Structure permissions
  canManageDepartments: boolean;
  canViewDirectory: boolean;
  
  // Administrative permissions
  canViewAuditLogs: boolean;
  canViewAnalytics: boolean;
  canViewActivity: boolean;
  canManageOrganization: boolean;
  canChangeModule: boolean;
  
  // Module-specific
  isReadOnly: boolean;
  requiresAuditLog: boolean;
}

// Module display information
export interface ModuleInfo {
  key: ClientModule;
  labelFr: string;
  labelEn: string;
  descriptionFr: string;
  descriptionEn: string;
  color: string;
  icon: 'building' | 'shield';
}

export const MODULE_INFO: Record<ClientModule, ModuleInfo> = {
  core: {
    key: 'core',
    labelFr: 'Core',
    labelEn: 'Core',
    descriptionFr: 'GED moderne pour PME et équipes internes',
    descriptionEn: 'Modern DMS for SMBs and internal teams',
    color: 'slate',
    icon: 'building',
  },
  admin_publique: {
    key: 'admin_publique',
    labelFr: 'Administratif',
    labelEn: 'Administrative',
    descriptionFr: 'Pour institutions et grandes entreprises — séparation des tâches',
    descriptionEn: 'For institutions and large enterprises — separation of duties',
    color: 'blue',
    icon: 'shield',
  },
};

// Role display information
export interface RoleInfo {
  key: AppRole;
  labelFr: string;
  labelEn: string;
  descriptionFr: string;
  descriptionEn: string;
}

export const ROLE_INFO: Record<AppRole, RoleInfo> = {
  ultra_admin: {
    key: 'ultra_admin',
    labelFr: 'Ultra Admin',
    labelEn: 'Ultra Admin',
    descriptionFr: 'Personnel DigiCam - Gestion de la plateforme et des organisations',
    descriptionEn: 'DigiCam Staff - Platform and organization management',
  },
  super_admin: {
    key: 'super_admin',
    labelFr: 'Super Admin',
    labelEn: 'Super Admin',
    descriptionFr: 'Autorité souveraine - Garant institutionnel (DSI, Direction Générale)',
    descriptionEn: 'Sovereign authority - Institutional guardian (CIO, General Management)',
  },
  client_admin: {
    key: 'client_admin',
    labelFr: 'Admin IT',
    labelEn: 'IT Admin',
    descriptionFr: 'Opérateur documentaire - Gestion technique transversale',
    descriptionEn: 'Document operator - Cross-functional technical management',
  },
  staff: {
    key: 'staff',
    labelFr: 'Utilisateur',
    labelEn: 'User',
    descriptionFr: 'Utilisateur standard - Consultation, recherche et téléchargement',
    descriptionEn: 'Standard user - Viewing, searching and downloading',
  },
};

// Permission matrix: what each role can do per module
export function getPermissionsForRoleAndModule(
  role: AppRole,
  module: ClientModule
): ModulePermissions {
  const isAdminModule = module === 'admin_publique';
  
  // Ultra Admin (DigiCam staff) - platform management only
  if (role === 'ultra_admin') {
    return {
      // Confidentiality: DigiCam staff must never access client documents
      canViewDocuments: false,
      canUploadDocuments: false,
      canEditDocuments: false,
      canDeleteDocuments: false,
      canDownloadDocuments: false,
      canManageUsers: true,
      canManageRoles: true,
      canManageDepartments: false,
      canViewDirectory: true,
      canViewAuditLogs: true,
      canViewAnalytics: true,
      canViewActivity: true,
      canManageOrganization: true,
      canChangeModule: true,
      isReadOnly: true,
      requiresAuditLog: false,
    };
  }
  
  // Super Admin
  if (role === 'super_admin') {
    return {
      canViewDocuments: true,
      // In Administrative module, Super Admin CANNOT upload (separation of concerns)
      canUploadDocuments: !isAdminModule,
      canEditDocuments: true,
      canDeleteDocuments: true,
      canDownloadDocuments: true,
      canManageUsers: true,
      canManageRoles: true,
      canManageDepartments: true,
      canViewDirectory: true,
      canViewAuditLogs: true,
      canViewAnalytics: true,
      canViewActivity: true,
      canManageOrganization: true,
      canChangeModule: false,
      isReadOnly: false,
      requiresAuditLog: isAdminModule,
    };
  }
  
  // Client Admin (Admin IT) - upload only in Administrative, full admin in Core
  if (role === 'client_admin') {
    return {
      canViewDocuments: !isAdminModule, // In Admin module, IT Admin only uploads
      canUploadDocuments: true,
      canEditDocuments: true,
      canDeleteDocuments: !isAdminModule,
      canDownloadDocuments: !isAdminModule,
      canManageUsers: !isAdminModule,
      canManageRoles: !isAdminModule,
      canManageDepartments: !isAdminModule,
      canViewDirectory: !isAdminModule,
      canViewAuditLogs: !isAdminModule,
      canViewAnalytics: !isAdminModule,
      canViewActivity: !isAdminModule,
      canManageOrganization: false,
      canChangeModule: false,
      isReadOnly: false,
      requiresAuditLog: isAdminModule,
    };
  }
  
  // Staff — read-only in both modules, no upload, no edit, no delete
  return {
    canViewDocuments: true,
    canUploadDocuments: false,
    canEditDocuments: false,
    canDeleteDocuments: false,
    canDownloadDocuments: true,
    canManageUsers: false,
    canManageRoles: false,
    canManageDepartments: false,
    canViewDirectory: true,
    canViewAuditLogs: false,
    canViewAnalytics: false,
    canViewActivity: false,
    canManageOrganization: false,
    canChangeModule: false,
    isReadOnly: true,
    requiresAuditLog: isAdminModule,
  };
}

// Permission item for display
export interface PermissionItem {
  key: keyof ModulePermissions;
  labelFr: string;
  labelEn: string;
}

export const PERMISSION_LABELS: PermissionItem[] = [
  { key: 'canViewDocuments', labelFr: 'Consulter les documents', labelEn: 'View documents' },
  { key: 'canUploadDocuments', labelFr: 'Importer des documents', labelEn: 'Upload documents' },
  { key: 'canEditDocuments', labelFr: 'Modifier les documents', labelEn: 'Edit documents' },
  { key: 'canDeleteDocuments', labelFr: 'Supprimer des documents', labelEn: 'Delete documents' },
  { key: 'canDownloadDocuments', labelFr: 'Télécharger des documents', labelEn: 'Download documents' },
  { key: 'canManageUsers', labelFr: 'Gérer les utilisateurs', labelEn: 'Manage users' },
  { key: 'canManageRoles', labelFr: 'Gérer les rôles', labelEn: 'Manage roles' },
  { key: 'canManageDepartments', labelFr: 'Gérer les départements', labelEn: 'Manage departments' },
  { key: 'canViewDirectory', labelFr: 'Voir l\'annuaire', labelEn: 'View directory' },
  { key: 'canViewAuditLogs', labelFr: 'Voir les logs d\'audit', labelEn: 'View audit logs' },
  { key: 'canViewAnalytics', labelFr: 'Voir les statistiques', labelEn: 'View analytics' },
  { key: 'canManageOrganization', labelFr: 'Gérer l\'organisation', labelEn: 'Manage organization' },
];

// Reasons for restricted permissions
export function getRestrictionReason(
  permission: keyof ModulePermissions,
  role: AppRole,
  module: ClientModule,
  language: 'fr' | 'en'
): string | null {
  const isAdminModule = module === 'admin_publique';
  
  if (role === 'super_admin' && isAdminModule && permission === 'canUploadDocuments') {
    return language === 'fr'
      ? 'Séparation des tâches : l\'upload est réservé à l\'Admin IT en module Administratif'
      : 'Separation of duties: upload is reserved for IT Admin in Administrative module';
  }
  
  if (role === 'client_admin' && isAdminModule) {
    if (['canManageUsers', 'canManageRoles', 'canManageDepartments', 'canViewDocuments', 'canDownloadDocuments'].includes(permission)) {
      return language === 'fr'
        ? 'Séparation des tâches : réservé au Super Admin en module Administratif'
        : 'Separation of duties: reserved for Super Admin in Administrative module';
    }
  }
  
  if (role === 'staff' && isAdminModule) {
    if (['canUploadDocuments', 'canEditDocuments'].includes(permission)) {
      return language === 'fr'
        ? 'Séparation des tâches : réservé à l\'Admin IT en module Administratif'
        : 'Separation of duties: reserved for IT Admin in Administrative module';
    }
  }
  
  if (role === 'staff') {
    if (['canUploadDocuments', 'canEditDocuments', 'canDeleteDocuments'].includes(permission)) {
      return language === 'fr'
        ? 'Réservé aux administrateurs'
        : 'Reserved for administrators';
    }
    if (['canManageUsers', 'canManageRoles', 'canManageDepartments', 'canViewAuditLogs', 'canViewAnalytics', 'canManageOrganization'].includes(permission)) {
      return language === 'fr'
        ? 'Réservé aux administrateurs'
        : 'Reserved for administrators';
    }
  }
  
  return null;
}
