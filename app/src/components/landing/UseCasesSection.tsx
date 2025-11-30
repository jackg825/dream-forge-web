'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Gamepad2,
  Palette,
  GraduationCap,
  Store,
  Heart,
  Printer
} from 'lucide-react';

interface UseCasesSectionProps {
  className?: string;
}

const useCases = [
  {
    id: 'hobbyist',
    icon: Heart,
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
    color: 'var(--accent-coral)',
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
 * Shows who can benefit from DreamForge
 */
export function UseCasesSection({ className }: UseCasesSectionProps) {
  const t = useTranslations('landing');

  return (
    <section className={cn('py-24 bg-background', className)}>
      <div className="container max-w-6xl mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-16">
          <Badge
            variant="outline"
            className="mb-4 px-3 py-1 text-xs font-medium"
          >
            {t('useCases.badge')}
          </Badge>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            {t('useCases.title')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('useCases.subtitle')}
          </p>
        </div>

        {/* Use case cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {useCases.map((useCase) => {
            const Icon = useCase.icon;

            return (
              <Card
                key={useCase.id}
                className="group overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2"
              >
                {/* Image */}
                <div className="relative h-40 overflow-hidden">
                  <img
                    src={useCase.image}
                    alt={t(`useCases.items.${useCase.id}.title`)}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                  {/* Icon badge */}
                  <div
                    className="absolute bottom-4 right-4 p-2.5 rounded-xl transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: useCase.color }}
                  >
                    <Icon className="w-5 h-5 text-white" strokeWidth={1.5} />
                  </div>
                </div>

                <CardContent className="p-5">
                  <h3 className="font-display text-lg font-bold mb-2">
                    {t(`useCases.items.${useCase.id}.title`)}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
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
