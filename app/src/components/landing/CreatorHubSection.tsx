'use client';

import { useTranslations } from 'next-intl';
import { Upload, DollarSign, BarChart3, Search, Gem, Printer, Users, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreatorHubSectionProps {
  className?: string;
}

const audiences = [
  {
    id: 'forCreators',
    icon: Users,
    features: [
      { id: 'upload', icon: Upload },
      { id: 'earn', icon: DollarSign },
      { id: 'analytics', icon: BarChart3 },
    ],
  },
  {
    id: 'forCollectors',
    icon: ShoppingBag,
    features: [
      { id: 'discover', icon: Search },
      { id: 'options', icon: Gem },
      { id: 'print', icon: Printer },
    ],
  },
];

export function CreatorHubSection({ className }: CreatorHubSectionProps) {
  const t = useTranslations('landing');

  return (
    <section id="creator-hub" className={cn('store-section', className)}>
      <div className="store-container">
        <div className="mb-10 max-w-3xl sm:mb-12">
          <p className="store-eyebrow mb-3">{t('creatorHub.badge')}</p>
          <h2 className="store-heading">{t('creatorHub.title')}</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground sm:text-xl">
            {t('creatorHub.subtitle')}
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {audiences.map((audience) => {
            const Icon = audience.icon;

            return (
              <article key={audience.id} className="store-card p-7 sm:p-10">
                <div className="mb-8 flex items-start justify-between gap-4">
                  <div>
                    <p className="mb-3 text-xs font-medium text-muted-foreground">{t('creatorHub.badge')}</p>
                    <h3 className="text-[26px] font-semibold tracking-tight sm:text-3xl">
                      {t(`creatorHub.${audience.id}.title`)}
                    </h3>
                    <p className="mt-2 text-base text-muted-foreground">{t(`creatorHub.${audience.id}.subtitle`)}</p>
                  </div>
                  <Icon className="mt-1 h-8 w-8 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                </div>
                <ul className="divide-y divide-border/70">
                  {audience.features.map((feature) => {
                    const FeatureIcon = feature.icon;

                    return (
                      <li key={feature.id} className="flex gap-4 py-5 first:pt-0 last:pb-0">
                        <FeatureIcon className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                        <div>
                          <h4 className="text-base font-semibold">{t(`creatorHub.${audience.id}.${feature.id}.title`)}</h4>
                          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                            {t(`creatorHub.${audience.id}.${feature.id}.description`)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">{t('creatorHub.connector')}</p>
      </div>
    </section>
  );
}
