'use client';

import { useTranslations } from 'next-intl';
import { Zap, FileDown, Printer, Shield, Palette, Globe, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeaturesSectionProps {
  className?: string;
}

const features = [
  { id: 'fast', icon: Zap },
  { id: 'formats', icon: FileDown },
  { id: 'printing', icon: Printer },
  { id: 'quality', icon: Palette },
  { id: 'secure', icon: Shield },
  { id: 'global', icon: Globe },
];

export function FeaturesSection({ className }: FeaturesSectionProps) {
  const t = useTranslations('landing');

  return (
    <section id="features" className={cn('store-section', className)}>
      <div className="store-container">
        <div className="mb-10 max-w-3xl sm:mb-12">
          <p className="store-eyebrow mb-3">{t('features.badge')}</p>
          <h2 className="store-heading">{t('features.title')}</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground sm:text-xl">
            {t('features.subtitle')}
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            const isDark = feature.id === 'fast';

            return (
              <article
                key={feature.id}
                className={cn('store-card flex min-h-[270px] flex-col p-7 sm:p-8', isDark && 'bg-[#1d1d1f] text-white')}
              >
                <Icon className="mb-7 h-8 w-8" strokeWidth={1.5} aria-hidden="true" />
                <h3 className="text-[22px] font-semibold tracking-tight">{t(`features.items.${feature.id}.title`)}</h3>
                <p className={cn('mt-3 text-[15px] leading-relaxed', isDark ? 'text-[#b5b5ba]' : 'text-muted-foreground')}>
                  {t(`features.items.${feature.id}.description`)}
                </p>
                {isDark && (
                  <p className="mt-auto flex items-center gap-2 pt-7 text-xs text-[#b5b5ba]">
                    <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {t('features.items.fast.subtext')}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
