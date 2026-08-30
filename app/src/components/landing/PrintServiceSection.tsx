'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Printer,
  Package,
  Globe,
  Truck,
  Clock,
  Palette,
  Leaf,
  Gem,
  Sparkles,
} from 'lucide-react';

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
    { id: 'small', dimension: '~5cm' },
    { id: 'medium', dimension: '~10cm' },
    { id: 'large', dimension: '~15cm' },
  ];

  const materials = [
    { id: 'pla', icon: Leaf },
    { id: 'resin', icon: Gem },
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
        <div className="grid lg:grid-cols-[3fr_2fr] gap-8 lg:gap-12 items-start">
          {/* Left: Visual showcase with title for alignment */}
          <div className="relative order-2 lg:order-1">
            {/* Title - aligns with "尺寸選擇" on right */}
            <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--accent-violet)]" />
              {t('printService.previewTitle')}
            </h3>
            {/* Model viewer card */}
            <Card className="overflow-hidden border-2 border-[var(--accent-violet)]/20 shadow-xl sm:shadow-2xl rounded-lg">
              <CardContent className="p-0">
                {/* Rotating model preview GIF - lightweight alternative to 3D viewer */}
                <div className="aspect-[4/3] sm:aspect-[4/3] lg:aspect-[4/3] bg-gradient-to-br from-slate-900 to-slate-800 relative group">
                  <Image
                    src="/showcase/racecar-rotate.gif"
                    alt="3D model rotating preview"
                    fill
                    className="object-contain"
                    unoptimized
                    priority
                  />

                  {/* Floating badges */}
                  <div className="absolute top-2 left-2 sm:top-4 sm:left-4 px-2 sm:px-3 py-1 sm:py-1.5 bg-white dark:bg-zinc-900 rounded-full shadow-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 z-10">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-muted-foreground rounded-full" />
                    {t('printService.statusReady')}
                  </div>
                  <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 px-2 sm:px-3 py-1 sm:py-1.5 bg-white dark:bg-zinc-900 rounded-full shadow-lg text-xs sm:text-sm font-medium z-10 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[var(--accent-violet)]" />
                    {t('printService.worldwide')}
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
                    <Package className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2 text-[var(--accent-violet)]" />
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
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--accent-coral)]" />
                {t('printService.materialsTitle')}
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {materials.map((material) => (
                  <Card
                    key={material.id}
                    className="p-3 sm:p-4 active:scale-[0.98] transition-all cursor-default"
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <material.icon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-[var(--accent-coral)]" />
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
                    {t('printService.comingSoon')}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--accent-mint)]" />
                  {t('printService.shippingIncluded')}
                </div>
              </div>
            </Card>

            {/* CTA */}
            <Button size="lg" className="w-full text-base sm:text-lg py-5 sm:py-6" disabled>
              {t('printService.cta')}
            </Button>

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
