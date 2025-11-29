'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ViewsGallery } from '@/components/create/ViewsGallery';

import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useSession } from '@/hooks/useSession';
import { useViewActions } from '@/hooks/useViews';
import { uploadSessionView, validateImage } from '@/lib/storage';

import type { ViewAngle } from '@/types';
import { SESSION_CREDIT_COSTS } from '@/types';

/**
 * Step 3: Preview and Edit Views
 *
 * User actions:
 * - Preview all generated view images
 * - Replace any AI-generated view with own upload (free)
 * - Download generated views
 * - Regenerate specific views (charges 1 credit each)
 * - Proceed to Step 4 (3D generation) - charges 1 credit
 */
export default function PreviewPage() {
  const t = useTranslations('create');
  const tUpload = useTranslations('upload');
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const { user } = useAuth();
  const { credits } = useCredits(user?.uid);
  const { session, loading: sessionLoading } = useSession(sessionId);
  const { regenerateView, uploadCustomView, loading, error } = useViewActions();

  const [regeneratingAngle, setRegeneratingAngle] = useState<ViewAngle | null>(null);
  const [uploadingAngle, setUploadingAngle] = useState<ViewAngle | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Handle regenerate view
  const handleRegenerate = useCallback(
    async (angle: ViewAngle) => {
      if (!sessionId || !user) return;

      // Check credits
      if (credits < SESSION_CREDIT_COSTS.VIEW_GENERATION) {
        setLocalError(tUpload('errors.insufficientCredits'));
        return;
      }

      setRegeneratingAngle(angle);
      setLocalError(null);

      try {
        const result = await regenerateView(sessionId, angle);
        if (!result?.success) {
          setLocalError(`Failed to regenerate ${angle} view`);
        }
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Regeneration failed');
      } finally {
        setRegeneratingAngle(null);
      }
    },
    [sessionId, user, credits, regenerateView, tUpload]
  );

  // Handle upload custom view
  const handleUploadCustom = useCallback(
    async (angle: ViewAngle, file: File) => {
      if (!sessionId || !user) return;

      setUploadingAngle(angle);
      setLocalError(null);

      try {
        // Validate image
        const validation = await validateImage(file);
        if (!validation.valid) {
          setLocalError(validation.error || 'Invalid image');
          return;
        }

        // Upload to storage with session-specific path
        const uploadResult = await uploadSessionView(file, user.uid, sessionId, angle);

        // Update session with custom view
        const result = await uploadCustomView(
          sessionId,
          angle,
          uploadResult.downloadUrl,
          uploadResult.storagePath
        );

        if (!result?.success) {
          setLocalError(`Failed to upload ${angle} view`);
        }
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploadingAngle(null);
      }
    },
    [sessionId, user, uploadCustomView]
  );

  // Handle proceed to 3D generation
  const handleProceed = () => {
    if (!sessionId) return;
    router.push(`./generate?sessionId=${sessionId}`);
  };

  // Handle go back to upload
  const handleBack = () => {
    if (!sessionId) return;
    router.push(`./upload?sessionId=${sessionId}`);
  };

  // Loading state
  if (!sessionId) {
    return (
      <div className="max-w-6xl mx-auto">
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
      <div className="max-w-6xl mx-auto">
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

  // Check session status
  if (session?.status === 'draft' || session?.status === 'generating-views') {
    router.push(`./views?sessionId=${sessionId}`);
    return null;
  }

  const displayError = localError || error;
  const isProcessing = regeneratingAngle !== null || uploadingAngle !== null || loading;
  const canProceed = credits >= SESSION_CREDIT_COSTS.MODEL_GENERATION && !isProcessing;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t('preview.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('preview.description')}</p>
      </div>

      {/* Error display */}
      {displayError && (
        <Card className="border-destructive">
          <CardContent className="pt-4">
            <p className="text-sm text-destructive">{displayError}</p>
          </CardContent>
        </Card>
      )}

      {/* Views Gallery */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('preview.title')}</CardTitle>
          <CardDescription>
            {t('preview.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {session && (
            <ViewsGallery
              views={session.views}
              selectedAngles={session.selectedAngles}
              onRegenerate={handleRegenerate}
              onUploadCustom={handleUploadCustom}
              regeneratingAngle={regeneratingAngle}
              uploadingAngle={uploadingAngle}
              disabled={isProcessing}
            />
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleBack} disabled={isProcessing}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('preview.backToUpload') || 'Back'}
        </Button>

        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            <span>{t('preview.modelCost')}</span>
            <span className="ml-2">• {tUpload('creditsRemaining')}: {credits}</span>
          </div>
          <Button size="lg" onClick={handleProceed} disabled={!canProceed}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('views.generating')}
              </>
            ) : (
              <>
                {t('preview.proceedButton')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
