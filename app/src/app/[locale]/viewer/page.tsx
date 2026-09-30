'use client';

import { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { UnifiedViewerToolbar } from '@/components/viewer/UnifiedViewerToolbar';
import { DownloadPanel } from '@/components/viewer/DownloadPanel';
import { useLighting } from '@/hooks/useLighting';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useARLaunch } from '@/hooks/useARLaunch';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/viewer/LoadingSpinner';
import { useJob, useJobStatusPolling } from '@/hooks/useJobs';
import { Link, useRouter } from '@/i18n/navigation';
import { deferStateUpdate } from '@/lib/defer-state-update';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FillImage } from '@/components/ui/fill-image';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  RefreshCw,
  PanelRight,
  Minimize,
} from 'lucide-react';
import type { JobStatus, ViewMode } from '@/types';
import type { ModelViewerRef } from '@/components/viewer/ModelViewer';
import { ViewerSidePanel } from '@/components/viewer/ViewerSidePanel';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

// Dynamic import for ModelViewer to avoid SSR issues with Three.js
const ModelViewer = dynamic(
  () => import('@/components/viewer/ModelViewer').then((mod) => mod.ModelViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-3xl bg-card">
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

  // Lighting state
  const {
    lighting,
    updateSpotlightPosition,
    updateSpotlightIntensity,
    updateSpotlightColor,
    updateAmbientIntensity,
    resetLighting,
  } = useLighting();

  // Side panel state
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Persist panel state in localStorage
  useEffect(() => {
    const saved = localStorage.getItem('viewerPanelOpen');
    if (saved !== null) {
      return deferStateUpdate(() => setIsPanelOpen(JSON.parse(saved)));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('viewerPanelOpen', JSON.stringify(isPanelOpen));
  }, [isPanelOpen]);

  // Refs
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const modelViewerRef = useRef<ModelViewerRef>(null);
  const [viewerContainer, setViewerContainer] = useState<HTMLDivElement | null>(null);
  const handleViewerContainerRef = useCallback((node: HTMLDivElement | null) => {
    viewerContainerRef.current = node;
    setViewerContainer(node);
  }, []);

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
      return deferStateUpdate(() => setViewMode(defaultMode));
    }
  }, [job?.settings.printerType, hasTextures]);

  // Fullscreen hook with iOS fallback
  const {
    isFullscreen,
    isPseudoFullscreen,
    toggleFullscreen,
  } = useFullscreen(viewerContainerRef);

  // AR hook for mobile preview
  const {
    isARSupported,
    isLoading: arLoading,
    launchAR,
  } = useARLaunch({
    glbUrl: job?.outputModelUrl || '',
    // USDZ URL would be added here when backend conversion is ready
    // usdzUrl: job?.outputModelUsdzUrl,
  });

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

  const handleFullscreen = toggleFullscreen;

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
      <div className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
        <LoadingSpinner message={t('viewer.redirecting')} />
      </div>
    );
  }

  // Loading state
  if (jobLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
        <LoadingSpinner message={t('viewer.loadingJob')} />
      </div>
    );
  }

  // Error state
  if (jobError || !job) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
        <Card className="w-full max-w-lg rounded-[28px] border-0 px-3 py-10 shadow-sm">
          <CardContent className="px-7 text-center">
            <XCircle className="mx-auto mb-6 h-10 w-10 text-destructive" />
            <h1 className="mb-4 text-[28px] font-semibold tracking-tight">{t('viewer.jobNotFound')}</h1>
            <p className="mb-8 text-[15px] leading-relaxed text-muted-foreground">
              {jobError || t('viewer.jobNotFoundDescription')}
            </p>
            <Button asChild className="h-11 rounded-full px-6">
              <Link href="/dashboard">{t('viewer.backToDashboard')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      {/* Header - Dark themed for viewer */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-xl">
        <div className="w-full px-5 py-4 sm:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="rounded-full text-muted-foreground hover:bg-white/10 hover:text-white"
              >
                <Link href="/dashboard" aria-label={t('viewer.backToDashboard')}>
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-foreground">
                  {t('viewer.title')}
                </h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  {job.settings.quality.toUpperCase()} • {job.settings.format.toUpperCase()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Panel toggle button (desktop) */}
              {!isMobile && job.status === 'completed' && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsPanelOpen(!isPanelOpen)}
                  aria-label={t('viewer.details')}
                  className="rounded-full text-muted-foreground hover:bg-white/10 hover:text-white"
                >
                  <PanelRight className="h-5 w-5" />
                </Button>
              )}
              {/* Status badge */}
              <StatusBadge status={job.status} />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="w-full px-4 py-5 sm:px-8">
        {/* Processing state */}
        {isProcessing && currentStatus && (
          <Card className="mx-auto max-w-3xl rounded-[28px] border-border bg-card">
            <CardContent className="px-5 py-12 sm:px-10 sm:py-16">
              <div className="text-center">
                <ProgressSteps currentStatus={currentStatus} />

                <LoadingSpinner
                  message={getStatusMessage(currentStatus)}
                />

                <div className="mt-6 max-w-md mx-auto">
                  <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                    <div className="relative h-14 w-14 overflow-hidden rounded-xl ring-1 ring-border">
                      <FillImage
                        src={job.inputImageUrl}
                        alt="Input"
                        className="object-cover"
                        sizes="56px"
                      />
                    </div>
                    <span className="text-xs">
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
          <Card className="mx-auto max-w-3xl rounded-[28px] border-destructive/30 bg-card">
            <CardContent className="px-6 py-14 text-center sm:px-10 sm:py-20">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
              <h2 className="mb-4 text-[28px] font-semibold tracking-tight text-foreground">
                {t('viewer.generationFailed')}
              </h2>
              <p className="mb-5 text-[15px] leading-relaxed text-muted-foreground">
                {job.error || t('viewer.errorOccurred')}
              </p>
              <p className="mb-7 text-sm text-muted-foreground">
                {t('viewer.creditRefunded')}
              </p>
              <Button asChild className="h-11 rounded-full px-6">
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
          <div className="relative">
            {/* Pseudo-fullscreen backdrop (iOS) */}
            {isPseudoFullscreen && (
              <div
                className="pseudo-fullscreen-backdrop"
                onClick={toggleFullscreen}
              />
            )}

            {/* Full-width 3D Viewer */}
            <div
              ref={handleViewerContainerRef}
              className={cn(
                'relative w-full overflow-hidden border border-border bg-card',
                isPseudoFullscreen
                  ? 'pseudo-fullscreen pseudo-fullscreen-safe pseudo-fullscreen-animate'
                  : 'h-[calc(100dvh-140px)] min-h-[400px] rounded-[28px]'
              )}
              style={isFullscreen && !isPseudoFullscreen ? { height: '100vh' } : undefined}
            >
              {/* Close button for pseudo-fullscreen (iOS) */}
              {isPseudoFullscreen && (
                <button
                  onClick={toggleFullscreen}
                  className="absolute top-4 right-4 z-[10000] p-2.5 rounded-full
                             bg-black/60 hover:bg-black/80 transition-colors
                             text-white/80 hover:text-white"
                  style={{
                    marginTop: 'env(safe-area-inset-top, 0)',
                    marginRight: 'env(safe-area-inset-right, 0)',
                  }}
                >
                  <Minimize className="w-5 h-5" />
                </button>
              )}

              <ModelViewer
                ref={modelViewerRef}
                modelUrl={job.outputModelUrl}
                viewMode={viewMode}
                backgroundColor={backgroundColor}
                autoOrient={true}
                showGrid={showGrid}
                showAxes={showAxes}
                autoRotate={autoRotate}
                lighting={lighting}
              />

              {/* Floating Toolbar */}
              <UnifiedViewerToolbar
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
                lighting={lighting}
                onSpotlightPositionChange={updateSpotlightPosition}
                onSpotlightIntensityChange={updateSpotlightIntensity}
                onSpotlightColorChange={updateSpotlightColor}
                onAmbientIntensityChange={updateAmbientIntensity}
                onLightingReset={resetLighting}
                showLightingControls={true}
                onScreenshot={handleScreenshot}
                onFullscreen={handleFullscreen}
                isFullscreen={isFullscreen}
                onReset={handleReset}
                onAR={launchAR}
                arLoading={arLoading}
                arSupported={isARSupported && isMobile}
                portalContainer={viewerContainer}
              />
            </div>

            {/* Desktop: Floating Side Panel */}
            {!isMobile && (
              <ViewerSidePanel
                isOpen={isPanelOpen}
                onToggle={() => setIsPanelOpen(!isPanelOpen)}
                title={t('viewer.details')}
              >
                <DownloadPanel
                  modelUrl={job.outputModelUrl}
                  downloadFiles={job.downloadFiles}
                  jobId={job.id}
                  currentFormat={job.settings.format}
                />

                {/* Source image */}
                <Card className="rounded-2xl border-white/10 bg-white/5 text-white">
                  <CardContent className="pt-1">
                    <h3 className="mb-4 text-sm font-semibold text-white/90">{t('viewer.sourceImage')}</h3>
                    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black/10 ring-1 ring-white/10">
                      <FillImage
                        src={job.inputImageUrl}
                        alt="Source"
                        className="object-contain"
                        sizes="(min-width: 1024px) 320px, 100vw"
                      />
                    </div>
                  </CardContent>
                </Card>
              </ViewerSidePanel>
            )}

            {/* Mobile: Bottom Sheet */}
            {isMobile && (
              <>
                {/* Floating action button to open sheet */}
                <Button
                  onClick={() => setIsPanelOpen(true)}
                  aria-label={t('viewer.details')}
                  className="fixed bottom-20 right-4 z-50 h-12 w-12 rounded-full bg-primary shadow-lg"
                >
                  <PanelRight className="h-5 w-5" />
                </Button>

                <Sheet open={isPanelOpen} onOpenChange={setIsPanelOpen}>
                  <SheetContent
                    side="bottom"
                    className="dark h-[70vh] rounded-t-[28px] border-border bg-card text-foreground"
                  >
                    <SheetHeader className="pb-5">
                      <SheetTitle className="text-xl font-semibold tracking-tight text-foreground">{t('viewer.details')}</SheetTitle>
                    </SheetHeader>
                    <div className="space-y-5 overflow-y-auto px-2 pb-8">
                      <DownloadPanel
                        modelUrl={job.outputModelUrl}
                        downloadFiles={job.downloadFiles}
                        jobId={job.id}
                        currentFormat={job.settings.format}
                      />

                      {/* Source image */}
                      <Card className="rounded-2xl border-white/10 bg-white/5 text-white">
                        <CardContent className="pt-1">
                          <h3 className="mb-4 text-sm font-semibold text-white/90">{t('viewer.sourceImage')}</h3>
                          <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black/10 ring-1 ring-white/10">
                            <FillImage
                              src={job.inputImageUrl}
                              alt="Source"
                              className="object-contain"
                              sizes="100vw"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </SheetContent>
                </Sheet>
              </>
            )}
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
    <ol className="mx-auto mb-10 grid max-w-md grid-cols-5 gap-2 sm:gap-4">
      {PROGRESS_STEPS.map((step, index) => {
        const isActive = index === currentIndex;
        const isCompleted = index < currentIndex;

        return (
          <li key={step.status} className="flex min-w-0 flex-col items-center" aria-current={isActive ? 'step' : undefined}>
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors sm:h-9 sm:w-9',
                isActive
                  ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                  : isCompleted
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-muted-foreground'
              )}
            >
              {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
            </div>
            <span className={cn('mt-3 text-center text-[11px] leading-relaxed', isActive ? 'font-medium text-[#66b3ff]' : 'text-muted-foreground')}>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
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
        <div className="flex min-h-screen items-center justify-center bg-background px-5">
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
