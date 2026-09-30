'use client';

import { useTranslations } from 'next-intl';
import { Gamepad2, Palette, GraduationCap, Store, Printer, Brush } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FillImage } from '@/components/ui/fill-image';

interface UseCasesSectionProps {
  className?: string;
}

const useCases = [
  { id: 'creator', icon: Brush, image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80', comingSoon: true },
  { id: 'maker', icon: Printer, image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&q=80' },
  { id: 'artist', icon: Palette, image: 'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=800&q=80' },
  { id: 'gamer', icon: Gamepad2, image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&q=80' },
  { id: 'educator', icon: GraduationCap, image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80' },
  { id: 'seller', icon: Store, image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80' },
];

export function UseCasesSection({ className }: UseCasesSectionProps) {
  const t = useTranslations('landing');

  return (
    <section id="use-cases" className={cn('store-section', className)}>
      <div className="store-container">
        <div className="mb-10 max-w-3xl sm:mb-12">
          <p className="store-eyebrow mb-3">{t('useCases.badge')}</p>
          <h2 className="store-heading">{t('useCases.title')}</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground sm:text-xl">
            {t('useCases.subtitle')}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {useCases.map((useCase) => {
            const Icon = useCase.icon;

            return (
              <article key={useCase.id} className="store-card flex flex-col overflow-hidden">
                <div className="flex-1 p-7 sm:p-8">
                  <div className="mb-5 flex min-h-6 items-center justify-between gap-3">
                    <Icon className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
                    {'comingSoon' in useCase && useCase.comingSoon && (
                      <span className="text-xs font-medium text-muted-foreground">{t('creatorHub.badge')}</span>
                    )}
                  </div>
                  <h3 className="text-[22px] font-semibold tracking-tight">{t(`useCases.items.${useCase.id}.title`)}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                    {t(`useCases.items.${useCase.id}.description`)}
                  </p>
                </div>
                <div className="relative h-48 overflow-hidden sm:h-52">
                  <FillImage src={useCase.image} alt="" className="object-cover" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
