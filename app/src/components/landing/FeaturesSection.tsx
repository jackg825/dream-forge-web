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

/**
 * Feature grid layout strategy:
 * - 2x2 grid on mobile (all cards equal)
 * - 6-column grid on desktop with varied spans for visual hierarchy
 *
 * Desktop layout (6 cols):
 * Row 1: [fast: 4 cols] [formats: 2 cols]
 * Row 2: [printing: 2 cols] [quality: 2 cols] [secure: 2 cols]
 * Row 3: [global: 6 cols - full width accent]
 */
const features = [
  {
    id: 'fast',
    icon: Zap,
    color: 'var(--accent-yellow)',
    // Hero card - warm gradient with glow effect
    gridClass: 'col-span-2 lg:col-span-4 lg:row-span-2',
    variant: 'hero' as const,
  },
  {
    id: 'formats',
    icon: FileDown,
    color: 'var(--accent-mint)',
    gridClass: 'col-span-1 lg:col-span-2 lg:row-span-2',
    variant: 'tall' as const,
  },
  {
    id: 'printing',
    icon: Printer,
    color: 'var(--accent-coral)',
    gridClass: 'col-span-1 lg:col-span-2',
    variant: 'standard' as const,
  },
  {
    id: 'quality',
    icon: Palette,
    color: 'var(--accent-violet)',
    gridClass: 'col-span-1 lg:col-span-2',
    variant: 'standard' as const,
  },
  {
    id: 'secure',
    icon: Shield,
    color: 'var(--accent-mint)',
    gridClass: 'col-span-1 lg:col-span-2',
    variant: 'standard' as const,
  },
  {
    id: 'global',
    icon: Globe,
    color: 'var(--accent-coral)',
    // Full-width accent banner
    gridClass: 'col-span-2 lg:col-span-6',
    variant: 'banner' as const,
  },
];

// Variant-specific styles for visual hierarchy
const variantStyles = {
  hero: {
    container: 'min-h-[200px] lg:min-h-[280px]',
    iconWrapper: 'p-3 sm:p-4',
    icon: 'w-7 h-7 sm:w-8 sm:h-8',
    title: 'text-xl sm:text-2xl lg:text-3xl',
    description: 'text-sm sm:text-base max-w-md',
    gradient: 'from-amber-500/15 via-orange-500/10 to-rose-500/5',
    glow: 'before:absolute before:inset-0 before:bg-gradient-to-br before:from-amber-500/20 before:to-transparent before:opacity-0 before:transition-opacity before:duration-500 hover:before:opacity-100',
  },
  tall: {
    container: 'min-h-[160px] lg:min-h-[280px] flex flex-col',
    iconWrapper: 'p-2.5 sm:p-3',
    icon: 'w-5 h-5 sm:w-6 sm:h-6',
    title: 'text-base sm:text-lg lg:text-xl',
    description: 'text-xs sm:text-sm lg:flex-1',
    gradient: 'from-emerald-500/15 via-teal-500/10 to-cyan-500/5',
    glow: '',
  },
  standard: {
    container: 'min-h-[120px] lg:min-h-[140px]',
    iconWrapper: 'p-2 sm:p-2.5',
    icon: 'w-4 h-4 sm:w-5 sm:h-5',
    title: 'text-sm sm:text-base lg:text-lg',
    description: 'text-xs sm:text-sm line-clamp-2',
    gradient: 'from-violet-500/12 via-purple-500/8 to-fuchsia-500/5',
    glow: '',
  },
  banner: {
    container: 'min-h-[80px] lg:min-h-[100px] flex-row items-center gap-4 lg:gap-6',
    iconWrapper: 'p-2.5 sm:p-3',
    icon: 'w-5 h-5 sm:w-6 sm:h-6',
    title: 'text-base sm:text-lg',
    description: 'text-xs sm:text-sm',
    gradient: 'from-orange-500/10 via-amber-500/8 to-yellow-500/5',
    glow: '',
  },
};

