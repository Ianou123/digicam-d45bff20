import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, Archive, RotateCcw, Pencil, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
}

export default function Departments() {
  const { user, profile, isClientAdmin, isSuperAdmin, isClientSuspended } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  
  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [departmentName, setDepartmentName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.client_id || isSuperAdmin) {
      fetchDepartments();
    }
  }, [profile?.client_id, isSuperAdmin, showArchived]);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('departments')
        .select('*')
        .order('name');

      // Filter by client for non-super-admins
      if (!isSuperAdmin && profile?.client_id) {
        query = query.eq('client_id', profile.client_id);
      }

      // Filter by archived status
      if (showArchived) {
        query = query.not('archived_at', 'is', null);
      } else {
        query = query.is('archived_at', null);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get document counts for each department
      const departmentsWithCounts = await Promise.all(
        (data || []).map(async (dept) => {
          const { count } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('department_id', dept.id)
            .is('deleted_at', null);
          return { ...dept, document_count: count || 0 };
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
      user_id: user.id,
      client_id: profile.client_id,
      action_type: actionType,
      target_type: 'department',
      target_id: departmentId,
      target_name: departmentName,
      metadata,
    });
  };

  const handleCreate = async () => {
    if (!departmentName.trim() || !profile?.client_id || !user) return;
    
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('departments')
        .insert({
          name: departmentName.trim(),
          client_id: profile.client_id,
        })
        .select()
        .single();

      if (error) throw error;

      await logAdminAction('create_department', data.id, data.name);
      
      toast.success(language === 'fr' ? 'Département créé avec succès' : 'Department created successfully');
      setCreateModalOpen(false);
      setDepartmentName('');
      fetchDepartments();
    } catch (error) {
      console.error('Error creating department:', error);
      toast.error(language === 'fr' ? 'Erreur lors de la création' : 'Error creating department');
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async () => {
    if (!departmentName.trim() || !selectedDepartment || !user) return;
    
    setSaving(true);
    try {
      const oldName = selectedDepartment.name;
      const { error } = await supabase
        .from('departments')
        .update({ name: departmentName.trim() })
        .eq('id', selectedDepartment.id);

      if (error) throw error;

      await logAdminAction('rename_department', selectedDepartment.id, departmentName.trim(), {
        old_name: oldName,
        new_name: departmentName.trim(),
      });
      
      toast.success(language === 'fr' ? 'Département renommé avec succès' : 'Department renamed successfully');
      setEditModalOpen(false);
      setSelectedDepartment(null);
      setDepartmentName('');
      fetchDepartments();
    } catch (error) {
      console.error('Error renaming department:', error);
      toast.error(language === 'fr' ? 'Erreur lors du renommage' : 'Error renaming department');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!selectedDepartment || !user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('departments')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', selectedDepartment.id);

      if (error) throw error;

      await logAdminAction('archive_department', selectedDepartment.id, selectedDepartment.name);
      
      toast.success(language === 'fr' ? 'Département archivé avec succès' : 'Department archived successfully');
      setArchiveDialogOpen(false);
      setSelectedDepartment(null);
      fetchDepartments();
    } catch (error) {
      console.error('Error archiving department:', error);
      toast.error(language === 'fr' ? "Erreur lors de l'archivage" : 'Error archiving department');
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (dept: Department) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('departments')
        .update({ archived_at: null })
        .eq('id', dept.id);

      if (error) throw error;

      await logAdminAction('restore_department', dept.id, dept.name);
      
      toast.success(language === 'fr' ? 'Département restauré avec succès' : 'Department restored successfully');
      fetchDepartments();
    } catch (error) {
      console.error('Error restoring department:', error);
      toast.error(language === 'fr' ? 'Erreur lors de la restauration' : 'Error restoring department');
    }
  };

  const openEditModal = (dept: Department) => {
    setSelectedDepartment(dept);
    setDepartmentName(dept.name);
    setEditModalOpen(true);
  };

  const openArchiveDialog = (dept: Department) => {
    setSelectedDepartment(dept);
    setArchiveDialogOpen(true);
  };

  // Super Admin can only view, not manage
  // Client Admin can manage if not suspended
  // Staff cannot access this page
  if (!isClientAdmin && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const canManage = isClientAdmin && !isClientSuspended;
  const activeDepts = departments.filter(d => !d.archived_at);
  const archivedDepts = departments.filter(d => d.archived_at);
  const displayedDepts = showArchived ? archivedDepts : activeDepts;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-semibold">
            {language === 'fr' ? 'Départements' : 'Departments'}
          </h2>
          <p className="text-muted-foreground">
            {isSuperAdmin 
              ? (language === 'fr' ? 'Aperçu des départements par organisation' : 'Overview of departments by organization')
              : (language === 'fr' ? 'Gérez les départements de votre organisation' : 'Manage your organization\'s departments')
            }
          </p>
        </div>
        
        {canManage && (
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {language === 'fr' ? 'Nouveau département' : 'New Department'}
          </Button>
        )}
      </div>

      {/* Toggle Active/Archived */}
      <div className="flex gap-2">
        <Button
          variant={!showArchived ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowArchived(false)}
        >
          <FolderOpen className="h-4 w-4 mr-2" />
          {language === 'fr' ? 'Actifs' : 'Active'} ({activeDepts.length})
        </Button>
        <Button
          variant={showArchived ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowArchived(true)}
        >
          <Archive className="h-4 w-4 mr-2" />
          {language === 'fr' ? 'Archivés' : 'Archived'} ({archivedDepts.length})
        </Button>
      </div>

      {/* Departments List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : displayedDepts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {showArchived 
                ? (language === 'fr' ? 'Aucun département archivé' : 'No archived departments')
                : (language === 'fr' ? 'Aucun département actif' : 'No active departments')
              }
            </p>
            {canManage && !showArchived && (
              <Button className="mt-4" onClick={() => setCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {language === 'fr' ? 'Créer un département' : 'Create Department'}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
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
                  {dept.archived_at && (
                    <Badge variant="secondary">
                      {language === 'fr' ? 'Archivé' : 'Archived'}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {dept.document_count} {language === 'fr' ? 'document(s)' : 'document(s)'}
                </p>
                
                {canManage && (
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    {dept.archived_at ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(dept)}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        {language === 'fr' ? 'Restaurer' : 'Restore'}
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(dept)}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          {language === 'fr' ? 'Renommer' : 'Rename'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openArchiveDialog(dept)}
                        >
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
            <DialogTitle>
              {language === 'fr' ? 'Nouveau département' : 'New Department'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder={language === 'fr' ? 'Nom du département' : 'Department name'}
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={!departmentName.trim() || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'fr' ? 'Renommer le département' : 'Rename Department'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder={language === 'fr' ? 'Nom du département' : 'Department name'}
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleRename} disabled={!departmentName.trim() || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'fr' ? 'Archiver ce département ?' : 'Archive this department?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'fr' 
                ? 'Ce département ne sera plus sélectionnable pour de nouveaux documents. Les documents existants conserveront leur association à ce département.'
                : 'This department will no longer be selectable for new documents. Existing documents will retain their association with this department.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {language === 'fr' ? 'Archiver' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
