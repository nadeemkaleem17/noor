import { defaultLocale, isLocale } from '@noor/i18n'

/**
 * `/` is English, `/ur` is Urdu. `/en` duplicates `/` and any other value is not a page, so both are 404 (plan/03 section 8).
 * @param {{ locale?: string; }} params
 * @returns {import('@noor/i18n').Locale}
 */
export function localeFromParams(params) {
  if (params.locale === undefined) return defaultLocale
  if (params.locale !== defaultLocale && isLocale(params.locale)) return params.locale
  throw new Response('Not Found', { status: 404 })
}
