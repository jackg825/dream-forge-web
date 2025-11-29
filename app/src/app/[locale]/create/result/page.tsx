'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Download, ArrowLeft, Plus, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import dynamic from 'next/dynamic';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { useAuth } from '@/hooks/useAuth';
import { useSession } from '@/hooks/useSession';

import type { ViewMode } from '@/types';

// Dynamically import ModelViewer to avoid SSR issues with Three.js
const ModelViewer = dynamic(
  () => import('@/components/viewer/ModelViewer').then((mod) => mod.ModelViewer),
  { ssr: false, loading: () => <div className="w-full h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div> }
);

/**
 * Step 5: Model Preview and Download
 *
 * User actions:
 * - Preview 3D model (Clay/Textured/Wireframe)
 * - Download in STL format
 * - Go back to modify views and regenerate
 * - Start a new session
 */
export default function ResultPage() {
  const t = useTranslations('create');
  const tViewer = useTranslations('viewer');
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const { user } = useAuth();
  const { session, loading: sessionLoading } = useSession(sessionId);

  const [viewMode, setViewMode] = useState<ViewMode>('clay');
  const [isDownloading, setIsDownloading] = useState(false);

  // Handle download
  const handleDownload = async () => {
    if (!session?.outputModelUrl) return;

    setIsDownloading(true);
    try {
      const response = await fetch(session.outputModelUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `model-${sessionId}.stl`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle go back to modify views
  const handleModifyViews = () => {
    if (!sessionId) return;
    router.push(`./preview?sessionId=${sessionId}`);
  };

  // Handle start new session
  const handleNewSession = () => {
    router.push('./upload');
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

  // Check if model is available
  if (!session?.outputModelUrl) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <AlertCircle className="h-8 w-8" />
              <span>{t('result.noModel') || 'Model not yet available'}</span>
              <Button onClick={() => router.push(`./generate?sessionId=${sessionId}`)}>
                {t('result.goToGenerate') || 'Go to Generation'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('result.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('result.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleModifyViews}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {t('result.modifyViews')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleNewSession}>
            <Plus className="mr-2 h-4 w-4" />
            {t('result.newSession')}
          </Button>
        </div>
      </div>

      {/* 3D Model Viewer */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{t('result.modelPreview') || '3D Model Preview'}</CardTitle>
            <div className="flex gap-1">
              {(['clay', 'wireframe'] as ViewMode[]).map((mode) => (
                <Button
                  key={mode}
                  variant={viewMode === mode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode(mode)}
                >
                  {tViewer(`viewMode.${mode}`) || mode}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full aspect-[4/3] bg-muted">
            <ModelViewer
              modelUrl={session.outputModelUrl}
              viewMode={viewMode}
              showGrid={true}
              showAxes={true}
              autoOrient={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('result.downloadModel')}</CardTitle>
          <CardDescription>
            {t('result.downloadDescription') || 'Download your 3D model for printing or editing'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              <span>Format: STL</span>
              {session.settings && (
                <>
                  <span className="mx-2">•</span>
                  <span>Quality: {session.settings.quality}</span>
                </>
              )}
            </div>
            <Button onClick={handleDownload} disabled={isDownloading}>
              {isDownloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  {t('result.downloadModel')}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Session info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">{t('result.sessionInfo') || 'Session Info'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Status:</span>
              <span className="ml-2 font-medium">{session.status}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Views used:</span>
              <span className="ml-2 font-medium">{Object.keys(session.views || {}).length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Credits used:</span>
              <span className="ml-2 font-medium">{session.totalCreditsUsed}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Created:</span>
              <span className="ml-2 font-medium">
                {session.createdAt ? new Date(session.createdAt).toLocaleDateString() : '-'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
