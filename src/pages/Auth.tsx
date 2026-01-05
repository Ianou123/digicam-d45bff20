import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { FileText, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Adresse e-mail invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  confirmPassword: z.string(),
  inviteCode: z.string().optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    inviteCode: '',
  });

  const { user, signIn, signUp } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      if (isLogin) {
        const result = loginSchema.safeParse(formData);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach(err => {
            if (err.path[0]) {
              fieldErrors[err.path[0] as string] = err.message;
            }
          });
          setErrors(fieldErrors);
          setLoading(false);
          return;
        }

        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          toast.error(t('auth.invalidCredentials'));
        }
      } else {
        const result = signupSchema.safeParse(formData);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach(err => {
            if (err.path[0]) {
              fieldErrors[err.path[0] as string] = err.message;
            }
          });
          setErrors(fieldErrors);
          setLoading(false);
          return;
        }

        const { error } = await signUp(formData.email, formData.password, formData.fullName, formData.inviteCode);
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error(t('auth.emailInUse'));
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success(language === 'fr' ? 'Compte créé avec succès' : 'Account created successfully');
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link to="/" className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <FileText className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="font-serif text-2xl font-semibold text-foreground">
            DigiCam
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant={language === 'fr' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setLanguage('fr')}
          >
            FR
          </Button>
          <Button
            variant={language === 'en' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setLanguage('en')}
          >
            EN
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-medium animate-slide-up">
          <CardHeader className="text-center space-y-1">
            <CardTitle className="text-2xl font-serif">
              {isLogin ? t('auth.welcomeBack') : t('auth.createAccount')}
            </CardTitle>
            <CardDescription>
              {isLogin 
                ? 'Connectez-vous pour accéder à vos documents'
                : 'Créez votre compte pour commencer'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t('auth.fullName')}</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="Jean Dupont"
                    className={errors.fullName ? 'border-destructive' : ''}
                  />
                  {errors.fullName && (
                    <p className="text-xs text-destructive">{errors.fullName}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="nom@exemple.fr"
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="••••••••"
                    className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password}</p>
                )}
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="••••••••"
                    className={errors.confirmPassword ? 'border-destructive' : ''}
                  />
                  {errors.confirmPassword && (
                    <p className="text-xs text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>
              )}

              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="inviteCode">{t('auth.inviteCode')}</Label>
                  <Input
                    id="inviteCode"
                    value={formData.inviteCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, inviteCode: e.target.value.toUpperCase() }))}
                    placeholder="ABC123"
                    className="font-mono uppercase"
                  />
                  <p className="text-xs text-muted-foreground">
                    {language === 'fr' 
                      ? 'Laissez vide si vous êtes administrateur DigiCam'
                      : 'Leave empty if you are a DigiCam administrator'}
                  </p>
                </div>
              )}

              <Button type="submit" className="w-full btn-institutional" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('common.loading')}
                  </>
                ) : (
                  isLogin ? t('auth.login') : t('auth.signup')
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-sm text-muted-foreground">
              {isLogin ? t('auth.noAccount') : t('auth.hasAccount')}{' '}
              <button
                type="button"
                className="text-primary font-medium hover:underline"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                }}
              >
                {isLogin ? t('auth.signupHere') : t('auth.loginHere')}
              </button>
            </p>
          </CardFooter>
        </Card>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-sm text-muted-foreground border-t border-border">
        © {new Date().getFullYear()} DigiCam. Tous droits réservés.
      </footer>
    </div>
  );
}