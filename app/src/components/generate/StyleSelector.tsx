'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sparkles, Eye, Check, Pencil, AlertTriangle, ImageOff, X } from 'lucide-react';
import { type StyleId, STYLE_IDS } from '@/types/styles';
import { STYLE_CONFIGS, type StyleConfig } from '@/config/styles';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

interface StyleSelectorProps {
  value: StyleId;
  onChange: (style: StyleId) => void;
  recommendedStyle?: StyleId;
  styleConfidence?: number;
  disabled?: boolean;
  locked?: boolean;
  onRequestUnlock?: () => void;
  styleSuitability?: number;
  styleSuitabilityReason?: string;
}

// Style-specific accent colors (OKLCH parameters for compositing with alpha)
const getStyleColors = (styleId: StyleId) => {
  const colorMap: Record<StyleId, string> = {
    none: '70% 0.02 0',
    bobblehead: '75% 0.2 45',
    chibi: '72% 0.22 330',
    cartoon: '68% 0.22 265',
    emoji: '82% 0.18 90',
  };
  return colorMap[styleId];
};

/**
 * StyleSelector - Playful figure style selector with horizontal card layout
 */
export function StyleSelector({
  value,
  onChange,
  recommendedStyle,
  styleConfidence,
  disabled,
  locked,
  onRequestUnlock,
  styleSuitability,
  styleSuitabilityReason,
}: StyleSelectorProps) {
  const t = useTranslations('styles');
  const [previewStyle, setPreviewStyle] = useState<StyleConfig | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  const isDisabled = disabled || locked;
  const showSuitabilityWarning = styleSuitability !== undefined && styleSuitability < 0.5;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-base font-semibold">
            {t('selectStyle')}
          </h3>
          {locked && (
            <Badge variant="secondary" className="text-xs font-medium">
              {t('locked')}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {locked && onRequestUnlock && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2 gap-1.5 hover:bg-accent"
              onClick={onRequestUnlock}
            >
              <Pencil className="w-3.5 h-3.5" />
              {t('change')}
            </Button>
          )}
          {!locked && recommendedStyle && styleConfidence && styleConfidence > 0.5 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="w-4 h-4 text-amber-500 animate-sparkle" />
              <span className="font-medium">{t('aiRecommended')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Style Suitability Warning */}
      {showSuitabilityWarning && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              {t('suitabilityWarning', { style: t(`${value}.name`) })}
            </p>
            {styleSuitabilityReason && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                {styleSuitabilityReason}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Horizontal Style Cards */}
      <div className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity duration-300",
        locked && "opacity-60 pointer-events-none"
      )}>
        {STYLE_IDS.map((styleId) => {
          const style = STYLE_CONFIGS[styleId];
          const isSelected = value === styleId;
          const isRecommended = recommendedStyle === styleId;
          const colorValue = getStyleColors(styleId);
          const hasPreviewImages = style.previewImages.length > 0;

          return (
            <button
              key={styleId}
              type="button"
              onClick={() => onChange(styleId)}
              disabled={isDisabled}
              style={{
                '--style-accent': colorValue,
              } as React.CSSProperties}
              className={cn(
                // Base styles
                'group relative flex items-center gap-3 p-2.5 sm:p-3 rounded-2xl border-2 text-left',
                'transition-all duration-300 ease-out',
                'hover:scale-[1.02] hover:-translate-y-0.5',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:translate-y-0',
                // Default state
                !isSelected && [
                  'bg-card border-border/50',
                  'hover:border-[oklch(var(--style-accent)/0.5)]',
                  'hover:bg-[oklch(var(--style-accent)/0.05)]',
                  'hover:shadow-lg hover:shadow-[oklch(var(--style-accent)/0.1)]',
                ],
                // Selected state
                isSelected && [
                  'border-[oklch(var(--style-accent)/0.7)]',
                  'bg-[oklch(var(--style-accent)/0.08)]',
                  'shadow-lg shadow-[oklch(var(--style-accent)/0.15)]',
                  'ring-2 ring-[oklch(var(--style-accent)/0.2)]',
                ],
              )}
            >
              {/* AI Recommended Badge */}
              {isRecommended && !isSelected && (
                <div className="absolute -top-2 -right-2 z-10">
                  <div
                    className="flex items-center justify-center w-7 h-7 rounded-full shadow-lg"
                    style={{ backgroundColor: `oklch(${colorValue})` }}
                  >
                    <Sparkles className="w-4 h-4 text-white animate-sparkle" />
                  </div>
                </div>
              )}

              {/* Selected Check */}
              {isSelected && (
                <div className="absolute -top-1.5 -right-1.5 z-10">
                  <div
                    className="flex items-center justify-center w-6 h-6 rounded-full shadow-md"
                    style={{ backgroundColor: `oklch(${colorValue})` }}
                  >
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                  </div>
                </div>
              )}

              {/* Preview Thumbnail */}
              <div className={cn(
                "relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0",
                "border-2 transition-all duration-300",
                isSelected
                  ? "border-[oklch(var(--style-accent)/0.4)]"
                  : "border-transparent group-hover:border-[oklch(var(--style-accent)/0.3)]"
              )}>
                {hasPreviewImages ? (
                  <Image
                    src={style.previewImages[0]}
                    alt={t(`${styleId}.name`)}
                    fill
                    className={cn(
                      "object-cover transition-transform duration-500",
                      "group-hover:scale-110"
                    )}
                    sizes="(max-width: 640px) 64px, 80px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted/50">
                    <ImageOff className="w-6 h-6 text-muted-foreground/50" />
                  </div>
                )}
                {/* Hover overlay for preview images */}
                {hasPreviewImages && (
                  <div className={cn(
                    "absolute inset-0 flex items-center justify-center",
                    "bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  )}>
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className="font-display text-sm font-bold"
                    style={{ color: isSelected ? `oklch(${colorValue})` : undefined }}
                  >
                    {t(`${styleId}.name`)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {t(`${styleId}.description`)}
                </p>

                {/* View Examples Button */}
                {hasPreviewImages && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewStyle(style);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-medium mt-1",
                      "transition-colors duration-200",
                      "hover:underline underline-offset-2"
                    )}
                    style={{ color: `oklch(${colorValue})` }}
                  >
                    <Eye className="w-3 h-3" />
                    {t('viewExamples')}
                  </button>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Preview Modal */}
      <Dialog open={!!previewStyle} onOpenChange={() => setPreviewStyle(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {previewStyle && (
            <div className="flex flex-col md:flex-row">
              {/* Left: Style Info Panel */}
              <div
                className="w-full md:w-80 p-6 shrink-0"
                style={{
                  backgroundColor: `oklch(${getStyleColors(previewStyle.id as StyleId)} / 0.08)`,
                  borderRight: '1px solid oklch(var(--border))'
                }}
              >
                <DialogHeader className="space-y-4">
                  <div className="flex items-center gap-3">
                    {/* Style thumbnail */}
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border-2"
                      style={{ borderColor: `oklch(${getStyleColors(previewStyle.id as StyleId)} / 0.3)` }}
                    >
                      {previewStyle.previewImages.length > 0 && (
                        <Image
                          src={previewStyle.previewImages[0]}
                          alt={t(`${previewStyle.id}.name`)}
                          fill
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div>
                      <DialogTitle
                        className="font-display text-xl font-bold"
                        style={{ color: `oklch(${getStyleColors(previewStyle.id as StyleId)})` }}
                      >
                        {t(`${previewStyle.id}.name`)}
                      </DialogTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {t(`${previewStyle.id}.description`)}
                      </p>
                    </div>
                  </div>
                </DialogHeader>

                {/* Characteristics as colorful badges */}
                <div className="mt-6 space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('headRatio')}
                  </h4>
                  <div
                    className="inline-flex px-3 py-1.5 rounded-full text-sm font-medium"
                    style={{
                      backgroundColor: `oklch(${getStyleColors(previewStyle.id as StyleId)} / 0.15)`,
                      color: `oklch(${getStyleColors(previewStyle.id as StyleId)})`
                    }}
                  >
                    {t(`${previewStyle.id}.headRatio`)}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('bodyStyle')}
                  </h4>
                  <p className="text-sm">{t(`${previewStyle.id}.bodyStyle`)}</p>
                </div>

                <div className="mt-4 space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('faceEmphasis')}
                  </h4>
                  <p className="text-sm">{t(`${previewStyle.id}.faceEmphasis`)}</p>
                </div>

                <div className="mt-4 space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('colorApproach')}
                  </h4>
                  <p className="text-sm">{t(`${previewStyle.id}.colorApproach`)}</p>
                </div>

                {/* Select Button */}
                <Button
                  onClick={() => {
                    onChange(previewStyle.id as StyleId);
                    setPreviewStyle(null);
                  }}
                  className="w-full mt-6 font-display font-semibold"
                  style={{
                    backgroundColor: `oklch(${getStyleColors(previewStyle.id as StyleId)})`,
                    color: 'white'
                  }}
                >
                  {t('selectThisStyle')}
                </Button>
              </div>

              {/* Right: Preview Gallery */}
              <div className="flex-1 p-6 bg-card">
                <h4 className="text-sm font-semibold text-muted-foreground mb-4">
                  {t('viewExamples')}
                </h4>

                {previewStyle.previewImages.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {previewStyle.previewImages.map((src: string, idx: number) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setEnlargedImage(src)}
                        className={cn(
                          "relative aspect-square rounded-xl overflow-hidden",
                          "border-2 border-transparent",
                          "transition-all duration-300",
                          "hover:border-[oklch(var(--style-accent)/0.5)] hover:scale-[1.02]",
                          "hover:shadow-lg hover:shadow-[oklch(var(--style-accent)/0.2)]",
                          "focus:outline-none focus-visible:ring-2"
                        )}
                        style={{
                          '--style-accent': getStyleColors(previewStyle.id as StyleId),
                        } as React.CSSProperties}
                      >
                        <Image
                          src={src}
                          alt={`${t(`${previewStyle.id}.name`)} example ${idx + 1}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 150px, 200px"
                        />
                        {/* Hover zoom icon */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                          <Eye className="w-6 h-6 text-white" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <ImageOff className="w-16 h-16 mb-4 opacity-30" />
                    <p className="text-sm">{t(`${previewStyle.id}.description`)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Enlarged Image Modal */}
      <Dialog open={!!enlargedImage} onOpenChange={() => setEnlargedImage(null)}>
        <DialogContent className="max-w-3xl p-2 bg-black/95">
          <button
            onClick={() => setEnlargedImage(null)}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          {enlargedImage && (
            <div className="relative aspect-square w-full">
              <Image
                src={enlargedImage}
                alt="Enlarged preview"
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 800px"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
