import { defaultLocale, isLocale } from '@noor/i18n'

/**
 * `/` is English and `/ur` is Urdu; the routes themselves have no language segment, so `/en`, `/fr` and the like are ordinary unknown addresses and get the shop's 404 page
 * (plan/03 section 8, plan/06-storefront/01-sitemap.md section 2).
 * @param {string} pathname
 * @returns {import('@noor/i18n').Locale}
 */
export function localeOfPath(pathname) {
  const first = pathname.split('/')[1] ?? ''
  return first !== defaultLocale && isLocale(first) ? first : defaultLocale
}
