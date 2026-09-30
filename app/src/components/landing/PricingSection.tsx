'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface PricingSectionProps {
  className?: string;
}

const plans = [
  { id: 'free', credits: 3, features: ['freeFeature1', 'freeFeature2', 'freeFeature3', 'freeFeature4'] },
  { id: 'starter', credits: 20, features: ['starterFeature1', 'starterFeature2', 'starterFeature3', 'starterFeature4', 'starterFeature5'] },
  { id: 'pro', credits: 80, features: ['proFeature1', 'proFeature2', 'proFeature3', 'proFeature4', 'proFeature5'] },
];

export function PricingSection({ className }: PricingSectionProps) {
  const t = useTranslations('landing');

  return (
    <section id="pricing" className={cn('store-section scroll-mt-24', className)}>
      <div className="store-container">
        <div className="mb-10 max-w-3xl sm:mb-12">
          <p className="store-eyebrow mb-3">{t('pricing.badge')}</p>
          <h2 className="store-heading">{t('pricing.title')}</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground sm:text-xl">
            {t('pricing.subtitle')}
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {plans.map((plan) => {
            const isFree = plan.id === 'free';

            return (
              <article key={plan.id} className={cn('store-card flex flex-col p-7 sm:p-8', isFree && 'ring-1 ring-primary/30')}>
                <h3 className="text-[22px] font-semibold tracking-tight">{t(`pricing.plans.${plan.id}.name`)}</h3>
                <div className="mt-7 flex items-baseline gap-2">
                  <span className="text-[52px] font-semibold leading-none tracking-[-0.04em]">{plan.credits}</span>
                  <span className="text-sm text-muted-foreground">{t('pricing.credits')}</span>
                </div>
                <p className={cn('mb-7 mt-4 text-base font-medium', isFree ? 'text-primary' : 'text-muted-foreground')}>
                  {isFree ? '$0' : t('pricing.comingSoon')}
                </p>
                <ul className="mb-8 space-y-3 border-t border-border/70 pt-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm leading-relaxed">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
                      <span>{t(`pricing.plans.${plan.id}.${feature}`)}</span>
                    </li>
                  ))}
                </ul>
                {isFree ? (
                  <Button asChild className="mt-auto h-11 w-full rounded-full font-normal">
                    <Link href="/generate">{t(`pricing.plans.${plan.id}.cta`)}</Link>
                  </Button>
                ) : (
                  <Button disabled variant="secondary" className="mt-auto h-11 w-full rounded-full font-normal disabled:opacity-70">
                    {t('pricing.comingSoon')}
                  </Button>
                )}
              </article>
            );
          })}
        </div>
        {t('pricing.note') && <p className="mt-6 text-sm text-muted-foreground">{t('pricing.note')}</p>}
      </div>
    </section>
  );
}
