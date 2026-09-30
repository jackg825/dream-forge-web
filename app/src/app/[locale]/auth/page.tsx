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
      <header className="store-container flex h-20 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background">
            <Box className="h-5 w-5" strokeWidth={1.6} />
          </div>
          <span className="text-base font-semibold tracking-tight">DreamForge</span>
        </Link>
        <ThemeToggle />
      </header>

      {/* Auth content */}
      <div className="flex flex-1 items-center justify-center px-5 pb-16 pt-8 sm:py-16">
        <div className="w-full max-w-[460px]">
          {/* Header */}
          <div className="mb-9 text-center">
            <h1 className="mb-4 text-[36px] font-semibold leading-[1.1] tracking-[-0.04em] sm:text-[44px]">
              {activeTab === 'signin' ? t('auth.welcomeBack') : t('auth.createYourAccount')}
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground">
              {t('auth.transformPhotos')}
            </p>
          </div>

          <Card className="gap-5 px-2 py-7 sm:px-4 sm:py-8">
            <CardHeader className="pb-0">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'signin' | 'signup')}>
                <TabsList className="grid h-11 w-full grid-cols-2">
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
              <form onSubmit={handleSubmit} className="space-y-5">
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
                  className="h-12 w-full"
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
                className="h-12 w-full"
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {isSubmitting ? t('common.pleaseWait') : t('auth.continueWithGoogle')}
              </Button>
            </CardContent>

            {/* Free credits notice for signup */}
            {activeTab === 'signup' && (
              <CardFooter className="flex justify-center border-t pt-5">
                <Badge variant="secondary" className="gap-1">
                  <Gift className="h-3 w-3" />
                  {t('auth.newUsersReceive')}
                </Badge>
              </CardFooter>
            )}
          </Card>

          {/* Back to home link */}
          <p className="mt-8 text-center text-sm text-muted-foreground">
            <Link href="/" className="text-primary transition-colors hover:underline">
              {t('auth.backToHome')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
