'use client';

import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { BatchProgress, PipelineStatus } from '@/types';

interface BatchProgressIndicatorProps {
  status: PipelineStatus;
  progress?: BatchProgress;
  estimatedCompletionTime?: Date;
  className?: string;
}

/**
 * BatchProgressIndicator - Shows batch processing progress
 *
 * Displays:
 * - Overall progress bar (completed + failed / total)
 * - Individual status counts (completed, failed, pending)
 * - Estimated completion time (if available)
 */
export function BatchProgressIndicator({
  status,
  progress,
  estimatedCompletionTime,
  className,
}: BatchProgressIndicatorProps) {
  const t = useTranslations('progress');
  // Determine if batch is currently processing
  const isProcessing = status === 'batch-queued' || status === 'batch-processing';

  // Calculate progress percentage
  const total = progress?.total ?? 6;
  const completed = progress?.completed ?? 0;
  const failed = progress?.failed ?? 0;
  const pending = total - completed - failed;
  const progressPercent = total > 0 ? ((completed + failed) / total) * 100 : 0;

  // Status-specific messaging
  const getStatusMessage = () => {
    switch (status) {
      case 'batch-queued':
        return t('batch.status.queued');
      case 'batch-processing':
        return t('batch.status.processing', { completed, total });
      case 'images-ready':
        return t('batch.status.completed');
      case 'failed':
        return t('batch.status.failed', { failed, total });
      default:
        return '';
    }
  };

  // Format estimated time
  const formatEstimatedTime = (date: Date) => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.max(0, Math.ceil(diffMs / 60000));

    if (diffMins === 0) return t('time.aboutToComplete');
    if (diffMins === 1) return t('time.aboutMinute');
    return t('time.aboutMinutes', { count: diffMins });
  };

  // Don't render if not in a batch-related status
  if (!isProcessing && status !== 'images-ready' && !(status === 'failed' && progress)) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          ) : status === 'images-ready' ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <span className="text-sm font-medium">{getStatusMessage()}</span>
        </div>

        {/* Estimated time */}
        {isProcessing && estimatedCompletionTime && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatEstimatedTime(estimatedCompletionTime)}</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <Progress
          value={progressPercent}
          className={cn(
            'h-2',
            failed > 0 && completed === 0 ? '[&>div]:bg-red-500' : ''
          )}
        />
      </div>

      {/* Status counts */}
      <div className="flex gap-2 flex-wrap">
        {/* Completed */}
        <Badge
          variant="outline"
          className={cn(
            'text-xs gap-1',
            completed > 0
              ? 'border-green-500/50 text-green-600'
              : 'border-muted text-muted-foreground'
          )}
        >
          <CheckCircle2 className="h-3 w-3" />
          {t('batch.completed', { count: completed })}
        </Badge>

        {/* Pending */}
        {isProcessing && pending > 0 && (
          <Badge
            variant="outline"
            className="text-xs gap-1 border-blue-500/50 text-blue-600"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('batch.processing', { count: pending })}
          </Badge>
        )}

        {/* Failed */}
        {failed > 0 && (
          <Badge
            variant="outline"
            className="text-xs gap-1 border-red-500/50 text-red-600"
          >
            <XCircle className="h-3 w-3" />
            {t('batch.failed', { count: failed })}
          </Badge>
        )}
      </div>

      {/* Info text for batch mode */}
      {isProcessing && (
        <p className="text-xs text-muted-foreground">
          {t('batch.canLeave')}
        </p>
      )}
    </div>
  );
}
