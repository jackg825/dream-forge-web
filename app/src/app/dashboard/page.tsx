'use client';

import Link from 'next/link';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { CreditBadge } from '@/components/credits/CreditBadge';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useJobs } from '@/hooks/useJobs';
import type { Job } from '@/types';

function DashboardContent() {
  const { user, signOut } = useAuth();
  const { credits, loading: creditsLoading } = useCredits(user?.uid);
  const { jobs, loading: jobsLoading } = useJobs(user?.uid);

  // Get recent jobs (last 3)
  const recentJobs = jobs.slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-gray-900">
              Dream Forge
            </Link>
            <div className="flex items-center gap-4">
              <CreditBadge credits={credits} loading={creditsLoading} />
              <button
                onClick={signOut}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.displayName || 'User'}
          </h1>
          <p className="text-gray-600">
            Transform your photos into stunning 3D models
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Credits card */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Available Credits</p>
                <p className="text-3xl font-bold text-gray-900">{credits}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-indigo-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.736 6.979C9.208 6.193 9.696 6 10 6c.304 0 .792.193 1.264.979a1 1 0 001.715-1.029C12.279 4.784 11.232 4 10 4s-2.279.784-2.979 1.95c-.285.475-.507 1-.67 1.55H6a1 1 0 000 2h.013a9.358 9.358 0 000 1H6a1 1 0 100 2h.351c.163.55.385 1.075.67 1.55C7.721 15.216 8.768 16 10 16s2.279-.784 2.979-1.95a1 1 0 10-1.715-1.029c-.472.786-.96.979-1.264.979-.304 0-.792-.193-1.264-.979a4.265 4.265 0 01-.264-.521H10a1 1 0 100-2H8.017a7.36 7.36 0 010-1H10a1 1 0 100-2H8.472c.08-.185.167-.36.264-.521z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              1 credit = 1 generation
            </p>
          </div>

          {/* Total generations card */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Generations</p>
                <p className="text-3xl font-bold text-gray-900">
                  {user?.totalGenerated || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              3D models created
            </p>
          </div>

          {/* Quick action card */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-sm p-6 text-white">
            <h3 className="font-semibold mb-2">Create New Model</h3>
            <p className="text-sm text-indigo-100 mb-4">
              Upload a photo and transform it into a 3D model
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 rounded-md font-medium hover:bg-indigo-50 transition-colors"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Generation
            </Link>
          </div>
        </div>

        {/* Recent generations */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Generations
              </h2>
              <Link
                href="/dashboard/history"
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                View all
              </Link>
            </div>
          </div>

          {jobsLoading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
            </div>
          ) : recentJobs.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-500">No generations yet</p>
              <Link
                href="/"
                className="mt-2 inline-block text-indigo-600 hover:text-indigo-700"
              >
                Create your first 3D model
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {recentJobs.map((job) => (
                <JobListItem key={job.id} job={job} />
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

function JobListItem({ job }: { job: Job }) {
  const statusStyles = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <li>
      <Link
        href={`/viewer/${job.id}`}
        className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        {/* Thumbnail */}
        <img
          src={job.inputImageUrl}
          alt="Input"
          className="w-12 h-12 rounded-md object-cover"
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {job.settings.quality} quality • {job.settings.format.toUpperCase()}
          </p>
          <p className="text-sm text-gray-500">
            {formatDate(job.createdAt)}
          </p>
        </div>

        {/* Status */}
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            statusStyles[job.status]
          }`}
        >
          {job.status}
        </span>

        {/* Arrow */}
        <svg
          className="w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </Link>
    </li>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
