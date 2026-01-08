import { useEffect, useState } from 'react';
import type { Json } from '@/integrations/supabase/types';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Building2, Users, FileText, Copy, RefreshCw, Check, Ban, CheckCircle, Clock, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Navigate, useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

interface ClientWithStats {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  created_at: string;
  invite_code: string | null;
  status: 'active' | 'inactive' | 'suspended';
  last_activity_at: string | null;
  usersCount: number;
  documentsCount: number;
}

export default function Clients() {
  const { isSuperAdmin, user } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientWithStats | null>(null);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchClients();
    }
  }, [isSuperAdmin]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      // Fetch clients with new columns
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (clientsError) throw clientsError;

      // Fetch user counts per client
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('client_id');

      if (profilesError) throw profilesError;

      // Fetch document counts per client (exclude deleted)
      const { data: documents, error: documentsError } = await supabase
        .from('documents')
        .select('client_id')
        .is('deleted_at', null);

      if (documentsError) throw documentsError;

      // Calculate stats
      const clientsWithStats: ClientWithStats[] = (clientsData || []).map(client => {
        const usersCount = profiles?.filter(p => p.client_id === client.id).length || 0;
        const documentsCount = documents?.filter(d => d.client_id === client.id).length || 0;
        return {
          ...client,
          status: client.status as 'active' | 'inactive' | 'suspended',
          usersCount,
          documentsCount,
        };
      });

      setClients(clientsWithStats);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: 'Failed to load organizations',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const generateInviteCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const copyToClipboard = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    toast({
      title: t('common.success'),
      description: t('clients.codeCopied'),
    });
  };

  const regenerateInviteCode = async (clientId: string) => {
    const newCode = generateInviteCode();
    try {
      const { error } = await supabase
        .from('clients')
        .update({ invite_code: newCode })
        .eq('id', clientId);

      if (error) throw error;

      toast({
        title: t('common.success'),
        description: language === 'fr' ? 'Code régénéré' : 'Code regenerated',
      });
      fetchClients();
    } catch (error: any) {
      console.error('Error regenerating code:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message,
      });
    }
  };

  const handleAddClient = async () => {
    if (!formName || !formSlug) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: 'Please fill all required fields',
      });
      return;
    }

    try {
      const inviteCode = generateInviteCode();
      const { error } = await supabase
        .from('clients')
        .insert({ name: formName, slug: formSlug, invite_code: inviteCode, status: 'active' });

      if (error) throw error;

      // Log admin action
      await logAdminAction('create_client', 'client', undefined, { name: formName });

      toast({
        title: t('common.success'),
        description: language === 'fr' ? 'Organisation créée' : 'Organization created',
      });

      setIsAddModalOpen(false);
      resetForm();
      fetchClients();
    } catch (error: any) {
      console.error('Error creating client:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message || 'Failed to create organization',
      });
    }
  };

  const handleEditClient = async () => {
    if (!selectedClient || !formName || !formSlug) return;

    try {
      const { error } = await supabase
        .from('clients')
        .update({ name: formName, slug: formSlug })
        .eq('id', selectedClient.id);

      if (error) throw error;

      await logAdminAction('update_client', 'client', selectedClient.id, { name: formName });

      toast({
        title: t('common.success'),
        description: language === 'fr' ? 'Organisation mise à jour' : 'Organization updated',
      });

      setIsEditModalOpen(false);
      resetForm();
      fetchClients();
    } catch (error: any) {
      console.error('Error updating client:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message || 'Failed to update organization',
      });
    }
  };

  const handleStatusChange = async (newStatus: 'active' | 'inactive' | 'suspended') => {
    if (!selectedClient) return;

    try {
      const { error } = await supabase
        .from('clients')
        .update({ status: newStatus })
        .eq('id', selectedClient.id);

      if (error) throw error;

      await logAdminAction(
        newStatus === 'suspended' ? 'suspend_client' : newStatus === 'active' ? 'unsuspend_client' : 'deactivate_client', 
        'client', 
        selectedClient.id, 
        { name: selectedClient.name, new_status: newStatus }
      );

      toast({
        title: t('common.success'),
        description: language === 'fr' 
          ? `Organisation ${newStatus === 'suspended' ? 'suspendue' : newStatus === 'active' ? 'réactivée' : 'désactivée'}`
          : `Organization ${newStatus === 'suspended' ? 'suspended' : newStatus === 'active' ? 'reactivated' : 'deactivated'}`,
      });

      setIsSuspendModalOpen(false);
      setSelectedClient(null);
      fetchClients();
    } catch (error: any) {
      console.error('Error updating client status:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message,
      });
    }
  };

  const handleDeleteClient = async () => {
    if (!selectedClient) return;

    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', selectedClient.id);

      if (error) throw error;

      await logAdminAction('delete_client', 'client', selectedClient.id, { name: selectedClient.name });

      toast({
        title: t('common.success'),
        description: language === 'fr' ? 'Organisation supprimée' : 'Organization deleted',
      });

      setIsDeleteModalOpen(false);
      setSelectedClient(null);
      fetchClients();
    } catch (error: any) {
      console.error('Error deleting client:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message || 'Failed to delete organization',
      });
    }
  };

  const logAdminAction = async (actionType: string, targetType: string, targetId?: string, metadata?: Record<string, unknown>) => {
    if (!user) return;
    try {
      // Log to super_admin_audit_logs for backward compatibility
      await supabase.from('super_admin_audit_logs').insert([{
        user_id: user.id,
        action_type: actionType,
        target_type: targetType,
        target_id: targetId || null,
        metadata: (metadata || {}) as Json,
      }]);
      
      // Also log to admin_audit_logs for the unified audit view
      await supabase.from('admin_audit_logs').insert({
        user_id: user.id,
        action_type: actionType,
        target_type: targetType,
        target_id: targetId || null,
        target_name: (metadata as any)?.name || null,
        client_id: targetType === 'client' ? targetId : null,
        metadata: (metadata || {}) as Json,
      });
    } catch (error) {
      console.error('Error logging admin action:', error);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormSlug('');
    setSelectedClient(null);
  };

  const openEditModal = (client: ClientWithStats) => {
    setSelectedClient(client);
    setFormName(client.name);
    setFormSlug(client.slug);
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (client: ClientWithStats) => {
    setSelectedClient(client);
    setIsDeleteModalOpen(true);
  };

  const openSuspendModal = (client: ClientWithStats) => {
    setSelectedClient(client);
    setIsSuspendModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-600 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />{language === 'fr' ? 'Actif' : 'Active'}</Badge>;
      case 'inactive':
        return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />{language === 'fr' ? 'Inactif' : 'Inactive'}</Badge>;
      case 'suspended':
        return <Badge variant="destructive"><Ban className="h-3 w-3 mr-1" />{language === 'fr' ? 'Suspendu' : 'Suspended'}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLastActivityText = (lastActivity: string | null) => {
    if (!lastActivity) return language === 'fr' ? 'Aucune activité' : 'No activity';
    return formatDistanceToNow(new Date(lastActivity), { 
      addSuffix: true, 
      locale: language === 'fr' ? fr : enUS 
    });
  };

  const filteredClients = clients.filter(client => {
    const searchLower = searchQuery.toLowerCase();
    return (
      client.name.toLowerCase().includes(searchLower) ||
      client.slug.toLowerCase().includes(searchLower)
    );
  });

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-semibold">{t('clients.title')}</h2>
          <p className="text-muted-foreground">
            {language === 'fr' 
              ? 'Gérez les organisations clientes de DigiCam'
              : 'Manage DigiCam client organizations'}
          </p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="btn-institutional">
          <Plus className="h-4 w-4 mr-2" />
          {t('clients.addClient')}
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardHeader className="pb-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={language === 'fr' ? 'Rechercher une organisation...' : 'Search organizations...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('clients.name')}</TableHead>
                <TableHead>{language === 'fr' ? 'Statut' : 'Status'}</TableHead>
                <TableHead>{t('clients.inviteCode')}</TableHead>
                <TableHead>{t('clients.usersCount')}</TableHead>
                <TableHead>{t('clients.documentsCount')}</TableHead>
                <TableHead>{language === 'fr' ? 'Dernière activité' : 'Last Activity'}</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    {t('common.loading')}
                  </TableCell>
                </TableRow>
              ) : filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {language === 'fr' ? 'Aucune organisation trouvée' : 'No organizations found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients.map((client) => (
                  <TableRow 
                    key={client.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/clients/${client.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <span className="font-medium">{client.name}</span>
                          <p className="text-xs text-muted-foreground font-mono">{client.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(client.status)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                          {client.invite_code || '-'}
                        </code>
                        {client.invite_code && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => copyToClipboard(client.invite_code!)}
                            >
                              {copiedCode === client.invite_code ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => regenerateInviteCode(client.id)}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{client.usersCount}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>{client.documentsCount}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-sm">{getLastActivityText(client.last_activity_at)}</span>
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditModal(client)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            {t('clients.editClient')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {client.status !== 'suspended' ? (
                            <DropdownMenuItem 
                              onClick={() => openSuspendModal(client)}
                              className="text-amber-600 focus:text-amber-600"
                            >
                              <Ban className="h-4 w-4 mr-2" />
                              {language === 'fr' ? 'Suspendre' : 'Suspend'}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem 
                              onClick={() => { setSelectedClient(client); handleStatusChange('active'); }}
                              className="text-green-600 focus:text-green-600"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              {language === 'fr' ? 'Réactiver' : 'Reactivate'}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => openDeleteModal(client)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('documents.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Client Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('clients.addClient')}</DialogTitle>
            <DialogDescription>
              {language === 'fr' 
                ? 'Créer une nouvelle organisation cliente'
                : 'Create a new client organization'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('clients.name')}</Label>
              <Input
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value);
                  setFormSlug(generateSlug(e.target.value));
                }}
                placeholder={language === 'fr' ? 'Ministère de l\'Éducation' : 'Ministry of Education'}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('clients.slug')}</Label>
              <Input
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder="ministere-education"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {language === 'fr' 
                  ? 'Identifiant unique pour l\'organisation (généré automatiquement)'
                  : 'Unique identifier for the organization (auto-generated)'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAddClient} className="btn-institutional">
              {t('clients.addClient')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Client Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('clients.editClient')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('clients.name')}</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('clients.slug')}</Label>
              <Input
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleEditClient} className="btn-institutional">
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Confirmation Modal */}
      <Dialog open={isSuspendModalOpen} onOpenChange={setIsSuspendModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {language === 'fr' ? 'Suspendre l\'organisation' : 'Suspend Organization'}
            </DialogTitle>
            <DialogDescription>
              {language === 'fr' 
                ? `Les utilisateurs de "${selectedClient?.name}" ne pourront plus accéder à leurs documents. Cette action peut être annulée.`
                : `Users of "${selectedClient?.name}" will no longer be able to access their documents. This action can be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSuspendModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => handleStatusChange('suspended')}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <Ban className="h-4 w-4 mr-2" />
              {language === 'fr' ? 'Suspendre' : 'Suspend'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'fr' ? 'Supprimer l\'organisation' : 'Delete Organization'}
            </DialogTitle>
            <DialogDescription>
              {language === 'fr' 
                ? `Êtes-vous sûr de vouloir supprimer "${selectedClient?.name}" ? Cette action supprimera également tous les utilisateurs et documents associés.`
                : `Are you sure you want to delete "${selectedClient?.name}"? This will also delete all associated users and documents.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteClient}>
              {t('documents.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}