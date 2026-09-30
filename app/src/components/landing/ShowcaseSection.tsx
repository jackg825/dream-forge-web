'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BeforeAfterSlider } from './BeforeAfterSlider';
import { FillImage } from '@/components/ui/fill-image';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const styles = ['bobblehead', 'chibi', 'cartoon', 'emoji'] as const;

export function ShowcaseSection({ className }: { className?: string }) {
  const t = useTranslations('landing');
  return (
    <div className={className}>
      <section id="styles" className="store-section">
        <div className="store-container">
          <h2 className="store-heading mb-7">{t('store.stylesTitle')} <span className="text-muted-foreground">{t('store.stylesSubtitle')}</span></h2>
          <div className="-mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-5 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-4 scrollbar-hide">
            {styles.map((style) => (
              <Link key={style} href="/generate" className="store-card group flex w-[260px] shrink-0 snap-start flex-col p-6 transition-shadow hover:shadow-lg sm:w-auto">
                <p className="store-eyebrow">DreamForge Styles</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">{t(`store.${style}`)}</h3>
                <div className="relative my-5 aspect-square overflow-hidden rounded-2xl bg-white">
                  <FillImage src={`/styles/${style}/preview-1.webp`} alt={t(`store.${style}`)} sizes="(max-width: 1024px) 260px, 240px" className="object-contain p-2 transition-transform duration-500 group-hover:scale-105" />
                </div>
                <span className="inline-flex items-center text-sm text-primary">{t('store.styleLink')}<ChevronRight className="size-4" aria-hidden="true" /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section id="showcase" className="store-section">
        <div className="store-container">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="store-eyebrow mb-3">{t('showcase.badge')}</p>
              <h2 className="store-heading">{t('store.comparison')}</h2>
              <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-muted-foreground">{t('store.comparisonSub')}</p>
            </div>
            <Link href="/generate" className="inline-flex min-h-11 shrink-0 items-center text-sm text-primary hover:underline">{t('store.start')}<ChevronRight className="size-4" aria-hidden="true" /></Link>
          </div>
          <BeforeAfterSlider beforeImage="racecarOrigin" afterImage="racecarRender" beforeAlt={t('showcase.examples.racecar.before')} afterAlt={t('showcase.examples.racecar.after')} className={cn('aspect-[4/3] sm:aspect-[16/9]')} />
          <p className="mt-5 text-center text-sm text-muted-foreground">{t('showcase.examples.racecar.description')}</p>
        </div>
      </section>
    </div>
  );
}
