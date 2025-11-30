'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Upload, Cpu, Download } from 'lucide-react';

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
 */
export function HowItWorksSection({ className }: HowItWorksSectionProps) {
  const t = useTranslations('landing');

  return (
    <section className={cn('py-24 bg-background', className)}>
      <div className="container max-w-5xl mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-16">
          <Badge
            variant="outline"
            className="mb-4 px-3 py-1 text-xs font-medium"
          >
            {t('howItWorks.badge')}
          </Badge>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            {t('howItWorks.title')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('howItWorks.subtitle')}
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connector line (desktop) */}
          <div className="hidden md:block absolute top-16 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-[var(--accent-violet)] via-[var(--accent-mint)] to-[var(--accent-coral)]">
            <div className="absolute inset-0 animate-pulse opacity-50" />
          </div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.id}
                  className="relative flex flex-col items-center text-center group"
                >
                  {/* Step number */}
                  <div className="absolute -top-3 -right-3 md:top-0 md:right-auto md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-8 h-8 rounded-full bg-background border-2 border-muted flex items-center justify-center text-sm font-bold text-muted-foreground z-10">
                    {index + 1}
                  </div>

                  {/* Icon container */}
                  <div
                    className={cn(
                      'w-32 h-32 rounded-3xl flex items-center justify-center mb-6 transition-all duration-500 group-hover:scale-110 group-hover:shadow-2xl',
                      `bg-gradient-to-br ${step.gradient}`
                    )}
                  >
                    <Icon className="w-12 h-12 text-white" strokeWidth={1.5} />
                  </div>

                  {/* Content */}
                  <h3 className="font-display text-xl font-bold mb-2">
                    {t(`howItWorks.steps.${step.id}.title`)}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
                    {t(`howItWorks.steps.${step.id}.description`)}
                  </p>

                  {/* Mobile connector arrow */}
                  {index < steps.length - 1 && (
                    <div className="md:hidden my-6 w-0.5 h-8 bg-gradient-to-b from-muted to-transparent" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Time indicator */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-muted/50 rounded-full">
            <span className="text-2xl font-display font-bold text-[var(--accent-violet)]">
              ~2
            </span>
            <span className="text-muted-foreground">
              {t('howItWorks.timeLabel')}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
