'use client';

import { useTranslations } from 'next-intl';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { UserHeader } from '@/components/layout/headers';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { usePipelines } from '@/hooks/usePipelines';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FillImage } from '@/components/ui/fill-image';
import {
  Coins,
  Box,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Palette,
} from 'lucide-react';
import type { Pipeline, PipelineStatus } from '@/types';

function DashboardContent() {
  const t = useTranslations();
  const { user } = useAuth();
  const { credits, loading: creditsLoading } = useCredits(user?.uid);
  const { pipelines, loading: pipelinesLoading } = usePipelines(user?.uid);

  // Get recent pipelines (last 3)
  const recentPipelines = pipelines.slice(0, 3);

  // Get translated status message
  const getStatusMessage = (status: PipelineStatus): string => {
    const statusMap: Record<PipelineStatus, string> = {
      'draft': '草稿',
      'batch-queued': '排隊中',
      'batch-processing': '批次處理中',
      'generating-images': '生成圖片中',
      'images-ready': '圖片就緒',
      'generating-mesh': '生成網格中',
      'mesh-ready': '網格就緒',
      'generating-texture': '生成貼圖中',
      'completed': t('status.completed'),
      'failed': t('status.failed'),
    };
    return statusMap[status] || status;
  };

  return (
    <div className="min-h-screen bg-background">
      <UserHeader />

      {/* Main content */}
      <main className="studio-shell py-12 sm:py-16">
        {/* Welcome section */}
        <div className="mb-10 sm:mb-12">
          <h1 className="studio-page-title">
            {t('dashboard.welcomeBack', { name: user?.displayName || t('common.user') })}
          </h1>
          <p className="studio-page-subtitle">
            {t('dashboard.subtitle')}
          </p>
        </div>

        {/* Stats cards */}
        <div className="mb-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {/* Credits card */}
          <Card>
            <CardContent className="pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('dashboard.availableCredits')}</p>
                  <p className="mt-3 text-5xl font-semibold tracking-[-0.045em] tabular-nums">
                    {creditsLoading ? (
                      <span className="animate-pulse">--</span>
                    ) : (
                      credits
                    )}
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                  <Coins className="h-5 w-5 text-foreground" strokeWidth={1.6} />
                </div>
              </div>
              <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                {t('dashboard.creditEquation')}
              </p>
            </CardContent>
          </Card>

          {/* Total generations card */}
          <Card>
            <CardContent className="pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('dashboard.totalGenerations')}</p>
                  <p className="mt-3 text-5xl font-semibold tracking-[-0.045em] tabular-nums">
                    {user?.totalGenerated || 0}
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                  <Box className="h-5 w-5 text-foreground" strokeWidth={1.6} />
                </div>
              </div>
              <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                {t('dashboard.modelsCreated')}
              </p>
            </CardContent>
          </Card>

          {/* Quick action card */}
          <Card className="border-0 bg-[#1d1d1f] text-white dark:bg-[#29292b]">
            <CardContent className="pt-2">
              <h3 className="mb-3 text-xl font-semibold tracking-tight">{t('dashboard.createNewModel')}</h3>
              <p className="text-sm leading-relaxed text-white/65 mb-6">
                {t('dashboard.uploadAndTransform')}
              </p>
              <Button asChild>
                <Link href="/generate" className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t('dashboard.startCreating')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent generations */}
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{t('dashboard.recentGenerations')}</CardTitle>
              <CardDescription className="mt-2">{t('dashboard.recentDescription')}</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/history" className="gap-1">
                {t('dashboard.viewAll')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent>
            {pipelinesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : recentPipelines.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                  <Box className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <p className="text-muted-foreground mb-2">{t('dashboard.noGenerationsYet')}</p>
                <Button asChild variant="link">
                  <Link href="/">{t('dashboard.createFirstModel')}</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/70">
                {recentPipelines.map((pipeline) => (
                  <PipelineListItem key={pipeline.id} pipeline={pipeline} getStatusMessage={getStatusMessage} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function PipelineListItem({ pipeline, getStatusMessage }: { pipeline: Pipeline; getStatusMessage: (status: PipelineStatus) => string }) {
  const t = useTranslations();

  // Status icon and variant
  const getStatusConfig = (status: PipelineStatus) => {
    switch (status) {
      case 'completed':
        return {
          icon: CheckCircle2,
          variant: 'default' as const,
          className: 'bg-green-500/10 text-green-500 border-green-500/20',
        };
      case 'failed':
        return {
          icon: XCircle,
          variant: 'destructive' as const,
          className: '',
        };
      case 'draft':
      case 'images-ready':
      case 'mesh-ready':
        return {
          icon: Clock,
          variant: 'secondary' as const,
          className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
        };
      default:
        return {
          icon: Loader2,
          variant: 'secondary' as const,
          className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        };
    }
  };

  const statusConfig = getStatusConfig(pipeline.status);
  const StatusIcon = statusConfig.icon;
  const isProcessing = ['generating-images', 'generating-mesh', 'generating-texture', 'batch-queued', 'batch-processing'].includes(pipeline.status);

  // Get preview image
  const previewImage = pipeline.inputImages[0]?.url || pipeline.meshImages?.front?.url || null;

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('time.justNow');
    if (minutes < 60) return t('time.minutesAgo', { count: minutes });
    if (hours < 24) return t('time.hoursAgo', { count: hours });
    if (days < 7) return t('time.daysAgo', { count: days });
    return date.toLocaleDateString();
  };

  return (
    <Link
      href={`/generate?id=${pipeline.id}`}
      className="group flex flex-wrap items-center gap-3 rounded-2xl py-5 transition-colors hover:bg-muted/50 sm:gap-5 sm:px-3"
    >
      {/* Thumbnail */}
      {previewImage ? (
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-muted">
          <FillImage
            src={previewImage}
            alt="Preview"
            className="object-cover"
            sizes="56px"
          />
        </div>
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-muted">
          <Box className="h-6 w-6 text-muted-foreground" />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">
            {pipeline.settings.quality === 'fine' ? '高品質' : pipeline.settings.quality === 'standard' ? '標準' : '草稿'}
          </p>
          {pipeline.meshUrl && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Box className="h-3 w-3" />
            </Badge>
          )}
          {pipeline.texturedModelUrl && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Palette className="h-3 w-3" />
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {formatDate(pipeline.createdAt)}
        </p>
      </div>

      {/* Status */}
      <Badge
        variant={statusConfig.variant}
        className={statusConfig.className}
      >
        <StatusIcon className={`mr-1 h-3 w-3 ${isProcessing ? 'animate-spin' : ''}`} />
        {getStatusMessage(pipeline.status)}
      </Badge>

      {/* Arrow */}
      <ArrowRight className="hidden h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 sm:block" />
    </Link>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
