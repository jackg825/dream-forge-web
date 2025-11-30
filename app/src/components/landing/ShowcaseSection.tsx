'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BeforeAfterSlider } from './BeforeAfterSlider';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface ShowcaseSectionProps {
  className?: string;
}

// Showcase examples
// beforeImage = original photo, afterImage = 3D render from Nano Banana Pro
const showcaseExamples = [
  {
    id: 'racecar',
    beforeImage: '/showcase/race_car_origin.jpg',
    afterImage: '/showcase/race_car_render.png',
    category: 'product',
  },
];

/**
 * ShowcaseSection - Interactive gallery of before/after 3D transformations
 * Features tabbed navigation to switch between different example types
 */
export function ShowcaseSection({ className }: ShowcaseSectionProps) {
  const t = useTranslations('landing');
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <section
      id="showcase"
      className={cn(
        'py-24 bg-gradient-to-b from-background to-muted/30',
        className
      )}
    >
      <div className="container max-w-6xl mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-12">
          <Badge
            variant="outline"
            className="mb-4 px-3 py-1 text-xs font-medium"
          >
            {t('showcase.badge')}
          </Badge>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            {t('showcase.title')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('showcase.subtitle')}
          </p>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {showcaseExamples.map((example, index) => (
            <button
              key={example.id}
              onClick={() => setActiveIndex(index)}
              className={cn(
                'px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300',
                activeIndex === index
                  ? 'bg-gradient-to-r from-[var(--accent-violet)] to-[var(--accent-coral)] text-white shadow-lg scale-105'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
              )}
            >
              {t(`showcase.categories.${example.category}`)}
            </button>
          ))}
        </div>

        {/* Before/After Slider */}
        <div className="max-w-3xl mx-auto">
          <BeforeAfterSlider
            beforeImage={showcaseExamples[activeIndex].beforeImage}
            afterImage={showcaseExamples[activeIndex].afterImage}
            beforeAlt={t(`showcase.examples.${showcaseExamples[activeIndex].id}.before`)}
            afterAlt={t(`showcase.examples.${showcaseExamples[activeIndex].id}.after`)}
            className="shadow-2xl"
          />

          {/* Example description */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t(`showcase.examples.${showcaseExamples[activeIndex].id}.description`)}
            </p>
          </div>
        </div>

        {/* Thumbnail navigation */}
        <div className="flex justify-center gap-4 mt-8">
          {showcaseExamples.map((example, index) => (
            <button
              key={example.id}
              onClick={() => setActiveIndex(index)}
              className={cn(
                'w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-300',
                activeIndex === index
                  ? 'border-[var(--accent-violet)] scale-110 shadow-lg'
                  : 'border-transparent opacity-60 hover:opacity-100'
              )}
            >
              <img
                src={example.beforeImage}
                alt={t(`showcase.examples.${example.id}.before`)}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
