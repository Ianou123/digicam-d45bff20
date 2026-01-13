import { Building2, Globe, Menu, Search, Shield, ShieldCheck, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface AppHeaderProps {
  title?: string;
  onMenuClick?: () => void;
  rightContent?: React.ReactNode;
}

export function AppHeader({ title, onMenuClick, rightContent }: AppHeaderProps) {
  const { language, setLanguage, t } = useLanguage();
  const { profile, isSuperAdmin, isClientAdmin, clientName } = useAuth();
  const [departmentName, setDepartmentName] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show global search on the documents page (it has its own search)
  const showGlobalSearch = !location.pathname.startsWith('/documents');

  // Fetch department name if user has one assigned
  useEffect(() => {
    const fetchDepartment = async () => {
      const deptId = profile?.department_id;
      if (deptId) {
        const { data } = await supabase
          .from('departments')
          .select('name')
          .eq('id', deptId)
          .single();
        if (data) {
          setDepartmentName(data.name);
        }
      } else {
        setDepartmentName(null);
      }
    };
    fetchDepartment();
  }, [profile?.department_id]);

  const getRoleBadge = () => {
    if (isSuperAdmin) {
      return (
        <Badge variant="default" className="bg-primary/90 text-primary-foreground gap-1">
          <ShieldCheck className="h-3 w-3" />
          {t('users.superAdmin')}
        </Badge>
      );
    }
    if (isClientAdmin) {
      return (
        <Badge variant="secondary" className="bg-accent text-accent-foreground gap-1">
          <Shield className="h-3 w-3" />
          {t('users.clientAdmin')}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1">
        <User className="h-3 w-3" />
        {t('users.staff')}
      </Badge>
    );
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        {title && (
          <h1 className="text-xl font-serif font-semibold text-foreground">
            {title}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Global Search Bar - hidden on documents page */}
        {showGlobalSearch && (
          <form 
            className="hidden md:flex items-center"
            onSubmit={(e) => {
              e.preventDefault();
              if (globalSearch.trim()) {
                navigate(`/documents?search=${encodeURIComponent(globalSearch.trim())}`);
                setGlobalSearch('');
              }
            }}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={language === 'fr' ? 'Rechercher des documents...' : 'Search documents...'}
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-[200px] lg:w-[280px] pl-9 h-9 text-sm"
              />
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>
          </form>
        )}

        {/* Right Content (e.g., Import button) */}
        {rightContent}

        {/* Organization Name - visible for non-super-admins */}
        {!isSuperAdmin && clientName && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border border-border">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{clientName}</span>
          </div>
        )}

        {/* Department Badge - visible for users with assigned department */}
        {departmentName && !isSuperAdmin && (
          <Badge variant="outline" className="gap-1 bg-accent/50">
            <Users className="h-3 w-3" />
            {departmentName}
          </Badge>
        )}

        {/* User Role Badge */}
        {getRoleBadge()}

        {/* Language Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Globe className="h-5 w-5" />
              <span className="absolute -bottom-0.5 -right-0.5 text-[10px] font-medium uppercase">
                {language}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem 
              onClick={() => setLanguage('fr')}
              className={language === 'fr' ? 'bg-accent' : ''}
            >
              🇫🇷 Français
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setLanguage('en')}
              className={language === 'en' ? 'bg-accent' : ''}
            >
              🇬🇧 English
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <NotificationCenter />
      </div>
    </header>
  );
}