// Response security headers for storefront HTML (plan/11-security-auth.md section 5.3).
// ponytail: one fresh nonce per request, also on cacheable routes. A CDN then serves one nonce to many visitors; DOC-11 section 5.3
// calls for hash-allowed inline blocks there. Revisit before the CDN goes live (M1 caching task).
import { randomBytes } from 'node:crypto'

/**
 * @returns {string}
 */
export const makeNonce = () => randomBytes(16).toString('base64')

/**
 * @param {{ nonce: string; imgOrigin: string; production: boolean; path: string; themeHash?: string | undefined; }} opts `themeHash` is the SHA-256 (base64) of the inline theme style
 * @returns {Record<string, string>}
 */
export function securityHeaders(opts) {
  const headers = /** @type {Record<string, string>} */ ({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': opts.path.startsWith('/orders/') ? 'no-referrer' : 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  })
  // The Vite dev server injects inline scripts and styles, so the CSP is for built servers only.
  if (opts.production) {
    headers['Content-Security-Policy'] = [
      "default-src 'self'",
      `script-src 'self' 'nonce-${opts.nonce}'`,
      // the theme is the one inline style, allowed by its hash: a page that a CDN keeps cannot carry a per-visitor nonce
      `style-src 'self'${opts.themeHash ? ` 'sha256-${opts.themeHash}'` : ''}`,
      `img-src 'self' ${opts.imgOrigin} data:`,
      "font-src 'self'",
      "connect-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join('; ')
  }
  return headers
}
