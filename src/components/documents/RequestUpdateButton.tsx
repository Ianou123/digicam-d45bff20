import { useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RequestUpdateButtonProps {
  documentId: string;
  documentTitle: string;
  documentOwnerId?: string;
  documentCreatedAt: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

export function RequestUpdateButton({
  documentId,
  documentTitle,
  documentOwnerId,
  documentCreatedAt,
  variant = 'outline',
  size = 'sm',
}: RequestUpdateButtonProps) {
  const { user, profile, isClientAdmin, isSuperAdmin } = useAuth();
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Calculate if document is older than 6 months
  const isOldDocument = () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return new Date(documentCreatedAt) < sixMonthsAgo;
  };

  // Don't show for admins (they can update directly) unless it's someone else's document
  if ((isClientAdmin || isSuperAdmin) && documentOwnerId === user?.id) {
    return null;
  }

  const handleSubmit = async () => {
    if (!user || !profile?.client_id) return;

    setLoading(true);
    try {
      // Create update request
      const { error: requestError } = await supabase
        .from('update_requests' as any)
        .insert({
          document_id: documentId,
          requester_id: user.id,
          client_id: profile.client_id,
          message: message.trim() || null,
          status: 'pending',
        });

      if (requestError) throw requestError;

      // Log the action
      await supabase.from('activity_logs').insert([{
        user_id: user.id,
        client_id: profile.client_id,
        action_type: 'update' as const,
        document_id: documentId,
        metadata: { 
          action: 'request_update',
          message: message.trim() || null
        }
      }]);

      // Create notification for document owner and admins
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('client_id', profile.client_id)
        .neq('id', user.id);

      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['client_admin', 'super_admin']);

      const adminUserIds = adminRoles?.map(r => r.user_id) || [];
      const relevantAdmins = admins?.filter(a => adminUserIds.includes(a.id)) || [];

      if (documentOwnerId && documentOwnerId !== user.id) {
        relevantAdmins.push({ id: documentOwnerId });
      }

      const notifications = relevantAdmins.map(admin => ({
        user_id: admin.id,
        client_id: profile.client_id,
        type: 'update_request',
        title: language === 'fr' ? 'Demande de mise à jour' : 'Update Requested',
        message: language === 'fr'
          ? `${profile.full_name || profile.email} demande une mise à jour de "${documentTitle}"`
          : `${profile.full_name || profile.email} is requesting an update for "${documentTitle}"`,
        document_id: documentId,
        metadata: { requester_name: profile.full_name || profile.email, message: message.trim() || null },
      }));

      if (notifications.length > 0) {
        await supabase.from('notifications' as any).insert(notifications);
      }

      toast.success(
        language === 'fr' 
          ? 'Demande de mise à jour envoyée'
          : 'Update request sent',
        {
          description: language === 'fr'
            ? 'Les administrateurs seront notifiés'
            : 'Administrators will be notified'
        }
      );

      setOpen(false);
      setMessage('');
    } catch (error) {
      console.error('Error creating update request:', error);
      toast.error(
        language === 'fr' 
          ? 'Erreur lors de l\'envoi de la demande'
          : 'Error sending request'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className="gap-1.5">
          <RefreshCw className="h-4 w-4" />
          {language === 'fr' ? 'Demander une mise à jour' : 'Request Update'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {language === 'fr' 
              ? 'Demander une mise à jour'
              : 'Request Document Update'}
          </DialogTitle>
          <DialogDescription>
            {language === 'fr'
              ? `Signalez que "${documentTitle}" nécessite une mise à jour. Les administrateurs et le propriétaire du document seront notifiés.`
              : `Signal that "${documentTitle}" needs to be updated. Administrators and the document owner will be notified.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="message">
              {language === 'fr' ? 'Message (optionnel)' : 'Message (optional)'}
            </Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                language === 'fr' 
                  ? 'Décrivez pourquoi une mise à jour est nécessaire...'
                  : 'Describe why an update is needed...'
              }
              rows={3}
            />
          </div>

          {isOldDocument() && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-sm">
              <p>
                {language === 'fr'
                  ? '📅 Ce document a plus de 6 mois'
                  : '📅 This document is over 6 months old'}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {language === 'fr' ? 'Annuler' : 'Cancel'}
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {language === 'fr' ? 'Envoyer la demande' : 'Send Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}