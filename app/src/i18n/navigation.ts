import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';
import { locales, defaultLocale } from './config';

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Always show locale prefix in URL
  localePrefix: 'always',
});

// Locale-aware navigation components
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
