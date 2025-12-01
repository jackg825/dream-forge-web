'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Upload, Cpu, Download, ChevronDown } from 'lucide-react';

interface HowItWorksSectionProps {
  className?: string;
}

const steps = [
  {
    id: 'upload',
    icon: Upload,
    color: 'var(--accent-violet)',
    gradient: 'from-[var(--accent-violet)] to-[var(--accent-coral)]',
  },
  {
    id: 'process',
    icon: Cpu,
    color: 'var(--accent-mint)',
    gradient: 'from-[var(--accent-mint)] to-[var(--accent-violet)]',
  },
  {
    id: 'download',
    icon: Download,
    color: 'var(--accent-coral)',
    gradient: 'from-[var(--accent-coral)] to-[var(--accent-yellow)]',
  },
];

/**
 * HowItWorksSection - Animated 3-step process visualization
 * Matches the PRD tagline: 一張照片，一個模型，一鍵下載
 * Mobile-optimized with vertical flow and touch-friendly elements
 */
export function HowItWorksSection({ className }: HowItWorksSectionProps) {
  const t = useTranslations('landing');

  return (
    <section className={cn('py-16 sm:py-24 bg-gradient-to-b from-muted/20 to-background', className)}>
      <div className="container max-w-5xl mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-10 sm:mb-16">
          <Badge
            variant="outline"
            className="mb-3 sm:mb-4 px-3 py-1 text-xs font-medium"
          >
            {t('howItWorks.badge')}
          </Badge>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-3 sm:mb-4">
            {t('howItWorks.title')}
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            {t('howItWorks.subtitle')}
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connector line (desktop) */}
          <div className="hidden md:block absolute top-16 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-[var(--accent-violet)] via-[var(--accent-mint)] to-[var(--accent-coral)]">
            <div className="absolute inset-0 animate-pulse opacity-50" />
          </div>

          {/* Mobile vertical connector */}
          <div className="md:hidden absolute left-1/2 top-[120px] bottom-[120px] w-0.5 -translate-x-1/2 bg-gradient-to-b from-[var(--accent-violet)] via-[var(--accent-mint)] to-[var(--accent-coral)] opacity-30" />

          <div className="grid md:grid-cols-3 gap-6 sm:gap-8 md:gap-12">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.id}
                  className="relative flex flex-col items-center text-center group"
                >
                  {/* Step number badge */}
                  <div className={cn(
                    'absolute z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-background border-2 border-muted flex items-center justify-center text-xs sm:text-sm font-bold text-muted-foreground',
                    // Mobile: top-right of icon
                    '-top-2 -right-2 md:top-0 md:right-auto',
                    // Desktop: centered above
                    'md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2'
                  )}>
                    {index + 1}
                  </div>

                  {/* Icon container - smaller on mobile */}
                  <div
                    className={cn(
                      'w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl sm:rounded-3xl flex items-center justify-center mb-4 sm:mb-6 transition-all duration-500',
                      'active:scale-95 md:group-hover:scale-110 md:group-hover:shadow-2xl',
                      `bg-gradient-to-br ${step.gradient}`
                    )}
                  >
                    <Icon className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-white" strokeWidth={1.5} />
                  </div>

                  {/* Content */}
                  <h3 className="font-display text-lg sm:text-xl font-bold mb-1.5 sm:mb-2">
                    {t(`howItWorks.steps.${step.id}.title`)}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed max-w-[280px] sm:max-w-xs px-2">
                    {t(`howItWorks.steps.${step.id}.description`)}
                  </p>

                  {/* Mobile connector arrow between steps */}
                  {index < steps.length - 1 && (
                    <div className="md:hidden flex flex-col items-center my-4 sm:my-6">
                      <ChevronDown className="w-5 h-5 text-muted-foreground/50 animate-bounce" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Time indicator */}
        <div className="mt-10 sm:mt-16 text-center">
          <div className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-muted/50 rounded-full">
            <span className="text-xl sm:text-2xl font-display font-bold text-[var(--accent-violet)]">
              ~2
            </span>
            <span className="text-sm sm:text-base text-muted-foreground">
              {t('howItWorks.timeLabel')}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
