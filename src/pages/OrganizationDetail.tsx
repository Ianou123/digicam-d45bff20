import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Building2, Users, FileText, FolderTree, CheckCircle, Ban, XCircle, Copy, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

interface Organization {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive' | 'suspended';
  invite_code: string | null;
  created_at: string;
  last_activity_at: string | null;
}

interface OrgUser {
  id: string;
  email: string;
  full_name: string | null;
  status: string;
  created_at: string;
  roles: string[];
}

interface OrgDepartment {
  id: string;
  name: string;
  created_at: string;
  documentsCount: number;
}

interface OrgDocument {
  id: string;
  title: string;
  document_type: string;
  confidentiality_level: string;
  created_at: string;
  department_name: string | null;
}

export default function OrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isSuperAdmin, isUltraAdmin } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [departments, setDepartments] = useState<OrgDepartment[]>([]);
  const [documents, setDocuments] = useState<OrgDocument[]>([]);
  const [documentsCount, setDocumentsCount] = useState<number>(0);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if ((isSuperAdmin || isUltraAdmin) && id) {
      fetchOrganizationData();
    }
  }, [isSuperAdmin, isUltraAdmin, id]);

  const fetchOrganizationData = async () => {
    if (!id) return;
    setLoading(true);

    try {
      // Fetch organization
      const { data: org, error: orgError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (orgError) throw orgError;
      setOrganization(org as Organization);

      // Fetch users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, status, created_at')
        .eq('client_id', id)
        .order('full_name');

      if (profilesError) throw profilesError;

      // Fetch roles for users
      const userIds = profilesData?.map((p) => p.id) || [];
      const { data: rolesData, error: rolesError } = userIds.length
        ? await supabase.from('user_roles').select('user_id, role').in('user_id', userIds)
        : { data: [], error: null };

      if (rolesError) throw rolesError;

      const usersWithRoles: OrgUser[] = (profilesData || []).map((profile) => ({
        ...profile,
        roles: rolesData?.filter((r) => r.user_id === profile.id).map((r) => r.role) || [],
      }));
      setUsers(usersWithRoles);

      // Fetch departments
      const { data: depts, error: deptsError } = await supabase
        .from('departments')
        .select('id, name, created_at')
        .eq('client_id', id)
        .is('archived_at', null)
        .order('name');

      if (deptsError) throw deptsError;

      // Total documents count (exclude deleted)
      const { count: totalDocsCount, error: docsCountError } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', id)
        .is('deleted_at', null);

      if (docsCountError) throw docsCountError;
      setDocumentsCount(totalDocsCount ?? 0);

      // Department document counts and recent documents are only shown to Super Admins
      if (isSuperAdmin) {
        // Count documents per department (used for department stats)
        const { data: docsForCount, error: docsForCountError } = await supabase
          .from('documents')
          .select('department_id')
          .eq('client_id', id)
          .is('deleted_at', null);

        if (docsForCountError) throw docsForCountError;

        const deptsWithCounts: OrgDepartment[] = (depts || []).map((dept) => ({
          ...dept,
          documentsCount: docsForCount?.filter((d) => d.department_id === dept.id).length || 0,
        }));
        setDepartments(deptsWithCounts);

        // Fetch recent documents (limit 50)
        const { data: docs, error: docsError } = await supabase
          .from('documents')
          .select('id, title, document_type, confidentiality_level, created_at, department_id')
          .eq('client_id', id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(50);

        if (docsError) throw docsError;

        // Map department names
        const docsWithDeptNames: OrgDocument[] = (docs || []).map((doc) => ({
          ...doc,
          department_name: depts?.find((d) => d.id === doc.department_id)?.name || null,
        }));
        setDocuments(docsWithDeptNames);
      } else {
        // Ultra Admin: can see org-level stats, but not document lists/counts per department
        const deptsWithoutCounts: OrgDepartment[] = (depts || []).map((dept) => ({
          ...dept,
          documentsCount: 0,
        }));
        setDepartments(deptsWithoutCounts);
        setDocuments([]);
      }
    } catch (error) {
      console.error('Error fetching organization data:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: language === 'fr' ? 'Erreur lors du chargement' : 'Failed to load data',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    toast({
      title: t('common.success'),
      description: t('clients.codeCopied'),
    });
  };

  const regenerateInviteCode = async () => {
    if (!id) return;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let newCode = '';
    for (let i = 0; i < 6; i++) {
      newCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    try {
      const { error } = await supabase
        .from('clients')
        .update({ invite_code: newCode })
        .eq('id', id);

      if (error) throw error;

      setOrganization(prev => prev ? { ...prev, invite_code: newCode } : null);
      toast({
        title: t('common.success'),
        description: language === 'fr' ? 'Code régénéré' : 'Code regenerated',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message,
      });
    }
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

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'client_admin':
        return <Badge variant="default" className="text-xs">{t('users.clientAdmin')}</Badge>;
      case 'staff':
        return <Badge variant="secondary" className="text-xs">{t('users.staff')}</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{role}</Badge>;
    }
  };

  const getConfidentialityBadge = (level: string) => {
    switch (level) {
      case 'confidential':
        return <Badge className="badge-confidential">{t('documents.confidential')}</Badge>;
      case 'internal':
        return <Badge className="badge-internal">{t('documents.internal')}</Badge>;
      case 'public':
        return <Badge className="badge-public">{t('documents.public')}</Badge>;
      default:
        return <Badge variant="outline">{level}</Badge>;
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  if (!isSuperAdmin && !isUltraAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {language === 'fr' ? 'Organisation non trouvée' : 'Organization not found'}
        </p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/clients')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/clients')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-4 flex-1">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-semibold">{organization.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <code className="text-sm text-muted-foreground font-mono">{organization.slug}</code>
              {getStatusBadge(organization.status)}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{users.length}</p>
              <p className="text-sm text-muted-foreground">{t('clients.usersCount')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{documentsCount}</p>
              <p className="text-sm text-muted-foreground">{t('clients.documentsCount')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <FolderTree className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{departments.length}</p>
              <p className="text-sm text-muted-foreground">{t('nav.departments')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-1">{t('clients.inviteCode')}</p>
            <div className="flex items-center gap-2">
              <code className="bg-muted px-2 py-1 rounded text-sm font-mono flex-1">
                {organization.invite_code || '-'}
              </code>
              {organization.invite_code && (
                <>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(organization.invite_code!)}>
                    {copiedCode ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={regenerateInviteCode}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{language === 'fr' ? 'Aperçu' : 'Overview'}</TabsTrigger>
          <TabsTrigger value="departments">{t('nav.departments')}</TabsTrigger>
          <TabsTrigger value="users">{t('users.title')}</TabsTrigger>
          <TabsTrigger value="documents">{t('nav.documents')}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{language === 'fr' ? 'Informations' : 'Information'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{language === 'fr' ? 'Créé le' : 'Created'}</span>
                  <span>{format(new Date(organization.created_at), 'PPP', { locale: language === 'fr' ? fr : enUS })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{language === 'fr' ? 'Dernière activité' : 'Last activity'}</span>
                  <span>
                    {organization.last_activity_at 
                      ? formatDistanceToNow(new Date(organization.last_activity_at), { addSuffix: true, locale: language === 'fr' ? fr : enUS })
                      : (language === 'fr' ? 'Aucune' : 'None')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{language === 'fr' ? 'Statut' : 'Status'}</span>
                  {getStatusBadge(organization.status)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{language === 'fr' ? 'Utilisateurs récents' : 'Recent Users'}</CardTitle>
              </CardHeader>
              <CardContent>
                {users.slice(0, 5).map(user => (
                  <div key={user.id} className="flex items-center gap-3 py-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{getInitials(user.full_name, user.email)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.full_name || user.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <div className="flex gap-1">
                      {user.roles.map(role => getRoleBadge(role))}
                    </div>
                  </div>
                ))}
                {users.length === 0 && (
                  <p className="text-sm text-muted-foreground">{language === 'fr' ? 'Aucun utilisateur' : 'No users'}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments">
          <Card>
            <CardHeader>
              <CardTitle>{t('nav.departments')}</CardTitle>
              <CardDescription>
                {language === 'fr' 
                  ? `${departments.length} département(s) dans cette organisation`
                  : `${departments.length} department(s) in this organization`}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('clients.name')}</TableHead>
                    {!isUltraAdmin && <TableHead>{t('clients.documentsCount')}</TableHead>}
                    <TableHead>{language === 'fr' ? 'Créé le' : 'Created'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isUltraAdmin ? 2 : 3} className="text-center py-8 text-muted-foreground">
                          {language === 'fr' ? 'Aucun département' : 'No departments'}
                        </TableCell>
                      </TableRow>
                  ) : (
                    departments.map(dept => (
                      <TableRow key={dept.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FolderTree className="h-4 w-4 text-muted-foreground" />
                            {dept.name}
                          </div>
                        </TableCell>
                          {!isUltraAdmin && <TableCell>{dept.documentsCount}</TableCell>}
                          <TableCell>{format(new Date(dept.created_at), 'PP', { locale: language === 'fr' ? fr : enUS })}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>{t('users.title')}</CardTitle>
              <CardDescription>
                {language === 'fr' 
                  ? `${users.length} utilisateur(s) dans cette organisation`
                  : `${users.length} user(s) in this organization`}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'fr' ? 'Utilisateur' : 'User'}</TableHead>
                    <TableHead>{t('users.role')}</TableHead>
                    <TableHead>{t('users.status')}</TableHead>
                    <TableHead>{language === 'fr' ? 'Inscrit le' : 'Joined'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        {language === 'fr' ? 'Aucun utilisateur' : 'No users'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map(user => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">{getInitials(user.full_name, user.email)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{user.full_name || '-'}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {user.roles.length > 0 
                              ? user.roles.map(role => <span key={role}>{getRoleBadge(role)}</span>)
                              : <span className="text-muted-foreground text-sm">-</span>
                            }
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.status === 'active' ? (
                            <Badge className="bg-green-500/10 text-green-600 border-green-200">{t('users.active')}</Badge>
                          ) : (
                            <Badge variant="secondary">{t('deactivation.deactivated')}</Badge>
                          )}
                        </TableCell>
                        <TableCell>{format(new Date(user.created_at), 'PP', { locale: language === 'fr' ? fr : enUS })}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>{t('nav.documents')}</CardTitle>
              <CardDescription>
                {language === 'fr'
                  ? `${documentsCount} document(s)`
                  : `${documentsCount} document(s)`}
              </CardDescription>
            </CardHeader>
            <CardContent className={isUltraAdmin ? "p-6" : "p-0"}>
              {isUltraAdmin ? (
                <p className="text-sm text-muted-foreground">
                  {language === 'fr'
                    ? "La liste des documents n’est pas affichée pour les Ultra Admins (confidentialité)."
                    : "The document list is hidden for Ultra Admins (privacy)."}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('documents.title')}</TableHead>
                      <TableHead>{t('documents.type')}</TableHead>
                      <TableHead>{t('documents.department')}</TableHead>
                      <TableHead>{t('documents.confidentiality')}</TableHead>
                      <TableHead>{language === 'fr' ? 'Créé le' : 'Created'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          {t('documents.noDocuments')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      documents.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium truncate max-w-[200px]">{doc.title}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="uppercase text-xs">
                              {doc.document_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {doc.department_name || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>{getConfidentialityBadge(doc.confidentiality_level)}</TableCell>
                          <TableCell>
                            {format(new Date(doc.created_at), 'PP', { locale: language === 'fr' ? fr : enUS })}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}