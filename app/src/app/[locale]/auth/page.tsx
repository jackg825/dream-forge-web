'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Box, Loader2, Gift, AlertCircle } from 'lucide-react';

function getPostAuthDestination(): string {
  if (typeof window === 'undefined') return '/dashboard';

  const returnTo = new URLSearchParams(window.location.search).get('returnTo');
  if (
    !returnTo ||
    !returnTo.startsWith('/') ||
    returnTo.startsWith('//') ||
    returnTo.includes('\\')
  ) {
    return '/dashboard';
  }

  return returnTo;
}

export default function AuthPage() {
  const t = useTranslations();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');

  const router = useRouter();
  const {
    user,
    loading,
    error,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    clearError,
  } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !loading && !isSubmitting) {
      router.push(getPostAuthDestination());
    }
  }, [user, loading, isSubmitting, router]);

  // Clear error and form when switching tabs
  useEffect(() => {
    clearError();
    setEmail('');
    setPassword('');
    setDisplayName('');
    setVerificationSent(false);
  }, [activeTab, clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (activeTab === 'signin') {
        await signInWithEmail(email, password);
      } else {
        const success = await signUpWithEmail(email, password, displayName || undefined);
        if (success) setVerificationSent(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Mini header */}
      <header className="flex items-center justify-between p-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
            <Box className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold">Dream Forge</span>
        </Link>
        <ThemeToggle />
      </header>

      {/* Auth content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight mb-2">
              {activeTab === 'signin' ? t('auth.welcomeBack') : t('auth.createYourAccount')}
            </h1>
            <p className="text-muted-foreground">
              {t('auth.transformPhotos')}
            </p>
          </div>

          <Card>
            <CardHeader className="pb-4">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'signin' | 'signup')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">{t('auth.tabSignIn')}</TabsTrigger>
                  <TabsTrigger value="signup">{t('auth.tabSignUp')}</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>

            <CardContent>
              {/* Error Display */}
              {error && (
                <div
                  className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-start gap-2"
                  role="alert"
                >
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {verificationSent && (
                <div
                  className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-md"
                  role="status"
                >
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {t('auth.verificationSent')}
                  </p>
                </div>
              )}

              {/* Email/Password Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {activeTab === 'signup' && (
                  <div className="space-y-2">
                    <Label htmlFor="displayName">{t('auth.nameOptional')}</Label>
                    <Input
                      id="displayName"
                      type="text"
                      autoComplete="name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={t('auth.namePlaceholder')}
                      disabled={isSubmitting}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">{t('auth.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('auth.emailPlaceholder')}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">{t('auth.password')}</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={activeTab === 'signin' ? 'current-password' : 'new-password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.passwordPlaceholder')}
                    disabled={isSubmitting}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('common.pleaseWait')}
                    </>
                  ) : activeTab === 'signin' ? (
                    t('common.signIn')
                  ) : (
                    t('common.createAccount')
                  )}
                </Button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <Separator />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="px-2 bg-card text-muted-foreground text-sm">
                    {t('auth.orContinueWith')}
                  </span>
                </div>
              </div>

              {/* Google Sign In */}
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {isSubmitting ? t('common.pleaseWait') : t('auth.continueWithGoogle')}
              </Button>
            </CardContent>

            {/* Free credits notice for signup */}
            {activeTab === 'signup' && (
              <CardFooter className="flex justify-center border-t pt-4">
                <Badge variant="secondary" className="gap-1">
                  <Gift className="h-3 w-3" />
                  {t('auth.newUsersReceive')}
                </Badge>
              </CardFooter>
            )}
          </Card>

          {/* Back to home link */}
          <p className="text-center mt-6 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              {t('auth.backToHome')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
