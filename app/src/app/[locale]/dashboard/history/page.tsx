'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Header } from '@/components/layout/Header';
import { PipelineCard } from '@/components/history/PipelineCard';
import { useAuth } from '@/hooks/useAuth';
import { usePipelines } from '@/hooks/usePipelines';
import { Link } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Box, Plus, Loader2 } from 'lucide-react';
import type { PipelineStatus, Pipeline } from '@/types';

// Filter options - 'processing' covers all intermediate statuses
type FilterStatus = 'all' | 'completed' | 'processing' | 'pending' | 'failed';

// All statuses considered "processing" for pipelines
const PIPELINE_PROCESSING_STATUSES: PipelineStatus[] = [
  'generating-images',
  'generating-mesh',
  'generating-texture',
  'batch-queued',
  'batch-processing',
];

const ITEMS_PER_PAGE = 12;

function HistoryContent() {
  const t = useTranslations();
  const { user } = useAuth();
  const { pipelines, loading } = usePipelines(user?.uid);

  const [filter, setFilter] = useState<FilterStatus>('all');
  const [page, setPage] = useState(1);

  // Filter pipelines
  const filteredPipelines = useMemo(() => {
    if (filter === 'all') return pipelines;
    if (filter === 'processing') {
      return pipelines.filter((p) => PIPELINE_PROCESSING_STATUSES.includes(p.status));
    }
    if (filter === 'pending') {
      return pipelines.filter((p) => p.status === 'draft' || p.status === 'images-ready' || p.status === 'mesh-ready');
    }
    return pipelines.filter((p) => p.status === filter);
  }, [pipelines, filter]);

  // Paginate
  const totalPages = Math.ceil(filteredPipelines.length / ITEMS_PER_PAGE);
  const paginatedPipelines = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredPipelines.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPipelines, page]);

  // Status counts for pipelines
  const statusCounts = useMemo(() => {
    return {
      all: pipelines.length,
      completed: pipelines.filter((p) => p.status === 'completed').length,
      processing: pipelines.filter((p) => PIPELINE_PROCESSING_STATUSES.includes(p.status)).length,
      pending: pipelines.filter((p) => p.status === 'draft' || p.status === 'images-ready' || p.status === 'mesh-ready').length,
      failed: pipelines.filter((p) => p.status === 'failed').length,
    };
  }, [pipelines]);

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

        {/* Status filters */}
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

        {/* Items grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : paginatedPipelines.length === 0 ? (
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
                  <Link href="/generate" className="gap-2">
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
              {paginatedPipelines.map((pipeline: Pipeline) => (
                <PipelineCard key={pipeline.id} pipeline={pipeline} />
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
