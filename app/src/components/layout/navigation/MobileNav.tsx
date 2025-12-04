'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { Box, LogOut, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { CreditBadge } from '@/components/credits/CreditBadge';
import { NavSection } from './NavSection';
import { NavItem } from './NavItem';
import {
  isActivePath,
  filterNavItems,
  type NavSection as NavSectionType,
  type NavItem as NavItemType,
} from './NavConfig';
import type { User } from '@/types';

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: NavSectionType[];
  user: User | null;
  credits: number;
  creditsLoading: boolean;
  isAdmin?: boolean;
  showAdminLink?: boolean;
  onSignOut: () => void;
}

export function MobileNav({
  open,
  onOpenChange,
  sections,
  user,
  credits,
  creditsLoading,
  isAdmin = false,
  showAdminLink = false,
  onSignOut,
}: MobileNavProps) {
  const t = useTranslations();
  const pathname = usePathname();

  const getInitials = (name: string | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleClose = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="mr-2 h-10 w-10 md:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
              <Box className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold">Dream Forge</span>
            {isAdmin && (
              <Badge variant="destructive" className="text-xs">
                {t('common.admin')}
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col p-4">
          {/* User info section (if logged in) */}
          {user && (
            <div className="mb-4 pb-4 border-b">
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={user.photoURL || undefined}
                    alt={user.displayName || 'User'}
                  />
                  <AvatarFallback className="text-sm">
                    {getInitials(user.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {user.displayName || t('common.user')}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </p>
                </div>
              </div>
              <CreditBadge credits={credits} loading={creditsLoading} />
            </div>
          )}

          {/* Collapsible navigation sections */}
          <div className="space-y-2">
            {sections.map((section) => {
              // Filter items based on auth state
              const filteredItems = filterNavItems(section.items, !!user);
              if (filteredItems.length === 0) return null;

              return (
                <NavSection
                  key={section.id}
                  title={t(section.titleKey)}
                  items={filteredItems}
                  defaultOpen={section.defaultOpen}
                  onItemClick={handleClose}
                />
              );
            })}
          </div>

          {/* Admin link (for user header when user is admin) */}
          {showAdminLink && user?.role === 'admin' && (
            <div className="mt-4 pt-4 border-t">
              <Link
                href="/admin"
                onClick={handleClose}
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground min-h-[48px]"
              >
                <Shield className="h-5 w-5" />
                <span>{t('nav.adminPanel')}</span>
                <Badge variant="destructive" className="ml-auto text-xs">
                  {t('common.admin')}
                </Badge>
              </Link>
            </div>
          )}

          {/* Return to user mode (for admin header) */}
          {isAdmin && (
            <div className="mt-4 pt-4 border-t">
              <NavItem
                href="/dashboard"
                label={t('admin.returnToUser')}
                icon={Shield}
                isActive={false}
                variant="mobile"
                onClick={handleClose}
              />
            </div>
          )}

          {/* Sign in/out */}
          <div className="mt-4 pt-4 border-t">
            {user ? (
              <button
                onClick={() => {
                  onSignOut();
                  handleClose();
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-base font-medium text-destructive hover:bg-destructive/10 min-h-[48px]"
              >
                <LogOut className="h-5 w-5" />
                <span>{t('common.signOut')}</span>
              </button>
            ) : (
              <Link
                href="/auth"
                onClick={handleClose}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-base font-medium text-primary-foreground min-h-[48px]"
              >
                {t('common.signIn')}
              </Link>
            )}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
