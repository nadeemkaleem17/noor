// The visitor's address that the API's limits count (apps/storefront/app/lib/visitor.server.js).
import { describe, expect, it } from 'vitest'
import { parseEnv } from '../app/lib/env.server'
import { visitorHeaders, visitorIp, visitorMiddleware } from '../app/lib/visitor.server'

describe('visitorIp', () => {
  it('is nothing unless a proxy is trusted', () => {
    expect(visitorIp('203.0.113.9', 0)).toBeUndefined()
    expect(visitorIp(null, 1)).toBeUndefined()
  })
  it('takes the entry the nearest trusted proxy appended, not what the visitor wrote', () => {
    expect(visitorIp('203.0.113.9', 1)).toBe('203.0.113.9')
    expect(visitorIp('1.1.1.1, 203.0.113.9', 1)).toBe('203.0.113.9') // 1.1.1.1 was written by the visitor
    expect(visitorIp('1.1.1.1, 203.0.113.9, 10.0.0.2', 2)).toBe('203.0.113.9')
    expect(visitorIp('2001:db8::7', 1)).toBe('2001:db8::7')
  })
  it('refuses a value that is not an address', () => {
    expect(visitorIp('not-an-ip', 1)).toBeUndefined()
    expect(visitorIp('203.0.113.9', 2)).toBeUndefined() // fewer entries than proxies
  })
})

describe('what goes to the API', () => {
  const env = { API_INTERNAL_URL: 'http://localhost:3000', PUBLIC_SITE_URL: 'http://localhost:5174', PUBLIC_IMG_URL: 'http://localhost:3000/img' }
  it('reads the key and the number of proxies from the environment', () => {
    expect(parseEnv(env)).toMatchObject({ TRUSTED_PROXY_HOPS: 0 })
    expect(parseEnv({ ...env, TRUSTED_PROXY_HOPS: '1', API_INTERNAL_KEY: 'k'.repeat(32) })).toMatchObject({ TRUSTED_PROXY_HOPS: 1, API_INTERNAL_KEY: 'k'.repeat(32) })
    expect(() => parseEnv({ ...env, API_INTERNAL_KEY: 'short' })).toThrow(/API_INTERNAL_KEY/)
  })
  it('sends the address only inside a request, and only with the key', async () => {
    process.env.API_INTERNAL_URL = env.API_INTERNAL_URL
    process.env.PUBLIC_SITE_URL = env.PUBLIC_SITE_URL
    process.env.PUBLIC_IMG_URL = env.PUBLIC_IMG_URL
    process.env.API_INTERNAL_KEY = 'k'.repeat(32)
    process.env.TRUSTED_PROXY_HOPS = '1'
    expect(visitorHeaders()).toEqual({ 'x-internal-key': 'k'.repeat(32) }) // outside a request: no address
    const request = new Request('http://shop/cart', { headers: { 'x-forwarded-for': '9.9.9.9, 203.0.113.9' } })
    const inside = await visitorMiddleware(/** @type {never} */ ({ request, params: {}, context: {} }), async () => visitorHeaders())
    expect(inside).toEqual({ 'x-internal-key': 'k'.repeat(32), 'x-forwarded-for': '203.0.113.9' })
  })
})
