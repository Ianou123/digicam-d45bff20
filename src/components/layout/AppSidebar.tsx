import { 
  LayoutDashboard, 
  FileText, 
  FolderOpen,
  Upload, 
  Users, 
  Building2, 
  Settings, 
  Activity,
  BarChart3,
  LogOut,
  ChevronDown,
  Shield,
  Share2,
  KeyRound,
  HelpCircle,
  Lightbulb,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface AppSidebarProps {
  onClose?: () => void;
}

export function AppSidebar({ onClose }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut, isUltraAdmin, isSuperAdmin, isClientAdmin, canManageDocuments } = useAuth();
  const { t, language } = useLanguage();
  const { module, moduleInfo, permissions, isRestrictedModule } = useModulePermissions();

  const isRestrictedITAdmin = isClientAdmin && isRestrictedModule;

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getModuleBadgeColor = () => {
    switch (module) {
      case 'admin_publique': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getModuleIcon = () => {
    switch (module) {
      case 'admin_publique': return Shield;
      default: return Building2;
    }
  };

  const isStaffUser = !isUltraAdmin && !isSuperAdmin && !isClientAdmin;

  const NavItem = ({ href, icon: Icon, label }: { href: string; icon: any; label: string }) => {
    const isActive = location.pathname === href;
    
    return (
      <Link
        to={href}
        onClick={handleNavClick}
        className={cn(
          'sidebar-item group',
          isActive && 'sidebar-item-active'
        )}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        <span className="truncate">{label}</span>
      </Link>
    );
  };

  const SectionLabel = ({ label }: { label: string }) => (
    <div className="pt-4 pb-2">
      <span className="px-3 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
        {label}
      </span>
    </div>
  );

  const ModuleIcon = getModuleIcon();

  // ==================== ULTRA ADMIN SIDEBAR ====================
  if (isUltraAdmin) {
    return (
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <FileText className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <span className="font-serif text-xl font-semibold text-sidebar-foreground">DigiCam</span>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          <NavItem href="/dashboard" icon={LayoutDashboard} label={language === 'fr' ? 'Tableau de Bord' : 'Dashboard'} />
          <NavItem href="/clients" icon={Building2} label={language === 'fr' ? 'Organisations' : 'Organizations'} />
          <NavItem href="/users" icon={Users} label={language === 'fr' ? 'Utilisateurs' : 'Users'} />
          <SectionLabel label={language === 'fr' ? 'Supervision' : 'Supervision'} />
          <NavItem href="/activity" icon={Activity} label={language === 'fr' ? 'Journal d\'Activité' : 'Activity Log'} />
          <NavItem href="/analytics" icon={BarChart3} label={language === 'fr' ? 'Statistiques' : 'Statistics'} />
          <SectionLabel label={language === 'fr' ? 'Mon Compte' : 'My Account'} />
          <NavItem href="/my-authorization" icon={KeyRound} label={language === 'fr' ? 'Mon Habilitation' : 'My Authorization'} />
          <NavItem href="/settings" icon={Settings} label={language === 'fr' ? 'Paramètres' : 'Settings'} />
          <NavItem href="/guide" icon={HelpCircle} label={language === 'fr' ? 'Guide' : 'Guide'} />
        </nav>
        {/* User Menu */}
        <div className="border-t border-sidebar-border p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-lg p-2 text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm">{getInitials(profile?.full_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium truncate">{profile?.full_name || profile?.email}</p>
                  <p className="text-xs text-sidebar-foreground/60 truncate">Ultra Admin</p>
                </div>
                <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild><Link to="/settings" className="flex items-center gap-2"><Settings className="h-4 w-4" />{t('nav.settings')}</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive"><LogOut className="h-4 w-4 mr-2" />{t('nav.logout')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    );
  }

  // ==================== STANDARD SIDEBAR ====================
  const isAdmin = isSuperAdmin || (isClientAdmin && !isRestrictedITAdmin);

  const mainNavItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: language === 'fr' ? 'Tableau de bord' : 'Dashboard', show: true },
    { href: '/documents', icon: FileText, label: isRestrictedITAdmin ? (language === 'fr' ? 'Documents uploadés' : 'Uploaded Documents') : (language === 'fr' ? 'Documents' : 'Documents'), show: true },
    { href: '/shared-with-me', icon: Share2, label: language === 'fr' ? 'Partagés avec moi' : 'Shared with me', show: !isRestrictedITAdmin },
    { href: '/upload', icon: Upload, label: t('nav.upload'), show: permissions.canUploadDocuments },
  ];

  const adminNavItems = [
    { href: '/users', icon: Users, label: t('nav.users'), show: isAdmin },
    { href: '/departments', icon: Building2, label: t('nav.departments'), show: isAdmin },
    { href: '/activity', icon: Activity, label: language === 'fr' ? 'Activité' : 'Activity', show: isAdmin },
    { href: '/admin-pulse', icon: Lightbulb, label: 'Admin Pulse', show: isAdmin },
    { href: '/analytics', icon: BarChart3, label: language === 'fr' ? 'Analytiques' : 'Analytics', show: isAdmin },
  ];

  const accountNavItems = [
    { href: '/my-authorization', icon: KeyRound, label: language === 'fr' ? 'Mon Habilitation' : 'My Authorization', show: !isRestrictedITAdmin },
    { href: '/guide', icon: HelpCircle, label: language === 'fr' ? 'Aide' : 'Help', show: true },
  ];

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
        <Link to={isStaffUser ? '/documents' : '/dashboard'} className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <FileText className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <span className="font-serif text-xl font-semibold text-sidebar-foreground">DigiCam</span>
        </Link>
      </div>

      {isRestrictedModule && (
        <div className="px-4 py-2 border-b border-sidebar-border">
          <Badge className={cn('w-full justify-center gap-1.5', getModuleBadgeColor())}>
            <ModuleIcon className="h-3 w-3" />
            {language === 'fr' ? moduleInfo.labelFr : moduleInfo.labelEn}
          </Badge>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {mainNavItems.filter(item => item.show).map((item) => (
          <NavItem key={item.href} {...item} />
        ))}

        {adminNavItems.some(item => item.show) && (
          <>
            <SectionLabel label="Administration" />
            {adminNavItems.filter(item => item.show).map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </>
        )}

        <SectionLabel label={language === 'fr' ? 'Mon Compte' : 'My Account'} />
        {accountNavItems.filter(item => item.show).map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg p-2 text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
              <Avatar className="h-9 w-9">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm">{getInitials(profile?.full_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">{profile?.full_name || profile?.email}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {isSuperAdmin ? t('users.superAdmin') : isClientAdmin ? t('users.clientAdmin') : t('users.staff')}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild><Link to="/settings" className="flex items-center gap-2"><Settings className="h-4 w-4" />{t('nav.settings')}</Link></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive"><LogOut className="h-4 w-4 mr-2" />{t('nav.logout')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
