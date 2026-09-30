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
import { FillImage } from '@/components/ui/fill-image';

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
    <Card className="group gap-0 overflow-hidden py-0 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_12px_36px_rgba(0,0,0,0.08)]">
      {/* Preview image */}
      <div className="relative aspect-[4/3] bg-[#f0f0f2] dark:bg-[#242426]">
        {previewImage ? (
          <FillImage
            src={previewImage}
            alt="Pipeline preview"
            className="object-contain p-6 transition-transform duration-500 group-hover:scale-[1.04]"
            sizes="(min-width: 1024px) 350px, (min-width: 640px) 50vw, 100vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Box className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}

        {/* Provider badge - top-left */}
        <div className="absolute top-4 left-4">
          <ProviderBadge provider={pipeline.settings.provider} />
        </div>

        {/* Status badge overlay */}
        <div className="absolute top-4 right-4">
          <Badge variant={statusConfig.variant} className="gap-1">
            <StatusIcon
              className={`h-3 w-3 ${isProcessing ? 'animate-spin' : ''}`}
            />
            {statusLabel}
          </Badge>
        </div>

        {/* Model type indicators */}
        <div className="absolute bottom-4 left-4 flex gap-1.5">
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

      <CardContent className="p-6">
        {/* Date and credits */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
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
        <Button asChild variant="outline" size="sm" className="h-10 w-full">
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
