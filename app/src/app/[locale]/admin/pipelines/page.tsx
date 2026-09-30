'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminGuard } from '@/components/auth/AdminGuard';
import { AdminHeader } from '@/components/layout/headers';
import { useAdminPipelines } from '@/hooks/useAdminPipelines';
import { AdminPipelineCard } from '@/components/admin/AdminPipelineCard';
import { PipelineDetailModal } from '@/components/admin/PipelineDetailModal';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Loader2, Box, Search } from 'lucide-react';
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
  const [userIdInput, setUserIdInput] = useState('');
  const [appliedUserIdFilter, setAppliedUserIdFilter] = useState('');
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const selectedPipeline = pipelines.find((pipeline) => pipeline.id === selectedPipelineId) || null;

  // Fetch pipelines on mount and when filters change
  useEffect(() => {
    fetchPipelines(20, 0, {
      status: statusFilter === 'all' ? undefined : statusFilter,
      userId: appliedUserIdFilter || undefined,
    });
  }, [statusFilter, appliedUserIdFilter, fetchPipelines]);

  const handleSearch = () => {
    setAppliedUserIdFilter(userIdInput.trim());
  };

  const handleLoadMore = () => {
    if (pagination?.hasMore) {
      fetchPipelines(pagination.limit, pagination.offset + pagination.limit, {
        status: statusFilter === 'all' ? undefined : statusFilter,
        userId: appliedUserIdFilter || undefined,
      });
    }
  };

  const handlePipelineClick = (pipeline: AdminPipeline) => {
    setSelectedPipelineId(pipeline.id);
    setDetailOpen(true);
  };

  const refreshLoadedPipelines = () => {
    fetchPipelines(Math.min(Math.max(pipelines.length, 20), 50), 0, {
      status: statusFilter === 'all' ? undefined : statusFilter,
      userId: appliedUserIdFilter || undefined,
    });
  };

  const handleFilterChange = (newFilter: FilterStatus) => {
    setStatusFilter(newFilter);
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      {/* Main content */}
      <main className="studio-shell">
        <div className="mb-10">
          <h1 className="studio-page-title">{t('admin.pipelines')}</h1>
        </div>
        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-2xl flex items-center justify-between">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            <button
              type="button"
              onClick={clearError}
              aria-label="關閉錯誤訊息"
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
            >
              ✕
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="mb-8 space-y-5">
          {/* Status filter */}
          <Tabs value={statusFilter} onValueChange={(v) => handleFilterChange(v as FilterStatus)}>
            <TabsList className="h-auto flex-wrap gap-1 rounded-2xl p-1.5">
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
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value)}
              className="max-w-sm bg-card"
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
          <div className="mb-4 text-sm text-muted-foreground">
            共 {pagination.total} 個 Pipeline
            {statusFilter !== 'all' && ` (篩選: ${statusFilter})`}
          </div>
        )}

        {/* Pipelines grid */}
        {loading && pipelines.length === 0 ? (
          <div className="store-card flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : pipelines.length === 0 ? (
          <div className="store-card flex flex-col items-center justify-center px-6 py-20 text-center">
            <Box className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-1">沒有找到 Pipeline</h3>
            <p className="text-muted-foreground">
              {statusFilter !== 'all' || appliedUserIdFilter
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
          setSelectedPipelineId(null);
        }}
        onPipelineUpdated={refreshLoadedPipelines}
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
