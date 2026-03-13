import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Share2, UserPlus, Trash2, Download, Eye, Clock, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DocumentShareTabProps {
  documentId: string;
}

interface Share {
  id: string;
  share_type: string;
  recipient_user_id: string | null;
  can_download: boolean;
  expires_at: string | null;
  created_at: string;
  created_by: string;
  recipient_profile?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
  creator_profile?: {
    full_name: string | null;
  } | null;
}

interface OrgUser {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

export function DocumentShareTab({ documentId }: DocumentShareTabProps) {
  const { user, profile, clientModule } = useAuth();
  const { language } = useLanguage();
  const dateLocale = language === 'fr' ? fr : enUS;
  
  const [shares, setShares] = useState<Share[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // New share form state
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [canDownload, setCanDownload] = useState(false);
  const [expiresIn, setExpiresIn] = useState<string>('never');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchShares();
    fetchOrgUsers();
  }, [documentId]);

  const fetchShares = async () => {
    try {
      const { data, error } = await supabase
        .from('shares')
        .select('*')
        .eq('document_id', documentId)
        .eq('share_type', 'internal')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        // Fetch recipient profiles
        const recipientIds = data.filter(s => s.recipient_user_id).map(s => s.recipient_user_id) as string[];
        const creatorIds = [...new Set(data.map(s => s.created_by))];
        const allUserIds = [...new Set([...recipientIds, ...creatorIds])];

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', allUserIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const sharesWithProfiles = data.map(share => ({
          ...share,
          recipient_profile: share.recipient_user_id ? profileMap.get(share.recipient_user_id) : null,
          creator_profile: profileMap.get(share.created_by) || null,
        }));

        setShares(sharesWithProfiles);
      } else {
        setShares([]);
      }
    } catch (error) {
      console.error('Error fetching shares:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgUsers = async () => {
    if (!profile?.client_id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .eq('client_id', profile.client_id)
        .eq('status', 'active')
        .neq('id', user?.id || '');

      if (error) throw error;

      let filteredUsers = data || [];

      // In administrative module, exclude IT admins (client_admin) from recipients
      // since they cannot access/view documents
      if (clientModule === 'admin_publique') {
        const { data: itAdminRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'client_admin');

        const itAdminIds = new Set(itAdminRoles?.map(r => r.user_id) || []);
        filteredUsers = filteredUsers.filter(u => !itAdminIds.has(u.id));
      }

      setOrgUsers(filteredUsers);
    } catch (error) {
      console.error('Error fetching org users:', error);
    }
  };

  const handleAddShare = async () => {
    if (!selectedUserId || !user) return;

    setSaving(true);
    try {
      // Check if share already exists for this user
      const existingShare = shares.find(s => s.recipient_user_id === selectedUserId);
      if (existingShare) {
        toast.error(language === 'fr' 
          ? 'Ce document est déjà partagé avec cet utilisateur' 
          : 'This document is already shared with this user');
        setSaving(false);
        return;
      }

      let expiresAt: string | null = null;
      if (expiresIn !== 'never') {
        const now = new Date();
        switch (expiresIn) {
          case '1d':
            now.setDate(now.getDate() + 1);
            break;
          case '7d':
            now.setDate(now.getDate() + 7);
            break;
          case '30d':
            now.setDate(now.getDate() + 30);
            break;
        }
        expiresAt = now.toISOString();
      }

      const { error } = await supabase
        .from('shares')
        .insert({
          document_id: documentId,
          share_type: 'internal',
          recipient_user_id: selectedUserId,
          can_download: canDownload,
          expires_at: expiresAt,
          created_by: user.id,
        });

      if (error) throw error;

      // Create in-app notification for recipient
      const recipientUser = orgUsers.find(u => u.id === selectedUserId);
      if (recipientUser && profile?.client_id) {
        // Fetch the document title
        const { data: docData } = await supabase
          .from('documents')
          .select('title')
          .eq('id', documentId)
          .single();

        await supabase.from('notifications').insert({
          user_id: selectedUserId,
          client_id: profile.client_id,
          type: 'document_shared',
          title: language === 'fr' ? 'Document partagé avec vous' : 'Document shared with you',
          message: language === 'fr' 
            ? `${profile.full_name || profile.email} a partagé "${docData?.title || 'un document'}" avec vous`
            : `${profile.full_name || profile.email} shared "${docData?.title || 'a document'}" with you`,
          metadata: {
            document_id: documentId,
            document_title: docData?.title,
            shared_by: user.id,
            shared_by_name: profile.full_name || profile.email,
            can_download: canDownload
          }
        });
      }

      toast.success(language === 'fr' ? 'Document partagé avec succès' : 'Document shared successfully');
      setIsAddModalOpen(false);
      setSelectedUserId('');
      setCanDownload(false);
      setExpiresIn('never');
      fetchShares();
    } catch (error) {
      console.error('Error sharing document:', error);
      toast.error(language === 'fr' ? 'Erreur lors du partage' : 'Error sharing document');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    try {
      const { error } = await supabase
        .from('shares')
        .delete()
        .eq('id', shareId);

      if (error) throw error;

      toast.success(language === 'fr' ? 'Partage supprimé' : 'Share removed');
      fetchShares();
    } catch (error) {
      console.error('Error removing share:', error);
      toast.error(language === 'fr' ? 'Erreur lors de la suppression' : 'Error removing share');
    }
  };

  const handleToggleDownload = async (shareId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('shares')
        .update({ can_download: !currentValue })
        .eq('id', shareId);

      if (error) throw error;

      toast.success(language === 'fr' ? 'Droits mis à jour' : 'Permissions updated');
      fetchShares();
    } catch (error) {
      console.error('Error updating share:', error);
      toast.error(language === 'fr' ? 'Erreur lors de la mise à jour' : 'Error updating');
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const isShareExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  // Filter out users who already have a share
  const availableUsers = orgUsers.filter(
    u => !shares.some(s => s.recipient_user_id === u.id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add Share Button */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogTrigger asChild>
          <Button className="w-full" disabled={availableUsers.length === 0}>
            <UserPlus className="h-4 w-4 mr-2" />
            {language === 'fr' ? 'Partager avec un collègue' : 'Share with a colleague'}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'fr' ? 'Partager le document' : 'Share Document'}
            </DialogTitle>
            <DialogDescription>
              {language === 'fr' 
                ? 'Sélectionnez un membre de votre organisation pour partager ce document.'
                : 'Select a member of your organization to share this document with.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* User Selection */}
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Partager avec' : 'Share with'}</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'fr' ? 'Sélectionner un utilisateur' : 'Select a user'} />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={u.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(u.full_name, u.email)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{u.full_name || u.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Permissions */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{language === 'fr' ? 'Autoriser le téléchargement' : 'Allow download'}</Label>
                <p className="text-xs text-muted-foreground">
                  {language === 'fr' 
                    ? 'L\'utilisateur pourra télécharger le document'
                    : 'User will be able to download the document'}
                </p>
              </div>
              <Switch checked={canDownload} onCheckedChange={setCanDownload} />
            </div>

            {/* Expiration */}
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Expiration' : 'Expiration'}</Label>
              <Select value={expiresIn} onValueChange={setExpiresIn}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">{language === 'fr' ? 'Jamais' : 'Never'}</SelectItem>
                  <SelectItem value="1d">{language === 'fr' ? '1 jour' : '1 day'}</SelectItem>
                  <SelectItem value="7d">{language === 'fr' ? '7 jours' : '7 days'}</SelectItem>
                  <SelectItem value="30d">{language === 'fr' ? '30 jours' : '30 days'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              {language === 'fr' ? 'Annuler' : 'Cancel'}
            </Button>
            <Button onClick={handleAddShare} disabled={!selectedUserId || saving}>
              {saving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
              ) : (
                <>
                  <Share2 className="h-4 w-4 mr-2" />
                  {language === 'fr' ? 'Partager' : 'Share'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {availableUsers.length === 0 && shares.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {language === 'fr' 
            ? 'Aucun autre utilisateur dans votre organisation'
            : 'No other users in your organization'}
        </p>
      )}

      {/* Shares List */}
      {shares.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              {language === 'fr' 
                ? `Partagé avec ${shares.length} personne${shares.length > 1 ? 's' : ''}`
                : `Shared with ${shares.length} ${shares.length > 1 ? 'people' : 'person'}`}
            </span>
          </div>
          
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {shares.map((share) => {
                const expired = isShareExpired(share.expires_at);
                const isCreator = share.created_by === user?.id;
                
                return (
                  <div 
                    key={share.id} 
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      expired ? "bg-muted/50 opacity-60" : "bg-card"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={share.recipient_profile?.avatar_url || undefined} />
                        <AvatarFallback>
                          {getInitials(
                            share.recipient_profile?.full_name || null, 
                            share.recipient_profile?.email || ''
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">
                          {share.recipient_profile?.full_name || share.recipient_profile?.email || 'Unknown'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {share.can_download ? (
                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                              <Download className="h-3 w-3 mr-1" />
                              {language === 'fr' ? 'Téléchargement' : 'Download'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                              <Eye className="h-3 w-3 mr-1" />
                              {language === 'fr' ? 'Lecture' : 'View only'}
                            </Badge>
                          )}
                          {share.expires_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {expired 
                                ? (language === 'fr' ? 'Expiré' : 'Expired')
                                : format(new Date(share.expires_at), 'dd MMM yyyy', { locale: dateLocale })
                              }
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {isCreator && (
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleToggleDownload(share.id, share.can_download)}
                          title={language === 'fr' ? 'Modifier les droits' : 'Toggle permissions'}
                        >
                          {share.can_download ? (
                            <Download className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              title={language === 'fr' ? 'Révoquer l\'accès' : 'Revoke access'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {language === 'fr' ? 'Révoquer l\'accès' : 'Revoke Access'}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {language === 'fr' 
                                  ? `Êtes-vous sûr de vouloir révoquer l'accès de ${share.recipient_profile?.full_name || share.recipient_profile?.email || 'cet utilisateur'} à ce document ?`
                                  : `Are you sure you want to revoke ${share.recipient_profile?.full_name || share.recipient_profile?.email || 'this user'}'s access to this document?`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>
                                {language === 'fr' ? 'Annuler' : 'Cancel'}
                              </AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleRemoveShare(share.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {language === 'fr' ? 'Révoquer' : 'Revoke'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground">
          <Share2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {language === 'fr' 
              ? 'Ce document n\'est partagé avec personne'
              : 'This document is not shared with anyone'}
          </p>
        </div>
      )}
    </div>
  );
}
