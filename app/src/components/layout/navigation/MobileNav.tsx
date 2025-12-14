'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { Box, LogOut, Shield, Sun, Moon, Monitor, Sparkles } from 'lucide-react';
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
import {
  filterNavItems,
  type NavSection as NavSectionType,
} from './NavConfig';
import { locales, localeNames, type Locale } from '@/i18n/config';
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
  const router = useRouter();
  const locale = useLocale() as Locale;
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch for theme
  useEffect(() => {
    setMounted(true);
  }, []);

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

  const handleLocaleChange = (newLocale: Locale) => {
    router.replace(pathname, { locale: newLocale });
    handleClose();
  };

  const themeOptions = [
    { value: 'light', icon: Sun, label: t('settings.theme.light') },
    { value: 'dark', icon: Moon, label: t('settings.theme.dark') },
    { value: 'system', icon: Monitor, label: t('settings.theme.system') },
  ];

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
      <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0 flex flex-col">
        {/* Header with gradient background */}
        <SheetHeader className="bg-gradient-to-br from-indigo-500/10 to-purple-600/10 border-b p-4">
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

        <nav className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {user ? (
              /* ============ LOGGED IN STATE ============ */
              <>
                {/* User info section */}
                <div className="pb-4 border-b">
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

                {/* Collapsible navigation sections */}
                <div className="space-y-2">
                  {sections.map((section) => {
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
                  <div className="pt-4 border-t">
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
                  <div className="pt-4 border-t">
                    <Link
                      href="/dashboard"
                      onClick={handleClose}
                      className="flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground min-h-[48px]"
                    >
                      <Shield className="h-5 w-5" />
                      <span>{t('admin.returnToUser')}</span>
                    </Link>
                  </div>
                )}

                {/* Sign out */}
                <div className="pt-4 border-t">
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
                </div>
              </>
            ) : (
              /* ============ LOGGED OUT STATE ============ */
              <>
                {/* Welcome section with sign in CTA */}
                <div className="rounded-xl bg-gradient-to-br from-indigo-500/5 to-purple-600/5 border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">{t('mobile.welcome')}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('auth.transformPhotos')}
                  </p>
                  <Button asChild className="w-full" size="lg">
                    <Link href="/auth" onClick={handleClose}>
                      {t('common.signIn')}
                    </Link>
                  </Button>
                </div>

                {/* Navigation items for non-logged in users */}
                <div className="space-y-1">
                  <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('mobile.explore')}
                  </p>
                  {sections.map((section) => {
                    const filteredItems = filterNavItems(section.items, false);
                    return filteredItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={handleClose}
                        className="flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground min-h-[48px] transition-colors"
                      >
                        {item.icon && <item.icon className="h-5 w-5" />}
                        <span>{t(item.labelKey)}</span>
                      </Link>
                    ));
                  })}
                </div>

                {/* Settings section */}
                <div className="pt-4 border-t space-y-4">
                  {/* Appearance */}
                  <div>
                    <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('settings.appearance')}
                    </p>
                    {mounted ? (
                      <div className="grid grid-cols-3 gap-2 px-3">
                        {themeOptions.map((option) => {
                          const Icon = option.icon;
                          const isSelected = theme === option.value;
                          return (
                            <button
                              key={option.value}
                              onClick={() => setTheme(option.value)}
                              className={cn(
                                'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all',
                                isSelected
                                  ? 'border-primary bg-primary/5 text-primary'
                                  : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
                              )}
                            >
                              <Icon className="h-5 w-5" />
                              <span className="text-xs font-medium">{option.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 px-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="h-[68px] animate-pulse rounded-lg bg-muted" />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Language */}
                  <div>
                    <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('settings.language')}
                    </p>
                    <div className="grid grid-cols-2 gap-2 px-3">
                      {locales.map((loc) => {
                        const isSelected = locale === loc;
                        return (
                          <button
                            key={loc}
                            onClick={() => handleLocaleChange(loc)}
                            className={cn(
                              'flex items-center justify-center gap-2 p-3 rounded-lg border transition-all',
                              isSelected
                                ? 'border-primary bg-primary/5 text-primary'
                                : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <span className="text-sm font-medium">{localeNames[loc]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
