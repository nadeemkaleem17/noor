// M5-11: what is reported about a visit's speed (plan/06-storefront/10-performance.md section 9). Pure.
import { describe, expect, it } from 'vitest'
import { routeName, vitalReport } from '../app/lib/vitals'

describe('the name of a page in a report', () => {
  it('is the kind of page, never its address', () => {
    expect(routeName('/')).toBe('home')
    expect(routeName('/ur')).toBe('home')
    expect(routeName('/c/women')).toBe('category')
    expect(routeName('/ur/c/women')).toBe('category')
    expect(routeName('/p/lawn-suit')).toBe('product')
    expect(routeName('/collections/eid')).toBe('collection')
    expect(routeName('/orders/AbC123')).toBe('order')
    expect(routeName('/pages/contact')).toBe('page')
    expect(routeName('/cart')).toBe('cart')
    expect(routeName('/ur/checkout')).toBe('checkout')
  })
  it('an address of no known kind is "other", whatever it holds', () => {
    expect(routeName('/<script>alert(1)</script>')).toBe('other')
    expect(routeName('/' + 'x'.repeat(100))).toBe('other')
  })
})

describe('one report', () => {
  it('carries the metric, a rounded value, the kind of page and the way the page was reached', () => {
    expect(vitalReport({ name: 'LCP', value: 1234.56789, navigationType: 'navigate' }, '/p/lawn')).toEqual({ name: 'LCP', value: 1234.568, route: 'product', navigationType: 'navigate' })
    expect(vitalReport({ name: 'CLS', value: 0.0123456 }, '/')).toEqual({ name: 'CLS', value: 0.012, route: 'home' })
  })
})
