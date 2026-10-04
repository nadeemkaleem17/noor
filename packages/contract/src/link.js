// Admin-supplied links (menus, banners, CTA buttons) are data, so only a short list of schemes may become an href.
// Replaces the storefront's safeHref (utils/api.js, F-xx javascript: links).
const allowedSchemes = new Set(['http:', 'https:', 'mailto:', 'tel:'])

/**
 * Returns `href` when it is a site path or one of http(s), mailto, tel (https://wa.me/ is https); otherwise undefined.
 * @param {string | null | undefined} href
 * @returns {string | undefined}
 */
export function safeHref(href) {
  if (typeof href !== 'string') return undefined
  const value = href.trim()
  // Browsers drop tabs and newlines and read "\" as "/", so "/\t/evil.com" would become the protocol-relative "//evil.com".
  if (value === '' || [...value].some((c) => c <= ' ' || c === '\u007f' || c === '\\')) return undefined
  if (value.startsWith('/')) return value.startsWith('//') ? undefined : value
  try {
    return allowedSchemes.has(new URL(value).protocol) ? value : undefined
  } catch {
    return undefined
  }
}

/**
 * True for an absolute http(s) link to another site: it gets `rel="noopener noreferrer"`.
 * @param {string} href
 * @returns {boolean}
 */
export const isExternal = (href) => /^https?:\/\//i.test(href)

/**
 * The rule for a link an admin types (menus, banners, buttons): a site path, `https://`, `mailto:` or `tel:`. Plain `http://` is refused
 * on entry even though the storefront would still render it, so new content is never insecure.
 * @param {string} value
 * @returns {boolean}
 */
export const isValidLink = (value) => safeHref(value) === value && !/^http:/i.test(value)
