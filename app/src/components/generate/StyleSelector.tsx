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
  DialogDescription,
} from '@/components/ui/dialog';
import { Sparkles, Eye, Check } from 'lucide-react';
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
}

/**
 * StyleSelector - Figure style selector with AI recommendation
 *
 * Displays 4 style options: Bobblehead, Chibi, Cartoon, Emoji
 * Shows AI-recommended style with sparkle badge
 * Opens preview gallery when user clicks "View Examples"
 */
export function StyleSelector({
  value,
  onChange,
  recommendedStyle,
  styleConfidence,
  disabled,
}: StyleSelectorProps) {
  const t = useTranslations('styles');
  const [previewStyle, setPreviewStyle] = useState<StyleConfig | null>(null);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-muted-foreground">
          {t('selectStyle')}
        </div>
        {recommendedStyle && styleConfidence && styleConfidence > 0.5 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>{t('aiRecommended')}</span>
          </div>
        )}
      </div>

      {/* Style Grid - 2x2 on mobile, 4 columns on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STYLE_IDS.map((styleId) => {
          const style = STYLE_CONFIGS[styleId];
          const isSelected = value === styleId;
          const isRecommended = recommendedStyle === styleId;

          return (
            <button
              key={styleId}
              type="button"
              onClick={() => onChange(styleId)}
              disabled={disabled}
              className={cn(
                'relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-center transition-all',
                'hover:border-primary/50 hover:bg-accent/50',
                'disabled:cursor-not-allowed disabled:opacity-50',
                isSelected
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border bg-background'
              )}
            >
              {/* AI Recommended Badge */}
              {isRecommended && (
                <div className="absolute -top-2 -right-2 z-10">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground shadow-sm">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                </div>
              )}

              {/* Selected Check */}
              {isSelected && (
                <div className="absolute top-2 left-2 z-10">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground">
                    <Check className="w-3 h-3" />
                  </div>
                </div>
              )}

              {/* Preview Thumbnail */}
              <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden bg-muted">
                <Image
                  src={style.previewImages[0]}
                  alt={t(`${styleId}.name`)}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 64px, 80px"
                />
              </div>

              {/* Style Name */}
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-sm font-semibold">{t(`${styleId}.name`)}</span>
                <span className="text-xs text-muted-foreground">{t(`${styleId}.description`)}</span>
              </div>

              {/* View Examples Button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2 gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewStyle(style);
                }}
              >
                <Eye className="w-3 h-3" />
                {t('viewExamples')}
              </Button>
            </button>
          );
        })}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewStyle} onOpenChange={() => setPreviewStyle(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewStyle && t(`${previewStyle.id}.name`)}
            </DialogTitle>
            <DialogDescription>
              {previewStyle && t(`${previewStyle.id}.description`)}
            </DialogDescription>
          </DialogHeader>

          {/* Characteristics */}
          {previewStyle && (
            <div className="grid grid-cols-2 gap-3 py-3 border-y">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">{t('headRatio')}</div>
                <div className="text-sm font-medium">{t(`${previewStyle.id}.headRatio`)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">{t('bodyStyle')}</div>
                <div className="text-sm font-medium">{t(`${previewStyle.id}.bodyStyle`)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">{t('faceEmphasis')}</div>
                <div className="text-sm font-medium">{t(`${previewStyle.id}.faceEmphasis`)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">{t('colorApproach')}</div>
                <div className="text-sm font-medium">{t(`${previewStyle.id}.colorApproach`)}</div>
              </div>
            </div>
          )}

          {/* Preview Grid */}
          {previewStyle && (
            <div className="grid grid-cols-3 gap-3">
              {previewStyle.previewImages.map((src: string, idx: number) => (
                <div
                  key={idx}
                  className="relative aspect-square rounded-lg overflow-hidden bg-muted"
                >
                  <Image
                    src={src}
                    alt={`${t(`${previewStyle.id}.name`)} example ${idx + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100px, 150px"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Select Button */}
          <div className="flex justify-end pt-3">
            <Button
              onClick={() => {
                if (previewStyle) {
                  onChange(previewStyle.id);
                  setPreviewStyle(null);
                }
              }}
            >
              {t('selectThisStyle')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
