'use client';

import { useTranslations } from 'next-intl';
import { Printer, Package, Globe, Truck, Leaf, Gem } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FillImage } from '@/components/ui/fill-image';

interface PrintServiceSectionProps {
  className?: string;
}

const sizes = [
  { id: 'small', dimension: '~5 cm' },
  { id: 'medium', dimension: '~10 cm' },
  { id: 'large', dimension: '~15 cm' },
];

const materials = [
  { id: 'pla', icon: Leaf },
  { id: 'resin', icon: Gem },
];

const features = [
  { icon: Printer, key: 'quality' },
  { icon: Package, key: 'packaging' },
  { icon: Globe, key: 'worldwide' },
  { icon: Truck, key: 'tracking' },
];

export function PrintServiceSection({ className }: PrintServiceSectionProps) {
  const t = useTranslations('landing');

  return (
    <section id="print-service" className={cn('store-section scroll-mt-24', className)}>
      <div className="store-container">
        <div className="mb-10 max-w-3xl sm:mb-12">
          <p className="store-eyebrow mb-3">{t('printService.badge')}</p>
          <h2 className="store-heading">{t('printService.title')}</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground sm:text-xl">
            {t('printService.subtitle')}
          </p>
        </div>

        <div className="store-card grid overflow-hidden lg:grid-cols-2">
          <div className="flex flex-col bg-[#e8e8ed] text-[#1d1d1f]">
            <div className="px-7 pt-7 sm:px-10 sm:pt-10">
              <p className="text-xs font-medium text-[#6e6e73]">{t('printService.statusReady')}</p>
              <h3 className="mt-3 text-[26px] font-semibold tracking-tight">{t('printService.previewTitle')}</h3>
            </div>
            <div className="relative mt-6 min-h-72 flex-1 sm:min-h-96">
              <FillImage src="/showcase/race_car_render.png" alt={t('printService.previewTitle')} className="object-cover" sizes="(min-width: 1024px) 50vw, 100vw" />
            </div>
            <p className="flex items-center gap-2 px-7 py-6 text-xs text-[#6e6e73] sm:px-10">
              <Globe className="h-4 w-4" aria-hidden="true" />
              {t('printService.worldwide')}
            </p>
          </div>

          <div className="p-7 sm:p-10">
            <h3 className="mb-4 text-lg font-semibold">{t('printService.sizesTitle')}</h3>
            <dl className="grid grid-cols-3 gap-3">
              {sizes.map((size) => (
                <div key={size.id} className="rounded-2xl bg-secondary px-3 py-5 text-center">
                  <dt className="text-xs text-muted-foreground">{t(`printService.sizes.${size.id}`)}</dt>
                  <dd className="mt-2 text-lg font-semibold tracking-tight">{size.dimension}</dd>
                </div>
              ))}
            </dl>

            <h3 className="mb-4 mt-7 text-lg font-semibold">{t('printService.materialsTitle')}</h3>
            <ul className="space-y-4">
              {materials.map((material) => {
                const Icon = material.icon;

                return (
                  <li key={material.id} className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold">{t(`printService.materials.${material.id}.name`)}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{t(`printService.materials.${material.id}.desc`)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <ul className="mt-7 grid gap-3 border-t border-border/70 pt-6 sm:grid-cols-2">
              {features.map((feature) => {
                const Icon = feature.icon;

                return (
                  <li key={feature.key} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                    {t(`printService.features.${feature.key}`)}
                  </li>
                );
              })}
            </ul>

            <div className="mt-7 border-t border-border/70 pt-6">
              <p className="text-xs text-muted-foreground">{t('printService.startingFrom')}</p>
              <p className="mt-1 text-[22px] font-semibold tracking-tight">{t('printService.comingSoon')}</p>
              <p className="mt-2 text-xs text-muted-foreground">{t('printService.shippingIncluded')}</p>
              <Button disabled variant="secondary" className="mt-5 h-11 w-full rounded-full font-normal disabled:opacity-70">
                {t('printService.cta')}
              </Button>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t('printService.trustNote')}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
