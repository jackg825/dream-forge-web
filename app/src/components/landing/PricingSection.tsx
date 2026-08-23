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

interface PricingPlan {
  id: 'free' | 'starter' | 'pro';
  icon: typeof Gift;
  price: string;
  credits: number;
  available: boolean;
  features: string[];
}

interface PricingCardProps {
  plan: PricingPlan;
  compact?: boolean;
}

function PricingCard({ plan, compact = false }: PricingCardProps) {
  const t = useTranslations('landing');
  const Icon = plan.icon;

  return (
    <Card
      className={cn(
        'relative overflow-hidden border transition-all duration-300',
        compact
          ? 'w-[280px] shrink-0 snap-center'
          : 'hover:-translate-y-1 hover:shadow-xl'
      )}
    >
      <CardHeader className={cn('text-center', compact && 'py-4')}>
        <div className={cn('mx-auto rounded-xl bg-muted', compact ? 'mb-3 p-2.5' : 'mb-4 p-3')}>
          <Icon className={cn('text-muted-foreground', compact ? 'h-5 w-5' : 'h-6 w-6')} />
        </div>

        <h3 className={cn('font-display font-bold', compact ? 'text-lg' : 'text-xl')}>
          {t(`pricing.plans.${plan.id}.name`)}
        </h3>

        <div className={compact ? 'mt-2' : 'mt-4'}>
          <span className={cn('font-display font-bold', compact ? 'text-3xl' : 'text-4xl')}>
            {plan.price}
          </span>
        </div>

        <p className={cn('text-sm text-muted-foreground', compact ? 'mt-1' : 'mt-2')}>
          {plan.credits} {t('pricing.credits')}
        </p>
      </CardHeader>

      <CardContent className={cn(compact ? 'px-4 pb-4 pt-2' : 'pt-4')}>
        <ul className={cn(compact ? 'mb-4 space-y-2' : 'mb-6 space-y-3')}>
          {plan.features.map((feature) => (
            <li
              key={feature}
              className={cn('flex items-start gap-2', compact ? 'text-xs' : 'text-sm')}
            >
              <Check
                className={cn(
                  'mt-0.5 shrink-0 text-[var(--accent-mint)]',
                  compact ? 'h-3.5 w-3.5' : 'h-4 w-4'
                )}
                strokeWidth={2.5}
              />
              <span className="leading-tight">{t(`pricing.plans.${plan.id}.${feature}`)}</span>
            </li>
          ))}
        </ul>

        {plan.available ? (
          <Link href="/generate">
            <Button className={cn('w-full', compact && 'py-5')} variant="outline">
              {t(`pricing.plans.${plan.id}.cta`)}
            </Button>
          </Link>
        ) : (
          <Button className={cn('w-full', compact && 'py-5')} variant="outline" disabled>
            {t('pricing.comingSoon')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function PricingSection({ className }: PricingSectionProps) {
  const t = useTranslations('landing');

  const plans: PricingPlan[] = [
    {
      id: 'free',
      icon: Gift,
      price: '$0',
      credits: 3,
      available: true,
      features: ['freeFeature1', 'freeFeature2', 'freeFeature3', 'freeFeature4'],
    },
    {
      id: 'starter',
      icon: Sparkles,
      price: t('pricing.comingSoon'),
      credits: 20,
      available: false,
      features: ['starterFeature1', 'starterFeature2', 'starterFeature3', 'starterFeature4', 'starterFeature5'],
    },
    {
      id: 'pro',
      icon: Sparkles,
      price: t('pricing.comingSoon'),
      credits: 80,
      available: false,
      features: ['proFeature1', 'proFeature2', 'proFeature3', 'proFeature4', 'proFeature5'],
    },
  ];

  return (
    <section
      id="pricing"
      className={cn('bg-gradient-to-b from-background to-muted/20 py-16 sm:py-24', className)}
    >
      <div className="container mx-auto max-w-5xl px-4">
        <div className="mb-10 text-center sm:mb-16">
          <Badge variant="outline" className="mb-3 px-3 py-1 text-xs font-medium sm:mb-4">
            {t('pricing.badge')}
          </Badge>
          <h2 className="mb-3 font-display text-2xl font-bold tracking-tight sm:mb-4 sm:text-3xl md:text-4xl lg:text-5xl">
            {t('pricing.title')}
          </h2>
          <p className="mx-auto max-w-2xl px-2 text-base text-muted-foreground sm:text-lg">
            {t('pricing.subtitle')}
          </p>
        </div>

        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 -mx-4 scrollbar-hide md:hidden">
          {plans.map((plan) => (
            <PricingCard key={plan.id} plan={plan} compact />
          ))}
        </div>

        <div className="hidden gap-6 md:grid md:grid-cols-3 lg:gap-8">
          {plans.map((plan) => (
            <PricingCard key={plan.id} plan={plan} />
          ))}
        </div>

        {t('pricing.note') && (
          <p className="mt-6 px-2 text-center text-xs text-muted-foreground sm:mt-8 sm:text-sm">
            {t('pricing.note')}
          </p>
        )}
      </div>
    </section>
  );
}
