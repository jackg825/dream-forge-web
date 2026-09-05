'use client';

import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FillImage } from '@/components/ui/fill-image';
import type { PipelineMeshAngle } from '@/types';

const ANGLES: PipelineMeshAngle[] = ['front', 'back', 'left', 'right'];

interface ViewComparisonDialogProps {
  angle: PipelineMeshAngle | null;
  onAngleChange: (angle: PipelineMeshAngle | null) => void;
  images: Partial<Record<PipelineMeshAngle, { url: string }>>;
  originalUrl?: string;
  onRegenerate: (angle: PipelineMeshAngle) => void;
  canRegenerate: boolean;
}

export function ViewComparisonDialog({ angle, onAngleChange, images, originalUrl, onRegenerate, canRegenerate }: ViewComparisonDialogProps) {
  const t = useTranslations('pipeline');
  const image = angle ? images[angle] : undefined;

  return (
    <Dialog open={angle !== null} onOpenChange={(open) => { if (!open) onAngleChange(null); }}>
      <DialogContent className="sm:max-w-4xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('viewPreview.title')}</DialogTitle>
          <DialogDescription>{t('viewPreview.description')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2" aria-label={t('viewPreview.angles')}>
          {ANGLES.map((item) => (
            <Button key={item} variant={angle === item ? 'default' : 'outline'} className="min-h-11" aria-pressed={angle === item} disabled={!images[item]} onClick={() => onAngleChange(item)}>
              {t(`angles.${item}`)}
            </Button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {originalUrl && (
            <figure>
              <figcaption className="text-sm font-medium mb-2">{t('viewPreview.original')}</figcaption>
              <div className="relative aspect-square rounded-lg bg-muted overflow-hidden">
                <FillImage src={originalUrl} alt={t('viewPreview.original')} className="object-contain" sizes="(min-width: 640px) 420px, 90vw" />
              </div>
            </figure>
          )}
          {image && angle && (
            <figure>
              <figcaption className="text-sm font-medium mb-2">{t(`angles.${angle}`)}</figcaption>
              <div className="relative aspect-square rounded-lg bg-muted overflow-hidden">
                <FillImage src={image.url} alt={t(`angles.${angle}`)} className="object-contain" sizes="(min-width: 640px) 420px, 90vw" />
              </div>
            </figure>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{t('viewPreview.checklist')}</p>
        <Button disabled={!angle || !canRegenerate} className="min-h-11" onClick={() => { if (angle) onRegenerate(angle); }}>
          {t('viewPreview.fixView')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
