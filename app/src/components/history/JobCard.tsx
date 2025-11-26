'use client';

import Link from 'next/link';
import type { Job } from '@/types';

interface JobCardProps {
  job: Job;
}

const STATUS_STYLES = {
  pending: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    label: 'Queued',
  },
  processing: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    label: 'Processing',
  },
  completed: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    label: 'Completed',
  },
  failed: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    label: 'Failed',
  },
};

/**
 * Card component for displaying a generation job
 */
export function JobCard({ job }: JobCardProps) {
  const status = STATUS_STYLES[job.status];

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="relative aspect-square bg-gray-100">
        <img
          src={job.inputImageUrl}
          alt="Input image"
          className="w-full h-full object-cover"
        />

        {/* Status badge */}
        <span
          className={`absolute top-2 right-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}
        >
          {status.label}
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Settings */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
          <span className="capitalize">{job.settings.quality}</span>
          <span className="text-gray-300">•</span>
          <span className="uppercase">{job.settings.format}</span>
        </div>

        {/* Timestamp */}
        <p className="text-xs text-gray-500 mb-3">
          {formatDate(job.createdAt)}
        </p>

        {/* Error message if failed */}
        {job.status === 'failed' && job.error && (
          <p className="text-xs text-red-600 mb-3 truncate" title={job.error}>
            {job.error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Link
            href={`/viewer/${job.id}`}
            className={`
              flex-1 text-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors
              ${job.status === 'completed'
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            {job.status === 'completed' ? 'View Model' : 'View Details'}
          </Link>

          {job.status === 'completed' && job.outputModelUrl && (
            <a
              href={job.outputModelUrl}
              download={`model_${job.id}.${job.settings.format}`}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
