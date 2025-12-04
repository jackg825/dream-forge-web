'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { BaseHeader } from './BaseHeader';
import {
  DesktopNav,
  MobileNav,
  adminNavItems,
  adminMobileSections,
} from '../navigation';
import { UserMenu } from '../user-menu';

interface AdminHeaderProps {
  className?: string;
}

export function AdminHeader({ className }: AdminHeaderProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { credits, loading: creditsLoading } = useCredits(user?.uid);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <BaseHeader
      className={className}
      showAdminBadge
      adminBadgeText={t('common.admin')}
      leftSlot={
        <MobileNav
          open={mobileMenuOpen}
          onOpenChange={setMobileMenuOpen}
          sections={adminMobileSections}
          user={user}
          credits={credits}
          creditsLoading={creditsLoading}
          isAdmin
          onSignOut={signOut}
        />
      }
      centerSlot={
        <div className="hidden md:flex flex-1 items-center gap-4">
          <DesktopNav items={adminNavItems} className="flex-none" />
          {/* Return to user mode link */}
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors ml-auto"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden lg:inline">{t('admin.returnToUser')}</span>
          </Link>
        </div>
      }
      rightSlot={
        user && <UserMenu user={user} showAdminLink={false} onSignOut={signOut} />
      }
    />
  );
}
