// Internal links keep the visitor's language: `/ur` in front for Urdu, nothing for English (plan/03 section 8).

/**
 * @param {import('@noor/i18n').Locale} locale
 * @param {string} path a path that starts with `/`
 */
export const localePath = (locale, path) => (locale === 'en' ? path : `/${locale}${path === '/' ? '' : path}`)

/** The address path of a request. React Router's own data requests carry a `.data` on the end of it, which is not part of the page's address and must never go into a redirect or a link. @param {URL} url */
export const pagePath = (url) => url.pathname.replace(/\.data$/, '')
