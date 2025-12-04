'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Box,
  Palette,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { AdminPipeline, PipelineStatus } from '@/types';
import { ProviderBadge } from '@/components/ui/provider-badge';

interface AdminPipelineCardProps {
  pipeline: AdminPipeline;
  onClick?: () => void;
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('zh-TW', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

export function AdminPipelineCard({ pipeline, onClick }: AdminPipelineCardProps) {
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
    <Card
      className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      {/* Preview image */}
      <div className="aspect-square bg-black relative">
        {previewImage ? (
          <img
            src={previewImage}
            alt="Pipeline preview"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Box className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}

        {/* Provider badge - top-left */}
        <div className="absolute top-2 left-2">
          <ProviderBadge provider={pipeline.settings.provider} />
        </div>

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
        {/* User info */}
        <div className="flex items-center gap-2 mb-3">
          <Avatar className="h-6 w-6">
            <AvatarImage src={pipeline.userPhotoURL || undefined} />
            <AvatarFallback className="text-xs">
              {pipeline.userDisplayName?.[0] || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{pipeline.userDisplayName}</p>
            <p className="text-xs text-muted-foreground truncate">{pipeline.userEmail}</p>
          </div>
        </div>

        {/* Date and credits */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{formatDate(pipeline.createdAt)}</span>
          {totalCredits > 0 && (
            <span>{totalCredits} 點</span>
          )}
        </div>

        {/* Error message */}
        {pipeline.status === 'failed' && pipeline.error && (
          <p className="text-xs text-destructive mt-2 line-clamp-2">
            {pipeline.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
