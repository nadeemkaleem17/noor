import { defaultLocale, isLocale, type Locale } from '@noor/i18n'

/** `/` is English, `/ur` is Urdu. `/en` duplicates `/` and any other value is not a page, so both are 404 (plan/03 section 8). */
export function localeFromParams(params: { locale?: string }): Locale {
  if (params.locale === undefined) return defaultLocale
  if (params.locale !== defaultLocale && isLocale(params.locale)) return params.locale
  throw new Response('Not Found', { status: 404 })
}
