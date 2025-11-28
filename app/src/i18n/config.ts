/**
 * i18n Configuration
 *
 * Locales: Traditional Chinese (Taiwan) as default, English
 * URL Strategy: Always show locale prefix (/zh-TW/..., /en/...)
 */

export const locales = ['zh-TW', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'zh-TW';

export const localeNames: Record<Locale, string> = {
  'zh-TW': '繁體中文',
  'en': 'English',
};

// For HTML lang attribute
export const localeHtmlLang: Record<Locale, string> = {
  'zh-TW': 'zh-TW',
  'en': 'en',
};
