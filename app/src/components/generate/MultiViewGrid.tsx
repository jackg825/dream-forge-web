'use client';

/**
 * MultiViewGrid Component
 *
 * Displays a 6-view grid for multi-angle images:
 * - 4 Mesh Views: front, back, left, right
 * - 2 Texture Views: front, back
 *
 * Supports:
 * - AI-generated images display
 * - Manual upload for individual slots
 * - Replace existing images
 * - Processing state indicators
 */

import { useRef, useState } from 'react';
import { Upload, Loader2, CheckCircle, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type {
  PipelineMeshAngle,
  PipelineTextureAngle,
  PipelineProcessedImage,
} from '@/types';

// View configuration
const MESH_VIEWS: { angle: PipelineMeshAngle; label: string }[] = [
  { angle: 'front', label: '正面' },
  { angle: 'back', label: '背面' },
  { angle: 'left', label: '左側' },
  { angle: 'right', label: '右側' },
];

const TEXTURE_VIEWS: { angle: PipelineTextureAngle; label: string }[] = [
  { angle: 'front', label: '正面' },
  { angle: 'back', label: '背面' },
];

interface ViewSlotProps {
  angle: string;
  label: string;
  image: PipelineProcessedImage | undefined;
  isGenerating: boolean;
  onUpload: (file: File) => void;
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
  const inputRef = useRef<HTMLInputElement>(null);
  const isUploading = uploadingAngle === angle;

  const handleClick = () => {
    if (!disabled && !isGenerating && !isUploading) {
      inputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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
          'aspect-square rounded-lg border-2 overflow-hidden transition-all',
          'flex items-center justify-center',
          image ? 'border-border bg-black' : 'border-dashed border-muted-foreground/30 bg-muted/30',
          !disabled && !isGenerating && !isUploading && 'cursor-pointer hover:border-primary/50 hover:bg-muted/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onClick={handleClick}
      >
        {isGenerating || isUploading ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-xs">{isUploading ? '上傳中...' : '生成中...'}</span>
          </div>
        ) : image ? (
          <img
            src={image.url}
            alt={`${label} view`}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload className="h-6 w-6" />
            <span className="text-xs">上傳</span>
          </div>
        )}
      </div>

      {/* Label and source badge */}
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {image && (
          <Badge
            variant={image.source === 'gemini' ? 'secondary' : 'outline'}
            className="text-[10px] px-1 py-0 h-4"
          >
            {image.source === 'gemini' ? 'AI' : '手動'}
          </Badge>
        )}
      </div>

      {/* Hover overlay with actions */}
      {image && !disabled && !isGenerating && (
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
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
            替換
          </Button>
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
              重新生成
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
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="sr-only"
      />
    </div>
  );
}

interface MultiViewGridProps {
  meshImages: Partial<Record<PipelineMeshAngle, PipelineProcessedImage>>;
  textureImages: Partial<Record<PipelineTextureAngle, PipelineProcessedImage>>;
  isGenerating: boolean;
  generatingPhase?: 'mesh-views' | 'texture-views';
  onUploadView: (viewType: 'mesh' | 'texture', angle: string, file: File) => void;
  onRegenerateView?: (viewType: 'mesh' | 'texture', angle: string) => void;
  disabled?: boolean;
  uploadingView?: { type: 'mesh' | 'texture'; angle: string } | null;
}

export function MultiViewGrid({
  meshImages,
  textureImages,
  isGenerating,
  generatingPhase,
  onUploadView,
  onRegenerateView,
  disabled,
  uploadingView,
}: MultiViewGridProps) {
  // Count completed images
  const meshCount = Object.keys(meshImages).length;
  const textureCount = Object.keys(textureImages).length;
  const totalCount = meshCount + textureCount;
  const allComplete = meshCount === 4 && textureCount === 2;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-foreground flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          多視角圖片
          <Badge variant={allComplete ? 'default' : 'secondary'} className="ml-1">
            {totalCount}/6
          </Badge>
        </h3>
        {isGenerating && (
          <Badge variant="outline" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {generatingPhase === 'mesh-views' ? '生成網格視角...' : '生成貼圖視角...'}
          </Badge>
        )}
      </div>

      {/* Mesh Views (4 columns) */}
      <div>
        <h4 className="text-sm text-muted-foreground mb-2">網格視角 (4 張)</h4>
        <div className="grid grid-cols-4 gap-3">
          {MESH_VIEWS.map(({ angle, label }) => (
            <ViewSlot
              key={`mesh-${angle}`}
              angle={angle}
              label={label}
              image={meshImages[angle]}
              isGenerating={isGenerating && generatingPhase === 'mesh-views' && !meshImages[angle]}
              onUpload={(file) => onUploadView('mesh', angle, file)}
              onRegenerate={onRegenerateView ? () => onRegenerateView('mesh', angle) : undefined}
              disabled={disabled}
              uploadingAngle={uploadingView?.type === 'mesh' ? uploadingView.angle : undefined}
            />
          ))}
        </div>
      </div>

      {/* Texture Views (2 columns, centered) */}
      <div>
        <h4 className="text-sm text-muted-foreground mb-2">貼圖視角 (2 張)</h4>
        <div className="grid grid-cols-4 gap-3">
          <div /> {/* Empty for centering */}
          {TEXTURE_VIEWS.map(({ angle, label }) => (
            <ViewSlot
              key={`texture-${angle}`}
              angle={angle}
              label={label}
              image={textureImages[angle]}
              isGenerating={isGenerating && generatingPhase === 'texture-views' && !textureImages[angle]}
              onUpload={(file) => onUploadView('texture', angle, file)}
              onRegenerate={onRegenerateView ? () => onRegenerateView('texture', angle) : undefined}
              disabled={disabled}
              uploadingAngle={uploadingView?.type === 'texture' ? uploadingView.angle : undefined}
            />
          ))}
          <div /> {/* Empty for centering */}
        </div>
      </div>

      {/* Help text */}
      <p className="text-xs text-muted-foreground">
        點擊空格上傳圖片，或 hover 已有圖片進行替換。AI 生成的圖片標記為「AI」，手動上傳標記為「手動」。
      </p>
    </div>
  );
}
