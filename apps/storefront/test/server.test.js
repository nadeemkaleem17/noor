import { describe, expect, it } from 'vitest'
import { cacheControl } from '../app/lib/cache'
import { parseEnv } from '../app/lib/env.server'
import { localeOfPath } from '../app/lib/locale'
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

describe('localeOfPath', () => {
  it('reads the language from the first segment: none is English, /ur is Urdu', () => {
    expect(localeOfPath('/')).toBe('en')
    expect(localeOfPath('/new')).toBe('en')
    expect(localeOfPath('/ur')).toBe('ur')
    expect(localeOfPath('/ur/c/lawn')).toBe('ur')
  })
  it('treats /en and unknown first segments as ordinary addresses (the router answers them with the 404 page)', () => {
    expect(localeOfPath('/en/new')).toBe('en')
    expect(localeOfPath('/fr/new')).toBe('en')
    expect(localeOfPath('/urdu')).toBe('en')
  })
})

describe('securityHeaders', () => {
  const opts = { nonce: 'abc', imgOrigin: 'https://img.rubaya.pk', production: true, path: '/' }
  it('builds the DOC-11 5.3 storefront CSP with the request nonce', () => {
    const csp = securityHeaders(opts)['Content-Security-Policy']
    expect(csp).toContain("script-src 'self' 'nonce-abc'")
    expect(csp).toContain("style-src 'self';") // the theme block is allowed by its hash (shell-lib.test.js), never by a nonce
    expect(csp).toContain('img-src \'self\' https://img.rubaya.pk data:')
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect((csp ?? '').replace("style-src-attr 'unsafe-inline'", '')).not.toContain('unsafe-inline') // the one exception is for style attributes
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
