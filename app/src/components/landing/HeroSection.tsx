'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { FillImage } from '@/components/ui/fill-image';
import { cn } from '@/lib/utils';
import { ChevronRight, Box } from 'lucide-react';

const categories = [
  { id: 'original', image: '/showcase/race_car_origin.jpg', href: '#showcase' },
  { id: 'bobblehead', image: '/styles/bobblehead/preview-1.webp', href: '#styles' },
  { id: 'chibi', image: '/styles/chibi/preview-1.webp', href: '#styles' },
  { id: 'cartoon', image: '/styles/cartoon/preview-1.webp', href: '#styles' },
  { id: 'emoji', image: '/styles/emoji/preview-1.webp', href: '#styles' },
] as const;

export function HeroSection({ className }: { className?: string }) {
  const t = useTranslations('landing');
  return (
    <section className={cn('pb-6', className)}>
      <div className="bg-card py-3 text-center text-xs sm:text-sm">
        <div className="store-container flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span>{t('store.offer')}</span>
          <Link href="/generate" className="inline-flex min-h-6 items-center text-primary hover:underline">
            {t('store.start')}<ChevronRight className="ml-0.5 size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
      <div className="store-container">
        <div className="flex flex-col justify-between gap-6 pb-10 pt-12 sm:pb-14 sm:pt-16 md:flex-row md:items-end">
          <div className="animate-fade-in-up">
            <p className="store-eyebrow mb-3">DreamForge</p>
            <h1 className="max-w-[720px] text-[40px] font-semibold leading-[1.13] tracking-[-0.045em] sm:text-[56px] lg:text-[64px]">
              <span>{t('hero.title1')}</span><br />
              <span className="text-muted-foreground">{t('hero.title2')}</span>
            </h1>
          </div>
          <div className="max-w-[330px] md:pb-1">
            <p className="text-[17px] leading-relaxed text-muted-foreground">{t('hero.subtitle')}</p>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <Button asChild><Link href="/generate">{t('hero.cta')}</Link></Button>
              <a href="#showcase" className="inline-flex min-h-10 items-center text-sm text-primary hover:underline">
                {t('hero.ctaSecondary')}<ChevronRight className="size-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
        <nav aria-label={t('store.explore')} className="-mx-5 mb-12 flex justify-start gap-3 overflow-x-auto px-5 pb-3 sm:mx-0 sm:mb-16 sm:justify-between sm:px-0 scrollbar-hide">
          {categories.map((category) => (
            <a key={category.id} href={category.href} className="group flex min-w-[104px] flex-1 flex-col items-center gap-3 rounded-xl py-2 text-center">
              <div className="relative size-[72px] overflow-hidden rounded-2xl bg-white sm:size-[84px]">
                <FillImage src={category.image} alt="" sizes="84px" className="object-contain p-1.5 transition-transform duration-300 group-hover:scale-105" />
              </div>
              <span className="text-xs font-medium sm:text-sm group-hover:text-primary">{t(`store.${category.id}`)}</span>
            </a>
          ))}
          <Link href="/preview" className="group flex min-w-[104px] flex-1 flex-col items-center gap-3 rounded-xl py-2 text-center">
            <div className="flex size-[72px] items-center justify-center rounded-2xl bg-card sm:size-[84px]">
              <Box strokeWidth={1.2} className="size-10 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
            </div>
            <span className="text-xs font-medium sm:text-sm group-hover:text-primary">{t('store.preview')}</span>
          </Link>
        </nav>
        <h2 className="mb-6 text-2xl font-semibold tracking-tight sm:text-[28px]">
          {t('store.latest')} <span className="text-muted-foreground">{t('store.latestSub')}</span>
        </h2>
        <div className="grid gap-5 md:grid-cols-[1.45fr_1fr]">
          <a href="#showcase" className="store-card group relative flex min-h-[430px] flex-col overflow-hidden p-7 transition-shadow duration-300 hover:shadow-lg sm:min-h-[500px] sm:p-9">
            <div className="relative z-10">
              <p className="store-eyebrow mb-3 text-primary">{t('store.photoLabel')}</p>
              <h3 className="whitespace-pre-line text-[32px] font-semibold leading-[1.15] tracking-[-0.035em] sm:text-[38px]">{t('store.photoTitle')}</h3>
              <p className="mt-3 max-w-[250px] text-sm text-muted-foreground">{t('store.photoDescription')}</p>
              <span className="mt-4 inline-flex items-center text-sm text-primary">{t('store.seeResult')}<ChevronRight className="size-4" aria-hidden="true" /></span>
            </div>
            <div className="relative -mx-7 -mb-7 mt-7 min-h-[220px] flex-1 overflow-hidden sm:-mx-9 sm:-mb-9">
              <FillImage src="/showcase/race_car_render.png" alt={t('showcase.examples.racecar.after')} sizes="(max-width: 768px) 100vw, 650px" preload className="object-cover object-center transition-transform duration-700 group-hover:scale-[1.025]" />
            </div>
          </a>
          <Link href="/generate" className="store-card group flex min-h-[430px] flex-col overflow-hidden p-7 transition-shadow duration-300 hover:shadow-lg sm:min-h-[500px] sm:p-9">
            <p className="store-eyebrow mb-3">{t('store.figureLabel')}</p>
            <h3 className="whitespace-pre-line text-[32px] font-semibold leading-[1.15] tracking-[-0.035em] sm:text-[38px]">{t('store.figureTitle')}</h3>
            <p className="mt-3 text-sm text-muted-foreground">{t('store.figureDescription')}</p>
            <div className="relative mx-auto mt-3 min-h-[225px] w-full max-w-[265px] flex-1">
              <FillImage src="/styles/chibi/preview-1.webp" alt={t('store.chibi')} sizes="265px" className="object-contain transition-transform duration-500 group-hover:scale-[1.04]" />
            </div>
            <span className="mt-3 inline-flex items-center text-sm text-primary">{t('store.start')}<ChevronRight className="size-4" aria-hidden="true" /></span>
          </Link>
        </div>
      </div>
    </section>
  );
}
