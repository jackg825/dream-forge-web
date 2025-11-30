'use client';

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
} from 'lucide-react';

interface PrintServiceSectionProps {
  className?: string;
}

/**
 * PrintServiceSection - 3D printing service advertisement
 * Promotes physical 3D printing and global delivery service
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
        'py-24 bg-gradient-to-b from-muted/30 to-background relative overflow-hidden',
        className
      )}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-72 h-72 bg-[var(--accent-violet)]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-64 h-64 bg-[var(--accent-coral)]/5 rounded-full blur-3xl" />
      </div>

      <div className="container max-w-6xl mx-auto px-4 relative z-10">
        {/* Section header */}
        <div className="text-center mb-16">
          <Badge
            variant="outline"
            className="mb-4 px-3 py-1 text-xs font-medium border-[var(--accent-coral)] text-[var(--accent-coral)]"
          >
            {t('printService.badge')}
          </Badge>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            {t('printService.title')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('printService.subtitle')}
          </p>
        </div>

        {/* Main content grid */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Visual showcase */}
          <div className="relative">
            <Card className="overflow-hidden border-2 border-[var(--accent-violet)]/20 shadow-2xl">
              <CardContent className="p-0">
                {/* Mockup image area */}
                <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center relative">
                  {/* 3D printer illustration placeholder */}
                  <div className="text-center p-8">
                    <div className="w-32 h-32 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[var(--accent-violet)] to-[var(--accent-coral)] flex items-center justify-center">
                      <Printer className="w-16 h-16 text-white" />
                    </div>
                    <p className="text-lg font-medium text-muted-foreground">
                      {t('printService.visualCaption')}
                    </p>
                  </div>

                  {/* Floating badges */}
                  <div className="absolute top-4 left-4 px-3 py-1.5 bg-white dark:bg-zinc-900 rounded-full shadow-lg text-sm font-medium flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    {t('printService.statusReady')}
                  </div>
                  <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-white dark:bg-zinc-900 rounded-full shadow-lg text-sm font-medium">
                    🌍 {t('printService.worldwide')}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Details */}
          <div className="space-y-8">
            {/* Size options */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-[var(--accent-violet)]" />
                {t('printService.sizesTitle')}
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {sizes.map((size) => (
                  <Card
                    key={size.id}
                    className="text-center p-4 hover:border-[var(--accent-violet)] transition-colors cursor-default"
                  >
                    <div className="text-2xl mb-2">{size.icon}</div>
                    <div className="font-medium">
                      {t(`printService.sizes.${size.id}`)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {size.dimension}
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Material options */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-[var(--accent-coral)]">✨</span>
                {t('printService.materialsTitle')}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {materials.map((material) => (
                  <Card
                    key={material.id}
                    className="p-4 hover:border-[var(--accent-coral)] transition-colors cursor-default"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{material.icon}</div>
                      <div>
                        <div className="font-medium">
                          {t(`printService.materials.${material.id}.name`)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {t(`printService.materials.${material.id}.desc`)}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Features list */}
            <div className="grid grid-cols-2 gap-4">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.key} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--accent-mint)]/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[var(--accent-mint)]" />
                    </div>
                    <span className="text-sm font-medium">
                      {t(`printService.features.${feature.key}`)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Pricing teaser */}
            <Card className="p-6 bg-gradient-to-r from-[var(--accent-violet)]/5 to-[var(--accent-coral)]/5 border-dashed">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    {t('printService.startingFrom')}
                  </div>
                  <div className="text-3xl font-bold font-display">
                    NT$ 500
                    <span className="text-base font-normal text-muted-foreground ml-2">
                      {t('printService.perModel')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-[var(--accent-mint)]" />
                  {t('printService.shippingIncluded')}
                </div>
              </div>
            </Card>

            {/* CTA */}
            <Link href="/print">
              <Button
                size="lg"
                className="w-full text-lg py-6 bg-gradient-to-r from-[var(--accent-violet)] to-[var(--accent-coral)] text-white hover:opacity-90 shadow-lg"
              >
                {t('printService.cta')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>

            {/* Trust note */}
            <p className="text-center text-sm text-muted-foreground">
              {t('printService.trustNote')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
