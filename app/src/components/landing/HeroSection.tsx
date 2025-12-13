'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowRight, Camera, Box, Truck, Sparkles, ChevronDown } from 'lucide-react';

interface HeroSectionProps {
  className?: string;
}

/**
 * HeroSection - Immersive hero showcasing the complete journey:
 * Photo → 3D Model → Physical Print Delivery
 *
 * Mobile-optimized with responsive typography and touch-friendly elements
 */
export function HeroSection({ className }: HeroSectionProps) {
  const t = useTranslations('landing');

  const journeySteps = [
    { icon: Camera, label: t('hero.journey.photo'), delay: '0s' },
    { icon: Box, label: t('hero.journey.model'), delay: '0.1s' },
    { icon: Truck, label: t('hero.journey.deliver'), delay: '0.2s' },
  ];

  return (
    <section
      className={cn(
        'relative min-h-[100dvh] flex items-center justify-center overflow-hidden',
        // Light mode: soft gradient background
        'bg-gradient-to-br from-slate-50 via-violet-50/30 to-rose-50/20',
        // Dark mode: subtle radial gradient with violet tint for depth
        'dark:bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.12)_0%,_rgba(24,24,27,1)_50%)]',
        className
      )}
    >
      {/* Animated gradient orbs - hidden on mobile for performance */}
      <div className="absolute inset-0 overflow-hidden hidden sm:block">
        {/* Main glow - top left */}
        <div
          className={cn(
            'absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-[120px] animate-pulse-slow',
            'opacity-20 dark:opacity-30'
          )}
          style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)' }}
        />
        {/* Secondary glow - bottom right */}
        <div
          className={cn(
            'absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full blur-[100px] animate-pulse-slower',
            'opacity-15 dark:opacity-25'
          )}
          style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)' }}
        />
        {/* Accent glow - center */}
        <div
          className={cn(
            'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full blur-[150px]',
            'opacity-5 dark:opacity-10'
          )}
          style={{ background: 'linear-gradient(90deg, #f59e0b 0%, #ef4444 50%, #8b5cf6 100%)' }}
        />
      </div>

      {/* Simplified mobile gradient */}
      <div className="absolute inset-0 sm:hidden">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full blur-[80px] opacity-30 dark:opacity-40"
          style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)' }}
        />
      </div>

      {/* Grid pattern overlay - smaller on mobile */}
      <div
        className={cn(
          'absolute inset-0',
          'opacity-[0.02] dark:opacity-[0.03]'
        )}
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 container max-w-6xl mx-auto px-4 py-16 sm:py-20">
        <div className="text-center">
          {/* Floating badge */}
          <div className={cn(
            'inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 mb-6 sm:mb-8 rounded-full backdrop-blur-sm animate-fade-in-up',
            'bg-white/60 border border-zinc-200/50 shadow-lg shadow-zinc-200/20',
            'dark:bg-white/5 dark:border-white/10 dark:shadow-none'
          )}>
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 dark:text-amber-400" />
            <span className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('hero.badge')}
            </span>
          </div>

          {/* Main headline - responsive typography */}
          <h1 className="font-display text-3xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight mb-4 sm:mb-6">
            <span
              className="block text-zinc-900 dark:text-white mb-1 sm:mb-2 animate-fade-in-up"
              style={{ animationDelay: '0.1s' }}
            >
              {t('hero.title1')}
            </span>
            <span
              className="block animate-fade-in-up bg-clip-text text-transparent"
              style={{
                animationDelay: '0.2s',
                backgroundImage: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 40%, #f97316 70%, #10b981 100%)',
              }}
            >
              {t('hero.title2')}
            </span>
          </h1>

          {/* Subtitle - responsive text */}
          <p
            className={cn(
              'text-base sm:text-lg md:text-xl lg:text-2xl max-w-3xl mx-auto mb-8 sm:mb-12 leading-relaxed animate-fade-in-up px-2',
              'text-zinc-600 dark:text-zinc-400'
            )}
            style={{ animationDelay: '0.3s' }}
          >
            {t('hero.subtitle')}
          </p>

          {/* Journey visualization - horizontal scroll on mobile */}
          <div
            className="mb-8 sm:mb-12 animate-fade-in-up"
            style={{ animationDelay: '0.4s' }}
          >
            {/* Mobile: Centered flexbox layout */}
            <div className="flex sm:hidden justify-center pb-4">
              <div className="flex items-center gap-2">
                {journeySteps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.label} className="flex items-center gap-2">
                      <div className={cn(
                        'flex flex-col items-center gap-1.5 p-3 rounded-2xl backdrop-blur-sm min-w-[85px]',
                        'bg-white/70 border border-zinc-200/50 shadow-lg shadow-zinc-200/20',
                        'dark:bg-white/5 dark:border-white/10 dark:shadow-none'
                      )}>
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg"
                          style={{
                            background: index === 0
                              ? 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)'
                              : index === 1
                              ? 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)'
                              : 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                          }}
                        >
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                          {step.label}
                        </span>
                      </div>

                      {/* Connector arrow */}
                      {index < journeySteps.length - 1 && (
                        <div className="flex items-center shrink-0">
                          <div className="w-4 h-px bg-gradient-to-r from-zinc-300 to-zinc-200 dark:from-white/20 dark:to-white/5" />
                          <div className="w-0 h-0 border-t-[4px] border-b-[4px] border-l-[5px] border-t-transparent border-b-transparent border-l-zinc-300 dark:border-l-white/20" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Desktop: Original layout */}
            <div className="hidden sm:flex items-center justify-center gap-4">
              {journeySteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.label} className="flex items-center gap-4">
                    <div className="group relative">
                      {/* Glow effect on hover */}
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                      <div className={cn(
                        'relative flex flex-col items-center gap-2 p-6 rounded-2xl backdrop-blur-sm transition-all duration-300 cursor-default',
                        'bg-white/70 border border-zinc-200/50 shadow-lg shadow-zinc-200/20 hover:bg-white/90 hover:border-zinc-300/50',
                        'dark:bg-white/5 dark:border-white/10 dark:shadow-none dark:hover:bg-white/10 dark:hover:border-white/20'
                      )}>
                        <div
                          className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg"
                          style={{
                            background: index === 0
                              ? 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)'
                              : index === 1
                              ? 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)'
                              : 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                          }}
                        >
                          <Icon className="w-7 h-7 text-white" />
                        </div>
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                          {step.label}
                        </span>
                      </div>
                    </div>

                    {/* Connector arrow */}
                    {index < journeySteps.length - 1 && (
                      <div className="flex items-center">
                        <div className="w-12 h-px bg-gradient-to-r from-zinc-300 to-zinc-200 dark:from-white/20 dark:to-white/5" />
                        <div className="w-0 h-0 border-t-4 border-b-4 border-l-6 border-t-transparent border-b-transparent border-l-zinc-300 dark:border-l-white/20" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTAs - full width on mobile */}
          <div
            className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 mb-10 sm:mb-16 animate-fade-in-up px-2 sm:px-0"
            style={{ animationDelay: '0.5s' }}
          >
            <Link href="/generate" className="w-full sm:w-auto">
              <Button
                size="lg"
                className={cn(
                  'group w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8 py-6 sm:py-7 transition-all duration-300 active:scale-[0.98] sm:hover:scale-105',
                  'bg-zinc-900 text-white hover:bg-zinc-800 shadow-xl shadow-zinc-900/20',
                  'dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 dark:shadow-white/10 dark:hover:shadow-white/20'
                )}
              >
                <span className="font-semibold">{t('hero.cta')}</span>
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>

            <Button
              variant="outline"
              size="lg"
              className={cn(
                'w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8 py-6 sm:py-7 transition-all duration-300 active:scale-[0.98]',
                'bg-white/50 border-2 border-zinc-300 text-zinc-700 hover:bg-white hover:border-zinc-400',
                'dark:bg-transparent dark:border-white/20 dark:text-white dark:hover:bg-white/10 dark:hover:border-white/30'
              )}
              onClick={() => {
                document.getElementById('showcase')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              {t('hero.ctaSecondary')}
            </Button>
          </div>

          {/* Stats row - 2x2 grid on mobile */}
          <div
            className="grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-center gap-4 sm:gap-8 md:gap-12 animate-fade-in-up"
            style={{ animationDelay: '0.6s' }}
          >
            {[
              { value: '3', label: t('hero.stat1') },
              { value: '~2', label: t('hero.stat2') },
              { value: '4+', label: t('hero.stat3') },
              { value: '🌍', label: t('hero.stat4') },
            ].map((stat, index) => (
              <div
                key={stat.label}
                className={cn(
                  'flex items-center gap-2 sm:gap-3',
                  // Center items in grid on mobile
                  'justify-center sm:justify-start'
                )}
              >
                <span className="text-2xl sm:text-3xl md:text-4xl font-bold font-display text-zinc-900 dark:text-white">
                  {stat.value}
                </span>
                <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-500 text-left leading-tight max-w-[70px] sm:max-w-[80px]">
                  {stat.label}
                </span>
                {index < 3 && (
                  <div className="hidden md:block w-px h-8 bg-zinc-200 dark:bg-zinc-800 ml-8" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom gradient fade - matches next section's background */}
      <div className={cn(
        'absolute bottom-0 left-0 right-0 h-20 sm:h-32 pointer-events-none',
        'bg-gradient-to-t from-background to-transparent'
      )} />

      {/* Scroll indicator - smaller on mobile */}
      <div className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-5 h-8 sm:w-6 sm:h-10 rounded-full border-2 border-zinc-300 dark:border-zinc-700 flex items-start justify-center p-1.5 sm:p-2">
          <div className="w-1 h-2 sm:w-1.5 sm:h-3 rounded-full bg-zinc-400 dark:bg-zinc-600 animate-pulse" />
        </div>
      </div>
    </section>
  );
}
