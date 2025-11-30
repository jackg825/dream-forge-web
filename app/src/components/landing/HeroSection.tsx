'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowRight, Camera, Box, Truck, Sparkles } from 'lucide-react';

interface HeroSectionProps {
  className?: string;
}

/**
 * HeroSection - Immersive hero showcasing the complete journey:
 * Photo → 3D Model → Physical Print Delivery
 *
 * Design: Dark industrial aesthetic with glowing accents
 * emphasizing the transformation from digital to physical
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
        'relative min-h-screen flex items-center justify-center overflow-hidden',
        'bg-zinc-950',
        className
      )}
    >
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Main glow - top left */}
        <div
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-30 blur-[120px] animate-pulse-slow"
          style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)' }}
        />
        {/* Secondary glow - bottom right */}
        <div
          className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-25 blur-[100px] animate-pulse-slower"
          style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)' }}
        />
        {/* Accent glow - center */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full opacity-10 blur-[150px]"
          style={{ background: 'linear-gradient(90deg, #f59e0b 0%, #ef4444 50%, #8b5cf6 100%)' }}
        />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.15] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 container max-w-6xl mx-auto px-4 py-20">
        <div className="text-center">
          {/* Floating badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm animate-fade-in-up">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-zinc-300">
              {t('hero.badge')}
            </span>
          </div>

          {/* Main headline - staggered animation */}
          <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6">
            <span
              className="block text-white mb-2 animate-fade-in-up"
              style={{ animationDelay: '0.1s' }}
            >
              {t('hero.title1')}
            </span>
            <span
              className="block animate-fade-in-up"
              style={{
                animationDelay: '0.2s',
                background: 'linear-gradient(135deg, #a78bfa 0%, #f472b6 40%, #fb923c 70%, #34d399 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {t('hero.title2')}
            </span>
          </h1>

          {/* Subtitle */}
          <p
            className="text-lg sm:text-xl md:text-2xl text-zinc-400 max-w-3xl mx-auto mb-12 leading-relaxed animate-fade-in-up"
            style={{ animationDelay: '0.3s' }}
          >
            {t('hero.subtitle')}
          </p>

          {/* Journey visualization */}
          <div
            className="flex items-center justify-center gap-2 sm:gap-4 mb-12 animate-fade-in-up"
            style={{ animationDelay: '0.4s' }}
          >
            {journeySteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex items-center gap-2 sm:gap-4">
                  <div className="group relative">
                    {/* Glow effect on hover */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    <div className="relative flex flex-col items-center gap-2 p-4 sm:p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 hover:border-white/20 transition-all duration-300 cursor-default">
                      <div
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center"
                        style={{
                          background: index === 0
                            ? 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)'
                            : index === 1
                            ? 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)'
                            : 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                        }}
                      >
                        <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                      </div>
                      <span className="text-xs sm:text-sm font-medium text-zinc-300 whitespace-nowrap">
                        {step.label}
                      </span>
                    </div>
                  </div>

                  {/* Connector arrow */}
                  {index < journeySteps.length - 1 && (
                    <div className="flex items-center">
                      <div className="w-8 sm:w-12 h-px bg-gradient-to-r from-white/20 to-white/5" />
                      <div className="w-0 h-0 border-t-4 border-b-4 border-l-6 border-t-transparent border-b-transparent border-l-white/20" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in-up"
            style={{ animationDelay: '0.5s' }}
          >
            <Link href="/generate">
              <Button
                size="lg"
                className="group text-lg px-8 py-7 bg-white text-zinc-900 hover:bg-zinc-100 shadow-2xl shadow-white/10 transition-all duration-300 hover:shadow-white/20 hover:scale-105"
              >
                <span className="font-semibold">{t('hero.cta')}</span>
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>

            <Button
              variant="outline"
              size="lg"
              className="text-lg px-8 py-7 bg-transparent border-2 border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all duration-300"
              onClick={() => {
                document.getElementById('showcase')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              {t('hero.ctaSecondary')}
            </Button>
          </div>

          {/* Stats row */}
          <div
            className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 animate-fade-in-up"
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
                className="flex items-center gap-3"
              >
                <span className="text-3xl sm:text-4xl font-bold font-display text-white">
                  {stat.value}
                </span>
                <span className="text-sm text-zinc-500 text-left leading-tight max-w-[80px]">
                  {stat.label}
                </span>
                {index < 3 && (
                  <div className="hidden sm:block w-px h-8 bg-zinc-800 ml-8" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-zinc-700 flex items-start justify-center p-2">
          <div className="w-1.5 h-3 rounded-full bg-zinc-600 animate-pulse" />
        </div>
      </div>
    </section>
  );
}
