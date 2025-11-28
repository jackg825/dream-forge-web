'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Header } from '@/components/layout/Header';
import { JobCard } from '@/components/history/JobCard';
import { useAuth } from '@/hooks/useAuth';
import { useJobs } from '@/hooks/useJobs';
import { Link } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Box, Plus, Loader2 } from 'lucide-react';
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
  const t = useTranslations();
  const { user } = useAuth();
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
    <div className="min-h-screen bg-background">
      <Header />

      {/* Main content */}
      <main className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('history.title')}</h1>
            <p className="text-muted-foreground">
              {t('history.subtitle')}
            </p>
          </div>

          <Button asChild>
            <Link href="/" className="gap-2">
              <Plus className="h-4 w-4" />
              {t('history.newGeneration')}
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <Tabs value={filter} onValueChange={(v) => handleFilterChange(v as FilterStatus)} className="mb-6">
          <TabsList>
            <TabsTrigger value="all" className="gap-2">
              {t('history.filter.all')}
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5">
                {statusCounts.all}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              {t('history.filter.completed')}
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5">
                {statusCounts.completed}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="processing" className="gap-2">
              {t('history.filter.processing')}
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5">
                {statusCounts.processing}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="failed" className="gap-2">
              {t('history.filter.failed')}
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5">
                {statusCounts.failed}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Jobs grid */}
        {jobsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : paginatedJobs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Box className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-1">
                {filter === 'all' ? t('history.noGenerations') : t('history.noGenerationsFiltered', { filter: t(`history.filter.${filter}`) })}
              </h3>
              <p className="text-muted-foreground mb-4">
                {filter === 'all'
                  ? t('history.uploadToCreate')
                  : t('history.tryAdjustingFilter')}
              </p>
              {filter === 'all' && (
                <Button asChild>
                  <Link href="/" className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t('history.createFirstModel')}
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  {t('history.pagination.previous')}
                </Button>

                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <Button
                      key={p}
                      variant={p === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPage(p)}
                      className="w-9"
                    >
                      {p}
                    </Button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  {t('history.pagination.next')}
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <AuthGuard>
      <HistoryContent />
    </AuthGuard>
  );
}
