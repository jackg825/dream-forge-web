'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { CreditBadge } from '@/components/credits/CreditBadge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { locales, localeNames, type Locale } from '@/i18n/config';
import {
  Box,
  LayoutDashboard,
  History,
  Eye,
  LogOut,
  Shield,
  Sun,
  Moon,
  Monitor,
  Globe,
  Palette,
  Settings,
  Settings2,
  Wand2,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';

export function Header() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user, loading, signOut } = useAuth();
  const { credits, loading: creditsLoading } = useCredits(user?.uid);
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Avoid hydration mismatch for theme
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const navItems = [
    { href: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, requireAuth: true },
    { href: '/generate', labelKey: 'nav.generate', icon: Wand2, showAlways: true },
    { href: '/preview', labelKey: 'nav.previewTool', icon: Eye, showAlways: true },
    { href: '/dashboard/history', labelKey: 'nav.history', icon: History, requireAuth: true },
  ];

  const getInitials = (name: string | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLocaleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale as Locale });
  };

  const getThemeIcon = () => {
    if (!mounted) return <Settings2 className="h-4 w-4" />;
    if (theme === 'light') return <Sun className="h-4 w-4" />;
    if (theme === 'dark') return <Moon className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  const getThemeLabel = () => {
    if (!mounted) return '';
    if (theme === 'light') return t('settings.theme.light');
    if (theme === 'dark') return t('settings.theme.dark');
    return t('settings.theme.system');
  };

  // Check if current path matches (without locale prefix)
  const isActivePath = (href: string) => {
    // Special case: /generate should match all /generate/* paths
    if (href === '/generate') {
      return pathname === '/generate' || pathname.startsWith('/generate/');
    }
    return pathname === href;
  };

  // Handle nav click - reset to base path when clicking on active parent route
  const handleNavClick = (e: React.MouseEvent, href: string) => {
    if (href === '/generate' && pathname.startsWith('/generate/') && pathname !== '/generate') {
      e.preventDefault();
      router.push('/generate');
    }
  };

  // Filter nav items based on auth state
  const visibleNavItems = navItems.filter((item) => {
    if (item.requireAuth && !user) return false;
    if (!item.showAlways && !user) return false;
    return true;
  });

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-7xl items-center mx-auto px-4 sm:px-6 lg:px-8">
        {/* Mobile Menu Button */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
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
              </SheetTitle>
            </SheetHeader>

            {/* Mobile Navigation */}
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

              {/* Nav links */}
              <div className="space-y-1">
                {visibleNavItems.map((item) => {
                  const isActive = isActivePath(item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={(e) => {
                        handleNavClick(e, item.href);
                        setMobileMenuOpen(false);
                      }}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors',
                        'min-h-[48px]', // Touch target
                        isActive
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/80'
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span>{t(item.labelKey)}</span>
                      <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
                    </Link>
                  );
                })}

                {/* Settings link for logged-in users */}
                {user && (
                  <Link
                    href="/settings"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors',
                      'min-h-[48px]',
                      isActivePath('/settings')
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/80'
                    )}
                  >
                    <Settings className="h-5 w-5 shrink-0" />
                    <span>{t('nav.settings')}</span>
                    <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
                  </Link>
                )}
              </div>

              {/* Settings section for non-logged-in users */}
              {!user && (
              <div className="mt-6 pt-4 border-t space-y-1">
                {/* Theme options */}
                <div className="px-3 py-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    {t('settings.appearance')}
                  </p>
                  <div className="flex gap-2">
                    {[
                      { value: 'light', icon: Sun, label: t('settings.theme.light') },
                      { value: 'dark', icon: Moon, label: t('settings.theme.dark') },
                      { value: 'system', icon: Monitor, label: t('settings.theme.system') },
                    ].map((option) => {
                      const Icon = option.icon;
                      const isSelected = mounted && theme === option.value;
                      return (
                        <button
                          key={option.value}
                          onClick={() => setTheme(option.value)}
                          className={cn(
                            'flex-1 flex flex-col items-center gap-1 p-3 rounded-lg transition-colors min-h-[64px]',
                            isSelected
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted hover:bg-muted/80'
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-xs">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Language options */}
                <div className="px-3 py-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    {t('settings.language')}
                  </p>
                  <div className="flex gap-2">
                    {locales.map((loc) => {
                      const isSelected = locale === loc;
                      return (
                        <button
                          key={loc}
                          onClick={() => handleLocaleChange(loc)}
                          className={cn(
                            'flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-colors min-h-[48px]',
                            isSelected
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted hover:bg-muted/80'
                          )}
                        >
                          {localeNames[loc]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              )}

              {/* Sign in/out */}
              <div className="mt-6 pt-4 border-t">
                {user ? (
                  <>
                    {user.role === 'admin' && (
                      <Link
                        href="/admin"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground min-h-[48px]"
                      >
                        <Shield className="h-5 w-5" />
                        <span>{t('nav.adminPanel')}</span>
                        <Badge variant="destructive" className="ml-auto text-xs">
                          {t('common.admin')}
                        </Badge>
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        signOut();
                        setMobileMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-base font-medium text-destructive hover:bg-destructive/10 min-h-[48px]"
                    >
                      <LogOut className="h-5 w-5" />
                      <span>{t('common.signOut')}</span>
                    </button>
                  </>
                ) : (
                  <Link
                    href="/auth"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-base font-medium text-primary-foreground min-h-[48px]"
                  >
                    {t('common.signIn')}
                  </Link>
                )}
              </div>
            </nav>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link href="/" className="mr-4 md:mr-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
            <Box className="h-5 w-5 text-white" />
          </div>
          <span className="hidden font-bold sm:inline-block">Dream Forge</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex flex-1 items-center gap-1">
          {visibleNavItems.map((item) => {
            const isActive = isActivePath(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>

        {/* Spacer for mobile */}
        <div className="flex-1 md:hidden" />

        {/* Right side */}
        <div className="flex items-center gap-2">
          {loading ? (
            <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
          ) : user ? (
            <>
              {/* Credit badge - hidden on mobile, shown in menu */}
              <div className="hidden sm:block">
                <CreditBadge credits={credits} loading={creditsLoading} />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-10 w-10 rounded-full"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={user.photoURL || undefined}
                        alt={user.displayName || 'User'}
                      />
                      <AvatarFallback className="text-xs">
                        {getInitials(user.displayName)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user.displayName || t('common.user')}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {/* Theme Selector */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Palette className="mr-2 h-4 w-4" />
                      <span>{t('settings.appearance')}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {getThemeLabel()}
                      </span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                        <DropdownMenuRadioItem value="light">
                          <Sun className="mr-2 h-4 w-4" />
                          {t('settings.theme.light')}
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="dark">
                          <Moon className="mr-2 h-4 w-4" />
                          {t('settings.theme.dark')}
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="system">
                          <Monitor className="mr-2 h-4 w-4" />
                          {t('settings.theme.system')}
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  {/* Language Selector */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Globe className="mr-2 h-4 w-4" />
                      <span>{t('settings.language')}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {localeNames[locale]}
                      </span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup value={locale} onValueChange={handleLocaleChange}>
                        {locales.map((loc) => (
                          <DropdownMenuRadioItem key={loc} value={loc}>
                            {localeNames[loc]}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="cursor-pointer">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      {t('nav.dashboard')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/history" className="cursor-pointer">
                      <History className="mr-2 h-4 w-4" />
                      {t('nav.history')}
                    </Link>
                  </DropdownMenuItem>
                  {user.role === 'admin' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="cursor-pointer">
                          <Shield className="mr-2 h-4 w-4" />
                          {t('nav.adminPanel')}
                          <Badge variant="destructive" className="ml-auto text-xs">
                            {t('common.admin')}
                          </Badge>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={signOut}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {t('common.signOut')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            /* Logged out: Settings dropdown + prominent Sign in button */
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10">
                    <Settings2 className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  {/* Theme Selector */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Palette className="mr-2 h-4 w-4" />
                      <span>{t('settings.appearance')}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {getThemeLabel()}
                      </span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                        <DropdownMenuRadioItem value="light">
                          <Sun className="mr-2 h-4 w-4" />
                          {t('settings.theme.light')}
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="dark">
                          <Moon className="mr-2 h-4 w-4" />
                          {t('settings.theme.dark')}
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="system">
                          <Monitor className="mr-2 h-4 w-4" />
                          {t('settings.theme.system')}
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  {/* Language Selector */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Globe className="mr-2 h-4 w-4" />
                      <span>{t('settings.language')}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {localeNames[locale]}
                      </span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup value={locale} onValueChange={handleLocaleChange}>
                        {locales.map((loc) => (
                          <DropdownMenuRadioItem key={loc} value={loc}>
                            {localeNames[loc]}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Prominent sign in button */}
              <Button asChild className="hidden sm:inline-flex">
                <Link href="/auth">{t('common.signIn')}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
