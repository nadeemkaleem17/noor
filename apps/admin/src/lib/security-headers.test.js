// The admin's response headers (plan/11-security-auth.md section 5.3) and the one thing the policy forbids that the page could do by accident: an inline script.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { adminHeaders, headersFile } from '../../security-headers.js'

const root = path.resolve(import.meta.dirname, '../..')

describe('admin response headers', () => {
  const h = adminHeaders({ api: 'https://api.rubaya.pk/api/v1', images: ['https://img.rubaya.pk/x'] })

  it('carry every header of the table', () => {
    expect(h['X-Content-Type-Options']).toBe('nosniff')
    expect(h['Referrer-Policy']).toBe('no-referrer')
    expect(h['X-Frame-Options']).toBe('DENY')
    expect(h['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=(), payment=()')
    expect(h['Cross-Origin-Opener-Policy']).toBe('same-origin')
  })

  it('allow scripts only from the admin itself and talk only to the API', () => {
    const csp = /** @type {string} */ (h['Content-Security-Policy'])
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self';")
    expect(csp).not.toMatch(/script-src[^;]*unsafe/)
    expect(csp).toContain("connect-src 'self' https://api.rubaya.pk")
    expect(csp).toContain('img-src \'self\' https://api.rubaya.pk https://img.rubaya.pk data: blob:')
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
  })

  it('go into the _headers file, with the caching rules: hashed files for good, index.html never', () => {
    const file = headersFile({ api: 'https://api.rubaya.pk' })
    expect(file).toMatch(/^\/\*\n {2}X-Content-Type-Options: nosniff/)
    expect(file).toContain('/index.html\n  Cache-Control: no-cache')
    expect(file).toContain('/assets/*\n  Cache-Control: public, max-age=31536000, immutable')
  })
})

describe('index.html', () => {
  it('has no inline script: the policy would block it (the theme is resolved by public/theme-init.js)', () => {
    const html = readFileSync(path.join(root, 'index.html'), 'utf8')
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    expect(scripts.length).toBeGreaterThan(0)
    for (const [, attrs] of scripts) expect(attrs, 'every script has a src').toMatch(/\bsrc=/)
    for (const [, , body] of scripts) expect((body ?? '').trim(), 'and no body').toBe('')
    expect(readFileSync(path.join(root, 'public/theme-init.js'), 'utf8')).toContain('dataset.theme')
  })
})
