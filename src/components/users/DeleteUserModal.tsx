import { useState, useEffect } from 'react';
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
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, FileText, UserX, UserMinus, ArrowRightLeft, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

interface DeleteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
  onDeactivate: () => void;
  onTransferOwnership?: (newOwnerId: string) => void;
  onPermanentDelete?: (transferToUserId?: string) => void;
  availableUsers?: { id: string; full_name: string | null; email: string }[];
  isSuperAdmin?: boolean;
}

export function DeleteUserModal({
  open,
  onOpenChange,
  user,
  onDeactivate,
  onTransferOwnership,
  onPermanentDelete,
  availableUsers = [],
  isSuperAdmin = false,
}: DeleteUserModalProps) {
  const { language } = useLanguage();
  const [documentCount, setDocumentCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'deactivate' | 'transfer' | 'permanent'>('deactivate');
  const [transferToUser, setTransferToUser] = useState<string>('');

  useEffect(() => {
    if (open && user) {
      fetchDocumentCount();
    }
  }, [open, user]);

  const fetchDocumentCount = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { count } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('uploaded_by', user.id)
        .is('deleted_at', null);
      
      setDocumentCount(count || 0);
    } catch (error) {
      console.error('Error fetching document count:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedAction === 'transfer' && transferToUser && onTransferOwnership) {
      onTransferOwnership(transferToUser);
    } else if (selectedAction === 'permanent' && onPermanentDelete) {
      onPermanentDelete(transferToUser || undefined);
    } else {
      onDeactivate();
    }
  };

  if (!user) return null;

  const displayName = user.full_name || user.email;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle className="text-lg font-semibold">
              {language === 'fr' ? 'Supprimer le compte utilisateur' : 'Delete User Account'}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Impact Analysis */}
        <div className="space-y-4 py-2">
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium text-foreground">{displayName}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : documentCount > 0 ? (
            <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <FileText className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  {language === 'fr' 
                    ? `Cet utilisateur possède ${documentCount} document${documentCount > 1 ? 's' : ''}.`
                    : `This user owns ${documentCount} document${documentCount > 1 ? 's' : ''}.`}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                  {language === 'fr' 
                    ? 'Ces documents doivent être transférés ou conservés.'
                    : 'These must be transferred or preserved.'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {language === 'fr' 
                ? "Cet utilisateur n'a aucun document."
                : 'This user has no documents.'}
            </p>
          )}

          <DialogDescription className="text-sm">
            {language === 'fr' 
              ? "Choisissez comment gérer ce compte :"
              : 'Choose how to handle this account:'}
          </DialogDescription>

          {/* Action Selection */}
          <div className="space-y-3">
            {/* Deactivate Option */}
            <div 
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedAction === 'deactivate' 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-muted-foreground/50'
              }`}
              onClick={() => setSelectedAction('deactivate')}
            >
              <div className="flex items-start gap-3">
                <UserMinus className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {language === 'fr' ? 'Désactiver le compte' : 'Deactivate Account'}
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      {language === 'fr' ? 'Recommandé' : 'Recommended'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === 'fr' 
                      ? `L'utilisateur ne pourra plus se connecter. Les documents seront attribués à "${displayName} (Inactif)".`
                      : `User cannot log in. Documents attributed as "${displayName} (Inactive)".`}
                  </p>
                </div>
              </div>
            </div>

            {/* Transfer Ownership Option */}
            {onTransferOwnership && availableUsers.length > 0 && documentCount > 0 && (
              <div 
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedAction === 'transfer' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-muted-foreground/50'
                }`}
                onClick={() => setSelectedAction('transfer')}
              >
                <div className="flex items-start gap-3">
                  <ArrowRightLeft className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {language === 'fr' ? 'Transférer la propriété' : 'Transfer Ownership'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {language === 'fr' 
                        ? 'Transférer tous les documents à un autre utilisateur avant de désactiver.'
                        : 'Transfer all documents to another user before deactivating.'}
                    </p>
                    
                    {selectedAction === 'transfer' && (
                      <div className="mt-3">
                        <Label className="text-xs">
                          {language === 'fr' ? 'Transférer à :' : 'Transfer to:'}
                        </Label>
                        <Select value={transferToUser} onValueChange={setTransferToUser}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder={language === 'fr' ? 'Sélectionner un utilisateur' : 'Select user'} />
                          </SelectTrigger>
                          <SelectContent>
                            {availableUsers
                              .filter(u => u.id !== user?.id)
                              .map(u => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.full_name || u.email}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Permanent Delete Option - Super Admin Only */}
            {isSuperAdmin && onPermanentDelete && (
              <div 
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedAction === 'permanent' 
                    ? 'border-destructive bg-destructive/5' 
                    : 'border-border hover:border-muted-foreground/50'
                }`}
                onClick={() => setSelectedAction('permanent')}
              >
                <div className="flex items-start gap-3">
                  <Trash2 className="h-5 w-5 text-destructive mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-destructive">
                        {language === 'fr' ? 'Supprimer définitivement' : 'Permanently Delete'}
                      </p>
                      <Badge variant="destructive" className="text-xs">
                        {language === 'fr' ? 'Irréversible' : 'Irreversible'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {language === 'fr' 
                        ? 'Supprimer définitivement le compte et toutes les données associées. Cette action est irréversible.'
                        : 'Permanently delete the account and all associated data. This action cannot be undone.'}
                    </p>
                    
                    {selectedAction === 'permanent' && documentCount > 0 && availableUsers.length > 0 && (
                      <div className="mt-3">
                        <Label className="text-xs">
                          {language === 'fr' ? 'Transférer les documents à (optionnel) :' : 'Transfer documents to (optional):'}
                        </Label>
                        <Select value={transferToUser} onValueChange={setTransferToUser}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder={language === 'fr' ? 'Ne pas transférer' : 'Do not transfer'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">
                              {language === 'fr' ? 'Ne pas transférer' : 'Do not transfer'}
                            </SelectItem>
                            {availableUsers
                              .filter(u => u.id !== user?.id)
                              .map(u => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.full_name || u.email}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {language === 'fr' ? 'Annuler' : 'Cancel'}
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm}
            disabled={(selectedAction === 'transfer' && !transferToUser)}
          >
            {selectedAction === 'permanent' ? (
              <Trash2 className="h-4 w-4 mr-2" />
            ) : (
              <UserX className="h-4 w-4 mr-2" />
            )}
            {selectedAction === 'transfer' 
              ? (language === 'fr' ? 'Transférer et désactiver' : 'Transfer & Deactivate')
              : selectedAction === 'permanent'
                ? (language === 'fr' ? 'Supprimer définitivement' : 'Delete Permanently')
                : (language === 'fr' ? 'Désactiver' : 'Deactivate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
