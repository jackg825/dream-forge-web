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
 * Creates urgency and final conversion opportunity
 */
export function FinalCTASection({ className }: FinalCTASectionProps) {
  const t = useTranslations('landing');

  return (
    <section
      className={cn(
        'relative py-24 overflow-hidden',
        className
      )}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-violet)] via-[var(--accent-coral)] to-[var(--accent-mint)] opacity-90" />

      {/* Decorative shapes */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-10 -left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 container max-w-4xl mx-auto px-4 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" />
          {t('finalCta.badge')}
        </div>

        {/* Headline */}
        <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
          {t('finalCta.title')}
        </h2>

        {/* Subtitle */}
        <p className="text-xl text-white/90 max-w-2xl mx-auto mb-10">
          {t('finalCta.subtitle')}
        </p>

        {/* CTA Button */}
        <Link href="/generate">
          <Button
            size="lg"
            className="text-lg px-10 py-7 bg-white text-[var(--accent-violet)] hover:bg-white/90 shadow-2xl transition-all hover:shadow-3xl hover:scale-105 font-display font-bold"
          >
            {t('finalCta.cta')}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>

        {/* Trust indicator */}
        <p className="mt-8 text-sm text-white/70">
          {t('finalCta.trust')}
        </p>
      </div>
    </section>
  );
}