// Per-variant gradient overrides for unique card colors
const cardGradients: Record<string, string> = {
  fast: 'from-amber-500/15 via-orange-500/10 to-rose-500/5',
  formats: 'from-emerald-500/15 via-teal-500/10 to-cyan-500/5',
  printing: 'from-rose-500/12 via-pink-500/8 to-fuchsia-500/5',
  quality: 'from-violet-500/12 via-purple-500/8 to-indigo-500/5',
  secure: 'from-cyan-500/12 via-blue-500/8 to-indigo-500/5',
  global: 'from-orange-500/10 via-amber-500/8 to-yellow-500/5',
};

/**
 * FeaturesSection - Bento grid layout showcasing key features
 * Uses a 6-column grid with varied card sizes for visual hierarchy
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

        {/* Bento Grid - 2 cols mobile, 6 cols desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4 auto-rows-min">
          {features.map((feature) => {
            const Icon = feature.icon;
            const styles = variantStyles[feature.variant];
            const isBanner = feature.variant === 'banner';
            const isHero = feature.variant === 'hero';

            return (
              <div
                key={feature.id}
                className={cn(
                  'group relative overflow-hidden rounded-xl sm:rounded-2xl border border-border/50 bg-card transition-all duration-300',
                  'active:scale-[0.98] md:hover:shadow-2xl md:hover:shadow-black/5 md:hover:-translate-y-0.5',
                  'md:hover:border-border',
                  feature.gridClass,
                  styles.container,
                  styles.glow,
                  `bg-gradient-to-br ${cardGradients[feature.id]}`,
                  // Flex layout for content positioning
                  isBanner ? 'flex p-4 sm:p-5' : 'flex flex-col p-4 sm:p-6'
                )}
              >
                {/* Subtle noise texture overlay */}
                <div className="absolute inset-0 opacity-[0.015] mix-blend-overlay pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iMSIvPjwvc3ZnPg==')]" />

                {/* Hover glow effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/0 group-hover:from-white/[0.03] group-hover:to-transparent transition-all duration-500 pointer-events-none" />

                {/* Content wrapper */}
                <div className={cn(
                  'relative z-10 flex',
                  isBanner ? 'flex-row items-center gap-4 lg:gap-6 w-full' : 'flex-col flex-1'
                )}>
                  {/* Icon */}
                  <div
                    className={cn(
                      'rounded-lg sm:rounded-xl w-fit transition-all duration-300 md:group-hover:scale-105',
                      'bg-background/60 backdrop-blur-sm border border-border/30',
                      styles.iconWrapper,
                      !isBanner && 'mb-3 sm:mb-4'
                    )}
                  >
                    <Icon
                      className={cn(styles.icon, 'transition-colors duration-300')}
                      style={{ color: feature.color }}
                      strokeWidth={1.5}
                    />
                  </div>

                  {/* Text content */}
                  <div className={cn(isBanner && 'flex-1')}>
                    <h3 className={cn(
                      'font-display font-bold mb-1 sm:mb-1.5 tracking-tight',
                      styles.title
                    )}>
                      {t(`features.items.${feature.id}.title`)}
                    </h3>

                    <p className={cn(
                      'text-muted-foreground leading-relaxed',
                      styles.description
                    )}>
                      {t(`features.items.${feature.id}.description`)}
                    </p>
                  </div>

                  {/* Hero card badge */}
                  {isHero && (
                    <div className="mt-auto pt-4 sm:pt-6">
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-1.5">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-[10px] sm:text-xs font-bold shadow-lg shadow-violet-500/25 ring-2 ring-background">
                            AI
                          </div>
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-[10px] sm:text-xs font-bold shadow-lg shadow-emerald-500/25 ring-2 ring-background">
                            3D
                          </div>
                        </div>
                        <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                          {t('features.items.fast.subtext')}
                        </span>
                      </div>
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
