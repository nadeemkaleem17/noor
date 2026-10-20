// Counting visits in the shop's server (apps/storefront/app/lib/visit.server.js): who is counted, and what is kept.
import { describe, expect, it } from 'vitest'

// the module reads the server's settings when it loads, so they are set first
Object.assign(process.env, { API_INTERNAL_URL: 'http://localhost:3000', PUBLIC_SITE_URL: 'http://localhost:5174', PUBLIC_IMG_URL: 'http://localhost:3000/img' })
const { isRobot, newVisitor, refusesTracking, VISITOR_COOKIE, visitorCookie, visitorOf } = await import('../app/lib/visit.server')

const request = (/** @type {Record<string, string>} */ headers = {}) => new Request('http://shop.test/visit', { method: 'POST', headers })

describe('the visitor number', () => {
  it('is 32 hex characters made by the shop, and different every time', () => {
    const a = newVisitor()
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(newVisitor()).not.toBe(a)
  })

  it('is read from the cookie only when the shop made it', () => {
    const id = newVisitor()
    expect(visitorOf(request({ cookie: `${VISITOR_COOKIE}=${id}; nc_cart=x` }))).toBe(id)
    expect(visitorOf(request({ cookie: `${VISITOR_COOKIE}=not-a-number` }))).toBeUndefined()
    expect(visitorOf(request({ cookie: `${VISITOR_COOKIE}=${id.toUpperCase()}` }))).toBeUndefined()
    expect(visitorOf(request())).toBeUndefined()
  })

  it('travels in a cookie the page cannot read, for a year, and holds nothing else', () => {
    const cookie = visitorCookie('a'.repeat(32))
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain(`Max-Age=${60 * 60 * 24 * 365}`)
    expect(cookie.startsWith(`${VISITOR_COOKIE}=${'a'.repeat(32)};`)).toBe(true)
  })
})

describe('who is not counted', () => {
  it('is a browser that says it does not want to be tracked', () => {
    expect(refusesTracking(request({ 'sec-gpc': '1' }))).toBe(true)
    expect(refusesTracking(request({ dnt: '1' }))).toBe(true)
    expect(refusesTracking(request({ dnt: '0' }))).toBe(false)
    expect(refusesTracking(request())).toBe(false)
  })

  it('is a program that is not a person', () => {
    for (const ua of ['Googlebot/2.1', 'Mozilla/5.0 (compatible; bingbot/2.0)', 'HeadlessChrome/120', 'Chrome-Lighthouse', 'facebookexternalhit/1.1']) expect(isRobot(request({ 'user-agent': ua })), ua).toBe(true)
    expect(isRobot(request({ 'user-agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' }))).toBe(false)
    expect(isRobot(request())).toBe(false)
  })
})
