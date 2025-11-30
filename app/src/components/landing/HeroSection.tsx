'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FloatingShapes } from './FloatingShapes';
import { Sparkles, ArrowRight, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeroSectionProps {
  className?: string;
}

/**
 * HeroSection - Full viewport hero with gradient mesh background
 * Features bold typography, floating shapes, and prominent CTAs
 */
export function HeroSection({ className }: HeroSectionProps) {
  const t = useTranslations('landing');

  return (
    <section
      className={cn(
        'relative min-h-[90vh] flex items-center justify-center gradient-mesh overflow-hidden',
        className
      )}
    >
      {/* Floating decorative shapes */}
      <FloatingShapes />

      {/* Content */}
      <div className="relative z-10 container max-w-5xl mx-auto px-4 text-center py-20">
        {/* Badge */}
        <Badge
          variant="secondary"
          className="mb-6 px-4 py-2 text-sm font-medium bg-white/80 dark:bg-black/40 backdrop-blur-sm border-0 shadow-lg"
        >
          <Sparkles className="mr-2 h-4 w-4 text-[var(--accent-violet)]" />
          {t('hero.badge')}
        </Badge>

        {/* Main headline */}
        <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight">
          <span className="block">{t('hero.title1')}</span>
          <span
            className="block bg-gradient-to-r from-[var(--accent-violet)] via-[var(--accent-coral)] to-[var(--accent-mint)] bg-clip-text text-transparent"
          >
            {t('hero.title2')}
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          {t('hero.subtitle')}
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link href="/generate">
            <Button
              size="lg"
              className="text-lg px-8 py-6 bg-gradient-to-r from-[var(--accent-violet)] to-[var(--accent-coral)] hover:opacity-90 text-white shadow-xl transition-all hover:shadow-2xl hover:scale-105"
            >
              {t('hero.cta')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>

          <Button
            variant="outline"
            size="lg"
            className="text-lg px-8 py-6 bg-white/60 dark:bg-black/30 backdrop-blur-sm border-2 hover:bg-white/80 dark:hover:bg-black/50"
            onClick={() => {
              document.getElementById('showcase')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <Play className="mr-2 h-5 w-5" />
            {t('hero.ctaSecondary')}
          </Button>
        </div>

        {/* Stats or trust indicators */}
        <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold font-display text-foreground">3</span>
            <span>{t('hero.stat1')}</span>
          </div>
          <div className="w-px h-6 bg-border hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold font-display text-foreground">~2</span>
            <span>{t('hero.stat2')}</span>
          </div>
          <div className="w-px h-6 bg-border hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold font-display text-foreground">4</span>
            <span>{t('hero.stat3')}</span>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
          <div className="w-1.5 h-3 rounded-full bg-muted-foreground/50 animate-pulse" />
        </div>
      </div>
    </section>
  );
}
