'use client';

import { useTranslations } from 'next-intl';
import { Upload, Cpu, Download, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HowItWorksSectionProps {
  className?: string;
}

const steps = [
  { id: 'upload', icon: Upload },
  { id: 'process', icon: Cpu },
  { id: 'download', icon: Download },
];

export function HowItWorksSection({ className }: HowItWorksSectionProps) {
  const t = useTranslations('landing');

  return (
    <section id="how-it-works" className={cn('store-section', className)}>
      <div className="store-container">
        <div className="mb-10 max-w-3xl sm:mb-12">
          <p className="store-eyebrow mb-3">{t('howItWorks.badge')}</p>
          <h2 className="store-heading">{t('howItWorks.title')}</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground sm:text-xl">
            {t('howItWorks.subtitle')}
          </p>
        </div>

        <ol className="grid gap-5 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;

            return (
              <li key={step.id} className="store-card p-7 sm:p-8">
                <div className="mb-9 flex items-center justify-between">
                  <Icon className="h-8 w-8 text-foreground" strokeWidth={1.5} aria-hidden="true" />
                  <span className="text-[40px] font-semibold leading-none tracking-tight text-foreground/15" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="text-[22px] font-semibold tracking-tight sm:text-2xl">
                  {t(`howItWorks.steps.${step.id}.title`)}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                  {t(`howItWorks.steps.${step.id}.description`)}
                </p>
              </li>
            );
          })}
        </ol>

        <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t('howItWorks.timeLabel')}
        </p>
      </div>
    </section>
  );
}
