'use client';

/**
 * MultiViewGrid Component
 *
 * Displays a 4-view grid for mesh reference images:
 * - 4 Mesh Views: front, back, left, right
 *
 * Supports:
 * - AI-generated images display
 * - Processing state indicators
 */

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, Loader2, CheckCircle, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FillImage } from '@/components/ui/fill-image';
import { cn } from '@/lib/utils';
import type {
  PipelineMeshAngle,
  PipelineProcessedImage,
} from '@/types';

// View configuration
const MESH_VIEWS: PipelineMeshAngle[] = ['front', 'back', 'left', 'right'];

interface ViewSlotProps {
  angle: string;
  label: string;
  image: PipelineProcessedImage | undefined;
  isGenerating: boolean;
  onUpload?: (file: File) => void;
  onRegenerate?: () => void;
  disabled?: boolean;
  uploadingAngle?: string;
}

function ViewSlot({
  angle,
  label,
  image,
  isGenerating,
  onUpload,
  onRegenerate,
  disabled,
  uploadingAngle,
}: ViewSlotProps) {
  const t = useTranslations('multiViewGrid');
  const inputRef = useRef<HTMLInputElement>(null);
  const isUploading = uploadingAngle === angle;
  const isAiGenerated = image?.source.startsWith('gemini') ?? false;

  const handleClick = () => {
    if (onUpload && !disabled && !isGenerating && !isUploading) {
      inputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpload) {
      onUpload(file);
    }
    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className="relative group">
      <div
        className={cn(
          'relative aspect-square rounded-lg border-2 overflow-hidden transition-all',
          'flex items-center justify-center',
          image ? 'border-border bg-black' : 'border-dashed border-muted-foreground/30 bg-muted/30',
          onUpload && !disabled && !isGenerating && !isUploading && 'cursor-pointer hover:border-primary/50 hover:bg-muted/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onClick={handleClick}
      >
        {isGenerating || isUploading ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-xs">{isUploading ? t('status.uploading') : t('status.generating')}</span>
          </div>
        ) : image ? (
          <FillImage
            src={image.url}
            alt={t('viewAlt', { label })}
            className="object-contain"
            sizes="(min-width: 768px) 25vw, 50vw"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
            <span className="text-xs">{t('status.missing')}</span>
          </div>
        )}
      </div>

      {/* Label and source badge */}
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {image && (
          <Badge
            variant={isAiGenerated ? 'secondary' : 'outline'}
            className="text-[10px] px-1 py-0 h-4"
          >
            {isAiGenerated ? t('source.ai') : t('source.manual')}
          </Badge>
        )}
      </div>

      {/* Hover overlay with actions */}
      {image && !disabled && !isGenerating && (onUpload || onRegenerate) && (
        <div className="absolute inset-0 bg-transparent opacity-100 p-2 flex items-end justify-end gap-2 rounded-lg md:bg-black/60 md:opacity-0 md:p-0 md:items-center md:justify-center md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          {onUpload && (
            <Button
              size="sm"
              variant="secondary"
              className="h-8"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              <Upload className="h-3.5 w-3.5 mr-1" />
              {t('actions.replace')}
            </Button>
          )}
          {onRegenerate && (
            <Button
              size="sm"
              variant="secondary"
              className="h-8"
              onClick={(e) => {
                e.stopPropagation();
                onRegenerate();
              }}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              {t('actions.regenerate')}
            </Button>
          )}
        </div>
      )}

      {/* Status indicator */}
      {image && (
        <div className="absolute top-1 right-1">
          <CheckCircle className="h-4 w-4 text-green-500" />
        </div>
      )}

      {/* Hidden file input */}
      {onUpload && (
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="sr-only"
        />
      )}
    </div>
  );
}

interface MultiViewGridProps {
  meshImages: Partial<Record<PipelineMeshAngle, PipelineProcessedImage>>;
  isGenerating: boolean;
  generatingPhase?: 'mesh-views' | 'complete';
  onUploadView?: (viewType: 'mesh', angle: string, file: File) => void;
  onRegenerateView?: (viewType: 'mesh', angle: string) => void;
  disabled?: boolean;
  uploadingView?: { type: 'mesh'; angle: string } | null;
}

export function MultiViewGrid({
  meshImages,
  isGenerating,
  generatingPhase,
  onUploadView,
  onRegenerateView,
  disabled,
  uploadingView,
}: MultiViewGridProps) {
  const t = useTranslations('multiViewGrid');
  // Count completed images
  const meshCount = Object.keys(meshImages).length;
  const totalRequired = 4;
  const totalCount = meshCount;
  const allComplete = meshCount === 4;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-foreground flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          {t('title')}
          <Badge variant={allComplete ? 'default' : 'secondary'} className="ml-1">
            {totalCount}/{totalRequired}
          </Badge>
        </h3>
        {isGenerating && (
          <Badge variant="outline" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('status.generatingMeshViews')}
          </Badge>
        )}
      </div>

      {/* Mesh Views (4 columns) */}
      <div>
        <h4 className="text-sm text-muted-foreground mb-2">{t('meshImages')}</h4>
        <div className="grid grid-cols-4 gap-3">
          {MESH_VIEWS.map((angle) => (
            <ViewSlot
              key={`mesh-${angle}`}
              angle={angle}
              label={t(`angles.${angle}`)}
              image={meshImages[angle]}
              isGenerating={isGenerating && generatingPhase === 'mesh-views' && !meshImages[angle]}
              onUpload={onUploadView ? (file) => onUploadView('mesh', angle, file) : undefined}
              onRegenerate={onRegenerateView ? () => onRegenerateView('mesh', angle) : undefined}
              disabled={disabled}
              uploadingAngle={uploadingView?.type === 'mesh' ? uploadingView.angle : undefined}
            />
          ))}
        </div>
      </div>

      {/* Help text */}
      <p className="text-xs text-muted-foreground">
        {onUploadView ? t('help') : t('helpRegenerate')}
      </p>
    </div>
  );
}
