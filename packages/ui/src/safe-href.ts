// Admin-supplied links (menus, banners, CTA buttons) are data, so only a short list of schemes may become an href.
// Replaces the storefront's safeHref (utils/api.js, F-xx javascript: links).
const allowedSchemes = new Set(['http:', 'https:', 'mailto:', 'tel:'])

/** Returns `href` when it is a site path or one of http(s), mailto, tel (https://wa.me/ is https); otherwise undefined. */
export function safeHref(href: string | null | undefined): string | undefined {
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

/** True for an absolute http(s) link to another site: it gets `rel="noopener noreferrer"`. */
export const isExternal = (href: string): boolean => /^https?:\/\//i.test(href)
