'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Download, Upload, RefreshCw, Loader2, Check, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import type { ViewAngle, SessionViewImage } from '@/types';

interface ViewCardProps {
  angle: ViewAngle;
  view: SessionViewImage | undefined;
  onRegenerate?: (angle: ViewAngle) => Promise<void>;
  onUploadCustom?: (angle: ViewAngle, file: File) => Promise<void>;
  isRegenerating?: boolean;
  isUploading?: boolean;
  disabled?: boolean;
}

/**
 * ViewCard - Displays a single view image with actions
 *
 * Features:
 * - Shows view image with angle label
 * - Badge indicating AI-generated or user-uploaded
 * - Download button
 * - Upload custom image button (free)
 * - Regenerate button (costs 1 credit)
 */
export function ViewCard({
  angle,
  view,
  onRegenerate,
  onUploadCustom,
  isRegenerating = false,
  isUploading = false,
  disabled = false,
}: ViewCardProps) {
  const t = useTranslations('upload.viewAngles');
  const tPreview = useTranslations('create.preview');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Handle file selection for custom upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadCustom) {
      await onUploadCustom(angle, file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle download
  const handleDownload = async () => {
    if (!view?.url) return;

    setIsDownloading(true);
    try {
      const response = await fetch(view.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${angle}-view.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const isProcessing = isRegenerating || isUploading;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Image container */}
        <div className="relative aspect-square bg-muted">
          {view?.url ? (
            <>
              <Image
                src={view.url}
                alt={`${angle} view`}
                fill
                className="object-contain"
              />
              {/* Processing overlay */}
              {isProcessing && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <span className="text-sm">{tPreview('noImage')}</span>
            </div>
          )}

          {/* Source badge */}
          {view && (
            <div
              className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium ${
                view.source === 'ai'
                  ? 'bg-purple-500/90 text-white'
                  : 'bg-green-500/90 text-white'
              }`}
            >
              {view.source === 'ai' ? (
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  {tPreview('aiGenerated')}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  {tPreview('uploaded')}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer with angle label and actions */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-sm">{t(angle)}</span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-1">
            <TooltipProvider>
              {/* Download */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleDownload}
                    disabled={!view?.url || isDownloading || disabled}
                  >
                    {isDownloading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{tPreview('download')}</p>
                </TooltipContent>
              </Tooltip>

              {/* Upload custom */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing || disabled}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{tPreview('replaceButton')} ({tPreview('free')})</p>
                </TooltipContent>
              </Tooltip>

              {/* Regenerate (only for non-front angles) */}
              {angle !== 'front' && onRegenerate && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onRegenerate(angle)}
                      disabled={isProcessing || disabled}
                    >
                      {isRegenerating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{tPreview('regenerateButton')} ({tPreview('oneCredit')})</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </CardContent>
    </Card>
  );
}
