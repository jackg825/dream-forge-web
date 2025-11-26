'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ViewerControls } from '@/components/viewer/ViewerControls';
import { DownloadPanel } from '@/components/viewer/DownloadPanel';
import { LoadingSpinner } from '@/components/viewer/LoadingSpinner';
import { useJob, useJobStatusPolling } from '@/hooks/useJobs';

// Dynamic import for ModelViewer to avoid SSR issues with Three.js
const ModelViewer = dynamic(
  () => import('@/components/viewer/ModelViewer').then((mod) => mod.ModelViewer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[500px] bg-gray-100 rounded-lg flex items-center justify-center">
        <LoadingSpinner message="Loading viewer..." />
      </div>
    ),
  }
);

function ViewerContent() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const { job, loading: jobLoading, error: jobError } = useJob(jobId);
  const [backgroundColor, setBackgroundColor] = useState('#f3f4f6');

  // Poll for status if job is processing
  const shouldPoll = job?.status === 'pending' || job?.status === 'processing';
  const { status: polledStatus } = useJobStatusPolling(jobId, shouldPoll);

  // Get the effective progress
  const progress = polledStatus?.progress;

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  className="w-6 h-6"
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
                <h1 className="text-xl font-semibold text-gray-900">
                  3D Model Viewer
                </h1>
                <p className="text-sm text-gray-500">
                  {job.settings.quality} quality • {job.settings.format.toUpperCase()}
                </p>
              </div>
            </div>

            {/* Status badge */}
            <StatusBadge status={job.status} />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Processing state */}
        {(job.status === 'pending' || job.status === 'processing') && (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <div className="text-center">
              <LoadingSpinner
                message={
                  job.status === 'pending'
                    ? 'Queued for processing...'
                    : 'Generating your 3D model...'
                }
                progress={progress}
              />

              <div className="mt-6 max-w-md mx-auto">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <img
                    src={job.inputImageUrl}
                    alt="Input"
                    className="w-12 h-12 rounded object-cover"
                  />
                  <span>
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
          <div className="bg-white rounded-lg shadow-sm p-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-600"
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
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Generation Failed
              </h2>
              <p className="text-gray-600 mb-6">
                {job.error || 'An error occurred during 3D model generation.'}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Your credit has been refunded automatically.
              </p>
              <Link
                href="/"
                className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Try Again
              </Link>
            </div>
          </div>
        )}

        {/* Completed state with viewer */}
        {job.status === 'completed' && job.outputModelUrl && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Viewer */}
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="h-[500px]">
                  <ModelViewer
                    modelUrl={job.outputModelUrl}
                    backgroundColor={backgroundColor}
                  />
                </div>
              </div>
              <ViewerControls
                backgroundColor={backgroundColor}
                onBackgroundChange={setBackgroundColor}
              />
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <DownloadPanel
                modelUrl={job.outputModelUrl}
                jobId={job.id}
                currentFormat={job.settings.format}
              />

              {/* Input image */}
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h3 className="font-medium text-gray-900 mb-3">Source Image</h3>
                <img
                  src={job.inputImageUrl}
                  alt="Source"
                  className="w-full rounded-md"
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  };

  const labels = {
    pending: 'Queued',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        styles[status as keyof typeof styles] || styles.pending
      }`}
    >
      {labels[status as keyof typeof labels] || status}
    </span>
  );
}

export default function ViewerPage() {
  return (
    <AuthGuard>
      <ViewerContent />
    </AuthGuard>
  );
}
