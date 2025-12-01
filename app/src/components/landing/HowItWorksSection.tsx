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
    glowColor: 'rgba(139, 92, 246, 0.4)',
    cardGradient: 'from-violet-500/10 to-purple-500/5',
  },
  {
    id: 'process',
    icon: Cpu,
    color: 'var(--accent-mint)',
    gradient: 'from-[var(--accent-mint)] to-[var(--accent-violet)]',
    glowColor: 'rgba(52, 211, 153, 0.4)',
    cardGradient: 'from-emerald-500/10 to-teal-500/5',
  },
  {
    id: 'download',
    icon: Download,
    color: 'var(--accent-coral)',
    gradient: 'from-[var(--accent-coral)] to-[var(--accent-yellow)]',
    glowColor: 'rgba(251, 146, 60, 0.4)',
    cardGradient: 'from-orange-500/10 to-amber-500/5',
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

          {/* Mobile vertical connector - enhanced with particles */}
          <div className="md:hidden absolute left-1/2 top-[140px] bottom-[140px] -translate-x-1/2 flex flex-col items-center pointer-events-none">
            {/* Base glow line */}
            <div className="absolute inset-0 w-1 bg-gradient-to-b from-[var(--accent-violet)] via-[var(--accent-mint)] to-[var(--accent-coral)] opacity-20 blur-sm" />

            {/* Main animated gradient line */}
            <div
              className="absolute inset-0 w-0.5"
              style={{
                background: 'linear-gradient(to bottom, var(--accent-violet), var(--accent-mint), var(--accent-coral), var(--accent-violet))',
                backgroundSize: '100% 200%',
                animation: 'gradient-flow 3s linear infinite',
              }}
            />

            {/* Flowing particle 1 */}
            <div
              className="absolute top-0 w-2 h-2 rounded-full bg-[var(--accent-violet)]"
              style={{
                boxShadow: '0 0 8px var(--accent-violet)',
                animation: 'particle-flow 2.5s ease-in-out infinite',
              }}
            />
            {/* Flowing particle 2 (delayed) */}
            <div
              className="absolute top-0 w-2 h-2 rounded-full bg-[var(--accent-mint)]"
              style={{
                boxShadow: '0 0 8px var(--accent-mint)',
                animation: 'particle-flow 2.5s ease-in-out infinite 1.25s',
              }}
            />
          </div>

          <div className="grid md:grid-cols-3 gap-4 sm:gap-6 md:gap-12">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.id}
                  className="relative flex flex-col items-center text-center group"
                >
                  {/* Step card with glassmorphism effect (mobile only) */}
                  <div
                    className={cn(
                      'relative p-5 sm:p-6 rounded-2xl w-full',
                      'md:p-0 md:bg-transparent md:border-0 md:backdrop-blur-none',
                      'bg-gradient-to-br backdrop-blur-sm',
                      'border border-white/10 dark:border-white/5',
                      `${step.cardGradient}`,
                    )}
                    style={{
                      animation: 'step-enter 0.6s ease-out forwards',
                      animationDelay: `${index * 150}ms`,
                      opacity: 0,
                    }}
                  >
                    {/* Step number badge - gradient background */}
                    <div
                      className={cn(
                        'absolute z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-full',
                        'flex items-center justify-center text-sm font-bold text-white',
                        'shadow-lg border-2 border-white/20',
                        // Mobile: top-left of card
                        '-top-3 -left-3',
                        // Desktop: centered above icon
                        'md:top-0 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2',
                        `bg-gradient-to-br ${step.gradient}`,
                      )}
                    >
                      {index + 1}
                    </div>

                    <div className="flex flex-col items-center">
                      {/* Icon container with glow effect */}
                      <div
                        className={cn(
                          'w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl sm:rounded-3xl',
                          'flex items-center justify-center mb-4 sm:mb-6',
                          'transition-all duration-500',
                          'active:scale-95 md:group-hover:scale-110 md:group-hover:shadow-2xl',
                          `bg-gradient-to-br ${step.gradient}`,
                        )}
                        style={
                          {
                            animation: 'icon-glow 2.5s ease-in-out infinite',
                            animationDelay: `${index * 0.5}s`,
                            '--glow-color': step.glowColor,
                          } as React.CSSProperties
                        }
                      >
                        <Icon
                          className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-white"
                          strokeWidth={1.5}
                        />
                      </div>

                      {/* Content */}
                      <h3 className="font-display text-lg sm:text-xl font-bold mb-1.5 sm:mb-2">
                        {t(`howItWorks.steps.${step.id}.title`)}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed max-w-[280px] sm:max-w-xs">
                        {t(`howItWorks.steps.${step.id}.description`)}
                      </p>
                    </div>
                  </div>

                  {/* Mobile connector between steps - animated dots */}
                  {index < steps.length - 1 && (
                    <div className="md:hidden flex flex-col items-center my-5 sm:my-6 relative">
                      {/* Pulsing background ring */}
                      <div
                        className="absolute w-6 h-6 rounded-full animate-ping opacity-20"
                        style={{ backgroundColor: steps[index + 1].color }}
                      />
                      {/* Center gradient dot */}
                      <div
                        className="relative z-10 w-3 h-3 rounded-full shadow-lg"
                        style={{
                          background: `linear-gradient(135deg, ${step.color}, ${steps[index + 1].color})`,
                          boxShadow: `0 0 10px ${step.color}`,
                        }}
                      />
                      {/* Down arrow */}
                      <ChevronDown
                        className="w-4 h-4 mt-1"
                        style={{ color: steps[index + 1].color }}
                      />
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
