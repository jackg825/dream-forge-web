'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { CreditBadge } from '@/components/credits/CreditBadge';
import { Button } from '@/components/ui/button';
import { Settings2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BaseHeader } from './BaseHeader';
import {
  DesktopNav,
  MobileNav,
  userNavItems,
  userMobileSections,
  filterNavItems,
} from '../navigation';
import { UserMenu } from '../user-menu';

interface UserHeaderProps {
  className?: string;
}

export function UserHeader({ className }: UserHeaderProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();
  const { credits, loading: creditsLoading } = useCredits(user?.uid);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Filter nav items based on auth state
  const visibleNavItems = filterNavItems(userNavItems, !!user);

  return (
    <BaseHeader
      className={className}
      leftSlot={
        <MobileNav
          open={mobileMenuOpen}
          onOpenChange={setMobileMenuOpen}
          sections={userMobileSections}
          user={user}
          credits={credits}
          creditsLoading={creditsLoading}
          showAdminLink
          onSignOut={signOut}
        />
      }
      centerSlot={<DesktopNav items={visibleNavItems} />}
      rightSlot={
        loading ? (
          <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
        ) : user ? (
          <>
            {/* Credit badge - hidden on mobile */}
            <div className="hidden sm:block">
              <CreditBadge credits={credits} loading={creditsLoading} />
            </div>
            <UserMenu user={user} showAdminLink onSignOut={signOut} />
          </>
        ) : (
          /* Logged out: Settings button + Sign in */
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10">
                  <Settings2 className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    {t('nav.settings')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/auth" className="cursor-pointer">
                    {t('common.signIn')}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )
      }
    />
  );
}
