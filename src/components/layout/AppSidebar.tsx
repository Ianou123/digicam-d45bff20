import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFavorites } from '@/hooks/useFavorites';
import { usePinnedDocuments } from '@/hooks/usePinnedDocuments';
import { Star } from 'lucide-react';
import { 
  LayoutDashboard, 
  FileText, 
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
  Pin,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface AppSidebarProps {
  onClose?: () => void;
}

function useCollapsibleState(key: string, defaultOpen: boolean): [boolean, (open: boolean) => void] {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(`sidebar-${key}`);
      if (stored !== null) return stored === 'true';
    } catch {}
    return defaultOpen;
  });

  const setOpen = (open: boolean) => {
    setIsOpen(open);
    try { localStorage.setItem(`sidebar-${key}`, String(open)); } catch {}
  };

  return [isOpen, setOpen];
}

export function AppSidebar({ onClose }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut, isUltraAdmin, isSuperAdmin, isClientAdmin, canManageDocuments } = useAuth();
  const { t, language } = useLanguage();
  const { module, moduleInfo, permissions, isRestrictedModule } = useModulePermissions();

  const isRestrictedITAdmin = isClientAdmin && isRestrictedModule;

  const [accountOpen, setAccountOpen] = useCollapsibleState('account', false);
  const [adminOpen, setAdminOpen] = useCollapsibleState('admin', true);
  const [spacesOpen, setSpacesOpen] = useCollapsibleState('spaces', true);

  const { favoriteCount } = useFavorites();
  const { pinnedDocs } = usePinnedDocuments();
  const [docsCount, setDocsCount] = useState<number>(0);
  const [sharedCount, setSharedCount] = useState<number>(0);

  useEffect(() => {
    const fetchCounts = async () => {
      if (!profile?.client_id) return;
      const { count: dCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', profile.client_id)
        .is('deleted_at', null);
      setDocsCount(dCount || 0);
      if (profile.id) {
        const { count: sCount } = await supabase
          .from('shares')
          .select('*', { count: 'exact', head: true })
          .eq('recipient_user_id', profile.id);
        setSharedCount(sCount || 0);
      }
    };
    fetchCounts();
  }, [profile?.client_id, profile?.id]);

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

  const NavItem = ({ href, icon: Icon, label, badge }: { href: string; icon: any; label: string; badge?: number | null }) => {
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
        <span className="truncate flex-1">{label}</span>
        {badge != null && badge > 0 && (
          <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs flex items-center justify-center">
            {badge}
          </Badge>
        )}
      </Link>
    );
  };

  const CollapsibleSection = ({ 
    label, 
    isOpen, 
    onOpenChange, 
    children 
  }: { 
    label: string; 
    isOpen: boolean; 
    onOpenChange: (open: boolean) => void; 
    children: React.ReactNode;
  }) => (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <CollapsibleTrigger className="w-full pt-4 pb-2 flex items-center justify-between px-3 group cursor-pointer hover:opacity-80 transition-opacity">
        <span className="text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
          {label}
        </span>
        <ChevronDown className={cn(
          "h-3.5 w-3.5 text-sidebar-foreground/40 transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-up data-[state=open]:slide-down">
        {children}
      </CollapsibleContent>
    </Collapsible>
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
            <span className="font-serif text-lg font-semibold text-sidebar-foreground leading-tight">GEDAI</span>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          <NavItem href="/dashboard" icon={LayoutDashboard} label={language === 'fr' ? 'Tableau de Bord' : 'Dashboard'} />
          <NavItem href="/clients" icon={Building2} label={language === 'fr' ? 'Organisations' : 'Organizations'} />
          <NavItem href="/users" icon={Users} label={language === 'fr' ? 'Utilisateurs' : 'Users'} />

          <CollapsibleSection label={language === 'fr' ? 'Supervision' : 'Supervision'} isOpen={adminOpen} onOpenChange={setAdminOpen}>
            <NavItem href="/activity" icon={Activity} label={language === 'fr' ? 'Journal d\'Activité' : 'Activity Log'} />
            <NavItem href="/analytics" icon={BarChart3} label={language === 'fr' ? 'Statistiques' : 'Statistics'} />
          </CollapsibleSection>

          <CollapsibleSection label={language === 'fr' ? 'Mon Compte' : 'My Account'} isOpen={accountOpen} onOpenChange={setAccountOpen}>
            <NavItem href="/my-authorization" icon={KeyRound} label={language === 'fr' ? 'Mon Habilitation' : 'My Authorization'} />
            <NavItem href="/offline" icon={Pin} label={language === 'fr' ? 'Hors-ligne' : 'Offline'} />
            <NavItem href="/settings" icon={Settings} label={language === 'fr' ? 'Paramètres' : 'Settings'} />
            <NavItem href="/guide" icon={HelpCircle} label={language === 'fr' ? 'Guide' : 'Guide'} />
          </CollapsibleSection>
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

  const mainNavItems = isRestrictedITAdmin
    ? [
        { href: '/dashboard', icon: LayoutDashboard, label: language === 'fr' ? 'Tableau de bord' : 'Dashboard', show: true },
        { href: '/upload', icon: Upload, label: t('nav.upload'), show: true },
        { href: '/my-documents', icon: FileText, label: language === 'fr' ? 'Mes Téléversements' : 'My Uploads', show: true },
      ]
    : [
        { href: '/dashboard', icon: LayoutDashboard, label: language === 'fr' ? 'Tableau de bord' : 'Dashboard', show: true },
        { href: '/documents', icon: FileText, label: language === 'fr' ? 'Documents' : 'Documents', show: true, badge: docsCount },
        { href: '/upload', icon: Upload, label: t('nav.upload'), show: permissions.canUploadDocuments },
      ];

  const spacesNavItems = [
    { href: '/my-favorites', icon: Star, label: language === 'fr' ? 'Mes favoris' : 'My favorites', show: true, badge: favoriteCount },
    { href: '/shared-with-me', icon: Share2, label: language === 'fr' ? 'Partagés avec moi' : 'Shared with me', show: true, badge: sharedCount },
    { href: '/offline', icon: Pin, label: language === 'fr' ? 'Hors ligne' : 'Offline', show: !isClientAdmin, badge: pinnedDocs.length },
  ];

  const adminNavItems = [
    { href: '/users', icon: Users, label: t('nav.users'), show: isAdmin },
    { href: '/departments', icon: Building2, label: t('nav.departments'), show: isAdmin },
    { href: '/activity', icon: Activity, label: language === 'fr' ? 'Activité' : 'Activity', show: isAdmin },
    { href: '/admin-pulse', icon: Lightbulb, label: 'Admin Pulse', show: isAdmin },
    { href: '/analytics', icon: BarChart3, label: language === 'fr' ? 'Analytiques' : 'Analytics', show: isAdmin },
  ];

  const accountNavItems = [
    { href: '/my-authorization', icon: KeyRound, label: language === 'fr' ? 'Mon Habilitation' : 'My Authorization', show: true },
    { href: '/guide', icon: HelpCircle, label: language === 'fr' ? 'Aide' : 'Help', show: true },
  ];

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <FileText className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <span className="font-serif text-lg font-semibold text-sidebar-foreground leading-tight">GEDAI</span>
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

        {!isRestrictedITAdmin && (
          <CollapsibleSection label={language === 'fr' ? 'Mes espaces' : 'My spaces'} isOpen={spacesOpen} onOpenChange={setSpacesOpen}>
            {spacesNavItems.filter(item => item.show).map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </CollapsibleSection>
        )}

        {adminNavItems.some(item => item.show) && (
          <CollapsibleSection label="Administration" isOpen={adminOpen} onOpenChange={setAdminOpen}>
            {adminNavItems.filter(item => item.show).map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </CollapsibleSection>
        )}

        <CollapsibleSection label={language === 'fr' ? 'Mon Compte' : 'My Account'} isOpen={accountOpen} onOpenChange={setAccountOpen}>
          {accountNavItems.filter(item => item.show).map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </CollapsibleSection>
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
