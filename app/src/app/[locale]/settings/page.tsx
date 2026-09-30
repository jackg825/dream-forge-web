'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useMounted } from '@/hooks/useMounted';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { UserHeader } from '@/components/layout/headers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { locales, localeNames, type Locale } from '@/i18n/config';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

function SettingsContent() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  const handleLocaleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale as Locale });
  };

  const themeOptions = [
    { value: 'light', icon: Sun, label: t('settings.theme.light') },
    { value: 'dark', icon: Moon, label: t('settings.theme.dark') },
    { value: 'system', icon: Monitor, label: t('settings.theme.system') },
  ];

  return (
    <div className="min-h-screen bg-background">
      <UserHeader />
      <main className="studio-shell py-12 sm:py-16">
        <div className="mb-10 sm:mb-12">
          <h1 className="studio-page-title">{t('settingsPage.title')}</h1>
          <p className="studio-page-subtitle">{t('settingsPage.subtitle')}</p>
        </div>

        <div className="max-w-3xl space-y-6">
          {/* Appearance Section */}
          <Card>
            <CardHeader className="gap-3">
              <CardTitle className="text-xl">{t('settings.appearance')}</CardTitle>
              <CardDescription>{t('settingsPage.appearanceDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              {mounted ? (
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  {themeOptions.map((option) => {
                    const Icon = option.icon;
                    const isSelected = theme === option.value;
                    return (
                      <button
                        key={option.value}
                        onClick={() => setTheme(option.value)}
                        aria-pressed={isSelected}
                        className={cn(
                          'flex min-h-32 flex-col items-center justify-center gap-4 rounded-2xl border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border/70 bg-muted/30 hover:bg-muted/70'
                        )}
                      >
                        <Icon className={cn('h-7 w-7', isSelected && 'text-primary')} />
                        <span className={cn('text-sm font-medium', isSelected && 'text-primary')}>
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-32 animate-pulse rounded-2xl bg-muted"
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Language Section */}
          <Card>
            <CardHeader className="gap-3">
              <CardTitle className="text-xl">{t('settings.language')}</CardTitle>
              <CardDescription>{t('settingsPage.languageDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={locale}
                onValueChange={handleLocaleChange}
                className="space-y-2"
              >
                {locales.map((loc) => (
                  <div
                    key={loc}
                    className={cn(
                      'flex cursor-pointer items-center gap-4 rounded-2xl border p-5 transition-colors',
                      locale === loc
                        ? 'border-primary bg-primary/5'
                        : 'border-border/70 bg-muted/30 hover:bg-muted/70'
                    )}
                    onClick={() => handleLocaleChange(loc)}
                  >
                    <RadioGroupItem value={loc} id={loc} />
                    <Label htmlFor={loc} className="flex-1 cursor-pointer font-medium">
                      {localeNames[loc]}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}
