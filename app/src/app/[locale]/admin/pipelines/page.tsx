'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminGuard } from '@/components/auth/AdminGuard';
import { useAdminPipelines } from '@/hooks/useAdminPipelines';
import { AdminPipelineCard } from '@/components/admin/AdminPipelineCard';
import { PipelineDetailModal } from '@/components/admin/PipelineDetailModal';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Loader2, Box, Search, RefreshCw } from 'lucide-react';
import type { AdminPipeline, PipelineStatus } from '@/types';

type FilterStatus = 'all' | PipelineStatus;

function AdminPipelinesContent() {
  const t = useTranslations();
  const {
    pipelines,
    loading,
    pagination,
    error,
    fetchPipelines,
    clearError,
  } = useAdminPipelines();

  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [selectedPipeline, setSelectedPipeline] = useState<AdminPipeline | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Fetch pipelines on mount and when filters change
  useEffect(() => {
    fetchPipelines(20, 0, {
      status: statusFilter === 'all' ? undefined : statusFilter,
      userId: userIdFilter || undefined,
    });
  }, [statusFilter, fetchPipelines]);

  const handleSearch = () => {
    fetchPipelines(20, 0, {
      status: statusFilter === 'all' ? undefined : statusFilter,
      userId: userIdFilter || undefined,
    });
  };

  const handleLoadMore = () => {
    if (pagination?.hasMore) {
      fetchPipelines(pagination.limit, pagination.offset + pagination.limit, {
        status: statusFilter === 'all' ? undefined : statusFilter,
        userId: userIdFilter || undefined,
      });
    }
  };

  const handlePipelineClick = (pipeline: AdminPipeline) => {
    setSelectedPipeline(pipeline);
    setDetailOpen(true);
  };

  const handleFilterChange = (newFilter: FilterStatus) => {
    setStatusFilter(newFilter);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/admin">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Pipeline 管理
                </h1>
                <span className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-xs font-medium rounded">
                  {t('common.admin')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchPipelines()}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                重新整理
              </Button>
              <Link href="/admin" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                返回管理員面板
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            <button
              onClick={clearError}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
            >
              ✕
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 space-y-4">
          {/* Status filter */}
          <Tabs value={statusFilter} onValueChange={(v) => handleFilterChange(v as FilterStatus)}>
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="completed">完成</TabsTrigger>
              <TabsTrigger value="generating-mesh">生成中</TabsTrigger>
              <TabsTrigger value="images-ready">待處理</TabsTrigger>
              <TabsTrigger value="failed">失敗</TabsTrigger>
              <TabsTrigger value="draft">草稿</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* User ID search */}
          <div className="flex gap-2">
            <Input
              placeholder="搜尋用戶 ID..."
              value={userIdFilter}
              onChange={(e) => setUserIdFilter(e.target.value)}
              className="max-w-xs"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={loading} className="gap-2">
              <Search className="h-4 w-4" />
              搜尋
            </Button>
          </div>
        </div>

        {/* Stats bar */}
        {pagination && (
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            共 {pagination.total} 個 Pipeline
            {statusFilter !== 'all' && ` (篩選: ${statusFilter})`}
          </div>
        )}

        {/* Pipelines grid */}
        {loading && pipelines.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : pipelines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Box className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-1">沒有找到 Pipeline</h3>
            <p className="text-muted-foreground">
              {statusFilter !== 'all' || userIdFilter
                ? '嘗試調整篩選條件'
                : '系統中尚無任何 Pipeline'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {pipelines.map((pipeline) => (
                <AdminPipelineCard
                  key={pipeline.id}
                  pipeline={pipeline}
                  onClick={() => handlePipelineClick(pipeline)}
                />
              ))}
            </div>

            {/* Load more */}
            {pagination?.hasMore && (
              <div className="flex justify-center mt-8">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      載入中...
                    </>
                  ) : (
                    '載入更多'
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Pipeline detail modal */}
      <PipelineDetailModal
        pipeline={selectedPipeline}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedPipeline(null);
        }}
      />
    </div>
  );
}

export default function AdminPipelinesPage() {
  return (
    <AdminGuard>
      <AdminPipelinesContent />
    </AdminGuard>
  );
}
