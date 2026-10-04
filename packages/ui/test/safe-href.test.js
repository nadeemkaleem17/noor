import { describe, expect, it } from 'vitest'
import { isExternal, safeHref } from '../src/safe-href'

describe('safeHref', () => {
  it.each(['/', '/shop?x=1', 'https://rubaya.pk/a', 'http://localhost:3000', 'mailto:hi@rubaya.pk', 'tel:+923001234567', 'https://wa.me/923001234567'])('allows %s', (h) => {
    expect(safeHref(h)).toBe(h)
  })
  it.each(['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\tscript:alert(1)', 'data:text/html,x', 'vbscript:x', '//evil.com', '/\\evil.com', '/\t/evil.com', ' javascript:x', 'ftp://x', '', 'shop', 'https://exa mple.com'])('rejects %j', (h) => {
    expect(safeHref(h)).toBeUndefined()
  })
  it('rejects non-strings', () => {
    expect(safeHref(undefined)).toBeUndefined()
    expect(safeHref(null)).toBeUndefined()
  })
  it('trims surrounding spaces of a valid link', () => {
    expect(safeHref('  /cart ')).toBe('/cart')
  })
  it('marks only absolute http(s) links as external', () => {
    expect(isExternal('https://wa.me/1')).toBe(true)
    expect(isExternal('/cart')).toBe(false)
    expect(isExternal('mailto:a@b.c')).toBe(false)
  })
})
