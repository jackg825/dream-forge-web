'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Printer,
  Package,
  Globe,
  Truck,
  ArrowRight,
  Check,
  Loader2,
} from 'lucide-react';
import { showcaseModels } from '@/config/showcase';

// Lazy load ModelViewer to avoid blocking initial page load
const ModelViewer = dynamic(
  () => import('@/components/viewer/ModelViewer').then(mod => mod.ModelViewer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface PrintServiceSectionProps {
  className?: string;
}

/**
 * PrintServiceSection - 3D printing service advertisement
 * Mobile-optimized with stacked layout and touch-friendly elements
 */
export function PrintServiceSection({ className }: PrintServiceSectionProps) {
  const t = useTranslations('landing');

  const sizes = [
    { id: 'small', dimension: '~5cm', icon: '📦' },
    { id: 'medium', dimension: '~10cm', icon: '📦' },
    { id: 'large', dimension: '~15cm', icon: '📦' },
  ];

  const materials = [
    { id: 'pla', icon: '🌱' },
    { id: 'resin', icon: '💎' },
  ];

  const features = [
    { icon: Printer, key: 'quality' },
    { icon: Package, key: 'packaging' },
    { icon: Globe, key: 'worldwide' },
    { icon: Truck, key: 'tracking' },
  ];

  return (
    <section
      id="print-service"
      className={cn(
        'py-16 sm:py-24 bg-gradient-to-b from-muted/20 to-background',
        className
      )}
    >
      <div className="container max-w-6xl mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-10 sm:mb-16">
          <Badge
            variant="outline"
            className="mb-3 sm:mb-4 px-3 py-1 text-xs font-medium border-[var(--accent-coral)] text-[var(--accent-coral)]"
          >
            {t('printService.badge')}
          </Badge>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-3 sm:mb-4">
            {t('printService.title')}
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            {t('printService.subtitle')}
          </p>
        </div>

        {/* Main content grid - stacks on mobile, 60:40 on desktop */}
        <div className="grid lg:grid-cols-[3fr_2fr] gap-8 lg:gap-12 items-center">
          {/* Left: Visual showcase - full-width on mobile, 60% on desktop */}
          <div className="relative order-2 lg:order-1 -mx-4 sm:mx-0">
            <Card className="overflow-hidden border-2 border-[var(--accent-violet)]/20 shadow-xl sm:shadow-2xl rounded-none sm:rounded-lg">
              <CardContent className="p-0">
                {/* 3D Model showcase - larger aspect ratio for visual impact */}
                <div className="aspect-[4/3] sm:aspect-[4/3] lg:aspect-[5/4] bg-gradient-to-br from-slate-900 to-slate-800 relative group">
                  {showcaseModels[0] && (
                    <ModelViewer
                      modelUrl={showcaseModels[0].modelUrl}
                      viewMode="textured"
                      autoRotate
                      showGrid={false}
                      showAxes={false}
                      backgroundColor="#1e293b"
                    />
                  )}

                  {/* Floating badges - smaller on mobile */}
                  <div className="absolute top-2 left-2 sm:top-4 sm:left-4 px-2 sm:px-3 py-1 sm:py-1.5 bg-white dark:bg-zinc-900 rounded-full shadow-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 z-10">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse" />
                    {t('printService.statusReady')}
                  </div>
                  <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 px-2 sm:px-3 py-1 sm:py-1.5 bg-white dark:bg-zinc-900 rounded-full shadow-lg text-xs sm:text-sm font-medium z-10">
                    🌍 {t('printService.worldwide')}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Details - shows first on mobile, compact spacing for 40% width */}
          <div className="space-y-4 sm:space-y-6 order-1 lg:order-2">
            {/* Size options */}
            <div>
              <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--accent-violet)]" />
                {t('printService.sizesTitle')}
              </h3>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {sizes.map((size) => (
                  <Card
                    key={size.id}
                    className="text-center p-3 sm:p-4 active:scale-[0.98] transition-all cursor-default"
                  >
                    <div className="text-xl sm:text-2xl mb-1 sm:mb-2">{size.icon}</div>
                    <div className="text-xs sm:text-sm font-medium">
                      {t(`printService.sizes.${size.id}`)}
                    </div>
                    <div className="text-[10px] sm:text-sm text-muted-foreground">
                      {size.dimension}
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Material options */}
            <div>
              <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3 flex items-center gap-2">
                <span className="text-[var(--accent-coral)]">✨</span>
                {t('printService.materialsTitle')}
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {materials.map((material) => (
                  <Card
                    key={material.id}
                    className="p-3 sm:p-4 active:scale-[0.98] transition-all cursor-default"
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="text-xl sm:text-2xl">{material.icon}</div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-medium truncate">
                          {t(`printService.materials.${material.id}.name`)}
                        </div>
                        <div className="text-[10px] sm:text-sm text-muted-foreground truncate">
                          {t(`printService.materials.${material.id}.desc`)}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Features list - 2x2 compact grid */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.key} className="flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[var(--accent-mint)]/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--accent-mint)]" />
                    </div>
                    <span className="text-xs sm:text-sm font-medium leading-tight">
                      {t(`printService.features.${feature.key}`)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Pricing teaser */}
            <Card className="p-3 sm:p-5 bg-gradient-to-r from-[var(--accent-violet)]/5 to-[var(--accent-coral)]/5 border-dashed">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                <div>
                  <div className="text-xs sm:text-sm text-muted-foreground mb-0.5 sm:mb-1">
                    {t('printService.startingFrom')}
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold font-display">
                    NT$ 500
                    <span className="text-sm sm:text-base font-normal text-muted-foreground ml-1 sm:ml-2">
                      {t('printService.perModel')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--accent-mint)]" />
                  {t('printService.shippingIncluded')}
                </div>
              </div>
            </Card>

            {/* CTA */}
            <Link href="/print" className="block">
              <Button
                size="lg"
                className="w-full text-base sm:text-lg py-5 sm:py-6 bg-gradient-to-r from-[var(--accent-violet)] to-[var(--accent-coral)] text-white hover:opacity-90 shadow-lg active:scale-[0.98]"
              >
                {t('printService.cta')}
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </Link>

            {/* Trust note */}
            <p className="text-center text-xs sm:text-sm text-muted-foreground">
              {t('printService.trustNote')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
