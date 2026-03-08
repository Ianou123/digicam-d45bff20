import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MoreHorizontal, Pencil, Building2, UserX, Mail, UserCheck, FileText, ShieldCheck, Shield, User } from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';
import { Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { DeleteUserModal } from '@/components/users/DeleteUserModal';

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  client_id: string | null;
  created_at: string;
  role: 'ultra_admin' | 'super_admin' | 'client_admin' | 'staff' | null;
  status: 'active' | 'deactivated';
  department_id: string | null;
  document_count: number;
}

interface Department {
  id: string;
  name: string;
}

interface Client {
  id: string;
  name: string;
}

export default function Users() {
  const { profile, isUltraAdmin, isSuperAdmin, isClientAdmin, user, clientModule } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();

  // Helper function to log admin actions
  const logAdminAction = async (
    actionType: string,
    targetType: string,
    targetId: string,
    targetName: string | null,
    metadata?: Record<string, unknown>
  ) => {
    if (!user) return;
    try {
      await supabase.from('admin_audit_logs').insert({
        user_id: user.id,
        action_type: actionType,
        target_type: targetType,
        target_id: targetId,
        target_name: targetName,
        client_id: profile?.client_id || null,
        metadata: (metadata || {}) as Json,
      });
    } catch (error) {
      console.error('Error logging admin action:', error);
    }
  };
  
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isReactivateModalOpen, setIsReactivateModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  
  // Form state
  const [formEmail, setFormEmail] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formRole, setFormRole] = useState<'super_admin' | 'client_admin' | 'staff'>('staff');
  const [formDepartmentId, setFormDepartmentId] = useState<string>('');

  // Determine access - Admin IT cannot access in restricted modules
  const isRestrictedModule = clientModule === 'admin_publique';
  const hasAccess = isUltraAdmin || isSuperAdmin || (isClientAdmin && !isRestrictedModule);

  useEffect(() => {
    if (hasAccess) {
      fetchUsers();
      fetchDepartments();
      if (isUltraAdmin) {
        fetchClients();
      }
    }
  }, [hasAccess, isUltraAdmin, profile?.client_id]);

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, name')
      .order('name');
    setClients(data || []);
  };

  const fetchDepartments = async () => {
    if (!profile?.client_id) return;
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .eq('client_id', profile.client_id)
      .is('archived_at', null)
      .order('name');
    setDepartments(data || []);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles for these users
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Fetch document counts per user
      const userIds = (profiles || []).map(p => p.id);
      const documentCounts = new Map<string, number>();
      
      if (userIds.length > 0) {
        const { data: docsData } = await supabase
          .from('documents')
          .select('uploaded_by')
          .in('uploaded_by', userIds)
          .is('deleted_at', null);

        if (docsData) {
          docsData.forEach(doc => {
            const current = documentCounts.get(doc.uploaded_by) || 0;
            documentCounts.set(doc.uploaded_by, current + 1);
          });
        }
      }

      // Merge profiles with roles and document counts
      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        return {
          ...profile,
          role: userRole?.role || null,
          status: (profile.status as 'active' | 'deactivated') || 'active',
          department_id: profile.department_id || null,
          document_count: documentCounts.get(profile.id) || 0,
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: 'Failed to load users',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!formEmail || !formFullName) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: language === 'fr' ? 'Veuillez remplir tous les champs' : 'Please fill all required fields',
      });
      return;
    }

    try {
      // Generate a cryptographically secure password for the invite
      const generateSecurePassword = () => {
        const array = new Uint8Array(24);
        crypto.getRandomValues(array);
        return btoa(String.fromCharCode(...array))
          .replace(/[+/=]/g, '')
          .substring(0, 16) + '!A1';
      };
      const tempPassword = generateSecurePassword();
      
      // Create user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formEmail,
        password: tempPassword,
        options: {
          data: { full_name: formFullName },
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Update profile with client_id
        if (profile?.client_id) {
          await supabase
            .from('profiles')
            .update({ 
              client_id: profile.client_id,
              full_name: formFullName 
            })
            .eq('id', authData.user.id);
        }

        // Assign role
        await supabase
          .from('user_roles')
          .insert({ user_id: authData.user.id, role: formRole });
      }

      toast({
        title: t('common.success'),
        description: language === 'fr' 
          ? 'Invitation envoyée par email' 
          : 'Invitation sent by email',
      });

      setIsAddModalOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Error inviting user:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message || 'Failed to invite user',
      });
    }
  };

  // Helper function to count Client Admins in the organization
  const countClientAdmins = () => {
    return users.filter(u => 
      u.role === 'client_admin' && 
      u.status === 'active' && 
      u.client_id === profile?.client_id
    ).length;
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      // Check if demoting the last Client Admin
      if (
        !isSuperAdmin &&
        selectedUser.role === 'client_admin' && 
        formRole === 'staff'
      ) {
        const adminCount = countClientAdmins();
        if (adminCount <= 1) {
          toast({
            variant: 'destructive',
            title: t('common.error'),
            description: language === 'fr' 
              ? 'Votre organisation doit toujours avoir au moins un administrateur client.'
              : 'Your organization must always have at least one Client Admin.',
          });
          return;
        }
      }

      // Update profile (including department)
      await supabase
        .from('profiles')
        .update({ 
          full_name: formFullName,
          department_id: formDepartmentId || null
        })
        .eq('id', selectedUser.id);

      // Update role
      if (formRole !== selectedUser.role) {
        // Delete existing role
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', selectedUser.id);

        // Insert new role
        await supabase
          .from('user_roles')
          .insert({ user_id: selectedUser.id, role: formRole });
      }

      toast({
        title: t('common.success'),
        description: language === 'fr' ? 'Utilisateur mis à jour' : 'User updated successfully',
      });

      setIsEditModalOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message || 'Failed to update user',
      });
    }
  };

  const handleDeactivateUser = async () => {
    if (!selectedUser) return;

    try {
      // Check if deactivating the last Client Admin
      if (!isSuperAdmin && selectedUser.role === 'client_admin') {
        const adminCount = countClientAdmins();
        if (adminCount <= 1) {
          toast({
            variant: 'destructive',
            title: t('common.error'),
            description: language === 'fr' 
              ? 'Votre organisation doit toujours avoir au moins un administrateur client.'
              : 'Your organization must always have at least one Client Admin.',
          });
          setIsDeleteModalOpen(false);
          return;
        }
      }

      // Delete role (effectively deactivates the user)
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', selectedUser.id);

      // Update profile status to deactivated
      await supabase
        .from('profiles')
        .update({ status: 'deactivated' })
        .eq('id', selectedUser.id);

      // Log the deactivation action
      await logAdminAction(
        'deactivate_user',
        'user',
        selectedUser.id,
        selectedUser.full_name || selectedUser.email,
        { 
          email: selectedUser.email,
          previous_role: selectedUser.role,
        }
      );

      toast({
        title: t('common.success'),
        description: language === 'fr' ? 'Utilisateur désactivé' : 'User deactivated',
      });

      setIsDeleteModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error deactivating user:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message || 'Failed to deactivate user',
      });
    }
  };

  const handleTransferOwnership = async (newOwnerId: string) => {
    if (!selectedUser) return;

    try {
      // Transfer all documents owned by this user to the new owner
      await supabase
        .from('documents')
        .update({ uploaded_by: newOwnerId })
        .eq('uploaded_by', selectedUser.id);

      // Log the transfer action
      await logAdminAction(
        'transfer_ownership',
        'user',
        selectedUser.id,
        selectedUser.full_name || selectedUser.email,
        { 
          email: selectedUser.email,
          transferred_to: newOwnerId,
        }
      );

      // Then deactivate the user
      await handleDeactivateUser();
    } catch (error: any) {
      console.error('Error transferring ownership:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message || 'Failed to transfer ownership',
      });
    }
  };

  const handlePermanentDelete = async (transferToUserId?: string) => {
    if (!selectedUser || !isSuperAdmin) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('No active session');
      }

      const response = await supabase.functions.invoke('delete-user', {
        body: {
          userId: selectedUser.id,
          transferToUserId: transferToUserId || null,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to delete user');
      }

      toast({
        title: t('common.success'),
        description: language === 'fr' ? 'Utilisateur supprimé définitivement' : 'User permanently deleted',
      });

      setIsDeleteModalOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Error permanently deleting user:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message || 'Failed to permanently delete user',
      });
    }
  };

  const handleReactivateUser = async () => {
    if (!selectedUser) return;

    try {
      // Update profile status to active
      await supabase
        .from('profiles')
        .update({ status: 'active' })
        .eq('id', selectedUser.id);

      // Insert new role
      await supabase
        .from('user_roles')
        .insert({ user_id: selectedUser.id, role: formRole });

      // Log the reactivation action
      await logAdminAction(
        'reactivate_user',
        'user',
        selectedUser.id,
        selectedUser.full_name || selectedUser.email,
        { 
          email: selectedUser.email,
          new_role: formRole,
        }
      );

      toast({
        title: t('common.success'),
        description: language === 'fr' ? 'Utilisateur réactivé' : 'User reactivated',
      });

      setIsReactivateModalOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Error reactivating user:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message || 'Failed to reactivate user',
      });
    }
  };

  const resetForm = () => {
    setFormEmail('');
    setFormFullName('');
    setFormRole('staff');
    setFormDepartmentId('');
    setSelectedUser(null);
  };

  const openEditModal = (user: UserWithRole) => {
    setSelectedUser(user);
    setFormFullName(user.full_name || '');
    setFormRole((user.role as 'client_admin' | 'staff') || 'staff');
    setFormDepartmentId(user.department_id || '');
    setIsEditModalOpen(true);
  };

  const openDeactivateModal = (user: UserWithRole) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  const openReactivateModal = (user: UserWithRole) => {
    setSelectedUser(user);
    setFormRole('staff');
    setIsReactivateModalOpen(true);
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleBadge = (user: UserWithRole) => {
    // Show deactivated badge if user is deactivated
    if (user.status === 'deactivated') {
      return (
        <Badge variant="destructive" className="gap-1.5">
          <UserX className="h-3 w-3" />
          {t('deactivation.deactivated')}
        </Badge>
      );
    }
    
    switch (user.role) {
      case 'ultra_admin':
        return (
          <Badge className="bg-destructive text-destructive-foreground gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            Ultra Admin
          </Badge>
        );
      case 'super_admin':
        return (
          <Badge className="bg-primary text-primary-foreground gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            {t('users.superAdmin')}
          </Badge>
        );
      case 'client_admin':
        return (
          <Badge variant="secondary" className="bg-accent text-accent-foreground gap-1.5 border border-border">
            <Shield className="h-3 w-3" />
            {t('users.clientAdmin')}
          </Badge>
        );
      case 'staff':
        return (
          <Badge variant="outline" className="gap-1.5">
            <User className="h-3 w-3" />
            {t('users.staff')}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground gap-1.5">
            <User className="h-3 w-3" />
            {language === 'fr' ? 'Aucun rôle' : 'No role'}
          </Badge>
        );
    }
  };


  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      user.email.toLowerCase().includes(searchLower) ||
      (user.full_name?.toLowerCase().includes(searchLower) ?? false);
    const matchesClient = clientFilter === 'all' || user.client_id === clientFilter;
    const matchesRole = roleFilter === 'all' || user.role === roleFilter || (roleFilter === 'none' && !user.role);
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    const matchesDepartment = departmentFilter === 'all' || 
      user.department_id === departmentFilter || 
      (departmentFilter === 'none' && !user.department_id);
    
    return matchesSearch && matchesClient && matchesRole && matchesStatus && matchesDepartment;
  });

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-semibold">{t('users.title')}</h2>
          <p className="text-muted-foreground">
            {language === 'fr' 
              ? 'Gérez les utilisateurs de votre organisation'
              : 'Manage users in your organization'}
          </p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="btn-institutional">
          <Mail className="h-4 w-4 mr-2" />
          {language === 'fr' ? 'Inviter un utilisateur' : 'Invite User'}
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={language === 'fr' ? 'Rechercher un utilisateur...' : 'Search users...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            {/* Organization filter for Super Admin */}
            {isSuperAdmin && (
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="w-[200px]">
                  <Building2 className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={language === 'fr' ? 'Organisation' : 'Organization'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'fr' ? 'Toutes les organisations' : 'All organizations'}</SelectItem>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {/* Role filter */}
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={language === 'fr' ? 'Rôle' : 'Role'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === 'fr' ? 'Tous les rôles' : 'All roles'}</SelectItem>
                {isSuperAdmin && <SelectItem value="super_admin">{t('users.superAdmin')}</SelectItem>}
                <SelectItem value="client_admin">{t('users.clientAdmin')}</SelectItem>
                <SelectItem value="staff">{t('users.staff')}</SelectItem>
                <SelectItem value="none">{language === 'fr' ? 'Aucun rôle' : 'No role'}</SelectItem>
              </SelectContent>
            </Select>
            {/* Department filter */}
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('documents.department')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('documents.allDepartments')}</SelectItem>
                <SelectItem value="none">{language === 'fr' ? 'Sans département' : 'No department'}</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Status filter for Super Admin */}
            {isSuperAdmin && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder={t('users.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'fr' ? 'Tous les statuts' : 'All statuses'}</SelectItem>
                  <SelectItem value="active">{t('users.active')}</SelectItem>
                  <SelectItem value="deactivated">{t('deactivation.deactivated')}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'fr' ? 'Utilisateur' : 'User'}</TableHead>
                <TableHead>{t('users.role')}</TableHead>
                <TableHead>{language === 'fr' ? 'Documents' : 'Documents'}</TableHead>
                <TableHead>{language === 'fr' ? 'Inscrit le' : 'Joined'}</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    {t('common.loading')}
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {language === 'fr' ? 'Aucun utilisateur trouvé' : 'No users found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(user.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <Link 
                            to={`/documents?owner=${user.id}`}
                            className="font-medium hover:underline hover:text-primary transition-colors"
                          >
                            {user.full_name || 'Unnamed'}
                          </Link>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(user)}</TableCell>
                    <TableCell>
                      <Link 
                        to={`/documents?owner=${user.id}`}
                        title={language === 'fr' 
                          ? `Voir les ${user.document_count} documents de ${user.full_name || user.email}` 
                          : `View ${user.document_count} documents by ${user.full_name || user.email}`}
                      >
                        <Badge 
                          variant="secondary" 
                          className="cursor-pointer hover:bg-secondary/80 transition-colors gap-1"
                        >
                          <FileText className="h-3 w-3" />
                          {user.document_count}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(user.created_at), 'PPP', {
                        locale: language === 'fr' ? fr : enUS,
                      })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {user.status === 'deactivated' ? (
                            <DropdownMenuItem 
                              onClick={() => openReactivateModal(user)}
                              className="text-green-600 focus:text-green-600"
                            >
                              <UserCheck className="h-4 w-4 mr-2" />
                              {t('deactivation.reactivate')}
                            </DropdownMenuItem>
                          ) : (
                            <>
                              <DropdownMenuItem onClick={() => openEditModal(user)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                {language === 'fr' ? 'Modifier le rôle' : 'Change Role'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => openDeactivateModal(user)}
                                className="text-destructive focus:text-destructive"
                              >
                                <UserX className="h-4 w-4 mr-2" />
                                {language === 'fr' ? 'Désactiver' : 'Deactivate'}
                              </DropdownMenuItem>
                            </>
                          )}
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

      {/* Invite User Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === 'fr' ? 'Inviter un utilisateur' : 'Invite User'}</DialogTitle>
            <DialogDescription>
              {language === 'fr' 
                ? 'Envoyez une invitation par email pour rejoindre l\'organisation'
                : 'Send an email invitation to join the organization'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('auth.fullName')}</Label>
              <Input
                value={formFullName}
                onChange={(e) => setFormFullName(e.target.value)}
                placeholder="Jean Dupont"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('auth.email')}</Label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="jean.dupont@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('users.role')}</Label>
              <Select value={formRole} onValueChange={(v: 'super_admin' | 'client_admin' | 'staff') => setFormRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isSuperAdmin && (
                    <SelectItem value="super_admin">{t('users.superAdmin')}</SelectItem>
                  )}
                  {/* Admin IT only available in restricted modules (admin_publique, fiscal), not Core */}
                  {isRestrictedModule && (
                    <SelectItem value="client_admin">{t('users.clientAdmin')}</SelectItem>
                  )}
                  <SelectItem value="staff">{t('users.staff')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleInviteUser} className="btn-institutional">
              <Mail className="h-4 w-4 mr-2" />
              {language === 'fr' ? 'Envoyer l\'invitation' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.editUser')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('auth.fullName')}</Label>
              <Input
                value={formFullName}
                onChange={(e) => setFormFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('users.role')}</Label>
              <Select value={formRole} onValueChange={(v: 'super_admin' | 'client_admin' | 'staff') => setFormRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isSuperAdmin && (
                    <SelectItem value="super_admin">{t('users.superAdmin')}</SelectItem>
                  )}
                  {isRestrictedModule && (
                    <SelectItem value="client_admin">{t('users.clientAdmin')}</SelectItem>
                  )}
                  <SelectItem value="staff">{t('users.staff')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Department Assignment - Admin only */}
            {(isClientAdmin || isSuperAdmin) && departments.length > 0 && (
              <div className="space-y-2">
                <Label>{t('documents.department')}</Label>
                <Select 
                  value={formDepartmentId || 'none'} 
                  onValueChange={(v) => setFormDepartmentId(v === 'none' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'fr' ? 'Non assigné' : 'Unassigned'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {language === 'fr' ? 'Non assigné' : 'Unassigned'}
                    </SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleEditUser} className="btn-institutional">
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete/Deactivate User Modal with Impact Analysis */}
      <DeleteUserModal
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        user={selectedUser}
        onDeactivate={handleDeactivateUser}
        onTransferOwnership={handleTransferOwnership}
        onPermanentDelete={isSuperAdmin ? handlePermanentDelete : undefined}
        availableUsers={users.filter(u => 
          u.status === 'active' && 
          (u.role === 'client_admin' || u.role === 'staff') &&
          u.client_id === selectedUser?.client_id
        )}
        isSuperAdmin={isSuperAdmin}
      />

      {/* Reactivate User Modal */}
      <Dialog open={isReactivateModalOpen} onOpenChange={setIsReactivateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('deactivation.reactivate')} {selectedUser?.full_name || selectedUser?.email}
            </DialogTitle>
            <DialogDescription>
              {language === 'fr' 
                ? 'Sélectionnez un rôle pour réactiver cet utilisateur.'
                : 'Select a role to reactivate this user.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('users.role')}</Label>
              <Select value={formRole} onValueChange={(v: 'super_admin' | 'client_admin' | 'staff') => setFormRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isSuperAdmin && (
                    <SelectItem value="super_admin">{t('users.superAdmin')}</SelectItem>
                  )}
                  {isRestrictedModule && (
                    <SelectItem value="client_admin">{t('users.clientAdmin')}</SelectItem>
                  )}
                  <SelectItem value="staff">{t('users.staff')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReactivateModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleReactivateUser} className="bg-green-600 hover:bg-green-700">
              <UserCheck className="h-4 w-4 mr-2" />
              {t('deactivation.reactivate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}