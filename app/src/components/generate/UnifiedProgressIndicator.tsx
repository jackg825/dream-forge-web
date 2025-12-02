'use client';

import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Upload,
  Loader2,
  Images,
  Box,
  Palette,
  CheckCircle,
  AlertCircle,
  Clock,
  Info,
} from 'lucide-react';
import type { PipelineStatus, BatchProgress, ProcessingMode } from '@/types';
import { PIPELINE_PROGRESS_MESSAGES, getProgressMessage, getNextStepInfo } from '@/types/progress';

/**
 * Progress data for different generation phases
 */
interface ProgressData {
  /** Image generation: mesh views completed (0-4) */
  meshViewsCompleted?: number;
  /** Image generation: texture views completed (0-2) */
  textureViewsCompleted?: number;
  /** Current phase: mesh-views, texture-views, or complete */
  phase?: 'mesh-views' | 'texture-views' | 'complete';
  /** Batch API progress */
  batchProgress?: BatchProgress;
  /** Mesh generation progress (0-100) from Meshy API */
  meshProgress?: number;
  /** Texture generation progress (0-100) from Meshy API */
  textureProgress?: number;
}

interface UnifiedProgressIndicatorProps {
  /** Current pipeline status */
  status: PipelineStatus;
  /** Processing mode (batch or realtime) */
  processingMode?: ProcessingMode;
  /** Progress data for current step */
  progress?: ProgressData;
  /** Estimated completion time from backend */
  estimatedCompletionTime?: Date;
  /** Display variant */
  variant?: 'inline' | 'full';
  /** Optional click handler for history navigation */
  onViewHistory?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Icon component based on status
 */
function StatusIcon({ icon, isAnimated }: { icon: string; isAnimated?: boolean }) {
  const iconClass = cn('h-10 w-10', isAnimated && 'animate-pulse');
  const spinnerClass = 'h-10 w-10 animate-spin';

  switch (icon) {
    case 'upload':
      return <Upload className={iconClass} />;
    case 'loader':
      return <Loader2 className={spinnerClass} />;
    case 'images':
      return <Images className={iconClass} />;
    case 'box':
      return <Box className={iconClass} />;
    case 'palette':
      return <Palette className={iconClass} />;
    case 'check':
      return <CheckCircle className={cn(iconClass, 'text-green-500')} />;
    case 'alert':
      return <AlertCircle className={cn(iconClass, 'text-destructive')} />;
    default:
      return <Loader2 className={spinnerClass} />;
  }
}

/**
 * Format remaining time from estimated completion
 */
function formatTimeRemaining(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.max(0, Math.ceil(diffMs / 60000));

  if (diffMins === 0) return '即將完成';
  if (diffMins === 1) return '約 1 分鐘';
  return `約 ${diffMins} 分鐘`;
}

/**
 * Calculate progress percentage based on status and progress data
 */
function calculateProgress(
  status: PipelineStatus,
  progress?: ProgressData
): number | undefined {
  // Batch mode progress
  if (status === 'batch-processing' && progress?.batchProgress) {
    const { completed, failed, total } = progress.batchProgress;
    return total > 0 ? ((completed + failed) / total) * 100 : 0;
  }

  // Realtime image generation
  if (status === 'generating-images' && progress) {
    const meshDone = progress.meshViewsCompleted ?? 0;
    const textureDone = progress.textureViewsCompleted ?? 0;
    return ((meshDone + textureDone) / 6) * 100;
  }

  // Mesh generation (if backend provides progress)
  if (status === 'generating-mesh' && progress?.meshProgress !== undefined) {
    return progress.meshProgress;
  }

  // Texture generation (if backend provides progress)
  if (status === 'generating-texture' && progress?.textureProgress !== undefined) {
    return progress.textureProgress;
  }

  // Indeterminate progress for generating steps without data
  if (status.includes('generating') || status === 'batch-processing') {
    return 50; // Show middle progress for indeterminate
  }

  return undefined;
}

/**
 * UnifiedProgressIndicator - Consistent progress display across all pipeline steps
 *
 * Replaces BatchProgressIndicator and inline progress displays with a unified
 * component that adapts to different pipeline statuses while maintaining
 * consistent visual language.
 */
export function UnifiedProgressIndicator({
  status,
  processingMode = 'batch',
  progress,
  estimatedCompletionTime,
  variant = 'full',
  onViewHistory,
  className,
}: UnifiedProgressIndicatorProps) {
  const message = getProgressMessage(status);
  const nextStep = getNextStepInfo(status);
  const progressValue = calculateProgress(status, progress);
  const isBatch = processingMode === 'batch';
  const isProcessing = status.includes('generating') ||
    status === 'batch-queued' ||
    status === 'batch-processing' ||
    status === 'draft';

  // Inline variant - compact display
  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="bg-primary/10 p-2 rounded-full">
          <StatusIcon icon={message.icon} isAnimated={isProcessing} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{message.title}</p>
          {message.estimatedTime && (
            <p className="text-xs text-muted-foreground">
              預計 {message.estimatedTime}
            </p>
          )}
        </div>
        {progressValue !== undefined && (
          <Progress value={progressValue} className="w-20 h-1.5" />
        )}
      </div>
    );
  }

  // Full variant - detailed display
  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      {/* Animated icon container */}
      <div className="relative">
        {isProcessing && (
          <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
        )}
        <div className={cn(
          'relative p-6 rounded-full',
          isProcessing ? 'bg-primary/10' : status === 'failed' ? 'bg-destructive/10' : 'bg-green-500/10'
        )}>
          <StatusIcon
            icon={message.icon}
            isAnimated={isProcessing && message.icon !== 'loader'}
          />
        </div>
      </div>

      {/* Title and subtitle */}
      <p className="text-lg font-medium mt-6">{message.title}</p>
      <p className="text-sm text-muted-foreground mt-2 text-center max-w-md">
        {message.subtitle}
      </p>

      {/* Estimated time */}
      {isProcessing && (message.estimatedTime || estimatedCompletionTime) && (
        <div className="flex items-center gap-1.5 mt-4 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>
            預計{' '}
            {estimatedCompletionTime
              ? formatTimeRemaining(estimatedCompletionTime)
              : message.estimatedTime}
          </span>
        </div>
      )}

      {/* Progress bar */}
      {progressValue !== undefined && isProcessing && (
        <Progress
          value={progressValue}
          className="w-full max-w-xs mt-6 h-2"
        />
      )}

      {/* Batch progress details */}
      {isBatch && progress?.batchProgress && (() => {
        const { total, completed, failed } = progress.batchProgress;
        const pending = total - completed - failed;
        return (
          <div className="flex gap-2 flex-wrap justify-center mt-4">
            <Badge variant="outline" className="text-xs gap-1 border-green-500/50 text-green-600">
              <CheckCircle className="h-3 w-3" />
              {completed} 完成
            </Badge>
            {pending > 0 && (
              <Badge variant="outline" className="text-xs gap-1 border-blue-500/50 text-blue-600">
                <Loader2 className="h-3 w-3 animate-spin" />
                {pending} 處理中
              </Badge>
            )}
            {failed > 0 && (
              <Badge variant="outline" className="text-xs gap-1 border-red-500/50 text-red-600">
                <AlertCircle className="h-3 w-3" />
                {failed} 失敗
              </Badge>
            )}
          </div>
        );
      })()}

      {/* Image confirmation for submitting state */}
      {status === 'draft' && (
        <div className="flex items-center gap-2 mt-4 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm">圖片已收到</span>
        </div>
      )}

      {/* Can leave message */}
      {message.canLeave && isProcessing && (
        <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 mt-6 max-w-sm text-center">
          <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-300">
            <Info className="h-4 w-4" />
            <p className="text-sm font-medium">您可以安心離開此頁面</p>
          </div>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
            處理完成後，您可以在歷史記錄中查看結果
          </p>
        </div>
      )}

      {/* View history button */}
      {message.canLeave && isProcessing && onViewHistory && (
        <Button
          variant="outline"
          className="mt-4"
          onClick={onViewHistory}
        >
          前往歷史記錄查看
        </Button>
      )}

      {/* Next step preview */}
      {nextStep && !isProcessing && (
        <div className="flex items-center gap-2 mt-6 text-sm text-muted-foreground">
          <span>下一步：{nextStep.label}</span>
          {nextStep.cost !== undefined && (
            <Badge variant="secondary" className="text-xs">
              {nextStep.cost} 點
            </Badge>
          )}
          {nextStep.optional && (
            <span className="text-muted-foreground/60">(可選)</span>
          )}
        </div>
      )}
    </div>
  );
}
