// The response headers of the admin's static host (plan/11-security-auth.md section 5.3), in one place: the build writes them to `dist/_headers` (the
// format of Netlify and Cloudflare Pages; any other host gets the same values in its own configuration) and `vite preview` sends the same ones, so
// the end-to-end run exercises the admin under its real content security policy. Hashed assets are immutable, `index.html` is never cached.

/**
 * @param {{ api: string, images?: string[] }} where `api` is the address of the API (the admin's only server), `images` other hosts pictures come from
 * @returns {Record<string, string>} the headers of every response
 */
export function adminHeaders({ api, images = [] }) {
  const origin = (/** @type {string} */ url) => new URL(url).origin
  const apiOrigin = origin(api)
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    // Base UI positions its popups with inline styles, so styles may be inline; scripts may not
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' ${[apiOrigin, ...images.map(origin)].join(' ')} data: blob:`,
      "font-src 'self'",
      `connect-src 'self' ${apiOrigin}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
  }
}

/** The `_headers` file: the headers for every path, then the caching rules (the more specific path wins on those hosts). @param {Parameters<typeof adminHeaders>[0]} where */
export function headersFile(where) {
  const lines = (/** @type {Record<string, string>} */ h) => Object.entries(h).map(([k, v]) => `  ${k}: ${v}`)
  return ['/*', ...lines(adminHeaders(where)), '/index.html', '  Cache-Control: no-cache', '/assets/*', '  Cache-Control: public, max-age=31536000, immutable', ''].join('\n')
}
