// Internal links keep the visitor's language: `/ur` in front for Urdu, nothing for English (plan/03 section 8).

/**
 * @param {import('@noor/i18n').Locale} locale
 * @param {string} path a path that starts with `/`
 */
export const localePath = (locale, path) => (locale === 'en' ? path : `/${locale}${path === '/' ? '' : path}`)
