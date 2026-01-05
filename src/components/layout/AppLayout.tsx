import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { SuspendedBanner } from './SuspendedBanner';
import { DeactivatedUserPage } from '@/components/DeactivatedUserPage';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const pageTitles: Record<string, string> = {
  '/dashboard': 'nav.dashboard',
  '/documents': 'nav.documents',
  '/search': 'nav.search',
  '/upload': 'nav.upload',
  '/users': 'nav.users',
  '/clients': 'nav.clients',
  '/activity': 'nav.activity',
  '/analytics': 'nav.analytics',
  '/settings': 'nav.settings',
  '/my-dashboard': 'nav.myDashboard',
};

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading, isClientSuspended, isSuperAdmin, isUserDeactivated } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();

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

  // Block deactivated users with full-page message
  if (isUserDeactivated) {
    return <DeactivatedUserPage />;
  }

  const titleKey = pageTitles[location.pathname];
  const pageTitle = titleKey ? t(titleKey) : '';

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      <div
        className={cn(
          'fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm lg:hidden transition-opacity',
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <div
        className={cn(
          'lg:block',
          sidebarOpen ? 'block' : 'hidden'
        )}
      >
        <AppSidebar />
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Show suspended banner if client is suspended and user is not super admin */}
        {isClientSuspended && !isSuperAdmin && <SuspendedBanner />}
        
        <AppHeader
          title={pageTitle}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="p-6 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}