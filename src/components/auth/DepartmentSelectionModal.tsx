import { useState, useEffect } from 'react';
import { Loader2, FolderOpen } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Department {
  id: string;
  name: string;
}

export function DepartmentSelectionModal() {
  const { user, profile, isUltraAdmin, isSuperAdmin, refreshProfile } = useAuth();
  const { language } = useLanguage();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Show only for non-admin users who have a client but no department
  const shouldShow = !isUltraAdmin && !isSuperAdmin && profile?.client_id && !profile?.department_id;

  useEffect(() => {
    if (shouldShow && profile?.client_id) {
      fetchDepartments();
    }
  }, [shouldShow, profile?.client_id]);

  const fetchDepartments = async () => {
    setFetching(true);
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .eq('client_id', profile!.client_id!)
      .is('archived_at', null)
      .order('name');
    setDepartments(data || []);
    setFetching(false);
  };

  const handleConfirm = async () => {
    if (!selectedDept || !user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ department_id: selectedDept, department_self_declared: true })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success(language === 'fr' ? 'Département sélectionné' : 'Department selected');
    } catch (error) {
      console.error('Error setting department:', error);
      toast.error(language === 'fr' ? 'Erreur lors de la sélection' : 'Error selecting department');
    } finally {
      setLoading(false);
    }
  };

  if (!shouldShow || fetching) return null;
  if (departments.length === 0) return null;

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            <DialogTitle>
              {language === 'fr' ? 'Choisissez votre département' : 'Choose your department'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {language === 'fr'
              ? 'Sélectionnez le département auquel vous appartenez pour personnaliser votre expérience.'
              : 'Select the department you belong to for a personalized experience.'}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Select value={selectedDept} onValueChange={setSelectedDept}>
            <SelectTrigger>
              <SelectValue placeholder={language === 'fr' ? 'Sélectionner un département' : 'Select a department'} />
            </SelectTrigger>
            <SelectContent>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button onClick={handleConfirm} disabled={!selectedDept || loading} className="btn-institutional">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {language === 'fr' ? 'Enregistrement...' : 'Saving...'}
              </>
            ) : (
              language === 'fr' ? 'Confirmer' : 'Confirm'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
