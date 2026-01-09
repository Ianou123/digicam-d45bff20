import { useState, useEffect } from 'react';
import { User, Globe, Bell, Lock, Building2, Copy, Check, Loader2, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { toast } from 'sonner';

interface NotificationPreferences {
  emailNotifications: boolean;
  newDocuments: boolean;
}

export default function Settings() {
  const { profile, refreshProfile, isClientAdmin, clientName, clientInviteCode, signOut, user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    fullName: profile?.full_name || '',
    email: profile?.email || '',
  });

  // Password change state
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  // Account deletion state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Notification preferences
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    emailNotifications: true,
    newDocuments: true,
  });
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);

  // Load notification preferences from profile metadata
  useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.full_name || '',
        email: profile.email || '',
      });
    }
  }, [profile]);

  // Simulated notification preferences (would need a preferences table in real impl)
  useEffect(() => {
    // For now, we use localStorage as a simple persistence layer
    const savedPrefs = localStorage.getItem(`notifications_${user?.id}`);
    if (savedPrefs) {
      try {
        setNotifications(JSON.parse(savedPrefs));
      } catch {
        // ignore
      }
    }
    setNotificationsLoaded(true);
  }, [user?.id]);

  const handleCopyInviteCode = async () => {
    if (!clientInviteCode) return;
    try {
      await navigator.clipboard.writeText(clientInviteCode);
      setCopied(true);
      toast.success(t('settings.copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName,
          preferred_language: language,
        })
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();
      toast.success(language === 'fr' ? 'Paramètres enregistrés' : 'Settings saved');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(language === 'fr' ? 'Erreur lors de la sauvegarde' : 'Error saving settings');
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationChange = (key: keyof NotificationPreferences, value: boolean) => {
    const newPrefs = { ...notifications, [key]: value };
    setNotifications(newPrefs);
    // Save to localStorage
    localStorage.setItem(`notifications_${user?.id}`, JSON.stringify(newPrefs));
    toast.success(language === 'fr' ? 'Préférences mises à jour' : 'Preferences updated');
  };

  const handlePasswordChange = async () => {
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error(language === 'fr' ? 'Veuillez remplir tous les champs' : 'Please fill all fields');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error(t('auth.passwordMismatch'));
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error(
        language === 'fr' 
          ? 'Le mot de passe doit contenir au moins 6 caractères'
          : 'Password must be at least 6 characters'
      );
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      toast.success(
        language === 'fr' 
          ? 'Mot de passe modifié avec succès'
          : 'Password changed successfully'
      );
      setPasswordModalOpen(false);
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(error.message || 'Error changing password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleAccountDeletion = async () => {
    const confirmText = language === 'fr' ? 'SUPPRIMER' : 'DELETE';
    if (deleteConfirmText !== confirmText) {
      toast.error(
        language === 'fr' 
          ? `Veuillez taper "${confirmText}" pour confirmer`
          : `Please type "${confirmText}" to confirm`
      );
      return;
    }

    setDeleting(true);
    try {
      // Mark profile as deletion requested (soft delete approach)
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'deactivated' })
        .eq('id', profile!.id);

      if (error) throw error;

      toast.success(
        language === 'fr'
          ? 'Demande de suppression envoyée. Un administrateur traitera votre demande.'
          : 'Deletion request submitted. An admin will process your request.'
      );
      
      // Sign out the user
      await signOut();
    } catch (error: any) {
      console.error('Error requesting account deletion:', error);
      toast.error(error.message || 'Error processing request');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-serif font-semibold">{t('nav.settings')}</h2>
        <p className="text-muted-foreground">
          {language === 'fr' 
            ? 'Gérez vos préférences et informations personnelles'
            : 'Manage your preferences and personal information'}
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {language === 'fr' ? 'Profil' : 'Profile'}
          </CardTitle>
          <CardDescription>
            {language === 'fr' ? 'Vos informations personnelles' : 'Your personal information'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">
              {language === 'fr' ? 'Nom complet' : 'Full name'}
            </Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">
              {language === 'fr' ? 'Adresse e-mail' : 'Email address'}
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              {language === 'fr' 
                ? "L'adresse e-mail ne peut pas être modifiée"
                : 'Email address cannot be changed'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Organization - Only visible to Client Admins */}
      {isClientAdmin && clientInviteCode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {t('settings.organization')}
            </CardTitle>
            <CardDescription>
              {t('settings.organizationDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('settings.organizationName')}</Label>
              <Input
                value={clientName || ''}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.inviteCode')}</Label>
              <div className="flex gap-2">
                <Input
                  value={clientInviteCode}
                  disabled
                  className="bg-muted font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyInviteCode}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('settings.inviteCodeHint')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {language === 'fr' ? 'Langue' : 'Language'}
          </CardTitle>
          <CardDescription>
            {language === 'fr' ? 'Choisissez votre langue préférée' : 'Choose your preferred language'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={language} onValueChange={(v: 'fr' | 'en') => setLanguage(v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fr">🇫🇷 Français</SelectItem>
              <SelectItem value="en">🇬🇧 English</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            {language === 'fr' 
              ? 'Gérez vos préférences de notification'
              : 'Manage your notification preferences'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {language === 'fr' ? 'Notifications par e-mail' : 'Email notifications'}
              </p>
              <p className="text-sm text-muted-foreground">
                {language === 'fr' 
                  ? 'Recevoir des notifications par e-mail'
                  : 'Receive notifications by email'}
              </p>
            </div>
            <Switch 
              checked={notifications.emailNotifications}
              onCheckedChange={(checked) => handleNotificationChange('emailNotifications', checked)}
              disabled={!notificationsLoaded}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {language === 'fr' ? 'Nouveaux documents' : 'New documents'}
              </p>
              <p className="text-sm text-muted-foreground">
                {language === 'fr' 
                  ? 'Être notifié des nouveaux documents dans votre organisation'
                  : 'Be notified of new documents in your organization'}
              </p>
            </div>
            <Switch 
              checked={notifications.newDocuments}
              onCheckedChange={(checked) => handleNotificationChange('newDocuments', checked)}
              disabled={!notificationsLoaded}
            />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {language === 'fr' ? 'Sécurité' : 'Security'}
          </CardTitle>
          <CardDescription>
            {language === 'fr' 
              ? 'Paramètres de sécurité de votre compte'
              : 'Your account security settings'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" onClick={() => setPasswordModalOpen(true)}>
            {language === 'fr' ? 'Changer le mot de passe' : 'Change password'}
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            {language === 'fr' ? 'Zone de danger' : 'Danger Zone'}
          </CardTitle>
          <CardDescription>
            {language === 'fr' 
              ? 'Actions irréversibles sur votre compte'
              : 'Irreversible actions on your account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            {language === 'fr' ? 'Demander la suppression du compte' : 'Request account deletion'}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            {language === 'fr' 
              ? 'Votre compte sera désactivé et un administrateur traitera votre demande de suppression.'
              : 'Your account will be deactivated and an admin will process your deletion request.'}
          </p>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading} className="btn-institutional">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          {loading ? t('common.loading') : t('common.save')}
        </Button>
      </div>

      {/* Password Change Modal */}
      <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'fr' ? 'Changer le mot de passe' : 'Change Password'}
            </DialogTitle>
            <DialogDescription>
              {language === 'fr' 
                ? 'Entrez votre nouveau mot de passe'
                : 'Enter your new password'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Nouveau mot de passe' : 'New password'}</Label>
              <Input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('auth.confirmPassword')}</Label>
              <Input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handlePasswordChange} disabled={changingPassword}>
              {changingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account Deletion Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'fr' 
                ? 'Êtes-vous absolument sûr ?'
                : 'Are you absolutely sure?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                {language === 'fr' 
                  ? 'Cette action désactivera votre compte. Un administrateur traitera votre demande de suppression.'
                  : 'This will deactivate your account. An admin will process your deletion request.'}
              </p>
              <div className="space-y-2">
                <Label>
                  {language === 'fr' 
                    ? 'Tapez "SUPPRIMER" pour confirmer'
                    : 'Type "DELETE" to confirm'}
                </Label>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={language === 'fr' ? 'SUPPRIMER' : 'DELETE'}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleAccountDeletion}
              disabled={deleting || deleteConfirmText !== (language === 'fr' ? 'SUPPRIMER' : 'DELETE')}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {language === 'fr' ? 'Supprimer mon compte' : 'Delete my account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
