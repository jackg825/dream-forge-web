'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Zap,
  FileDown,
  Printer,
  Shield,
  Palette,
  Globe,
} from 'lucide-react';

interface FeaturesSectionProps {
  className?: string;
}

const features = [
  {
    id: 'fast',
    icon: Zap,
    color: 'var(--accent-yellow)',
    bgGradient: 'from-amber-500/10 to-orange-500/5',
    size: 'large', // col-span-2
  },
  {
    id: 'formats',
    icon: FileDown,
    color: 'var(--accent-mint)',
    bgGradient: 'from-emerald-500/10 to-teal-500/5',
    size: 'normal',
  },
  {
    id: 'printing',
    icon: Printer,
    color: 'var(--accent-coral)',
    bgGradient: 'from-rose-500/10 to-pink-500/5',
    size: 'normal',
  },
  {
    id: 'quality',
    icon: Palette,
    color: 'var(--accent-violet)',
    bgGradient: 'from-violet-500/10 to-purple-500/5',
    size: 'normal',
  },
  {
    id: 'secure',
    icon: Shield,
    color: 'var(--accent-mint)',
    bgGradient: 'from-cyan-500/10 to-blue-500/5',
    size: 'normal',
  },
  {
    id: 'global',
    icon: Globe,
    color: 'var(--accent-coral)',
    bgGradient: 'from-orange-500/10 to-red-500/5',
    size: 'normal',
  },
];

/**
 * FeaturesSection - Bento grid layout showcasing key features
 * Mobile-optimized with 2-column grid and touch-friendly cards
 */
export function FeaturesSection({ className }: FeaturesSectionProps) {
  const t = useTranslations('landing');

  return (
    <section
      className={cn(
        'py-16 sm:py-24 bg-gradient-to-b from-background to-muted/20',
        className
      )}
    >
      <div className="container max-w-6xl mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-10 sm:mb-16">
          <Badge
            variant="outline"
            className="mb-3 sm:mb-4 px-3 py-1 text-xs font-medium"
          >
            {t('features.badge')}
          </Badge>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-3 sm:mb-4">
            {t('features.title')}
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            {t('features.subtitle')}
          </p>
        </div>

        {/* Bento Grid - 2 cols on mobile, 3 on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            const isLarge = feature.size === 'large';

            return (
              <div
                key={feature.id}
                className={cn(
                  'group relative overflow-hidden rounded-xl sm:rounded-2xl border bg-card transition-all duration-300',
                  'p-4 sm:p-6 md:p-8',
                  'active:scale-[0.98] md:hover:shadow-xl md:hover:-translate-y-1',
                  // Large card spans full width on mobile, 2 cols on desktop
                  isLarge && 'col-span-2',
                  `bg-gradient-to-br ${feature.bgGradient}`
                )}
              >
                {/* Hover gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/0 group-hover:from-white/5 group-hover:to-transparent transition-all duration-500" />

                {/* Content */}
                <div className="relative z-10">
                  {/* Icon - smaller on mobile */}
                  <div
                    className={cn(
                      'mb-3 sm:mb-4 p-2 sm:p-3 rounded-lg sm:rounded-xl w-fit transition-transform duration-300 md:group-hover:scale-110',
                      'bg-background/80'
                    )}
                  >
                    <Icon
                      className="w-5 h-5 sm:w-6 sm:h-6"
                      style={{ color: feature.color }}
                      strokeWidth={1.5}
                    />
                  </div>

                  {/* Title */}
                  <h3 className="font-display text-base sm:text-lg md:text-xl font-bold mb-1 sm:mb-2">
                    {t(`features.items.${feature.id}.title`)}
                  </h3>

                  {/* Description - hidden on very small screens for non-large cards */}
                  <p className={cn(
                    'text-muted-foreground text-xs sm:text-sm leading-relaxed',
                    !isLarge && 'line-clamp-2 sm:line-clamp-none'
                  )}>
                    {t(`features.items.${feature.id}.description`)}
                  </p>

                  {/* Extra content for large card */}
                  {isLarge && (
                    <div className="mt-3 sm:mt-4 flex items-center gap-3 sm:gap-4">
                      <div className="flex -space-x-2">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[var(--accent-violet)] flex items-center justify-center text-white text-[10px] sm:text-xs font-bold">
                          AI
                        </div>
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[var(--accent-mint)] flex items-center justify-center text-white text-[10px] sm:text-xs font-bold">
                          3D
                        </div>
                      </div>
                      <span className="text-[10px] sm:text-xs text-muted-foreground">
                        {t('features.items.fast.subtext')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
