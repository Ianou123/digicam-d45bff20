import { useEffect, useState, useMemo } from 'react';
import { Search, Download, FileText, Eye, Download as DownloadIcon, Upload, Pencil, Trash2, Filter, Building2, User, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Navigate } from 'react-router-dom';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

interface ActivityLogWithDetails {
  id: string;
  action_type: 'search' | 'view' | 'download' | 'upload' | 'update' | 'delete';
  document_id: string | null;
  search_query: string | null;
  created_at: string;
  user_id: string;
  client_id: string;
  user_name: string | null;
  user_email: string;
  user_avatar: string | null;
  document_title: string | null;
  department_name: string | null;
}

interface Client {
  id: string;
  name: string;
}

interface OrgUser {
  id: string;
  full_name: string | null;
  email: string;
}

interface Department {
  id: string;
  name: string;
}

export default function Activity() {
  const { isUltraAdmin, isSuperAdmin, isClientAdmin, profile, clientModule } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  
  const [logs, setLogs] = useState<ActivityLogWithDetails[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [customDateRange, setCustomDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [documentSearch, setDocumentSearch] = useState('');

  const isRestrictedModule = clientModule === 'admin_publique';
  const hasAccess = isUltraAdmin || isSuperAdmin || (isClientAdmin && !isRestrictedModule);

  useEffect(() => {
    if (hasAccess) {
      fetchActivityLogs();
      fetchOrgUsers();
      fetchDepartments();
      if (isUltraAdmin) {
        fetchClients();
      }
    }
  }, [hasAccess, isUltraAdmin]);

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name').order('name');
    setClients(data || []);
  };

  const fetchOrgUsers = async () => {
    let query = supabase.from('profiles').select('id, full_name, email').order('full_name');
    if (profile?.client_id) query = query.eq('client_id', profile.client_id);
    const { data } = await query;
    setOrgUsers(data || []);
  };

  const fetchDepartments = async () => {
    let query = supabase.from('departments').select('id, name').is('archived_at', null).order('name');
    if (profile?.client_id) query = query.eq('client_id', profile.client_id);
    const { data } = await query;
    setDepartments(data || []);
  };

  const fetchActivityLogs = async () => {
    setLoading(true);
    try {
      let logsQuery = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (profile?.client_id) logsQuery = logsQuery.eq('client_id', profile.client_id);
      const { data: logsData, error: logsError } = await logsQuery;

      if (logsError) throw logsError;

      const userIds = [...new Set(logsData?.map(l => l.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, department_id')
        .in('id', userIds);

      const documentIds = [...new Set(logsData?.filter(l => l.document_id).map(l => l.document_id) || [])];
      const { data: documents } = await supabase
        .from('documents')
        .select('id, title, department_id')
        .in('id', documentIds.length > 0 ? documentIds : ['none']);

      // Fetch department names
      const allDeptIds = [
        ...new Set([
          ...(profiles?.map(p => p.department_id).filter(Boolean) || []),
          ...(documents?.map(d => d.department_id).filter(Boolean) || []),
        ])
      ];
      const { data: deptData } = allDeptIds.length > 0
        ? await supabase.from('departments').select('id, name').in('id', allDeptIds)
        : { data: [] };

      const deptMap: Record<string, string> = {};
      deptData?.forEach(d => { deptMap[d.id] = d.name; });

      const logsWithDetails: ActivityLogWithDetails[] = (logsData || []).map(log => {
        const userProfile = profiles?.find(p => p.id === log.user_id);
        const document = documents?.find(d => d.id === log.document_id);
        const deptId = document?.department_id || userProfile?.department_id;
        return {
          ...log,
          user_name: userProfile?.full_name || null,
          user_email: userProfile?.email || 'Unknown',
          user_avatar: userProfile?.avatar_url || null,
          document_title: document?.title || null,
          department_name: deptId ? (deptMap[deptId] || null) : null,
        };
      });

      setLogs(logsWithDetails);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      toast({ variant: 'destructive', title: t('common.error'), description: 'Failed to load activity logs' });
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'search': return <Search className="h-4 w-4" />;
      case 'view': return <Eye className="h-4 w-4" />;
      case 'download': return <DownloadIcon className="h-4 w-4" />;
      case 'upload': return <Upload className="h-4 w-4" />;
      case 'update': return <Pencil className="h-4 w-4" />;
      case 'delete': return <Trash2 className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getActionBadge = (action: string) => {
    const actionLabel = t(`activity.${action}`) || action;
    switch (action) {
      case 'search': return <Badge variant="secondary">{actionLabel}</Badge>;
      case 'view': return <Badge variant="outline">{actionLabel}</Badge>;
      case 'download': return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">{actionLabel}</Badge>;
      case 'upload': return <Badge className="bg-green-500/10 text-green-600 border-green-200">{actionLabel}</Badge>;
      case 'update': return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">{actionLabel}</Badge>;
      case 'delete': return <Badge variant="destructive">{actionLabel}</Badge>;
      default: return <Badge>{actionLabel}</Badge>;
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch =
        !searchQuery ||
        log.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.document_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.search_query?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesAction = actionFilter === 'all' || log.action_type === actionFilter;
      const matchesClient = clientFilter === 'all' || log.client_id === clientFilter;
      const matchesUser = userFilter === 'all' || log.user_id === userFilter;
      const matchesDepartment = departmentFilter === 'all' || log.department_name === departments.find(d => d.id === departmentFilter)?.name;
      
      const matchesDocument = !documentSearch || log.document_title?.toLowerCase().includes(documentSearch.toLowerCase());

      // Period filter
      let matchesPeriod = true;
      const logDate = new Date(log.created_at);
      if (periodFilter === 'today') {
        matchesPeriod = logDate >= startOfDay(new Date()) && logDate <= endOfDay(new Date());
      } else if (periodFilter === '7days') {
        matchesPeriod = logDate >= subDays(new Date(), 7);
      } else if (periodFilter === '30days') {
        matchesPeriod = logDate >= subDays(new Date(), 30);
      } else if (periodFilter === 'custom' && customDateRange.from) {
        const from = startOfDay(customDateRange.from);
        const to = customDateRange.to ? endOfDay(customDateRange.to) : endOfDay(new Date());
        matchesPeriod = isWithinInterval(logDate, { start: from, end: to });
      }

      return matchesSearch && matchesAction && matchesClient && matchesUser && matchesDepartment && matchesPeriod && matchesDocument;
    });
  }, [logs, searchQuery, actionFilter, clientFilter, userFilter, departmentFilter, periodFilter, customDateRange, documentSearch, departments]);

  const exportToCSV = () => {
    const headers = ['Date', 'User', 'Email', 'Action', 'Document', 'Department', 'Search Query'];
    const rows = filteredLogs.map(log => [
      format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      log.user_name || '',
      log.user_email,
      log.action_type,
      log.document_title || '',
      log.department_name || '',
      log.search_query || '',
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `activity-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  const colSpan = isUltraAdmin ? 6 : 5;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-semibold">{t('nav.activity')}</h2>
          <p className="text-muted-foreground">
            {language === 'fr'
              ? 'Historique des activités des utilisateurs — pensé pour les administrations et entreprises africaines'
              : 'User activity history — designed for African administrations and enterprises'}
          </p>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          {language === 'fr' ? 'Exporter CSV' : 'Export CSV'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {language === 'fr' ? 'Total actions' : 'Total Actions'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredLogs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('activity.search')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredLogs.filter(l => l.action_type === 'search').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('activity.view')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredLogs.filter(l => l.action_type === 'view').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('activity.download')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredLogs.filter(l => l.action_type === 'download').length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4">
            {/* Row 1: Search + Document search */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={language === 'fr' ? 'Rechercher un utilisateur...' : 'Search user...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="relative flex-1">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={language === 'fr' ? 'Filtrer par document...' : 'Filter by document...'}
                  value={documentSearch}
                  onChange={(e) => setDocumentSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Row 2: Dropdowns */}
            <div className="flex flex-wrap gap-3">
              {/* User filter */}
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-[200px]">
                  <User className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={language === 'fr' ? 'Tous les utilisateurs' : 'All users'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'fr' ? 'Tous les utilisateurs' : 'All users'}</SelectItem>
                  {orgUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Action filter */}
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={language === 'fr' ? 'Toutes les actions' : 'All actions'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'fr' ? 'Toutes les actions' : 'All actions'}</SelectItem>
                  <SelectItem value="view">{t('activity.view')}</SelectItem>
                  <SelectItem value="download">{t('activity.download')}</SelectItem>
                  <SelectItem value="search">{t('activity.search')}</SelectItem>
                  <SelectItem value="upload">{t('activity.upload')}</SelectItem>
                  <SelectItem value="update">{t('activity.update')}</SelectItem>
                  <SelectItem value="delete">{t('activity.delete')}</SelectItem>
                </SelectContent>
              </Select>

              {/* Department filter */}
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[200px]">
                  <Building2 className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={language === 'fr' ? 'Tous les départements' : 'All departments'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'fr' ? 'Tous les départements' : 'All departments'}</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Period filter */}
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-[180px]">
                  <Clock className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={language === 'fr' ? 'Toute la période' : 'All time'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'fr' ? 'Toute la période' : 'All time'}</SelectItem>
                  <SelectItem value="today">{language === 'fr' ? "Aujourd'hui" : 'Today'}</SelectItem>
                  <SelectItem value="7days">{language === 'fr' ? '7 derniers jours' : 'Last 7 days'}</SelectItem>
                  <SelectItem value="30days">{language === 'fr' ? '30 derniers jours' : 'Last 30 days'}</SelectItem>
                  <SelectItem value="custom">{language === 'fr' ? 'Période personnalisée' : 'Custom range'}</SelectItem>
                </SelectContent>
              </Select>

              {/* Organization filter for Ultra Admin */}
              {isUltraAdmin && (
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className="w-[200px]">
                    <Building2 className="h-4 w-4 mr-2" />
                    <SelectValue placeholder={language === 'fr' ? 'Toutes les organisations' : 'All organizations'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{language === 'fr' ? 'Toutes les organisations' : 'All organizations'}</SelectItem>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Custom date range picker */}
            {periodFilter === 'custom' && (
              <div className="flex gap-3 items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Calendar className="h-4 w-4" />
                      {customDateRange.from ? format(customDateRange.from, 'dd/MM/yyyy') : (language === 'fr' ? 'Date début' : 'Start date')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={customDateRange.from}
                      onSelect={(date) => setCustomDateRange(prev => ({ ...prev, from: date }))}
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground">→</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Calendar className="h-4 w-4" />
                      {customDateRange.to ? format(customDateRange.to, 'dd/MM/yyyy') : (language === 'fr' ? 'Date fin' : 'End date')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={customDateRange.to}
                      onSelect={(date) => setCustomDateRange(prev => ({ ...prev, to: date }))}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'fr' ? 'Date/Heure' : 'Date/Time'}</TableHead>
                <TableHead>{language === 'fr' ? 'Utilisateur' : 'User'}</TableHead>
                <TableHead>{language === 'fr' ? 'Action' : 'Action'}</TableHead>
                <TableHead>{language === 'fr' ? 'Document' : 'Document'}</TableHead>
                <TableHead>{language === 'fr' ? 'Département' : 'Department'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="text-center py-8">{t('common.loading')}</TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground">{t('activity.noActivity')}</TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="text-sm">
                        {format(new Date(log.created_at), 'PPP', { locale: language === 'fr' ? fr : enUS })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), 'HH:mm:ss')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={log.user_avatar || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {getInitials(log.user_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{log.user_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{log.user_email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action_type)}
                        {getActionBadge(log.action_type)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.action_type === 'search' ? (
                        <span className="text-sm text-muted-foreground italic">"{log.search_query}"</span>
                      ) : isUltraAdmin ? (
                        <span className="text-sm text-muted-foreground italic">
                          {log.document_title ? (language === 'fr' ? 'un document' : 'a document') : '-'}
                        </span>
                      ) : log.document_title ? (
                        <span className="text-sm">{log.document_title}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.department_name ? (
                        <Badge variant="outline" className="text-xs">{log.department_name}</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
