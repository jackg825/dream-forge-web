'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { ComingSoonBadge } from '@/components/ui/coming-soon-badge';
import {
  Upload,
  DollarSign,
  BarChart3,
  Search,
  Gem,
  Printer,
  Users,
  ShoppingBag,
} from 'lucide-react';

interface CreatorHubSectionProps {
  className?: string;
}

const creatorFeatures = [
  { id: 'upload', icon: Upload, color: 'var(--accent-violet)' },
  { id: 'earn', icon: DollarSign, color: 'var(--accent-mint)' },
  { id: 'analytics', icon: BarChart3, color: 'var(--accent-coral)' },
];

const collectorFeatures = [
  { id: 'discover', icon: Search, color: 'var(--accent-mint)' },
  { id: 'options', icon: Gem, color: 'var(--accent-violet)' },
  { id: 'print', icon: Printer, color: 'var(--accent-coral)' },
];

/**
 * CreatorHubSection - Upcoming creator marketplace feature showcase
 * Split view design: Creators vs Collectors with "Coming Soon" badge
 */
export function CreatorHubSection({ className }: CreatorHubSectionProps) {
  const t = useTranslations('landing');

  return (
    <section
      className={cn(
        'py-16 sm:py-24 bg-gradient-to-b from-muted/30 to-background relative overflow-hidden',
        className
      )}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-0 w-72 h-72 bg-[var(--accent-violet)]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-72 h-72 bg-[var(--accent-mint)]/5 rounded-full blur-3xl" />
      </div>

      <div className="container max-w-6xl mx-auto px-4 relative z-10">
        {/* Section header */}
        <div className="text-center mb-10 sm:mb-16">
          <div className="inline-flex items-center gap-2 mb-3 sm:mb-4">
            <ComingSoonBadge size="md">
              {t('creatorHub.badge')}
            </ComingSoonBadge>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-3 sm:mb-4">
            {t('creatorHub.title')}
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            {t('creatorHub.subtitle')}
          </p>
        </div>

        {/* Split view - Creators vs Collectors */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* For Creators */}
          <div className="relative group">
            <div
              className={cn(
                'rounded-2xl border border-dashed border-[var(--accent-violet)]/30 p-6 sm:p-8',
                'bg-gradient-to-br from-[var(--accent-violet)]/5 to-transparent',
                'transition-all duration-300 hover:border-[var(--accent-violet)]/50 hover:shadow-lg'
              )}
            >
              {/* Header with icon */}
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div className="p-2.5 rounded-xl bg-[var(--accent-violet)]/10">
                  <Users className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--accent-violet)]" />
                </div>
                <div>
                  <h3 className="font-display text-lg sm:text-xl font-bold">
                    {t('creatorHub.forCreators.title')}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {t('creatorHub.forCreators.subtitle')}
                  </p>
                </div>
              </div>

              {/* Feature list */}
              <div className="space-y-4">
                {creatorFeatures.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div key={feature.id} className="flex gap-3 sm:gap-4">
                      <div
                        className="shrink-0 p-2 rounded-lg"
                        style={{ backgroundColor: `color-mix(in srgb, ${feature.color} 15%, transparent)` }}
                      >
                        <Icon
                          className="w-4 h-4 sm:w-5 sm:h-5"
                          style={{ color: feature.color }}
                        />
                      </div>
                      <div>
                        <h4 className="text-sm sm:text-base font-semibold mb-0.5">
                          {t(`creatorHub.forCreators.${feature.id}.title`)}
                        </h4>
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                          {t(`creatorHub.forCreators.${feature.id}.description`)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* For Collectors */}
          <div className="relative group">
            <div
              className={cn(
                'rounded-2xl border border-dashed border-[var(--accent-mint)]/30 p-6 sm:p-8',
                'bg-gradient-to-br from-[var(--accent-mint)]/5 to-transparent',
                'transition-all duration-300 hover:border-[var(--accent-mint)]/50 hover:shadow-lg'
              )}
            >
              {/* Header with icon */}
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div className="p-2.5 rounded-xl bg-[var(--accent-mint)]/10">
                  <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--accent-mint)]" />
                </div>
                <div>
                  <h3 className="font-display text-lg sm:text-xl font-bold">
                    {t('creatorHub.forCollectors.title')}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {t('creatorHub.forCollectors.subtitle')}
                  </p>
                </div>
              </div>

              {/* Feature list */}
              <div className="space-y-4">
                {collectorFeatures.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div key={feature.id} className="flex gap-3 sm:gap-4">
                      <div
                        className="shrink-0 p-2 rounded-lg"
                        style={{ backgroundColor: `color-mix(in srgb, ${feature.color} 15%, transparent)` }}
                      >
                        <Icon
                          className="w-4 h-4 sm:w-5 sm:h-5"
                          style={{ color: feature.color }}
                        />
                      </div>
                      <div>
                        <h4 className="text-sm sm:text-base font-semibold mb-0.5">
                          {t(`creatorHub.forCollectors.${feature.id}.title`)}
                        </h4>
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                          {t(`creatorHub.forCollectors.${feature.id}.description`)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Connection indicator - visible on desktop */}
        <div className="hidden lg:flex justify-center -mt-4 relative z-20">
          <div className="px-4 py-2 rounded-full bg-background border shadow-sm">
            <span className="text-xs text-muted-foreground">
              {t('creatorHub.connector')}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
