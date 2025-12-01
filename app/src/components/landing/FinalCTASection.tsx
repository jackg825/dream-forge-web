'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';

interface FinalCTASectionProps {
  className?: string;
}

/**
 * FinalCTASection - Bold gradient call-to-action at page bottom
 * Mobile-optimized with responsive typography and touch-friendly CTA
 */
export function FinalCTASection({ className }: FinalCTASectionProps) {
  const t = useTranslations('landing');

  return (
    <section
      className={cn(
        'relative py-16 sm:py-24 overflow-hidden',
        className
      )}
    >
      {/* Dark mode base layer */}
      <div className="absolute inset-0 bg-zinc-900 hidden dark:block" />

      {/* Background gradient - reduced opacity in dark mode */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-violet)] via-[var(--accent-coral)] to-[var(--accent-mint)] opacity-90 dark:opacity-70" />

      {/* Decorative shapes - hidden on mobile for performance */}
      <div className="absolute inset-0 overflow-hidden hidden sm:block">
        <div className="absolute -top-10 -left-10 w-64 h-64 bg-white/10 dark:bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-white/10 dark:bg-white/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-40 h-40 bg-white/5 dark:bg-white/3 rounded-full blur-2xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 container max-w-4xl mx-auto px-4 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs sm:text-sm font-medium mb-4 sm:mb-6">
          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          {t('finalCta.badge')}
        </div>

        {/* Headline - responsive typography */}
        <h2 className="font-display text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-6 leading-tight px-2">
          {t('finalCta.title')}
        </h2>

        {/* Subtitle */}
        <p className="text-base sm:text-xl text-white/90 max-w-2xl mx-auto mb-8 sm:mb-10 px-2">
          {t('finalCta.subtitle')}
        </p>

        {/* CTA Button - full width on mobile */}
        <Link href="/generate" className="block sm:inline-block px-4 sm:px-0">
          <Button
            size="lg"
            className={cn(
              'w-full sm:w-auto text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7',
              'bg-white text-[var(--accent-violet)] hover:bg-white/90',
              'shadow-2xl transition-all active:scale-[0.98] sm:hover:scale-105',
              'font-display font-bold'
            )}
          >
            {t('finalCta.cta')}
            <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </Link>

        {/* Trust indicator */}
        <p className="mt-6 sm:mt-8 text-xs sm:text-sm text-white/70 px-4">
          {t('finalCta.trust')}
        </p>
      </div>
    </section>
  );
}
