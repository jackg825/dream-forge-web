'use client';

import { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ViewerToolbar } from '@/components/viewer/ViewerToolbar';
import { DownloadPanel } from '@/components/viewer/DownloadPanel';
import { LoadingSpinner } from '@/components/viewer/LoadingSpinner';
import { useJob, useJobStatusPolling } from '@/hooks/useJobs';
import { Link, useRouter } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type { JobStatus, ViewMode } from '@/types';
import type { ModelViewerRef } from '@/components/viewer/ModelViewer';

// Dynamic import for ModelViewer to avoid SSR issues with Three.js
const ModelViewer = dynamic(
  () => import('@/components/viewer/ModelViewer').then((mod) => mod.ModelViewer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-gray-900 rounded-lg flex items-center justify-center">
        <LoadingSpinner message="" />
      </div>
    ),
  }
);

function ViewerContentInner() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = searchParams.get('id');

  const { job, loading: jobLoading, error: jobError } = useJob(jobId || '');

  // Viewer state
  const [backgroundColor, setBackgroundColor] = useState('#1f2937');
  const [viewMode, setViewMode] = useState<ViewMode>('clay');
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Refs
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const modelViewerRef = useRef<ModelViewerRef>(null);

  // Check if GLB is available for textured mode
  const hasTextures = Boolean(
    job?.outputModelUrl?.includes('.glb') ||
    job?.downloadFiles?.some((f) => f.name.endsWith('.glb') || f.name.endsWith('.gltf'))
  );

  // Set default view mode based on printer type when job loads
  useEffect(() => {
    if (job?.settings.printerType) {
      const defaultMode: ViewMode =
        job.settings.printerType === 'fdm' ? 'clay' : hasTextures ? 'textured' : 'clay';
      setViewMode(defaultMode);
    }
  }, [job?.settings.printerType, hasTextures]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handlers
  const handleScreenshot = useCallback(() => {
    const dataUrl = modelViewerRef.current?.takeScreenshot();
    if (dataUrl) {
      const link = document.createElement('a');
      link.download = `model-screenshot-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    }
  }, []);

  const handleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      viewerContainerRef.current?.requestFullscreen();
    }
  }, []);

  const handleReset = useCallback(() => {
    modelViewerRef.current?.resetCamera();
  }, []);

  // Poll for status if job is not yet completed or failed
  const isProcessing = job?.status && !['completed', 'failed'].includes(job.status);
  const { status: polledStatus } = useJobStatusPolling(jobId || '', isProcessing || false);

  // Use polled status if available, otherwise fall back to job status
  const currentStatus = (polledStatus?.status || job?.status) as JobStatus | undefined;

  // Get translated status message
  const getStatusMessage = (status: JobStatus): string => {
    const statusMap: Record<JobStatus, string> = {
      'pending': t('status.pending'),
      'generating-views': t('status.generatingViews'),
      'generating-model': t('status.generatingModel'),
      'downloading-model': t('status.downloadingModel'),
      'uploading-storage': t('status.uploadingStorage'),
      'completed': t('status.completed'),
      'failed': t('status.failed'),
    };
    return statusMap[status] || status;
  };

  // Redirect if no jobId
  useEffect(() => {
    if (!jobId) {
      router.replace('/dashboard');
    }
  }, [jobId, router]);

  // No jobId state
  if (!jobId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner message={t('viewer.redirecting')} />
      </div>
    );
  }

  // Loading state
  if (jobLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner message={t('viewer.loadingJob')} />
      </div>
    );
  }

  // Error state
  if (jobError || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h1 className="text-xl font-bold mb-2">{t('viewer.jobNotFound')}</h1>
            <p className="text-muted-foreground mb-6">
              {jobError || t('viewer.jobNotFoundDescription')}
            </p>
            <Button asChild>
              <Link href="/dashboard">{t('viewer.backToDashboard')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header - Dark themed for viewer */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-gray-900/80 backdrop-blur-lg">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="text-white/60 hover:text-white hover:bg-white/10"
              >
                <Link href="/dashboard">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-lg font-medium text-white">
                  {t('viewer.title')}
                </h1>
                <p className="text-xs text-white/50 font-mono">
                  {job.settings.quality.toUpperCase()} • {job.settings.format.toUpperCase()}
                </p>
              </div>
            </div>

            {/* Status badge */}
            <StatusBadge status={job.status} />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Processing state */}
        {isProcessing && currentStatus && (
          <Card className="bg-gray-900/50 border-white/10">
            <CardContent className="py-8">
              <div className="text-center">
                <ProgressSteps currentStatus={currentStatus} />

                <LoadingSpinner
                  message={getStatusMessage(currentStatus)}
                />

                <div className="mt-6 max-w-md mx-auto">
                  <div className="flex items-center justify-center gap-3 text-sm text-white/50">
                    <img
                      src={job.inputImageUrl}
                      alt="Input"
                      className="w-12 h-12 rounded-lg object-cover ring-1 ring-white/10"
                    />
                    <span className="font-mono text-xs">
                      {job.settings.quality === 'fine'
                        ? t('viewer.estimatedTime.fine')
                        : job.settings.quality === 'standard'
                        ? t('viewer.estimatedTime.standard')
                        : t('viewer.estimatedTime.draft')}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Failed state */}
        {job.status === 'failed' && (
          <Card className="bg-gray-900/50 border-destructive/30">
            <CardContent className="py-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/20 flex items-center justify-center">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                {t('viewer.generationFailed')}
              </h2>
              <p className="text-white/60 mb-6">
                {job.error || t('viewer.errorOccurred')}
              </p>
              <p className="text-sm text-white/40 mb-4">
                {t('viewer.creditRefunded')}
              </p>
              <Button asChild>
                <Link href="/" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  {t('viewer.tryAgain')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Completed state with viewer */}
        {job.status === 'completed' && job.outputModelUrl && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Viewer */}
            <div className="lg:col-span-3">
              <div
                ref={viewerContainerRef}
                className="relative bg-gray-900 rounded-2xl overflow-hidden border border-white/10"
                style={{ height: isFullscreen ? '100vh' : '600px' }}
              >
                <ModelViewer
                  ref={modelViewerRef}
                  modelUrl={job.outputModelUrl}
                  downloadFiles={job.downloadFiles}
                  viewMode={viewMode}
                  backgroundColor={backgroundColor}
                  autoOrient={true}
                  showGrid={showGrid}
                  showAxes={showAxes}
                  autoRotate={autoRotate}
                />

                {/* Floating Toolbar */}
                <ViewerToolbar
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  hasTextures={hasTextures}
                  backgroundColor={backgroundColor}
                  onBackgroundChange={setBackgroundColor}
                  showGrid={showGrid}
                  onShowGridChange={setShowGrid}
                  showAxes={showAxes}
                  onShowAxesChange={setShowAxes}
                  autoRotate={autoRotate}
                  onAutoRotateChange={setAutoRotate}
                  onScreenshot={handleScreenshot}
                  onFullscreen={handleFullscreen}
                  isFullscreen={isFullscreen}
                  onReset={handleReset}
                  portalContainer={viewerContainerRef.current}
                />
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <DownloadPanel
                modelUrl={job.outputModelUrl}
                downloadFiles={job.downloadFiles}
                jobId={job.id}
                currentFormat={job.settings.format}
              />

              {/* Input image */}
              <Card className="bg-gray-900/50 border-white/10">
                <CardContent className="pt-4">
                  <h3 className="font-medium text-white/90 mb-3 text-sm">{t('viewer.sourceImage')}</h3>
                  <img
                    src={job.inputImageUrl}
                    alt="Source"
                    className="w-full rounded-lg ring-1 ring-white/10"
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Progress steps component
function ProgressSteps({ currentStatus }: { currentStatus: JobStatus }) {
  const t = useTranslations();

  const PROGRESS_STEPS: { status: JobStatus; label: string }[] = [
    { status: 'pending', label: t('viewer.progress.queue') },
    { status: 'generating-views', label: t('viewer.progress.views') },
    { status: 'generating-model', label: t('viewer.progress.model') },
    { status: 'downloading-model', label: t('viewer.progress.download') },
    { status: 'uploading-storage', label: t('viewer.progress.done') },
  ];

  const currentIndex = PROGRESS_STEPS.findIndex((s) => s.status === currentStatus);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-center">
        {PROGRESS_STEPS.map((step, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;

          return (
            <div key={step.status} className="flex items-center">
              {/* Step circle */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground ring-4 ring-primary/30'
                    : isCompleted
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>

              {/* Connector line */}
              {index < PROGRESS_STEPS.length - 1 && (
                <div
                  className={`w-8 h-0.5 mx-1 transition-colors ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-700'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step labels */}
      <div className="flex items-center justify-center mt-2">
        {PROGRESS_STEPS.map((step, index) => {
          const isActive = index === currentIndex;

          return (
            <div
              key={step.status}
              className={`text-xs text-center font-mono whitespace-nowrap ${
                isActive ? 'text-primary font-medium' : 'text-gray-500'
              }`}
              style={{ width: '48px' }}
            >
              {step.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations();

  const getConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          icon: CheckCircle2,
          className: 'bg-green-500/20 text-green-300 border-green-500/30',
          label: t('status.badge.completed'),
        };
      case 'failed':
        return {
          icon: XCircle,
          className: 'bg-red-500/20 text-red-300 border-red-500/30',
          label: t('status.badge.failed'),
        };
      case 'pending':
        return {
          icon: Clock,
          className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
          label: t('status.badge.pending'),
        };
      default:
        return {
          icon: Loader2,
          className: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
          label: t('status.badge.processing'),
        };
    }
  };

  const config = getConfig(status);
  const Icon = config.icon;
  const isProcessing = !['completed', 'failed', 'pending'].includes(status);

  return (
    <Badge variant="outline" className={config.className}>
      <Icon className={`mr-1 h-3 w-3 ${isProcessing ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  );
}

function ViewerContent() {
  const t = useTranslations();

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-950">
          <LoadingSpinner message={t('common.loading')} />
        </div>
      }
    >
      <ViewerContentInner />
    </Suspense>
  );
}

export default function ViewerPage() {
  return (
    <AuthGuard>
      <ViewerContent />
    </AuthGuard>
  );
}
