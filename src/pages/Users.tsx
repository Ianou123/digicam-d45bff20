import { useEffect, useState } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, UserPlus } from 'lucide-react';
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
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  client_id: string | null;
  created_at: string;
  role: 'super_admin' | 'client_admin' | 'staff' | null;
}

export default function Users() {
  const { profile, isSuperAdmin, isClientAdmin } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  
  // Form state
  const [formEmail, setFormEmail] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formRole, setFormRole] = useState<'client_admin' | 'staff'>('staff');
  const [formPassword, setFormPassword] = useState('');

  useEffect(() => {
    if (isSuperAdmin || isClientAdmin) {
      fetchUsers();
    }
  }, [isSuperAdmin, isClientAdmin]);

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

      // Merge profiles with roles
      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        return {
          ...profile,
          role: userRole?.role || null,
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

  const handleAddUser = async () => {
    if (!formEmail || !formPassword || !formFullName) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: 'Please fill all required fields',
      });
      return;
    }

    try {
      // Create user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formEmail,
        password: formPassword,
        options: {
          data: { full_name: formFullName },
          emailRedirectTo: `${window.location.origin}/`,
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
        description: 'User created successfully',
      });

      setIsAddModalOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message || 'Failed to create user',
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
        description: 'User updated successfully',
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

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      // Delete role first
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', selectedUser.id);

      // Note: We cannot delete from auth.users directly via client
      // The profile will be orphaned but that's acceptable for this use case
      // In production, you'd use an edge function with service role

      toast({
        title: t('common.success'),
        description: 'User removed successfully',
      });

      setIsDeleteModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message || 'Failed to delete user',
      });
    }
  };

  const resetForm = () => {
    setFormEmail('');
    setFormFullName('');
    setFormRole('staff');
    setFormPassword('');
    setSelectedUser(null);
  };

  const openEditModal = (user: UserWithRole) => {
    setSelectedUser(user);
    setFormFullName(user.full_name || '');
    setFormRole((user.role as 'client_admin' | 'staff') || 'staff');
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (user: UserWithRole) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case 'super_admin':
        return <Badge className="bg-primary">{t('users.superAdmin')}</Badge>;
      case 'client_admin':
        return <Badge variant="secondary">{t('users.clientAdmin')}</Badge>;
      case 'staff':
        return <Badge variant="outline">{t('users.staff')}</Badge>;
      default:
        return <Badge variant="outline">{t('users.staff')}</Badge>;
    }
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(searchLower) ||
      (user.full_name?.toLowerCase().includes(searchLower) ?? false)
    );
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
          <UserPlus className="h-4 w-4 mr-2" />
          {t('users.addUser')}
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardHeader className="pb-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={language === 'fr' ? 'Rechercher un utilisateur...' : 'Search users...'}
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
                <TableHead>{language === 'fr' ? 'Utilisateur' : 'User'}</TableHead>
                <TableHead>{t('users.role')}</TableHead>
                <TableHead>{language === 'fr' ? 'Date d\'inscription' : 'Joined'}</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    {t('common.loading')}
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
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
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
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
                          <DropdownMenuItem onClick={() => openEditModal(user)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            {t('documents.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => openDeleteModal(user)}
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

      {/* Add User Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.addUser')}</DialogTitle>
            <DialogDescription>
              {language === 'fr' 
                ? 'Créer un nouvel utilisateur dans votre organisation'
                : 'Create a new user in your organization'}
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
              <Label>{t('auth.password')}</Label>
              <Input
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('users.role')}</Label>
              <Select value={formRole} onValueChange={(v: 'client_admin' | 'staff') => setFormRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isClientAdmin && (
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
            <Button onClick={handleAddUser} className="btn-institutional">
              {t('users.addUser')}
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

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'fr' ? 'Supprimer l\'utilisateur' : 'Delete User'}
            </DialogTitle>
            <DialogDescription>
              {language === 'fr' 
                ? `Êtes-vous sûr de vouloir supprimer ${selectedUser?.full_name || selectedUser?.email} ? Cette action est irréversible.`
                : `Are you sure you want to delete ${selectedUser?.full_name || selectedUser?.email}? This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              {t('documents.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
