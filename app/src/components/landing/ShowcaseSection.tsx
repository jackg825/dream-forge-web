'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { BeforeAfterSlider } from './BeforeAfterSlider';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { showcaseModels } from '@/config/showcase';
import { Box, ImageIcon, Loader2 } from 'lucide-react';

// Lazy load ModelViewer to avoid blocking initial page load
const ModelViewer = dynamic(
  () => import('@/components/viewer/ModelViewer').then(mod => mod.ModelViewer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-square flex items-center justify-center bg-muted/50 rounded-lg">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface ShowcaseSectionProps {
  className?: string;
}

type ViewType = '2d' | '3d';

/**
 * ShowcaseSection - Interactive gallery of 3D models and before/after comparisons
 * Features view toggle between 3D model and 2D comparison
 */
export function ShowcaseSection({ className }: ShowcaseSectionProps) {
  const t = useTranslations('landing');
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewType, setViewType] = useState<ViewType>('3d');

  const activeModel = showcaseModels[activeIndex];
  const hasBeforeAfter = activeModel?.beforeImage && activeModel?.afterImage;

  return (
    <section
      id="showcase"
      className={cn(
        'py-24 bg-gradient-to-b from-background to-muted/20',
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
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {showcaseModels.map((model, index) => (
            <button
              key={model.id}
              onClick={() => setActiveIndex(index)}
              className={cn(
                'px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300',
                activeIndex === index
                  ? 'bg-gradient-to-r from-[var(--accent-violet)] to-[var(--accent-coral)] text-white shadow-lg scale-105'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
              )}
            >
              {t(`showcase.categories.${model.category}`)}
            </button>
          ))}
        </div>

        {/* View type toggle */}
        {hasBeforeAfter && (
          <div className="flex justify-center gap-2 mb-8">
            <Button
              variant={viewType === '3d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewType('3d')}
              className="gap-2"
            >
              <Box className="w-4 h-4" />
              3D Model
            </Button>
            <Button
              variant={viewType === '2d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewType('2d')}
              className="gap-2"
            >
              <ImageIcon className="w-4 h-4" />
              Before/After
            </Button>
          </div>
        )}

        {/* Main display area */}
        <div className="max-w-3xl mx-auto">
          {viewType === '3d' ? (
            // 3D Model Viewer
            <div className="aspect-square rounded-xl overflow-hidden shadow-2xl bg-gradient-to-b from-slate-900 to-slate-800">
              <ModelViewer
                modelUrl={activeModel.modelUrl}
                viewMode="textured"
                autoRotate
                showGrid={false}
                showAxes={false}
                backgroundColor="#1e293b"
              />
            </div>
          ) : (
            // Before/After Slider (fallback if no model or user selected 2D)
            hasBeforeAfter && (
              <BeforeAfterSlider
                beforeImage={activeModel.beforeImage!}
                afterImage={activeModel.afterImage!}
                beforeAlt={t(`showcase.examples.${activeModel.id}.before`)}
                afterAlt={t(`showcase.examples.${activeModel.id}.after`)}
                className="shadow-2xl"
              />
            )
          )}

          {/* Example description */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {viewType === '3d'
                ? t('showcase.dragToRotate')
                : t(`showcase.examples.${activeModel.id}.description`)}
            </p>
          </div>
        </div>

        {/* Thumbnail navigation */}
        <div className="flex justify-center gap-4 mt-8">
          {showcaseModels.map((model, index) => (
            <button
              key={model.id}
              onClick={() => setActiveIndex(index)}
              className={cn(
                'w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-300',
                activeIndex === index
                  ? 'border-[var(--accent-violet)] scale-110 shadow-lg'
                  : 'border-transparent opacity-60 hover:opacity-100'
              )}
            >
              <img
                src={model.thumbnailUrl}
                alt={t(`showcase.examples.${model.id}.before`)}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to beforeImage if R2 thumbnail not available
                  if (model.beforeImage) {
                    (e.target as HTMLImageElement).src = model.beforeImage;
                  }
                }}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
