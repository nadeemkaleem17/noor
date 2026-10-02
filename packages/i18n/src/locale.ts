import { enums, type Locale } from '@noor/contract'

export type { Locale }
export const supportedLocales = enums.locale
export const defaultLocale: Locale = 'en'

export const isLocale = (v: unknown): v is Locale => (supportedLocales as readonly unknown[]).includes(v)

export const dirOf = (locale: Locale): 'ltr' | 'rtl' => (locale === 'ur' ? 'rtl' : 'ltr')

/** BCP 47 tag for `Intl`. `-u-nu-latn` keeps Western digits (0-9), the ADR-0018 default for prices and numbers. */
export const intlTag = (locale: Locale): string => `${locale}-PK-u-nu-latn`
