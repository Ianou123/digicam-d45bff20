import { useEffect, useState } from 'react';
import { Search, Download, FileText, Eye, Download as DownloadIcon, Upload, Pencil, Trash2, Filter, Building2 } from 'lucide-react';
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
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

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
}

interface Client {
  id: string;
  name: string;
}

export default function Activity() {
  const { isUltraAdmin, isSuperAdmin, isClientAdmin, profile, clientModule } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  
  const [logs, setLogs] = useState<ActivityLogWithDetails[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');

  // Determine if user has access - Admin IT cannot access in restricted modules
  const isRestrictedModule = clientModule === 'admin_publique';
  const hasAccess = isUltraAdmin || isSuperAdmin || (isClientAdmin && !isRestrictedModule);

  useEffect(() => {
    if (hasAccess) {
      fetchActivityLogs();
      if (isUltraAdmin) {
        fetchClients();
      }
    }
  }, [hasAccess, isUltraAdmin]);

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, name')
      .order('name');
    setClients(data || []);
  };

  const fetchActivityLogs = async () => {
    setLoading(true);
    try {
      // Fetch activity logs
      const { data: logsData, error: logsError } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (logsError) throw logsError;

      // Fetch profiles for user details
      const userIds = [...new Set(logsData?.map(l => l.user_id) || [])];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Fetch document titles
      const documentIds = [...new Set(logsData?.filter(l => l.document_id).map(l => l.document_id) || [])];
      const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select('id, title')
        .in('id', documentIds);

      if (docsError) throw docsError;

      // Merge data
      const logsWithDetails: ActivityLogWithDetails[] = (logsData || []).map(log => {
        const userProfile = profiles?.find(p => p.id === log.user_id);
        const document = documents?.find(d => d.id === log.document_id);
        return {
          ...log,
          user_name: userProfile?.full_name || null,
          user_email: userProfile?.email || 'Unknown',
          user_avatar: userProfile?.avatar_url || null,
          document_title: document?.title || null,
        };
      });

      setLogs(logsWithDetails);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: 'Failed to load activity logs',
      });
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'search':
        return <Search className="h-4 w-4" />;
      case 'view':
        return <Eye className="h-4 w-4" />;
      case 'download':
        return <DownloadIcon className="h-4 w-4" />;
      case 'upload':
        return <Upload className="h-4 w-4" />;
      case 'update':
        return <Pencil className="h-4 w-4" />;
      case 'delete':
        return <Trash2 className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getActionBadge = (action: string) => {
    const actionLabel = t(`activity.${action}`) || action;
    
    switch (action) {
      case 'search':
        return <Badge variant="secondary">{actionLabel}</Badge>;
      case 'view':
        return <Badge variant="outline">{actionLabel}</Badge>;
      case 'download':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">{actionLabel}</Badge>;
      case 'upload':
        return <Badge className="bg-green-500/10 text-green-600 border-green-200">{actionLabel}</Badge>;
      case 'update':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">{actionLabel}</Badge>;
      case 'delete':
        return <Badge variant="destructive">{actionLabel}</Badge>;
      default:
        return <Badge>{actionLabel}</Badge>;
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const exportToCSV = () => {
    const headers = ['Date', 'User', 'Email', 'Action', 'Document', 'Search Query'];
    const rows = filteredLogs.map(log => [
      format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      log.user_name || '',
      log.user_email,
      log.action_type,
      log.document_title || '',
      log.search_query || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `activity-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.document_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.search_query?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || log.action_type === actionFilter;
    const matchesClient = clientFilter === 'all' || log.client_id === clientFilter;
    
    return matchesSearch && matchesAction && matchesClient;
  });

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-semibold">{t('nav.activity')}</h2>
          <p className="text-muted-foreground">
            {language === 'fr' 
              ? 'Historique des activités des utilisateurs'
              : 'User activity history'}
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
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('activity.search')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredLogs.filter(l => l.action_type === 'search').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('activity.view')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredLogs.filter(l => l.action_type === 'view').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('activity.download')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredLogs.filter(l => l.action_type === 'download').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={language === 'fr' ? 'Rechercher...' : 'Search...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
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
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder={language === 'fr' ? 'Toutes les actions' : 'All actions'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === 'fr' ? 'Toutes les actions' : 'All actions'}</SelectItem>
                <SelectItem value="search">{t('activity.search')}</SelectItem>
                <SelectItem value="view">{t('activity.view')}</SelectItem>
                <SelectItem value="download">{t('activity.download')}</SelectItem>
                <SelectItem value="upload">{t('activity.upload')}</SelectItem>
                <SelectItem value="update">{t('activity.update')}</SelectItem>
                <SelectItem value="delete">{t('activity.delete')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'fr' ? 'Date/Heure' : 'Date/Time'}</TableHead>
                <TableHead>{language === 'fr' ? 'Utilisateur' : 'User'}</TableHead>
                <TableHead>{language === 'fr' ? 'Action' : 'Action'}</TableHead>
                <TableHead>{language === 'fr' ? 'Détails' : 'Details'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    {t('common.loading')}
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    {t('activity.noActivity')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="text-sm">
                        {format(new Date(log.created_at), 'PPP', {
                          locale: language === 'fr' ? fr : enUS,
                        })}
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
                        <span className="text-sm text-muted-foreground italic">
                          "{log.search_query}"
                        </span>
                      ) : log.document_title ? (
                        <span className="text-sm">{log.document_title}</span>
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