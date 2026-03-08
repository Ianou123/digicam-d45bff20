import { useState, useMemo } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { GlobalImportButton } from './GlobalImportButton';
import { SuspendedBanner } from './SuspendedBanner';
import { DeactivatedUserPage } from '@/components/DeactivatedUserPage';
import { RoleAcknowledgmentModal } from '@/components/auth/RoleAcknowledgmentModal';
import { DepartmentSelectionModal } from '@/components/auth/DepartmentSelectionModal';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { cn } from '@/lib/utils';

const pageTitles: Record<string, string> = {
  '/dashboard': 'nav.dashboard',
  '/documents': 'nav.documents',
  '/my-documents': 'nav.myDocuments',
  '/search': 'nav.search',
  '/upload': 'nav.upload',
  '/users': 'nav.users',
  '/clients': 'nav.clients',
  '/activity': 'nav.activity',
  '/analytics': 'nav.analytics',
  '/settings': 'nav.settings',
  '/admin': 'nav.admin',
};

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading, isClientSuspended, isSuperAdmin, isClientAdmin, isUserDeactivated, requiresRoleAcknowledgment, acknowledgeRole, moduleConfigured } = useAuth();
  const { t } = useLanguage();
  const { isRestrictedModule } = useModulePermissions();
  const location = useLocation();

  // IT Admin in Administrative module = restricted to specific routes only
  const isRestrictedITAdmin = isClientAdmin && isRestrictedModule;
  const allowedRoutesForRestrictedITAdmin = ['/upload', '/documents', '/settings'];
  const isRouteAllowed = !isRestrictedITAdmin || allowedRoutesForRestrictedITAdmin.some(
    route => location.pathname === route || location.pathname.startsWith(route + '/')
  );
  
  // Dynamic page title based on route
  usePageTitle();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect super admins to module setup if not configured
  if (isSuperAdmin && !moduleConfigured) {
    return <Navigate to="/setup" replace />;
  }

  // Block deactivated users with full-page message
  if (isUserDeactivated) {
    return <DeactivatedUserPage />;
  }

  // Redirect restricted IT Admin to /upload if accessing unauthorized route
  if (!isRouteAllowed) {
    return <Navigate to="/upload" replace />;
  }

  const titleKey = pageTitles[location.pathname];
  const pageTitle = titleKey ? t(titleKey) : '';

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay - visible below xl breakpoint */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm xl:hidden transition-opacity duration-300',
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar - Fixed on xl+, slide-in drawer on smaller screens */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out',
          'xl:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full xl:translate-x-0'
        )}
      >
        <AppSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content - offset by sidebar width on xl+ */}
      <div className="xl:pl-64">
        {/* Show suspended banner if client is suspended and user is not super admin */}
        {isClientSuspended && !isSuperAdmin && <SuspendedBanner />}
        
        <AppHeader
          title={pageTitle}
          onMenuClick={() => setSidebarOpen(true)}
          rightContent={<GlobalImportButton />}
        />
        <main className="p-6 animate-fade-in">
          <Outlet />
        </main>
      </div>

      {/* Role Acknowledgment Modal */}
      <RoleAcknowledgmentModal 
        open={requiresRoleAcknowledgment} 
        onAcknowledge={acknowledgeRole} 
      />

      {/* Department Selection for new users */}
      <DepartmentSelectionModal />
    </div>
  );
}