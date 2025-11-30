'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Check, Gift, Sparkles } from 'lucide-react';

interface PricingSectionProps {
  className?: string;
}

/**
 * PricingSection - Credit-based pricing display
 * Shows free tier and credit packages
 */
export function PricingSection({ className }: PricingSectionProps) {
  const t = useTranslations('landing');

  const plans = [
    {
      id: 'free',
      featured: false,
      icon: Gift,
      price: '$0',
      credits: 3,
      features: ['freeFeature1', 'freeFeature2', 'freeFeature3', 'freeFeature4'],
    },
    {
      id: 'starter',
      featured: true,
      icon: Sparkles,
      price: '$9',
      credits: 20,
      features: ['starterFeature1', 'starterFeature2', 'starterFeature3', 'starterFeature4', 'starterFeature5'],
    },
    {
      id: 'pro',
      featured: false,
      icon: Sparkles,
      price: '$29',
      credits: 80,
      features: ['proFeature1', 'proFeature2', 'proFeature3', 'proFeature4', 'proFeature5'],
    },
  ];

  return (
    <section
      id="pricing"
      className={cn(
        'py-24 bg-gradient-to-b from-background to-muted/20',
        className
      )}
    >
      <div className="container max-w-5xl mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-16">
          <Badge
            variant="outline"
            className="mb-4 px-3 py-1 text-xs font-medium"
          >
            {t('pricing.badge')}
          </Badge>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            {t('pricing.title')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('pricing.subtitle')}
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan) => {
            const Icon = plan.icon;

            return (
              <Card
                key={plan.id}
                className={cn(
                  'relative overflow-hidden transition-all duration-300 hover:shadow-xl',
                  plan.featured
                    ? 'border-2 border-[var(--accent-violet)] shadow-lg scale-105 z-10'
                    : 'border hover:-translate-y-1'
                )}
              >
                {/* Featured badge */}
                {plan.featured && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2">
                    <div className="px-4 py-1 bg-gradient-to-r from-[var(--accent-violet)] to-[var(--accent-coral)] text-white text-xs font-medium rounded-b-lg">
                      {t('pricing.popular')}
                    </div>
                  </div>
                )}

                <CardHeader className={cn('text-center', plan.featured && 'pt-8')}>
                  {/* Icon */}
                  <div
                    className={cn(
                      'mx-auto mb-4 p-3 rounded-xl w-fit',
                      plan.featured
                        ? 'bg-gradient-to-br from-[var(--accent-violet)] to-[var(--accent-coral)]'
                        : 'bg-muted'
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-6 h-6',
                        plan.featured ? 'text-white' : 'text-muted-foreground'
                      )}
                    />
                  </div>

                  {/* Plan name */}
                  <h3 className="font-display text-xl font-bold">
                    {t(`pricing.plans.${plan.id}.name`)}
                  </h3>

                  {/* Price */}
                  <div className="mt-4">
                    <span className="text-4xl font-display font-bold">
                      {plan.price}
                    </span>
                    {plan.id !== 'free' && (
                      <span className="text-muted-foreground ml-1">
                        {t('pricing.perPack')}
                      </span>
                    )}
                  </div>

                  {/* Credits */}
                  <p className="mt-2 text-sm text-muted-foreground">
                    {plan.credits} {t('pricing.credits')}
                  </p>
                </CardHeader>

                <CardContent className="pt-4">
                  {/* Features list */}
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm"
                      >
                        <Check
                          className="w-4 h-4 mt-0.5 text-[var(--accent-mint)]"
                          strokeWidth={2.5}
                        />
                        <span>{t(`pricing.plans.${plan.id}.${feature}`)}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <Link href={plan.id === 'free' ? '/generate' : '/dashboard'}>
                    <Button
                      className={cn(
                        'w-full',
                        plan.featured
                          ? 'bg-gradient-to-r from-[var(--accent-violet)] to-[var(--accent-coral)] text-white hover:opacity-90'
                          : ''
                      )}
                      variant={plan.featured ? 'default' : 'outline'}
                    >
                      {t(`pricing.plans.${plan.id}.cta`)}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Additional note */}
        {t('pricing.note') && (
          <p className="text-center text-sm text-muted-foreground mt-8">
            {t('pricing.note')}
          </p>
        )}
      </div>
    </section>
  );
}
