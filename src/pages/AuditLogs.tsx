import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { FileText, User, Building2, Search, Calendar, ChevronDown, ChevronRight, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import type { Json } from '@/integrations/supabase/types';

interface AuditLog {
  id: string;
  user_id: string;
  action_type: string;
  target_type: string;
  target_id: string | null;
  target_name?: string | null;
  client_id?: string | null;
  metadata: Json;
  created_at: string;
  source: 'super_admin' | 'admin';
  profiles?: {
    full_name: string | null;
    email: string;
  } | null;
  client?: {
    name: string;
  } | null;
}

interface AdminUser {
  id: string;
  full_name: string | null;
  email: string;
}

export default function AuditLogs() {
  const { isUltraAdmin, isSuperAdmin } = useAuth();
  const { t, language } = useLanguage();
  const dateLocale = language === 'fr' ? fr : enUS;
  
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState<string>('all');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('all');
  const [adminFilter, setAdminFilter] = useState<string>('all');

  useEffect(() => {
    fetchLogs();
    fetchAdminUsers();
  }, [actionTypeFilter, targetTypeFilter, adminFilter]);

  // Redirect non-admins (Ultra Admin sees all, Super Admin sees their org)
  if (!isUltraAdmin && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const fetchAdminUsers = async () => {
    // Get all users who have made audit log entries from both tables
    const { data: superAdminLogs } = await supabase
      .from('super_admin_audit_logs')
      .select('user_id')
      .order('created_at', { ascending: false });

    const { data: adminLogs } = await supabase
      .from('admin_audit_logs')
      .select('user_id')
      .order('created_at', { ascending: false });

    const allUserIds = [
      ...(superAdminLogs || []).map(d => d.user_id),
      ...(adminLogs || []).map(d => d.user_id),
    ];
    const uniqueUserIds = [...new Set(allUserIds)];
    
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', uniqueUserIds);

    setAdminUsers((profiles || []).map(p => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
    })));
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Fetch from super_admin_audit_logs
      let superAdminQuery = supabase
        .from('super_admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (actionTypeFilter !== 'all') {
        superAdminQuery = superAdminQuery.eq('action_type', actionTypeFilter);
      }
      if (targetTypeFilter !== 'all') {
        superAdminQuery = superAdminQuery.eq('target_type', targetTypeFilter);
      }
      if (adminFilter !== 'all') {
        superAdminQuery = superAdminQuery.eq('user_id', adminFilter);
      }

      const { data: superAdminData, error: superAdminError } = await superAdminQuery;
      if (superAdminError) throw superAdminError;

      // Fetch from admin_audit_logs (includes client admin actions)
      let adminQuery = supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (actionTypeFilter !== 'all') {
        adminQuery = adminQuery.eq('action_type', actionTypeFilter);
      }
      if (targetTypeFilter !== 'all') {
        adminQuery = adminQuery.eq('target_type', targetTypeFilter);
      }
      if (adminFilter !== 'all') {
        adminQuery = adminQuery.eq('user_id', adminFilter);
      }

      const { data: adminData, error: adminError } = await adminQuery;
      if (adminError) throw adminError;

      // Combine and deduplicate logs (prefer admin_audit_logs as it's more complete)
      const adminLogIds = new Set((adminData || []).map(l => l.id));
      const combinedLogs = [
        ...(adminData || []).map(l => ({ ...l, source: 'admin' as const })),
        ...(superAdminData || [])
          .filter(l => !adminLogIds.has(l.id))
          .map(l => ({ ...l, source: 'super_admin' as const })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Fetch profile info for each log
      const userIds = [...new Set(combinedLogs.map(d => d.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]));

      // Fetch client info for admin_audit_logs
      const clientIds = [...new Set(combinedLogs
        .filter(l => 'client_id' in l && l.client_id)
        .map(l => (l as { client_id: string }).client_id)
      )];
      const { data: clients } = clientIds.length > 0 
        ? await supabase.from('clients').select('id, name').in('id', clientIds)
        : { data: [] };

      const clientMap = new Map((clients || []).map(c => [c.id, c]));

      const logsWithProfiles = combinedLogs.map(log => ({
        ...log,
        profiles: profileMap.get(log.user_id) || null,
        client: 'client_id' in log && log.client_id 
          ? clientMap.get(log.client_id as string) || null 
          : null,
      }));

      setLogs(logsWithProfiles as AuditLog[]);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getActionBadgeVariant = (action: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (action.includes('delete') || action.includes('suspend')) return 'destructive';
    if (action.includes('create') || action.includes('unsuspend')) return 'default';
    if (action.includes('update') || action.includes('edit')) return 'secondary';
    return 'outline';
  };

  const getActionLabel = (action: string): string => {
    const labels: Record<string, { fr: string; en: string }> = {
      create_client: { fr: 'Création organisation', en: 'Create organization' },
      edit_client: { fr: 'Modification organisation', en: 'Edit organization' },
      update_client: { fr: 'Modification organisation', en: 'Update organization' },
      delete_client: { fr: 'Suppression organisation', en: 'Delete organization' },
      suspend_client: { fr: 'Suspension organisation', en: 'Suspend organization' },
      unsuspend_client: { fr: 'Réactivation organisation', en: 'Unsuspend organization' },
      deactivate_client: { fr: 'Désactivation organisation', en: 'Deactivate organization' },
      regenerate_invite: { fr: 'Régénération code', en: 'Regenerate invite' },
      create_user: { fr: 'Création utilisateur', en: 'Create user' },
      edit_user: { fr: 'Modification utilisateur', en: 'Edit user' },
      delete_user: { fr: 'Suppression utilisateur', en: 'Delete user' },
      deactivate_user: { fr: 'Désactivation utilisateur', en: 'Deactivate user' },
      reactivate_user: { fr: 'Réactivation utilisateur', en: 'Reactivate user' },
      change_role: { fr: 'Changement de rôle', en: 'Change role' },
    };
    return labels[action]?.[language] || action;
  };

  const getTargetTypeIcon = (type: string) => {
    switch (type) {
      case 'client': return <Building2 className="h-4 w-4" />;
      case 'user': return <User className="h-4 w-4" />;
      case 'document': return <FileText className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  const getTargetName = (log: AuditLog): string => {
    // First try target_name from admin_audit_logs
    if (log.target_name) return log.target_name;
    
    // Then try from metadata
    const metadata = log.metadata as Record<string, unknown>;
    return (metadata?.name as string) || (metadata?.client_name as string) || (metadata?.email as string) || log.target_id || 'N/A';
  };

  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const targetName = getTargetName(log).toLowerCase();
    const adminName = (log.profiles?.full_name || log.profiles?.email || '').toLowerCase();
    return targetName.includes(searchQuery.toLowerCase()) || adminName.includes(searchQuery.toLowerCase());
  });

  const uniqueActionTypes = [...new Set(logs.map(l => l.action_type))];
  const uniqueTargetTypes = [...new Set(logs.map(l => l.target_type))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-serif font-semibold">{t('auditLogs.title')}</h2>
        <p className="text-muted-foreground">
          {language === 'fr' 
            ? 'Historique des actions administratives système'
            : 'System administrative actions history'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={language === 'fr' ? 'Rechercher...' : 'Search...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('auditLogs.actionType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === 'fr' ? 'Toutes les actions' : 'All actions'}</SelectItem>
            {uniqueActionTypes.map(type => (
              <SelectItem key={type} value={type}>{getActionLabel(type)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={targetTypeFilter} onValueChange={setTargetTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('auditLogs.targetType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === 'fr' ? 'Tous les types' : 'All types'}</SelectItem>
            {uniqueTargetTypes.map(type => (
              <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={adminFilter} onValueChange={setAdminFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('auditLogs.performedBy')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === 'fr' ? 'Tous les admins' : 'All admins'}</SelectItem>
            {adminUsers.map(admin => (
              <SelectItem key={admin.id} value={admin.id}>
                {admin.full_name || admin.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">{t('auditLogs.noLogs')}</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead className="w-[180px]">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {language === 'fr' ? 'Date/Heure' : 'Date/Time'}
                  </div>
                </TableHead>
                <TableHead>{t('auditLogs.performedBy')}</TableHead>
                <TableHead>{t('auditLogs.actionType')}</TableHead>
                <TableHead>{t('auditLogs.targetType')}</TableHead>
                <TableHead>{language === 'fr' ? 'Cible' : 'Target'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <Collapsible key={log.id} asChild open={expandedRows.has(log.id)}>
                  <>
                    <CollapsibleTrigger asChild>
                      <TableRow 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleRow(log.id)}
                      >
                        <TableCell>
                          {expandedRows.has(log.id) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(log.created_at), 'PPp', { locale: dateLocale })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-3 w-3 text-primary" />
                            </div>
                            <span className="text-sm">
                              {log.profiles?.full_name || log.profiles?.email || 'Unknown'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getActionBadgeVariant(log.action_type)}>
                            {getActionLabel(log.action_type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 capitalize">
                            {getTargetTypeIcon(log.target_type)}
                            <span className="text-sm">{log.target_type}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {getTargetName(log)}
                        </TableCell>
                      </TableRow>
                    </CollapsibleTrigger>
                    <CollapsibleContent asChild>
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={6} className="py-4">
                          <div className="pl-10">
                            <h4 className="text-sm font-medium mb-2">{t('auditLogs.details')}</h4>
                            <pre className="text-xs bg-background p-4 rounded-lg overflow-auto max-h-[200px]">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
