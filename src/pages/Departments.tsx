import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, Archive, RotateCcw, Pencil, Loader2, LayoutList, Network, Users, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';

interface Department {
  id: string;
  name: string;
  client_id: string;
  created_at: string;
  archived_at: string | null;
  document_count?: number;
  user_count?: number;
}

export default function Departments() {
  const { user, profile, isClientAdmin, isSuperAdmin, isClientSuspended } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'organigramme'>('list');
  const [orgName, setOrgName] = useState('');

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [departmentName, setDepartmentName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.client_id || isSuperAdmin) {
      fetchDepartments();
      fetchOrgName();
    }
  }, [profile?.client_id, isSuperAdmin, showArchived]);

  const fetchOrgName = async () => {
    if (profile?.client_id) {
      const { data } = await supabase.from('clients').select('name').eq('id', profile.client_id).single();
      if (data) setOrgName(data.name);
    }
  };

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      let query = supabase.from('departments').select('*').order('name');
      if (!isSuperAdmin && profile?.client_id) query = query.eq('client_id', profile.client_id);
      if (showArchived) query = query.not('archived_at', 'is', null);
      else query = query.is('archived_at', null);

      const { data, error } = await query;
      if (error) throw error;

      // Get doc counts and user counts in parallel
      const departmentsWithCounts = await Promise.all(
        (data || []).map(async (dept) => {
          const [{ count: docCount }, { count: userCount }] = await Promise.all([
            supabase.from('documents').select('*', { count: 'exact', head: true }).eq('department_id', dept.id).is('deleted_at', null),
            supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('department_id', dept.id),
          ]);
          return { ...dept, document_count: docCount || 0, user_count: userCount || 0 };
        })
      );

      setDepartments(departmentsWithCounts);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error(language === 'fr' ? 'Erreur lors du chargement' : 'Error loading departments');
    } finally {
      setLoading(false);
    }
  };

  const logAdminAction = async (actionType: string, departmentId: string, departmentName: string, metadata: Record<string, any> = {}) => {
    if (!user || !profile?.client_id) return;
    await supabase.from('admin_audit_logs').insert({
      user_id: user.id, client_id: profile.client_id,
      action_type: actionType, target_type: 'department',
      target_id: departmentId, target_name: departmentName, metadata,
    });
  };

  const handleCreate = async () => {
    if (!departmentName.trim() || !profile?.client_id || !user) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('departments')
        .insert({ name: departmentName.trim(), client_id: profile.client_id })
        .select().single();
      if (error) throw error;
      await logAdminAction('create_department', data.id, data.name);
      toast.success(language === 'fr' ? 'Département créé avec succès' : 'Department created successfully');
      setCreateModalOpen(false);
      setDepartmentName('');
      fetchDepartments();
    } catch (error) {
      toast.error(language === 'fr' ? 'Erreur lors de la création' : 'Error creating department');
    } finally { setSaving(false); }
  };

  const handleRename = async () => {
    if (!departmentName.trim() || !selectedDepartment || !user) return;
    setSaving(true);
    try {
      const oldName = selectedDepartment.name;
      const { error } = await supabase.from('departments').update({ name: departmentName.trim() }).eq('id', selectedDepartment.id);
      if (error) throw error;
      await logAdminAction('rename_department', selectedDepartment.id, departmentName.trim(), { old_name: oldName, new_name: departmentName.trim() });
      toast.success(language === 'fr' ? 'Département renommé avec succès' : 'Department renamed successfully');
      setEditModalOpen(false);
      setSelectedDepartment(null);
      setDepartmentName('');
      fetchDepartments();
    } catch (error) {
      toast.error(language === 'fr' ? 'Erreur lors du renommage' : 'Error renaming department');
    } finally { setSaving(false); }
  };

  const handleArchive = async () => {
    if (!selectedDepartment || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('departments').update({ archived_at: new Date().toISOString() }).eq('id', selectedDepartment.id);
      if (error) throw error;
      await logAdminAction('archive_department', selectedDepartment.id, selectedDepartment.name);
      toast.success(language === 'fr' ? 'Département archivé avec succès' : 'Department archived successfully');
      setArchiveDialogOpen(false);
      setSelectedDepartment(null);
      fetchDepartments();
    } catch (error) {
      toast.error(language === 'fr' ? "Erreur lors de l'archivage" : 'Error archiving department');
    } finally { setSaving(false); }
  };

  const handleRestore = async (dept: Department) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('departments').update({ archived_at: null }).eq('id', dept.id);
      if (error) throw error;
      await logAdminAction('restore_department', dept.id, dept.name);
      toast.success(language === 'fr' ? 'Département restauré' : 'Department restored');
      fetchDepartments();
    } catch (error) {
      toast.error(language === 'fr' ? 'Erreur' : 'Error');
    }
  };

  if (!isClientAdmin && !isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const canManage = (isSuperAdmin || isClientAdmin) && !isClientSuspended;
  const activeDepts = departments.filter(d => !d.archived_at);
  const archivedDepts = departments.filter(d => d.archived_at);
  const displayedDepts = showArchived ? archivedDepts : activeDepts;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-semibold">{language === 'fr' ? 'Départements' : 'Departments'}</h2>
          <p className="text-muted-foreground">
            {language === 'fr' ? 'Gérez les départements de votre organisation' : 'Manage your organization\'s departments'}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {language === 'fr' ? 'Nouveau département' : 'New Department'}
          </Button>
        )}
      </div>

      {/* View toggle + archive toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant={!showArchived ? 'default' : 'outline'} size="sm" onClick={() => setShowArchived(false)}>
            <FolderOpen className="h-4 w-4 mr-2" />
            {language === 'fr' ? 'Actifs' : 'Active'} ({activeDepts.length})
          </Button>
          <Button variant={showArchived ? 'default' : 'outline'} size="sm" onClick={() => setShowArchived(true)}>
            <Archive className="h-4 w-4 mr-2" />
            {language === 'fr' ? 'Archivés' : 'Archived'} ({archivedDepts.length})
          </Button>
        </div>
        {!showArchived && (
          <div className="flex gap-1 border rounded-lg p-0.5">
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="h-8 px-3">
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'organigramme' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('organigramme')} className="h-8 px-3">
              <Network className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : displayedDepts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {showArchived ? (language === 'fr' ? 'Aucun département archivé' : 'No archived departments') : (language === 'fr' ? 'Aucun département actif' : 'No active departments')}
            </p>
            {canManage && !showArchived && (
              <Button className="mt-4" onClick={() => setCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {language === 'fr' ? 'Créer un département' : 'Create Department'}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'organigramme' && !showArchived ? (
        /* Organigramme View */
        <div className="flex flex-col items-center gap-6">
          {/* Org node */}
          <Card className="w-64 text-center shadow-md border-2 border-primary/20">
            <CardContent className="pt-6 pb-4">
              <div className="h-12 w-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Network className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">{orgName || 'Organisation'}</h3>
              <p className="text-xs text-muted-foreground">{displayedDepts.length} {language === 'fr' ? 'départements' : 'departments'}</p>
            </CardContent>
          </Card>

          {/* Connector line */}
          <div className="w-0.5 h-8 bg-border" />

          {/* Horizontal connector + department nodes */}
          <div className="relative">
            {/* Horizontal line */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 bg-border" 
              style={{ width: `${Math.min(displayedDepts.length * 220, 900)}px` }} />
            
            <div className="flex gap-4 flex-wrap justify-center pt-6">
              {displayedDepts.map((dept) => (
                <div key={dept.id} className="flex flex-col items-center">
                  {/* Vertical connector */}
                  <div className="w-0.5 h-6 bg-border -mt-6" />
                  <Card
                    className="w-48 cursor-pointer hover:shadow-md transition-all hover:border-primary/30"
                    onClick={() => navigate(`/documents?department=${dept.id}`)}
                  >
                    <CardContent className="pt-4 pb-3 text-center">
                      <h4 className="font-medium text-sm mb-2">{dept.name}</h4>
                      <div className="flex justify-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {dept.user_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {dept.document_count}
                        </span>
                      </div>
                      {canManage && (
                        <div className="flex gap-1 justify-center mt-3" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setSelectedDepartment(dept); setDepartmentName(dept.name); setEditModalOpen(true); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setSelectedDepartment(dept); setArchiveDialogOpen(true); }}>
                            <Archive className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* List View */
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayedDepts.map((dept) => (
            <Card
              key={dept.id}
              className={`${dept.archived_at ? 'opacity-75' : ''} ${!dept.archived_at ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
              onClick={() => !dept.archived_at && navigate(`/documents?department=${dept.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg font-medium">{dept.name}</CardTitle>
                  {dept.archived_at && <Badge variant="secondary">{language === 'fr' ? 'Archivé' : 'Archived'}</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-sm text-muted-foreground mb-4">
                  <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {dept.user_count} {language === 'fr' ? 'utilisateurs' : 'users'}</span>
                  <span className="flex items-center gap-1"><FileText className="h-4 w-4" /> {dept.document_count} docs</span>
                </div>
                {canManage && (
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    {dept.archived_at ? (
                      <Button variant="outline" size="sm" onClick={() => handleRestore(dept)}>
                        <RotateCcw className="h-4 w-4 mr-1" />
                        {language === 'fr' ? 'Restaurer' : 'Restore'}
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" size="sm" onClick={() => { setSelectedDepartment(dept); setDepartmentName(dept.name); setEditModalOpen(true); }}>
                          <Pencil className="h-4 w-4 mr-1" />
                          {language === 'fr' ? 'Renommer' : 'Rename'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setSelectedDepartment(dept); setArchiveDialogOpen(true); }}>
                          <Archive className="h-4 w-4 mr-1" />
                          {language === 'fr' ? 'Archiver' : 'Archive'}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === 'fr' ? 'Nouveau département' : 'New Department'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input placeholder={language === 'fr' ? 'Nom du département' : 'Department name'} value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreate} disabled={!departmentName.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === 'fr' ? 'Renommer le département' : 'Rename Department'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input placeholder={language === 'fr' ? 'Nom du département' : 'Department name'} value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRename()} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleRename} disabled={!departmentName.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === 'fr' ? 'Archiver ce département ?' : 'Archive this department?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'fr'
                ? 'Ce département ne sera plus sélectionnable pour de nouveaux documents. Les documents existants conserveront leur association.'
                : 'This department will no longer be selectable for new documents. Existing documents will retain their association.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {language === 'fr' ? 'Archiver' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
