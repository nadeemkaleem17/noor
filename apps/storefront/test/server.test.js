import { describe, expect, it } from 'vitest'
import { cacheControl } from '../app/lib/cache'
import { parseEnv } from '../app/lib/env.server'
import { localeFromParams } from '../app/lib/locale'
import { makeNonce, securityHeaders } from '../app/lib/security.server'

const goodEnv = { API_INTERNAL_URL: 'http://localhost:3000', PUBLIC_SITE_URL: 'http://localhost:5174', PUBLIC_IMG_URL: 'http://localhost:3000/img' }

describe('parseEnv', () => {
  it('accepts a complete environment and defaults PORT and NODE_ENV', () => {
    expect(parseEnv(goodEnv)).toMatchObject({ PORT: 5174, NODE_ENV: 'development', API_INTERNAL_URL: 'http://localhost:3000' })
  })
  it('names the missing variable', () => {
    expect(() => parseEnv({ ...goodEnv, API_INTERNAL_URL: undefined })).toThrow(/API_INTERNAL_URL: is required/)
  })
  it('names a malformed variable and reports every problem', () => {
    expect(() => parseEnv({ ...goodEnv, PUBLIC_SITE_URL: 'not a url', PORT: 'abc' })).toThrow(/PUBLIC_SITE_URL.*PORT/)
  })
})

describe('localeFromParams', () => {
  /**
   * @param {{ locale?: string; }} p
   */
  const status = (p) => {
    try {
      localeFromParams(p)
    } catch (e) {
      return (/** @type {Response} */ (e)).status
    }
    return 200
  }
  it('maps the optional prefix to a locale', () => {
    expect(localeFromParams({})).toBe('en')
    expect(localeFromParams({ locale: 'ur' })).toBe('ur')
  })
  it('404s the default-locale prefix and unknown prefixes', () => {
    expect(status({ locale: 'en' })).toBe(404)
    expect(status({ locale: 'fr' })).toBe(404)
  })
})

describe('securityHeaders', () => {
  const opts = { nonce: 'abc', imgOrigin: 'https://img.rubaya.pk', production: true, path: '/' }
  it('builds the DOC-11 5.3 storefront CSP with the request nonce', () => {
    const csp = securityHeaders(opts)['Content-Security-Policy']
    expect(csp).toContain("script-src 'self' 'nonce-abc'")
    expect(csp).toContain("style-src 'self' 'nonce-abc'")
    expect(csp).toContain('img-src \'self\' https://img.rubaya.pk data:')
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).not.toContain('unsafe-inline')
  })
  it('sends no CSP from the dev server, but keeps the other headers', () => {
    const h = securityHeaders({ ...opts, production: false })
    expect(h['Content-Security-Policy']).toBeUndefined()
    expect(h['X-Content-Type-Options']).toBe('nosniff')
  })
  it('sends no referrer on order pages', () => {
    expect(securityHeaders({ ...opts, path: '/orders/RB-1' })['Referrer-Policy']).toBe('no-referrer')
    expect(securityHeaders(opts)['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
  })
  it('makes a different nonce each time', () => {
    expect(makeNonce()).not.toBe(makeNonce())
    expect(makeNonce().length).toBeGreaterThanOrEqual(22)
  })
})

describe('cacheControl', () => {
  it('keeps private routes out of shared caches', () => {
    expect(cacheControl.private).toBe('private, no-store')
  })
})
