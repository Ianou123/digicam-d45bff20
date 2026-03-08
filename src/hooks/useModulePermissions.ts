import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ClientModule, 
  AppRole, 
  ModulePermissions, 
  getPermissionsForRoleAndModule,
  MODULE_INFO,
  ROLE_INFO,
  ModuleInfo,
  RoleInfo
} from '@/types/modules';

interface UseModulePermissionsResult {
  module: ClientModule;
  role: AppRole;
  permissions: ModulePermissions;
  moduleInfo: ModuleInfo;
  roleInfo: RoleInfo;
  isRestrictedModule: boolean;
  isReadOnly: boolean;
  isUltraAdmin: boolean;
  can: (permission: keyof ModulePermissions) => boolean;
}

export function useModulePermissions(): UseModulePermissionsResult {
  const { 
    isUltraAdmin,
    isSuperAdmin, 
    isClientAdmin, 
    clientModule 
  } = useAuth();
  
  const module: ClientModule = (clientModule === 'core' || clientModule === 'admin_publique') 
    ? clientModule 
    : 'core';
  
  const role: AppRole = useMemo(() => {
    if (isUltraAdmin) return 'ultra_admin';
    if (isSuperAdmin) return 'super_admin';
    if (isClientAdmin) return 'client_admin';
    return 'staff';
  }, [isUltraAdmin, isSuperAdmin, isClientAdmin]);
  
  const permissions = useMemo(() => {
    return getPermissionsForRoleAndModule(role, module);
  }, [role, module]);
  
  const moduleInfo = MODULE_INFO[module];
  const roleInfo = ROLE_INFO[role];
  
  const isRestrictedModule = module === 'admin_publique';
  
  const can = (permission: keyof ModulePermissions): boolean => {
    const value = permissions[permission];
    return typeof value === 'boolean' ? value : false;
  };
  
  return {
    module,
    role,
    permissions,
    moduleInfo,
    roleInfo,
    isRestrictedModule,
    isReadOnly: permissions.isReadOnly,
    isUltraAdmin,
    can,
  };
}
