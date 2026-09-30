'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sparkles, Eye, Check, Pencil, AlertTriangle, ImageOff } from 'lucide-react';
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
    <section className="space-y-5 rounded-[24px] bg-card p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-semibold tracking-tight">{t('selectStyle')}</h3>
          {locked && <Badge variant="secondary">{t('locked')}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {locked && onRequestUnlock && (
            <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-primary" onClick={onRequestUnlock}>
              <Pencil className="h-3.5 w-3.5" />
              {t('change')}
            </Button>
          )}
          {!locked && recommendedStyle && styleConfidence && styleConfidence > 0.5 && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              {t('aiRecommended')}
            </span>
          )}
        </div>
      </div>

      {showSuitabilityWarning && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {t('suitabilityWarning', { style: t(`${value}.name`) })}
            </p>
            {styleSuitabilityReason && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{styleSuitabilityReason}</p>}
          </div>
        </div>
      )}

      <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5', locked && 'opacity-60')}>
        {STYLE_IDS.map((styleId) => {
          const style = STYLE_CONFIGS[styleId];
          const isSelected = value === styleId;
          const isRecommended = recommendedStyle === styleId;
          const hasPreviewImages = style.previewImages.length > 0;

          return (
            <div
              key={styleId}
              className={cn(
                'relative flex flex-col overflow-hidden rounded-[20px] border-2 transition-colors',
                isSelected ? 'border-primary bg-primary/[0.03]' : 'border-transparent bg-muted/60',
                !isDisabled && !isSelected && 'hover:border-border'
              )}
            >
              <button
                type="button"
                onClick={() => onChange(styleId)}
                disabled={isDisabled}
                aria-pressed={isSelected}
                className="flex flex-1 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:cursor-not-allowed"
              >
                <span className="relative block aspect-square w-full overflow-hidden bg-muted">
                  {hasPreviewImages ? (
                    <Image src={style.previewImages[0]} alt={t(`${styleId}.name`)} fill className="object-cover" sizes="(max-width: 640px) 160px, 200px" />
                  ) : (
                    <span className="flex h-full items-center justify-center"><ImageOff className="h-8 w-8 text-muted-foreground/40" /></span>
                  )}
                  {isSelected && (
                    <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                  )}
                  {isRecommended && !isSelected && (
                    <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-card text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                  )}
                </span>
                <span className="block px-3.5 pb-2 pt-4">
                  <span className="block text-sm font-semibold">{t(`${styleId}.name`)}</span>
                  <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">{t(`${styleId}.description`)}</span>
                </span>
              </button>
              {hasPreviewImages && (
                <button
                  type="button"
                  onClick={() => setPreviewStyle(style)}
                  disabled={isDisabled}
                  className="flex min-h-10 items-center gap-1.5 px-3.5 pb-3 text-left text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:cursor-not-allowed"
                >
                  <Eye className="h-3 w-3" />
                  {t('viewExamples')}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={!!previewStyle} onOpenChange={() => setPreviewStyle(null)}>
        <DialogContent className="max-h-[85dvh] max-w-[calc(100%-2rem)] overflow-y-auto rounded-[28px] p-0 sm:max-w-4xl">
          {previewStyle && (
            <div className="flex max-h-[85dvh] flex-col overflow-y-auto md:flex-row">
              <div className="w-full shrink-0 bg-muted/70 p-7 md:w-80">
                <DialogHeader>
                  <div className="relative mb-5 h-20 w-20 overflow-hidden rounded-[20px] bg-card">
                    {previewStyle.previewImages.length > 0 && (
                      <Image src={previewStyle.previewImages[0]} alt={t(`${previewStyle.id}.name`)} fill className="object-cover" sizes="80px" />
                    )}
                  </div>
                  <DialogTitle className="text-2xl font-semibold tracking-tight">{t(`${previewStyle.id}.name`)}</DialogTitle>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`${previewStyle.id}.description`)}</p>
                </DialogHeader>

                <dl className="mt-7 space-y-5">
                  {(['headRatio', 'bodyStyle', 'faceEmphasis', 'colorApproach'] as const).map((detail) => (
                    <div key={detail}>
                      <dt className="text-xs font-medium text-muted-foreground">{t(detail)}</dt>
                      <dd className="mt-1.5 text-sm leading-relaxed">{t(`${previewStyle.id}.${detail}`)}</dd>
                    </div>
                  ))}
                </dl>
                <Button
                  disabled={isDisabled}
                  onClick={() => {
                    onChange(previewStyle.id as StyleId);
                    setPreviewStyle(null);
                  }}
                  className="mt-7 w-full"
                >
                  {t('selectThisStyle')}
                </Button>
              </div>

              <div className="flex-1 bg-card p-7">
                <h4 className="mb-5 text-sm font-semibold">{t('viewExamples')}</h4>
                {previewStyle.previewImages.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {previewStyle.previewImages.map((src, idx) => (
                      <button
                        key={src}
                        type="button"
                        onClick={() => setEnlargedImage(src)}
                        aria-label={`${t('viewExamples')} ${idx + 1}`}
                        className="group relative aspect-square overflow-hidden rounded-2xl bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <Image src={src} alt={`${t(`${previewStyle.id}.name`)} ${idx + 1}`} fill className="object-cover" sizes="(max-width: 640px) 150px, 200px" />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                          <Eye className="h-6 w-6 text-white" />
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <ImageOff className="mb-4 h-16 w-16 opacity-30" />
                    <p className="text-sm">{t(`${previewStyle.id}.description`)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!enlargedImage} onOpenChange={() => setEnlargedImage(null)}>
        <DialogContent className="max-h-[85dvh] max-w-[calc(100%-2rem)] overflow-y-auto rounded-[28px] bg-card p-4 sm:max-w-3xl">
          <DialogTitle className="sr-only">{t('viewExamples')}</DialogTitle>
          {enlargedImage && (
            <div className="relative aspect-square w-full overflow-hidden rounded-[20px] bg-muted">
              <Image src={enlargedImage} alt={t('viewExamples')} fill className="object-contain" sizes="(max-width: 768px) 100vw, 800px" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
