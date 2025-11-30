'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Zap, Download, Shield, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

interface MarketingHeroProps {
  user: User | null;
  className?: string;
}

/**
 * MarketingHero - Hero section with value proposition and CTA
 * Shows different CTAs for new vs returning users
 */
export function MarketingHero({ user, className }: MarketingHeroProps) {
  const t = useTranslations();

  // Scroll to tabs section
  const scrollToTabs = () => {
    const tabsSection = document.getElementById('generator-tabs');
    if (tabsSection) {
      tabsSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className={cn('text-center py-12 md:py-16', className)}>
      {/* Badge */}
      <Badge variant="secondary" className="mb-4">
        <Sparkles className="mr-1 h-3 w-3" />
        {t('home.badge')}
      </Badge>

      {/* Tagline */}
      <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
        {t('home.hero.tagline')}
      </h1>

      {/* Subtitle */}
      <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
        {t('home.hero.subtitle')}
      </p>

      {/* Primary CTA */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
        {user ? (
          // Returning user - scroll to generate
          <Button
            size="lg"
            onClick={scrollToTabs}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg transition-all hover:shadow-xl"
          >
            <Sparkles className="mr-2 h-5 w-5" />
            {t('home.hero.ctaReturning')}
          </Button>
        ) : (
          // New user - sign up
          <Link href="/auth">
            <Button
              size="lg"
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg transition-all hover:shadow-xl"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              {t('home.hero.ctaNew')}
            </Button>
          </Link>
        )}

        {/* Secondary CTA - scroll to tabs */}
        <Button variant="outline" size="lg" onClick={scrollToTabs}>
          {t('home.hero.ctaSecondary')}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* Trust indicators */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <span>{t('home.features.aiPowered.title')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Download className="h-4 w-4 text-primary" />
          </div>
          <span>{t('home.features.multipleFormats.title')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <span>{t('home.features.printReady.title')}</span>
        </div>
      </div>
    </section>
  );
}
