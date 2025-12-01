'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ComingSoonBadge } from '@/components/ui/coming-soon-badge';
import {
  Gamepad2,
  Palette,
  GraduationCap,
  Store,
  Printer,
  Brush,
} from 'lucide-react';

interface UseCasesSectionProps {
  className?: string;
}

const useCases = [
  {
    id: 'creator',
    icon: Brush,
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80',
    color: 'var(--accent-violet)',
    comingSoon: true,
  },
  {
    id: 'maker',
    icon: Printer,
    image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&q=80',
    color: 'var(--accent-mint)',
  },
  {
    id: 'artist',
    icon: Palette,
    image: 'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=400&q=80',
    color: 'var(--accent-violet)',
  },
  {
    id: 'gamer',
    icon: Gamepad2,
    image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&q=80',
    color: 'var(--accent-yellow)',
  },
  {
    id: 'educator',
    icon: GraduationCap,
    image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&q=80',
    color: 'var(--accent-mint)',
  },
  {
    id: 'seller',
    icon: Store,
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&q=80',
    color: 'var(--accent-coral)',
  },
];

/**
 * UseCasesSection - Target audience personas with use case cards
 * Mobile-optimized with 2-column grid and horizontal scroll option
 */
export function UseCasesSection({ className }: UseCasesSectionProps) {
  const t = useTranslations('landing');

  return (
    <section className={cn('py-16 sm:py-24 bg-gradient-to-b from-muted/20 to-background', className)}>
      <div className="container max-w-6xl mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-10 sm:mb-16">
          <Badge
            variant="outline"
            className="mb-3 sm:mb-4 px-3 py-1 text-xs font-medium"
          >
            {t('useCases.badge')}
          </Badge>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-3 sm:mb-4">
            {t('useCases.title')}
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            {t('useCases.subtitle')}
          </p>
        </div>

        {/* Use case cards - 2 cols on mobile */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          {useCases.map((useCase) => {
            const Icon = useCase.icon;
            const isComingSoon = 'comingSoon' in useCase && useCase.comingSoon;

            return (
              <Card
                key={useCase.id}
                className={cn(
                  'group overflow-hidden shadow-lg transition-all duration-500',
                  'active:scale-[0.98] md:hover:shadow-2xl md:hover:-translate-y-2',
                  isComingSoon
                    ? 'border border-dashed border-[var(--accent-violet)]/40'
                    : 'border-0'
                )}
              >
                {/* Image - shorter on mobile */}
                <div className="relative h-28 sm:h-36 md:h-40 overflow-hidden">
                  <img
                    src={useCase.image}
                    alt={t(`useCases.items.${useCase.id}.title`)}
                    className={cn(
                      'w-full h-full object-cover transition-transform duration-500 md:group-hover:scale-110',
                      isComingSoon && 'opacity-80'
                    )}
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                  {/* Coming Soon badge */}
                  {isComingSoon && (
                    <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
                      <ComingSoonBadge size="sm" showIcon={false}>
                        {t('creatorHub.badge')}
                      </ComingSoonBadge>
                    </div>
                  )}

                  {/* Icon badge - smaller on mobile */}
                  <div
                    className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-transform duration-300 md:group-hover:scale-110"
                    style={{ backgroundColor: useCase.color }}
                  >
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" strokeWidth={1.5} />
                  </div>
                </div>

                <CardContent className="p-3 sm:p-4 md:p-5">
                  <h3 className="font-display text-sm sm:text-base md:text-lg font-bold mb-1 sm:mb-2 line-clamp-1">
                    {t(`useCases.items.${useCase.id}.title`)}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-2 sm:line-clamp-3">
                    {t(`useCases.items.${useCase.id}.description`)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
