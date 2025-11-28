'use client';

import { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ViewerToolbar } from '@/components/viewer/ViewerToolbar';
import { DownloadPanel } from '@/components/viewer/DownloadPanel';
import { LoadingSpinner } from '@/components/viewer/LoadingSpinner';
import { useJob, useJobStatusPolling } from '@/hooks/useJobs';
import { JOB_STATUS_MESSAGES, type JobStatus, type ViewMode } from '@/types';
import type { ModelViewerRef } from '@/components/viewer/ModelViewer';

// Dynamic import for ModelViewer to avoid SSR issues with Three.js
const ModelViewer = dynamic(
  () => import('@/components/viewer/ModelViewer').then((mod) => mod.ModelViewer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-gray-900 rounded-lg flex items-center justify-center">
        <LoadingSpinner message="Loading viewer..." />
      </div>
    ),
  }
);

function ViewerContentInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = searchParams.get('id');

  const { job, loading: jobLoading, error: jobError } = useJob(jobId || '');

  // Viewer state
  const [backgroundColor, setBackgroundColor] = useState('#1f2937');
  const [viewMode, setViewMode] = useState<ViewMode>('clay');
  const [showGrid, setShowGrid] = useState(false);
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

  // Redirect if no jobId
  useEffect(() => {
    if (!jobId) {
      router.replace('/dashboard');
    }
  }, [jobId, router]);

  // No jobId state
  if (!jobId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner message="Redirecting..." />
      </div>
    );
  }

  // Loading state
  if (jobLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner message="Loading job..." />
      </div>
    );
  }

  // Error state
  if (jobError || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Job Not Found</h1>
          <p className="text-gray-600 mb-4">
            {jobError || 'The requested job could not be found.'}
          </p>
          <Link
            href="/dashboard"
            className="text-indigo-600 hover:text-indigo-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-900/80 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-white/60 hover:text-white transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </Link>
              <div>
                <h1 className="text-lg font-medium text-white">
                  3D Model Viewer
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Processing state */}
        {isProcessing && currentStatus && (
          <div className="bg-gray-800/50 backdrop-blur rounded-2xl border border-white/10 p-8">
            <div className="text-center">
              <ProgressSteps currentStatus={currentStatus} />

              <LoadingSpinner
                message={JOB_STATUS_MESSAGES[currentStatus] || '處理中...'}
              />

              <div className="mt-6 max-w-md mx-auto">
                <div className="flex items-center gap-3 text-sm text-white/50">
                  <img
                    src={job.inputImageUrl}
                    alt="Input"
                    className="w-12 h-12 rounded-lg object-cover ring-1 ring-white/10"
                  />
                  <span className="font-mono text-xs">
                    {job.settings.quality === 'fine'
                      ? '精細品質生成約需 3 分鐘'
                      : job.settings.quality === 'standard'
                      ? '標準品質生成約需 2 分鐘'
                      : '草稿品質生成約需 1 分鐘'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Failed state */}
        {job.status === 'failed' && (
          <div className="bg-gray-800/50 backdrop-blur rounded-2xl border border-red-500/30 p-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Generation Failed
              </h2>
              <p className="text-white/60 mb-6">
                {job.error || 'An error occurred during 3D model generation.'}
              </p>
              <p className="text-sm text-white/40 mb-4">
                Your credit has been refunded automatically.
              </p>
              <Link
                href="/"
                className="inline-flex items-center justify-center px-5 py-2.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-medium"
              >
                Try Again
              </Link>
            </div>
          </div>
        )}

        {/* Completed state with viewer */}
        {job.status === 'completed' && job.outputModelUrl && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Viewer - takes more space now */}
            <div className="lg:col-span-3">
              <div
                ref={viewerContainerRef}
                className="relative bg-gray-800 rounded-2xl overflow-hidden border border-white/10"
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
              <div className="bg-gray-800/50 backdrop-blur rounded-xl border border-white/10 p-4">
                <h3 className="font-medium text-white/90 mb-3 text-sm">Source Image</h3>
                <img
                  src={job.inputImageUrl}
                  alt="Source"
                  className="w-full rounded-lg ring-1 ring-white/10"
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Progress steps component
const PROGRESS_STEPS: { status: JobStatus; label: string }[] = [
  { status: 'pending', label: '排隊' },
  { status: 'generating-views', label: '視角' },
  { status: 'generating-model', label: '模型' },
  { status: 'downloading-model', label: '下載' },
  { status: 'uploading-storage', label: '完成' },
];

function ProgressSteps({ currentStatus }: { currentStatus: JobStatus }) {
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
                    ? 'bg-indigo-500 text-white ring-4 ring-indigo-500/30'
                    : isCompleted
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
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
                isActive ? 'text-indigo-400 font-medium' : 'text-gray-500'
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
  const styles: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-300 ring-yellow-500/30',
    'generating-views': 'bg-blue-500/20 text-blue-300 ring-blue-500/30',
    'generating-model': 'bg-blue-500/20 text-blue-300 ring-blue-500/30',
    'downloading-model': 'bg-blue-500/20 text-blue-300 ring-blue-500/30',
    'uploading-storage': 'bg-blue-500/20 text-blue-300 ring-blue-500/30',
    completed: 'bg-green-500/20 text-green-300 ring-green-500/30',
    failed: 'bg-red-500/20 text-red-300 ring-red-500/30',
  };

  const labels: Record<string, string> = {
    pending: '排隊中',
    'generating-views': '生成視角',
    'generating-model': '生成模型',
    'downloading-model': '下載中',
    'uploading-storage': '準備連結',
    completed: '完成',
    failed: '失敗',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono ring-1 ${
        styles[status] || styles.pending
      }`}
    >
      {labels[status] || status}
    </span>
  );
}

function ViewerContent() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
          <LoadingSpinner message="Loading..." />
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
