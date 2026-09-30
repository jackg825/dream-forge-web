'use client';

import { useTranslations } from 'next-intl';
import { Box, ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface FooterProps {
  className?: string;
}

const links = [
  { href: '/generate', key: 'generate' },
  { href: '/preview', key: 'preview' },
  { href: '/dashboard', key: 'dashboard' },
] as const;

export function Footer({ className }: FooterProps) {
  const t = useTranslations('landing');
  const currentYear = new Date().getFullYear();

  return (
    <footer className={cn('safe-bottom bg-background pb-8 pt-4 text-muted-foreground', className)}>
      <div className="store-container">
        <div className="flex items-center gap-3 border-t border-border py-6 text-sm">
          <Box className="h-5 w-5 text-foreground" strokeWidth={1.6} aria-hidden="true" />
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <Link href="/" className="font-semibold text-foreground hover:underline">DreamForge</Link>
        </div>
        <nav className="grid grid-cols-2 gap-x-6 gap-y-2 pb-7 text-xs sm:flex sm:flex-wrap sm:gap-8">
          {links.map((link) => (
            <Link key={link.key} href={link.href} className="flex min-h-11 items-center text-foreground hover:underline">
              {t(`footer.${link.key}`)}
            </Link>
          ))}
          <a href="#pricing" className="flex min-h-11 items-center text-foreground hover:underline">{t('footer.pricing')}</a>
        </nav>
        <p className="border-t border-border pt-5 text-xs leading-relaxed">
          © {currentYear} DreamForge. {t('footer.rights')}
        </p>
      </div>
    </footer>
  );
}
