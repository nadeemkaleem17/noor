import { describe, expect, it } from 'vitest'
import { loginUrl, safeNext } from './safe-next'

describe('safeNext (plan/07-admin/01 section 8: same-origin paths only)', () => {
  it('keeps a path with its search and hash', () => {
    expect(safeNext('/products?status=draft#top')).toBe('/products?status=draft#top')
    expect(safeNext('/orders/123')).toBe('/orders/123')
  })

  it.each([
    'https://evil.example',
    'http://evil.example/x',
    '//evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    'javascript:alert(1)',
    'products',
    '',
    null,
    undefined,
    42,
  ])('ignores %j', (value) => {
    expect(safeNext(value)).toBeNull()
  })
})

describe('loginUrl', () => {
  it('remembers where the person was going, unless it is the dashboard', () => {
    expect(loginUrl('/products?x=1')).toBe('/login?next=%2Fproducts%3Fx%3D1')
    expect(loginUrl('/')).toBe('/login')
  })
  it('says when the session ended', () => {
    expect(loginUrl('/orders', true)).toBe('/login?next=%2Forders&reason=expired')
  })
})
