'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface FooterProps {
  className?: string;
}

/**
 * Footer - Simple footer with links and copyright
 */
export function Footer({ className }: FooterProps) {
  const t = useTranslations('landing');
  const currentYear = new Date().getFullYear();

  return (
    <footer className={cn('py-12 bg-muted/30 border-t', className)}>
      <div className="container max-w-6xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo/Brand */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-violet)] to-[var(--accent-coral)] flex items-center justify-center">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <span className="font-display font-bold text-lg">DreamForge</span>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <Link href="/generate" className="text-muted-foreground hover:text-foreground transition-colors">
              {t('footer.generate')}
            </Link>
            <Link href="/preview" className="text-muted-foreground hover:text-foreground transition-colors">
              {t('footer.preview')}
            </Link>
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
              {t('footer.dashboard')}
            </Link>
            <a
              href="#pricing"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('footer.pricing')}
            </a>
          </nav>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            © {currentYear} DreamForge. {t('footer.rights')}
          </p>
        </div>
      </div>
    </footer>
  );
}
