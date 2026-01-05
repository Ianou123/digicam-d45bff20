import { useEffect, useState } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, UserPlus, Building2, Clock, UserX, Mail, UserCheck } from 'lucide-react';
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
import { Navigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  client_id: string | null;
  created_at: string;
  role: 'super_admin' | 'client_admin' | 'staff' | null;
  last_active?: string | null;
  status: 'active' | 'deactivated';
}

interface Client {
  id: string;
  name: string;
}

export default function Users() {
  const { profile, isSuperAdmin, isClientAdmin } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isReactivateModalOpen, setIsReactivateModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  
  // Form state
  const [formEmail, setFormEmail] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formRole, setFormRole] = useState<'client_admin' | 'staff'>('staff');

  useEffect(() => {
    if (isSuperAdmin || isClientAdmin) {
      fetchUsers();
      if (isSuperAdmin) {
        fetchClients();
      }
    }
  }, [isSuperAdmin, isClientAdmin]);

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, name')
      .order('name');
    setClients(data || []);
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

      // Fetch last activity for each user
      const { data: activityData } = await supabase
        .from('activity_logs')
        .select('user_id, created_at')
        .order('created_at', { ascending: false });

      // Get last activity per user
      const lastActivityMap: Record<string, string> = {};
      activityData?.forEach(a => {
        if (!lastActivityMap[a.user_id]) {
          lastActivityMap[a.user_id] = a.created_at;
        }
      });

      // Merge profiles with roles and last activity
      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        return {
          ...profile,
          role: userRole?.role || null,
          last_active: lastActivityMap[profile.id] || null,
          status: (profile.status as 'active' | 'deactivated') || 'active',
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
      // Generate a random password for the invite
      const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';
      
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

  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      // Update profile
      await supabase
        .from('profiles')
        .update({ full_name: formFullName })
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
    setSelectedUser(null);
  };

  const openEditModal = (user: UserWithRole) => {
    setSelectedUser(user);
    setFormFullName(user.full_name || '');
    setFormRole((user.role as 'client_admin' | 'staff') || 'staff');
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
      return <Badge variant="destructive">{t('deactivation.deactivated')}</Badge>;
    }
    
    switch (user.role) {
      case 'super_admin':
        return <Badge className="bg-primary">{t('users.superAdmin')}</Badge>;
      case 'client_admin':
        return <Badge variant="secondary">{t('users.clientAdmin')}</Badge>;
      case 'staff':
        return <Badge variant="outline">{t('users.staff')}</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">{language === 'fr' ? 'Aucun rôle' : 'No role'}</Badge>;
    }
  };

  const getLastActiveText = (lastActive: string | null) => {
    if (!lastActive) return language === 'fr' ? 'Jamais' : 'Never';
    return formatDistanceToNow(new Date(lastActive), { 
      addSuffix: true, 
      locale: language === 'fr' ? fr : enUS 
    });
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      user.email.toLowerCase().includes(searchLower) ||
      (user.full_name?.toLowerCase().includes(searchLower) ?? false);
    const matchesClient = clientFilter === 'all' || user.client_id === clientFilter;
    const matchesRole = roleFilter === 'all' || user.role === roleFilter || (roleFilter === 'none' && !user.role);
    
    return matchesSearch && matchesClient && matchesRole;
  });

  if (!isSuperAdmin && !isClientAdmin) {
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
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'fr' ? 'Utilisateur' : 'User'}</TableHead>
                <TableHead>{t('users.role')}</TableHead>
                <TableHead>{language === 'fr' ? 'Dernière activité' : 'Last Active'}</TableHead>
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
                          <p className="font-medium">{user.full_name || 'Unnamed'}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(user)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-sm">{getLastActiveText(user.last_active)}</span>
                      </div>
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
              <Select value={formRole} onValueChange={(v: 'client_admin' | 'staff') => setFormRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client_admin">{t('users.clientAdmin')}</SelectItem>
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
              <Select value={formRole} onValueChange={(v: 'client_admin' | 'staff') => setFormRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client_admin">{t('users.clientAdmin')}</SelectItem>
                  <SelectItem value="staff">{t('users.staff')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
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

      {/* Deactivate Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'fr' ? 'Désactiver l\'utilisateur' : 'Deactivate User'}
            </DialogTitle>
            <DialogDescription>
              {language === 'fr' 
                ? `L'utilisateur ${selectedUser?.full_name || selectedUser?.email} ne pourra plus accéder à l'application. Vous pourrez le réactiver ultérieurement.`
                : `${selectedUser?.full_name || selectedUser?.email} will no longer be able to access the application. You can reactivate them later.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeactivateUser}>
              <UserX className="h-4 w-4 mr-2" />
              {language === 'fr' ? 'Désactiver' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <Select value={formRole} onValueChange={(v: 'client_admin' | 'staff') => setFormRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client_admin">{t('users.clientAdmin')}</SelectItem>
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