'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

import { useAuth } from '@/hooks/useAuth';
import { useSession } from '@/hooks/useSession';
import { useModelActions } from '@/hooks/useModel';

import type { ViewAngle } from '@/types';

// View angles in display order
const VIEW_ORDER: ViewAngle[] = ['front', 'back', 'left', 'right', 'top'];

/**
 * Step 4: 3D Model Generation
 *
 * This page initiates and shows progress while Rodin generates the 3D model.
 * Auto-redirects to Step 5 (result) when complete.
 *
 * Flow:
 * 1. User arrives from Step 3 (preview)
 * 2. Page automatically starts model generation
 * 3. Shows progress with animated states
 * 4. Polls status periodically
 * 5. When done, redirects to result page
 */
export default function GeneratePage() {
  const t = useTranslations('create');
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const { user } = useAuth();
  const { session, loading: sessionLoading } = useSession(sessionId);
  const { startModelGeneration, checkModelStatus, loading, error } = useModelActions();

  const [generationStarted, setGenerationStarted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Start model generation when page loads
  const startGeneration = useCallback(async () => {
    if (!sessionId || generationStarted || loading) return;

    setGenerationStarted(true);
    setProgress(10);

    const result = await startModelGeneration(sessionId);

    if (!result?.success) {
      setLocalError('Failed to start model generation');
      return;
    }

    // Start polling for status
    setProgress(20);
    pollingRef.current = setInterval(async () => {
      const status = await checkModelStatus(sessionId);

      if (status?.status === 'completed') {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setProgress(100);
        // Redirect to result page after short delay
        setTimeout(() => {
          router.push(`./result?sessionId=${sessionId}`);
        }, 1500);
      } else if (status?.status === 'failed') {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setLocalError(status.error || 'Model generation failed');
      } else {
        // Update progress (simulate progress since Rodin doesn't provide percentage)
        setProgress((prev) => Math.min(prev + 5, 90));
      }
    }, 5000); // Poll every 5 seconds
  }, [sessionId, generationStarted, loading, startModelGeneration, checkModelStatus, router]);

  // Auto-start generation when session is ready
  useEffect(() => {
    if (
      session &&
      session.status === 'views-ready' &&
      !generationStarted
    ) {
      startGeneration();
    }
  }, [session, generationStarted, startGeneration]);

  // If session is already generating or completed, handle appropriately
  useEffect(() => {
    if (session?.status === 'completed') {
      router.push(`./result?sessionId=${sessionId}`);
    } else if (session?.status === 'generating-model' && !generationStarted) {
      // Resume polling if generation already in progress
      setGenerationStarted(true);
      setProgress(50);
      pollingRef.current = setInterval(async () => {
        const status = await checkModelStatus(sessionId!);

        if (status?.status === 'completed') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setProgress(100);
          setTimeout(() => {
            router.push(`./result?sessionId=${sessionId}`);
          }, 1500);
        } else if (status?.status === 'failed') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setLocalError(status.error || 'Model generation failed');
        }
      }, 5000);
    }
  }, [session?.status, sessionId, generationStarted, checkModelStatus, router]);

  // Handle retry
  const handleRetry = () => {
    setGenerationStarted(false);
    setProgress(0);
    setLocalError(null);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
  };

  // Get available views for display
  const getAvailableViews = () => {
    if (!session?.views) return [];
    return VIEW_ORDER.filter((angle) => session.views[angle]?.url);
  };

  const displayError = localError || error;

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

  const availableViews = getAvailableViews();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t('generate.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('generate.description')}</p>
      </div>

      {/* Generation Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {displayError ? (
              <>
                <AlertCircle className="h-5 w-5 text-destructive" />
                {t('views.generationFailed')}
              </>
            ) : progress === 100 ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                {t('generate.complete') || 'Generation Complete!'}
              </>
            ) : (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {t('generate.generating') || 'Generating 3D Model...'}
              </>
            )}
          </CardTitle>
          <CardDescription>
            {displayError
              ? t('generate.errorDescription') || 'An error occurred during generation'
              : progress === 100
                ? t('generate.redirecting') || 'Redirecting to preview...'
                : t('generate.estimatedTime')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress bar */}
          <Progress value={progress} className="h-2" />

          {/* Status text */}
          <div className="text-sm text-muted-foreground text-center">
            {displayError ? (
              <span className="text-destructive">{displayError}</span>
            ) : progress < 30 ? (
              t('generate.statusPreparing') || 'Preparing images...'
            ) : progress < 60 ? (
              t('generate.statusGenerating') || 'Generating 3D model...'
            ) : progress < 90 ? (
              t('generate.statusProcessing') || 'Processing model...'
            ) : progress === 100 ? (
              t('generate.statusComplete') || 'Generation complete!'
            ) : (
              t('generate.statusFinalizing') || 'Finalizing...'
            )}
          </div>

          {/* Error actions */}
          {displayError && (
            <div className="flex justify-center gap-2 pt-4">
              <Button variant="outline" onClick={() => router.push(`./preview?sessionId=${sessionId}`)}>
                {t('generate.backToPreview') || 'Back to Preview'}
              </Button>
              <Button onClick={handleRetry}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t('views.retry')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Views being used */}
      {availableViews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('generate.usedViews')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {availableViews.map((angle) => (
                <div
                  key={angle}
                  className="relative w-20 h-20 flex-shrink-0 rounded-md overflow-hidden border"
                >
                  <Image
                    src={session?.views[angle]?.url || ''}
                    alt={`${angle} view`}
                    fill
                    className="object-cover"
                  />
                  <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-0.5">
                    {angle}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
