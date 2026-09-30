'use client';

import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface FinalCTASectionProps {
  className?: string;
}

export function FinalCTASection({ className }: FinalCTASectionProps) {
  const t = useTranslations('landing');

  return (
    <section className={cn('store-section', className)}>
      <div className="store-container">
        <div className="rounded-[28px] bg-white px-6 py-16 text-center text-[#1d1d1f] sm:px-12 sm:py-24">
          <p className="mb-4 text-sm font-semibold text-[#6e6e73]">{t('finalCta.badge')}</p>
          <h2 className="mx-auto max-w-3xl text-[32px] font-semibold leading-[1.12] tracking-[-0.035em] sm:text-[48px]">
            {t('finalCta.title')}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-[#6e6e73] sm:text-xl">
            {t('finalCta.subtitle')}
          </p>
          <Button asChild size="lg" className="mt-8 h-12 max-w-full rounded-full px-7 text-[15px] font-normal">
            <Link href="/generate">
              {t('finalCta.cta')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <p className="mt-5 text-xs text-[#6e6e73] sm:text-sm">{t('finalCta.trust')}</p>
        </div>
      </div>
    </section>
  );
}
