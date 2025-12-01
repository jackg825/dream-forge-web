'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface FooterProps {
  className?: string;
}

/**
 * Footer - Simple footer with links and copyright
 * Mobile-optimized with stacked layout and safe area support
 */
export function Footer({ className }: FooterProps) {
  const t = useTranslations('landing');
  const currentYear = new Date().getFullYear();

  return (
    <footer className={cn('py-8 sm:py-12 bg-muted/30 border-t safe-bottom', className)}>
      <div className="container max-w-6xl mx-auto px-4">
        <div className="flex flex-col items-center gap-6 sm:gap-8 md:flex-row md:justify-between">
          {/* Logo/Brand */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-[var(--accent-violet)] to-[var(--accent-coral)] flex items-center justify-center">
              <span className="text-white font-bold text-xs sm:text-sm">D</span>
            </div>
            <span className="font-display font-bold text-base sm:text-lg">DreamForge</span>
          </div>

          {/* Links - horizontal scroll on very small screens */}
          <nav className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm">
            <Link
              href="/generate"
              className="text-muted-foreground hover:text-foreground transition-colors py-1 min-h-[44px] flex items-center"
            >
              {t('footer.generate')}
            </Link>
            <Link
              href="/preview"
              className="text-muted-foreground hover:text-foreground transition-colors py-1 min-h-[44px] flex items-center"
            >
              {t('footer.preview')}
            </Link>
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground transition-colors py-1 min-h-[44px] flex items-center"
            >
              {t('footer.dashboard')}
            </Link>
            <a
              href="#pricing"
              className="text-muted-foreground hover:text-foreground transition-colors py-1 min-h-[44px] flex items-center"
            >
              {t('footer.pricing')}
            </a>
          </nav>

          {/* Copyright */}
          <p className="text-xs sm:text-sm text-muted-foreground text-center">
            © {currentYear} DreamForge. {t('footer.rights')}
          </p>
        </div>
      </div>
    </footer>
  );
}
