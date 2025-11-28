'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { CreditBadge } from '@/components/credits/CreditBadge';
import { JobCard } from '@/components/history/JobCard';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useJobs } from '@/hooks/useJobs';
import type { JobStatus } from '@/types';

// Filter options - 'processing' covers all intermediate statuses
type FilterStatus = 'all' | 'completed' | 'processing' | 'pending' | 'failed';

// All statuses considered "processing"
const PROCESSING_STATUSES: JobStatus[] = [
  'generating-views',
  'generating-model',
  'downloading-model',
  'uploading-storage',
];

const ITEMS_PER_PAGE = 12;

function HistoryContent() {
  const { user, signOut } = useAuth();
  const { credits, loading: creditsLoading } = useCredits(user?.uid);
  const { jobs, loading: jobsLoading } = useJobs(user?.uid);

  const [filter, setFilter] = useState<FilterStatus>('all');
  const [page, setPage] = useState(1);

  // Filter jobs - 'processing' filter includes all intermediate statuses
  const filteredJobs = useMemo(() => {
    if (filter === 'all') return jobs;
    if (filter === 'processing') {
      return jobs.filter((job) => PROCESSING_STATUSES.includes(job.status));
    }
    return jobs.filter((job) => job.status === filter);
  }, [jobs, filter]);

  // Paginate
  const totalPages = Math.ceil(filteredJobs.length / ITEMS_PER_PAGE);
  const paginatedJobs = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredJobs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredJobs, page]);

  // Status counts - 'processing' includes all intermediate statuses
  const statusCounts = useMemo(() => {
    return {
      all: jobs.length,
      completed: jobs.filter((j) => j.status === 'completed').length,
      processing: jobs.filter((j) => PROCESSING_STATUSES.includes(j.status)).length,
      pending: jobs.filter((j) => j.status === 'pending').length,
      failed: jobs.filter((j) => j.status === 'failed').length,
    };
  }, [jobs]);

  const handleFilterChange = (newFilter: FilterStatus) => {
    setFilter(newFilter);
    setPage(1); // Reset to first page when filter changes
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold text-gray-900">Generation History</h1>
            </div>
            <div className="flex items-center gap-4">
              <CreditBadge credits={credits} loading={creditsLoading} />
              <button onClick={signOut} className="text-sm text-gray-600 hover:text-gray-900">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            <FilterButton
              active={filter === 'all'}
              onClick={() => handleFilterChange('all')}
              count={statusCounts.all}
            >
              All
            </FilterButton>
            <FilterButton
              active={filter === 'completed'}
              onClick={() => handleFilterChange('completed')}
              count={statusCounts.completed}
            >
              Completed
            </FilterButton>
            <FilterButton
              active={filter === 'processing'}
              onClick={() => handleFilterChange('processing')}
              count={statusCounts.processing}
            >
              Processing
            </FilterButton>
            <FilterButton
              active={filter === 'failed'}
              onClick={() => handleFilterChange('failed')}
              count={statusCounts.failed}
            >
              Failed
            </FilterButton>
          </div>

          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Generation
          </Link>
        </div>

        {/* Jobs grid */}
        {jobsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : paginatedJobs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              {filter === 'all' ? 'No generations yet' : `No ${filter} generations`}
            </h3>
            <p className="text-gray-500 mb-4">
              {filter === 'all'
                ? 'Upload a photo to create your first 3D model'
                : 'Try adjusting your filter'}
            </p>
            {filter === 'all' && (
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Create First Model
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginatedJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 text-sm rounded-md ${
                        p === page
                          ? 'bg-indigo-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors
        ${active
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-gray-600 hover:bg-gray-100'
        }
      `}
    >
      {children}
      <span
        className={`
          inline-flex items-center justify-center w-5 h-5 text-xs rounded-full
          ${active ? 'bg-indigo-200' : 'bg-gray-200'}
        `}
      >
        {count}
      </span>
    </button>
  );
}

export default function HistoryPage() {
  return (
    <AuthGuard>
      <HistoryContent />
    </AuthGuard>
  );
}
