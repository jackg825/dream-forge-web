'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

import { useAuth } from '@/hooks/useAuth';
import { useSession } from '@/hooks/useSession';
import { useViewActions } from '@/hooks/useViews';

/**
 * Step 2: AI View Generation
 *
 * This page initiates and shows progress while Gemini generates view images.
 * Auto-redirects to Step 3 (preview) when complete.
 *
 * Flow:
 * 1. User arrives from Step 1 (upload)
 * 2. Page automatically starts view generation
 * 3. Shows progress with animated states
 * 4. When done, redirects to preview page
 */
export default function ViewsPage() {
  const t = useTranslations('create');
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const { user } = useAuth();
  const { session, loading: sessionLoading } = useSession(sessionId);
  const { generateViews, loading: generating, error } = useViewActions();

  const [generationStarted, setGenerationStarted] = useState(false);
  const [progress, setProgress] = useState(0);

  // Start view generation when page loads
  const startGeneration = useCallback(async () => {
    if (!sessionId || generationStarted || generating) return;

    setGenerationStarted(true);
    setProgress(10);

    // Simulate progress while generating
    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 5, 85));
    }, 2000);

    const result = await generateViews(sessionId);

    clearInterval(progressInterval);

    if (result?.success) {
      setProgress(100);
      // Redirect to preview page after short delay
      setTimeout(() => {
        router.push(`./preview?sessionId=${sessionId}`);
      }, 1000);
    }
  }, [sessionId, generationStarted, generating, generateViews, router]);

  // Auto-start generation when session is ready
  useEffect(() => {
    if (
      session &&
      session.status === 'draft' &&
      session.originalImage &&
      session.selectedAngles.length > 0 &&
      !generationStarted
    ) {
      startGeneration();
    }
  }, [session, generationStarted, startGeneration]);

  // If session is already in views-ready state, redirect to preview
  useEffect(() => {
    if (session?.status === 'views-ready') {
      router.push(`./preview?sessionId=${sessionId}`);
    }
  }, [session?.status, sessionId, router]);

  // Handle retry
  const handleRetry = () => {
    setGenerationStarted(false);
    setProgress(0);
  };

  // Loading state
  if (!sessionId) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <AlertCircle className="h-5 w-5" />
              <span>{t('views.noSession')}</span>
            </div>
            <div className="mt-4 text-center">
              <Button onClick={() => router.push('./upload')}>
                {t('views.startOver')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sessionLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{t('views.loadingSession')}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t('views.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('views.description')}</p>
      </div>

      {/* Generation Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {error ? (
              <>
                <AlertCircle className="h-5 w-5 text-destructive" />
                {t('views.generationFailed')}
              </>
            ) : progress === 100 ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                {t('views.generationComplete')}
              </>
            ) : (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {t('views.generatingViews')}
              </>
            )}
          </CardTitle>
          <CardDescription>
            {error
              ? t('views.errorDescription')
              : progress === 100
                ? t('views.redirecting')
                : t('views.pleaseWait')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress bar */}
          <Progress value={progress} className="h-2" />

          {/* Status text */}
          <div className="text-sm text-muted-foreground text-center">
            {error ? (
              <span className="text-destructive">{error}</span>
            ) : progress < 30 ? (
              t('views.statusPreparing')
            ) : progress < 60 ? (
              t('views.statusGenerating')
            ) : progress < 90 ? (
              t('views.statusProcessing')
            ) : progress === 100 ? (
              t('views.statusComplete')
            ) : (
              t('views.statusFinalizing')
            )}
          </div>

          {/* Selected angles info */}
          {session?.selectedAngles && session.selectedAngles.length > 0 && (
            <div className="text-sm text-center text-muted-foreground">
              {t('views.anglesCount', { count: session.selectedAngles.length })}:{' '}
              {session.selectedAngles.join(', ')}
            </div>
          )}

          {/* Error actions */}
          {error && (
            <div className="flex justify-center gap-2 pt-4">
              <Button variant="outline" onClick={() => router.push('./upload')}>
                {t('views.backToUpload')}
              </Button>
              <Button onClick={handleRetry}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t('views.retry')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips while waiting */}
      {!error && progress < 100 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('views.tips.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• {t('views.tips.tip1')}</li>
              <li>• {t('views.tips.tip2')}</li>
              <li>• {t('views.tips.tip3')}</li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
