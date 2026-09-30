'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MoveHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ShowcaseImage, type ShowcaseImageKey } from './ShowcaseImage';

interface BeforeAfterSliderProps {
  beforeImage: ShowcaseImageKey;
  afterImage: ShowcaseImageKey;
  beforeAlt?: string;
  afterAlt?: string;
  className?: string;
}

export function BeforeAfterSlider({ beforeImage, afterImage, beforeAlt = 'Photo', afterAlt = '3D render', className }: BeforeAfterSliderProps) {
  const t = useTranslations('landing.store');
  const [position, setPosition] = useState(50);
  return (
    <div className={cn('relative isolate aspect-[4/3] w-full overflow-hidden rounded-3xl bg-card focus-within:ring-4 focus-within:ring-ring focus-within:ring-offset-4', className)}>
      <ShowcaseImage image={afterImage} alt={afterAlt} className="object-cover" sizes="(min-width: 1184px) 1120px, (min-width: 640px) calc(100vw - 64px), calc(100vw - 40px)" draggable={false} />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 0 0 ${position}%)` }}>
        <ShowcaseImage image={beforeImage} alt={beforeAlt} className="object-cover" sizes="(min-width: 1184px) 1120px, (min-width: 640px) calc(100vw - 64px), calc(100vw - 40px)" draggable={false} />
      </div>
      <span className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-2 text-xs font-medium text-white backdrop-blur-md sm:left-6 sm:top-6">{t('after')}</span>
      <span className="absolute right-4 top-4 rounded-full bg-white/85 px-3 py-2 text-xs font-medium text-[#1d1d1f] backdrop-blur-md sm:right-6 sm:top-6">{t('before')}</span>
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90" style={{ left: `${position}%` }}>
        <div className="absolute left-1/2 top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#1d1d1f] shadow-lg"><MoveHorizontal className="size-5" aria-hidden="true" /></div>
      </div>
      <input type="range" min="0" max="100" value={position} onChange={(event) => setPosition(Number(event.target.value))} aria-label={t('compareLabel')} aria-valuetext={t('compareValue', { value: position })} className="absolute inset-0 z-20 m-0 h-full w-full cursor-ew-resize opacity-0" />
    </div>
  );
}
