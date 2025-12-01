'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import {
  Box,
  Palette,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import type { Pipeline, PipelineStatus } from '@/types';

interface PipelineCardProps {
  pipeline: Pipeline;
}

// Status display configuration
const STATUS_CONFIG: Record<
  PipelineStatus,
  { label: string; icon: typeof Box; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  draft: { label: '草稿', icon: Clock, variant: 'secondary' },
  'batch-queued': { label: '排隊中', icon: Clock, variant: 'secondary' },
  'batch-processing': { label: '批次處理中', icon: Loader2, variant: 'default' },
  'generating-images': { label: '生成圖片中', icon: Loader2, variant: 'default' },
  'images-ready': { label: '圖片就緒', icon: CheckCircle, variant: 'secondary' },
  'generating-mesh': { label: '生成網格中', icon: Loader2, variant: 'default' },
  'mesh-ready': { label: '網格就緒', icon: Box, variant: 'secondary' },
  'generating-texture': { label: '生成貼圖中', icon: Loader2, variant: 'default' },
  completed: { label: '完成', icon: CheckCircle, variant: 'default' },
  failed: { label: '失敗', icon: AlertCircle, variant: 'destructive' },
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-TW', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function PipelineCard({ pipeline }: PipelineCardProps) {
  const statusConfig = STATUS_CONFIG[pipeline.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusConfig.icon;

  // Get preview image (first input image or first generated mesh image)
  const previewImage =
    pipeline.inputImages[0]?.url ||
    pipeline.meshImages?.front?.url ||
    null;

  // Determine if pipeline is in progress
  const isProcessing =
    pipeline.status === 'batch-queued' ||
    pipeline.status === 'batch-processing' ||
    pipeline.status === 'generating-images' ||
    pipeline.status === 'generating-mesh' ||
    pipeline.status === 'generating-texture';

  // Calculate total credits used
  const totalCredits = pipeline.creditsCharged.mesh + pipeline.creditsCharged.texture;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      {/* Preview image */}
      <div className="aspect-square bg-muted relative">
        {previewImage ? (
          <img
            src={previewImage}
            alt="Pipeline preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Box className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}

        {/* Status badge overlay */}
        <div className="absolute top-2 right-2">
          <Badge variant={statusConfig.variant} className="gap-1">
            <StatusIcon
              className={`h-3 w-3 ${isProcessing ? 'animate-spin' : ''}`}
            />
            {statusConfig.label}
          </Badge>
        </div>

        {/* Model type indicators */}
        <div className="absolute bottom-2 left-2 flex gap-1">
          {pipeline.meshUrl && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Box className="h-3 w-3" />
              網格
            </Badge>
          )}
          {pipeline.texturedModelUrl && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Palette className="h-3 w-3" />
              貼圖
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="p-4">
        {/* Date and credits */}
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
          <span>{formatDate(pipeline.createdAt)}</span>
          {totalCredits > 0 && (
            <span>{totalCredits} 點</span>
          )}
        </div>

        {/* Error message */}
        {pipeline.status === 'failed' && pipeline.error && (
          <p className="text-xs text-destructive mb-3 line-clamp-2">
            {pipeline.error}
          </p>
        )}

        {/* Action button */}
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={`/generate?id=${pipeline.id}`} className="gap-2">
            {pipeline.status === 'completed' ? (
              <>
                <ExternalLink className="h-4 w-4" />
                查看結果
              </>
            ) : pipeline.status === 'failed' ? (
              <>
                <AlertCircle className="h-4 w-4" />
                重試
              </>
            ) : isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                查看進度
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4" />
                繼續
              </>
            )}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
