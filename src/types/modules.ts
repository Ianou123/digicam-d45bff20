// Module types for DigiCam Archive
export type ClientModule = 'core' | 'admin_publique' | 'fiscal';

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
  requiresImmutability: boolean;
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
  icon: 'building' | 'shield' | 'lock';
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
    labelFr: 'Administration Publique',
    labelEn: 'Public Administration',
    descriptionFr: 'Pour ministères et collectivités - accès en lecture pour le staff',
    descriptionEn: 'For ministries and public entities - read-only for staff',
    color: 'blue',
    icon: 'shield',
  },
  fiscal: {
    key: 'fiscal',
    labelFr: 'Fiscal',
    labelEn: 'Fiscal',
    descriptionFr: 'Haute sécurité avec immutabilité WORM - DGI, Douanes, Trésor',
    descriptionEn: 'High security with WORM immutability - Tax, Customs, Treasury',
    color: 'amber',
    icon: 'lock',
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
    labelFr: 'Staff',
    labelEn: 'Staff',
    descriptionFr: 'Utilisateur standard - Consultation et recherche',
    descriptionEn: 'Standard user - Viewing and searching',
  },
};

// Permission matrix: what each role can do per module
export function getPermissionsForRoleAndModule(
  role: AppRole,
  module: ClientModule
): ModulePermissions {
  const isRestrictedModule = module === 'admin_publique' || module === 'fiscal';
  const isFiscalModule = module === 'fiscal';
  
  // Ultra Admin (DigiCam staff) - full platform access, not tied to modules
  if (role === 'ultra_admin') {
    return {
      canViewDocuments: true,
      canUploadDocuments: true,
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
      canChangeModule: true,
      isReadOnly: false,
      requiresImmutability: false,
      requiresAuditLog: false,
    };
  }
  
  // Super Admin has full access everywhere
  if (role === 'super_admin') {
    return {
      canViewDocuments: true,
      canUploadDocuments: true,
      canEditDocuments: true,
      canDeleteDocuments: !isFiscalModule, // Fiscal: no deletion
      canDownloadDocuments: true,
      canManageUsers: true,
      canManageRoles: true,
      canManageDepartments: true,
      canViewDirectory: true,
      canViewAuditLogs: true,
      canViewAnalytics: true,
      canViewActivity: true,
      canManageOrganization: true,
      canChangeModule: false, // Must contact DigiCam
      isReadOnly: false,
      requiresImmutability: isFiscalModule,
      requiresAuditLog: isFiscalModule,
    };
  }
  
  // Client Admin (Admin IT)
  if (role === 'client_admin') {
    return {
      canViewDocuments: true,
      canUploadDocuments: true,
      canEditDocuments: true,
      canDeleteDocuments: !isFiscalModule, // Fiscal: no deletion
      canDownloadDocuments: true,
      canManageUsers: !isRestrictedModule, // Only in Core module
      canManageRoles: !isRestrictedModule, // Only in Core module
      canManageDepartments: !isRestrictedModule, // Only in Core module
      canViewDirectory: true,
      canViewAuditLogs: !isRestrictedModule, // Only in Core module
      canViewAnalytics: !isRestrictedModule, // Only in Core module
      canViewActivity: !isRestrictedModule, // Only in Core module
      canManageOrganization: false,
      canChangeModule: false,
      isReadOnly: false,
      requiresImmutability: isFiscalModule,
      requiresAuditLog: isRestrictedModule,
    };
  }
  
  // Staff
  return {
    canViewDocuments: true,
    canUploadDocuments: !isRestrictedModule, // Read-only in Admin/Fiscal
    canEditDocuments: !isRestrictedModule,
    canDeleteDocuments: false, // Staff never deletes
    canDownloadDocuments: true, // Can download if document allows
    canManageUsers: false,
    canManageRoles: false,
    canManageDepartments: false,
    canViewDirectory: isRestrictedModule, // Directory visible in Admin/Fiscal
    canViewAuditLogs: false,
    canViewAnalytics: false,
    canViewActivity: false,
    canManageOrganization: false,
    canChangeModule: false,
    isReadOnly: isRestrictedModule,
    requiresImmutability: isFiscalModule,
    requiresAuditLog: isRestrictedModule,
  };
}

// Permission item for display in MyAuthorization page
export interface PermissionItem {
  key: keyof ModulePermissions;
  labelFr: string;
  labelEn: string;
  reasonFr?: string;
  reasonEn?: string;
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
  const isRestrictedModule = module === 'admin_publique' || module === 'fiscal';
  const isFiscalModule = module === 'fiscal';
  
  if (permission === 'canDeleteDocuments' && isFiscalModule) {
    return language === 'fr' 
      ? 'Suppression interdite en module Fiscal (immutabilité WORM)' 
      : 'Deletion forbidden in Fiscal module (WORM immutability)';
  }
  
  if (role === 'staff' && isRestrictedModule) {
    if (['canUploadDocuments', 'canEditDocuments'].includes(permission)) {
      return language === 'fr'
        ? 'Réservé aux administrateurs en module Administration/Fiscal'
        : 'Reserved for administrators in Admin/Fiscal module';
    }
  }
  
  if (role === 'client_admin' && isRestrictedModule) {
    if (['canManageUsers', 'canManageRoles', 'canManageDepartments'].includes(permission)) {
      return language === 'fr'
        ? 'Réservé au Super Admin en module Administration/Fiscal'
        : 'Reserved for Super Admin in Admin/Fiscal module';
    }
  }
  
  if (role === 'staff') {
    if (['canManageUsers', 'canManageRoles', 'canManageDepartments', 'canViewAuditLogs', 'canViewAnalytics', 'canManageOrganization', 'canDeleteDocuments'].includes(permission)) {
      return language === 'fr'
        ? 'Réservé aux administrateurs'
        : 'Reserved for administrators';
    }
  }
  
  return null;
}
