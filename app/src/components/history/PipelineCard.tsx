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
import { useTranslations } from 'next-intl';
import type { Pipeline, PipelineStatus } from '@/types';
import { ProviderBadge } from '@/components/ui/provider-badge';

interface PipelineCardProps {
  pipeline: Pipeline;
}

// Status icon and variant configuration (labels come from translations)
const STATUS_CONFIG: Record<
  PipelineStatus,
  { labelKey: string; icon: typeof Box; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  draft: { labelKey: 'draft', icon: Clock, variant: 'secondary' },
  'batch-queued': { labelKey: 'batchQueued', icon: Clock, variant: 'secondary' },
  'batch-processing': { labelKey: 'batchProcessing', icon: Loader2, variant: 'default' },
  'generating-images': { labelKey: 'generatingImages', icon: Loader2, variant: 'default' },
  'images-ready': { labelKey: 'imagesReady', icon: CheckCircle, variant: 'secondary' },
  'generating-mesh': { labelKey: 'generatingMesh', icon: Loader2, variant: 'default' },
  'mesh-ready': { labelKey: 'meshReady', icon: Box, variant: 'secondary' },
  'generating-texture': { labelKey: 'generatingTexture', icon: Loader2, variant: 'default' },
  completed: { labelKey: 'completed', icon: CheckCircle, variant: 'default' },
  failed: { labelKey: 'failed', icon: AlertCircle, variant: 'destructive' },
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
  const t = useTranslations();
  const statusConfig = STATUS_CONFIG[pipeline.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusConfig.icon;
  const statusLabel = t(`adminStatus.${statusConfig.labelKey}`);

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
            {statusLabel}
          </Badge>
        </div>

        {/* Model type indicators */}
        <div className="absolute bottom-2 left-2 flex gap-1">
          {pipeline.meshUrl && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Box className="h-3 w-3" />
              {t('selectors.mesh')}
            </Badge>
          )}
          {pipeline.texturedModelUrl && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Palette className="h-3 w-3" />
              {t('selectors.texture')}
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="p-4">
        {/* Date and credits */}
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
          <span>{formatDate(pipeline.createdAt)}</span>
          {totalCredits > 0 && (
            <span>{totalCredits} {t('pipeline.credits.points')}</span>
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
                {t('pipelineCard.viewResult')}
              </>
            ) : pipeline.status === 'failed' ? (
              <>
                <AlertCircle className="h-4 w-4" />
                {t('pipelineCard.retry')}
              </>
            ) : isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('pipelineCard.viewProgress')}
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4" />
                {t('pipelineCard.continue')}
              </>
            )}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
