'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import { usePathname, useRouter } from '@/i18n/navigation';
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
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch for theme
  useEffect(() => {
    setMounted(true);
  }, []);

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
      <main className="container max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">{t('settingsPage.title')}</h1>
          <p className="text-muted-foreground">{t('settingsPage.subtitle')}</p>
        </div>

        <div className="space-y-6">
          {/* Appearance Section */}
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.appearance')}</CardTitle>
              <CardDescription>{t('settingsPage.appearanceDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              {mounted ? (
                <div className="grid grid-cols-3 gap-3">
                  {themeOptions.map((option) => {
                    const Icon = option.icon;
                    const isSelected = theme === option.value;
                    return (
                      <button
                        key={option.value}
                        onClick={() => setTheme(option.value)}
                        className={cn(
                          'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        )}
                      >
                        <Icon className={cn('h-6 w-6', isSelected && 'text-primary')} />
                        <span className={cn('text-sm font-medium', isSelected && 'text-primary')}>
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-[88px] animate-pulse rounded-lg bg-muted"
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Language Section */}
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.language')}</CardTitle>
              <CardDescription>{t('settingsPage.languageDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={locale}
                onValueChange={handleLocaleChange}
                className="space-y-3"
              >
                {locales.map((loc) => (
                  <div
                    key={loc}
                    className={cn(
                      'flex items-center space-x-3 rounded-lg border-2 p-4 transition-all cursor-pointer',
                      locale === loc
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
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
