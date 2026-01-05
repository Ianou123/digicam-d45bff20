import { ShieldX, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

export function DeactivatedUserPage() {
  const { signOut } = useAuth();
  const { t, language } = useLanguage();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-6 text-center">
          <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          
          <h1 className="text-2xl font-serif font-semibold mb-2">
            {t('deactivation.title')}
          </h1>
          
          <p className="text-muted-foreground mb-6">
            {t('deactivation.message')}
          </p>
          
          <p className="text-sm text-muted-foreground mb-8">
            {t('deactivation.contactAdmin')}
          </p>
          
          <Button onClick={handleSignOut} variant="outline" className="w-full">
            <LogOut className="h-4 w-4 mr-2" />
            {t('deactivation.signOut')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
