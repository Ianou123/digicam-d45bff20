import { 
  LayoutDashboard, 
  FileText, 
  Search, 
  Upload, 
  Users, 
  Building2, 
  Settings, 
  Activity,
  BarChart3,
  LogOut,
  User,
  ChevronDown
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut, isSuperAdmin, isClientAdmin, canManageDocuments } = useAuth();
  const { t } = useLanguage();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const mainNavItems = [
    { 
      href: '/dashboard', 
      icon: LayoutDashboard, 
      label: t('nav.dashboard'),
      show: true 
    },
    { 
      href: '/documents', 
      icon: FileText, 
      label: t('nav.documents'),
      show: true 
    },
    { 
      href: '/search', 
      icon: Search, 
      label: t('nav.search'),
      show: true 
    },
    { 
      href: '/upload', 
      icon: Upload, 
      label: t('nav.upload'),
      show: canManageDocuments 
    },
    { 
      href: '/my-dashboard', 
      icon: User, 
      label: t('nav.myDashboard'),
      show: !canManageDocuments 
    },
  ];

  const adminNavItems = [
    { 
      href: '/users', 
      icon: Users, 
      label: t('nav.users'),
      show: isSuperAdmin || isClientAdmin 
    },
    { 
      href: '/clients', 
      icon: Building2, 
      label: t('nav.clients'),
      show: isSuperAdmin 
    },
    { 
      href: '/activity', 
      icon: Activity, 
      label: t('nav.activity'),
      show: isSuperAdmin || isClientAdmin 
    },
    { 
      href: '/analytics', 
      icon: BarChart3, 
      label: t('nav.analytics'),
      show: isSuperAdmin || isClientAdmin 
    },
  ];

  const NavItem = ({ href, icon: Icon, label }: { href: string; icon: any; label: string }) => {
    const isActive = location.pathname === href;
    
    return (
      <Link
        to={href}
        className={cn(
          'sidebar-item',
          isActive && 'sidebar-item-active'
        )}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        <span className="truncate">{label}</span>
      </Link>
    );
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <FileText className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <span className="font-serif text-xl font-semibold text-sidebar-foreground">
            DigiCam
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {mainNavItems.filter(item => item.show).map((item) => (
          <NavItem key={item.href} {...item} />
        ))}

        {adminNavItems.some(item => item.show) && (
          <>
            <div className="pt-4 pb-2">
              <span className="px-3 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
                Administration
              </span>
            </div>
            {adminNavItems.filter(item => item.show).map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </>
        )}
      </nav>

      {/* User Menu */}
      <div className="border-t border-sidebar-border p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg p-2 text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
              <Avatar className="h-9 w-9">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm">
                  {getInitials(profile?.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">
                  {profile?.full_name || profile?.email}
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {isSuperAdmin ? t('users.superAdmin') : isClientAdmin ? t('users.clientAdmin') : t('users.staff')}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link to="/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                {t('nav.settings')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t('nav.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}