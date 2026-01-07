import { useState } from 'react';
import { User, Globe, Bell, Lock, Building2, Copy, Check } from 'lucide-react';
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
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Settings() {
  const { profile, refreshProfile, isClientAdmin, clientName, clientInviteCode } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    fullName: profile?.full_name || '',
    email: profile?.email || '',
  });

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
      toast.success('Paramètres enregistrés');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-serif font-semibold">{t('nav.settings')}</h2>
        <p className="text-muted-foreground">
          Gérez vos préférences et informations personnelles
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profil
          </CardTitle>
          <CardDescription>
            Vos informations personnelles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nom complet</Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Adresse e-mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              L'adresse e-mail ne peut pas être modifiée
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
            Langue
          </CardTitle>
          <CardDescription>
            Choisissez votre langue préférée
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
            Gérez vos préférences de notification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Notifications par e-mail</p>
              <p className="text-sm text-muted-foreground">
                Recevoir des notifications par e-mail
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Nouveaux documents</p>
              <p className="text-sm text-muted-foreground">
                Être notifié des nouveaux documents dans votre organisation
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Sécurité
          </CardTitle>
          <CardDescription>
            Paramètres de sécurité de votre compte
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline">
            Changer le mot de passe
          </Button>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading} className="btn-institutional">
          {loading ? t('common.loading') : t('common.save')}
        </Button>
      </div>
    </div>
  );
}