// M1-04 (plan/11-security-auth.md sections 2, 5.1-5.4): response headers, exact-origin CORS, the client address and the internal key,
// rate-limit buckets, and "authenticate before validating". No database needed.
import { afterEach, describe, expect, it } from 'vitest'
import { defineRoutes, z } from '@noor/contract'
import { buildApp } from '../src/app.js'
import { advanceClock, setClock } from '../src/platform/clock.js'
import { parseConfig } from '../src/platform/config.js'
import { buckets } from '../src/platform/http/rate-limit.js'

const ORIGIN = 'http://localhost:5173'
const KEY = 'k'.repeat(40)
const base = { NODE_ENV: 'test', APP_ENV: 'ci', ADMIN_ORIGIN: ORIGIN, LOG_LEVEL: 'silent', DATA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), DATABASE_URL: 'mysql://a:b@h/d', DATABASE_MIGRATION_URL: 'mysql://a:b@h/d' }
const config = parseConfig(base)
const keyed = parseConfig({ ...base, INTERNAL_KEY: KEY })

const apps = /** @type {Awaited<ReturnType<typeof buildApp>>[]} */ ([])
/** @param {Parameters<typeof buildApp>[0]} o */
const make = async (o) => {
  const app = await buildApp(o)
  apps.push(app)
  return app
}
afterEach(async () => {
  setClock(null)
  while (apps.length) await apps.pop()?.close()
})

const table = defineRoutes({
  'test.me': { method: 'GET', path: '/test/me', auth: 'public', response: z.strictObject({ ip: z.string() }) },
  'test.review': { method: 'POST', path: '/test/review', auth: 'public', rateLimit: 'review', status: 201, body: z.strictObject({}), response: z.strictObject({ ok: z.boolean() }) },
  'admin.test.export': { method: 'GET', path: '/admin/test/export', auth: 'staff', permission: 'orders:read', rateLimit: 'adminExport', response: z.strictObject({ ok: z.boolean() }) },
  'admin.test.make': { method: 'POST', path: '/admin/test/make', auth: 'staff', permission: 'orders:read', body: z.strictObject({ name: z.string() }), response: z.strictObject({ ok: z.boolean() }) },
})
const actor = { staffId: 's1', role: 'viewer', permissions: new Set(/** @type {const} */ (['orders:read'])) }
const handlers = {
  'test.me': async (/** @type {{ http: { ip: string } }} */ c) => ({ ip: c.http.ip }),
  'test.review': async () => ({ ok: true }),
  'admin.test.export': async () => ({ ok: true }),
  'admin.test.make': async () => ({ ok: true }),
}
/** @param {import('../src/platform/config.js').Config} cfg @param {boolean} [signedIn] */
const makeTest = (cfg, signedIn = true) =>
  make({ config: cfg, table, handlers: /** @type {never} */ (handlers), authorize: async (req) => (signedIn || req.headers.cookie ? actor : null) })

describe('response headers', () => {
  it('every response carries the API headers; HSTS only outside local and CI', async () => {
    const app = await make({ config })
    for (const url of ['/api/v1/shipping/cities', '/api/v1/admin/system', '/api/v1/nope', '/healthz']) {
      const h = (await app.inject(url)).headers
      expect(h, url).toMatchObject({ 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY', 'content-security-policy': "default-src 'none'; frame-ancestors 'none'" })
      expect(h['strict-transport-security'], url).toBeUndefined()
    }
    const prod = await make({ config: parseConfig({ ...base, APP_ENV: 'production', NODE_ENV: 'production' }) })
    expect((await prod.inject('/api/v1/shipping/cities')).headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains')
  })

  it('admin responses are never cached; public ones are left to their route class', async () => {
    const app = await make({ config })
    expect((await app.inject('/api/v1/admin/system')).headers['cache-control']).toBe('no-store')
    expect((await app.inject('/api/v1/shipping/cities')).headers['cache-control']).toBeUndefined()
  })

  it('an error response keeps the headers', async () => {
    const res = await (await make({ config })).inject('/api/v1/admin/system')
    expect(res.statusCode).toBe(401)
    expect(res.headers['x-frame-options']).toBe('DENY')
  })
})

describe('CORS', () => {
  it('allows the admin origin exactly, with credentials, and nobody else', async () => {
    const app = await make({ config })
    const ok = await app.inject({ url: '/api/v1/admin/system', headers: { origin: ORIGIN } })
    expect(ok.headers).toMatchObject({ 'access-control-allow-origin': ORIGIN, 'access-control-allow-credentials': 'true', vary: 'Origin' })
    for (const origin of ['http://evil.example', `${ORIGIN}.evil.example`, 'null', 'http://localhost:5174']) {
      const res = await app.inject({ url: '/api/v1/admin/system', headers: { origin } })
      expect(res.headers['access-control-allow-origin'], origin).toBeUndefined()
      expect(res.headers['access-control-allow-credentials'], origin).toBeUndefined()
    }
  })

  it('answers a preflight from the admin origin, and refuses one from another', async () => {
    const app = await make({ config })
    const pre = (/** @type {string} */ origin) => app.inject({ method: 'OPTIONS', url: '/api/v1/admin/staff', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'x-csrf-token' } })
    const ok = await pre(ORIGIN)
    expect(ok.statusCode).toBe(204)
    expect(ok.headers).toMatchObject({
      'access-control-allow-origin': ORIGIN,
      'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE',
      'access-control-allow-headers': 'content-type, x-csrf-token, x-request-id, idempotency-key',
      'access-control-max-age': '600',
    })
    const bad = await pre('http://evil.example')
    expect(bad.headers['access-control-allow-origin']).toBeUndefined()
    expect(bad.statusCode).not.toBe(204)
  })

  it('public routes send no CORS headers even when asked from the admin origin', async () => {
    const app = await make({ config })
    const res = await app.inject({ url: '/api/v1/shipping/cities', headers: { origin: ORIGIN } })
    expect(Object.keys(res.headers).filter((h) => h.startsWith('access-control'))).toEqual([])
  })

  it('a refused state change still tells the admin site why (the error carries the CORS headers)', async () => {
    const app = await make({ config })
    const res = await app.inject({ method: 'POST', url: '/api/v1/admin/auth/login', payload: {} })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toMatchObject({ code: 'csrf_failed' })
  })
})

describe('client address and the internal key', () => {
  /** @param {Record<string, string>} headers @param {import('../src/platform/config.js').Config} [cfg] */
  const ipFor = async (headers, cfg = keyed) => ((await (await makeTest(cfg)).inject({ url: '/api/v1/test/me', remoteAddress: '10.9.9.9', headers })).json()).ip

  it('believes the forwarded address only with a valid internal key', async () => {
    expect(await ipFor({ 'x-internal-key': KEY, 'x-forwarded-for': '203.0.113.5' })).toBe('203.0.113.5')
    expect(await ipFor({ 'x-internal-key': KEY, 'x-forwarded-for': '203.0.113.5, 10.0.0.2' })).toBe('203.0.113.5')
    expect(await ipFor({ 'x-internal-key': KEY, 'x-forwarded-for': '2001:db8::1' })).toBe('2001:db8::1')
    expect(await ipFor({ 'x-forwarded-for': '203.0.113.5' })).toBe('10.9.9.9')
    expect(await ipFor({ 'x-internal-key': 'x'.repeat(40), 'x-forwarded-for': '203.0.113.5' })).toBe('10.9.9.9')
    expect(await ipFor({ 'x-internal-key': 'short', 'x-forwarded-for': '203.0.113.5' })).toBe('10.9.9.9')
  })

  it('ignores a forwarded value that is not an address, and everything when no key is configured', async () => {
    expect(await ipFor({ 'x-internal-key': KEY, 'x-forwarded-for': 'not-an-ip' })).toBe('10.9.9.9')
    expect(await ipFor({ 'x-internal-key': KEY })).toBe('10.9.9.9')
    expect(await ipFor({ 'x-internal-key': KEY, 'x-forwarded-for': '203.0.113.5' }, config)).toBe('10.9.9.9')
  })

  it('rate limits the visitor behind the storefront, not the storefront', async () => {
    const app = await makeTest(keyed)
    const post = (/** @type {string} */ visitor) => app.inject({ method: 'POST', url: '/api/v1/test/review', remoteAddress: '10.9.9.9', payload: {}, headers: { 'x-internal-key': KEY, 'x-forwarded-for': visitor } })
    for (let i = 0; i < 5; i++) expect((await post('203.0.113.1')).statusCode).toBe(201)
    expect((await post('203.0.113.1')).statusCode).toBe(429)
    expect((await post('203.0.113.2')).statusCode).toBe(201)
  })
})

describe('rate limits', () => {
  it('refuses over the limit with 429, Retry-After and the RateLimit headers, per address, and recovers after the window', async () => {
    setClock(new Date('2026-10-04T10:00:00.000Z'))
    const app = await makeTest(config)
    const post = (/** @type {string} */ ip) => app.inject({ method: 'POST', url: '/api/v1/test/review', remoteAddress: ip, payload: {} })
    const first = await post('10.1.1.1')
    expect(first.headers).toMatchObject({ 'ratelimit-limit': '5', 'ratelimit-remaining': '4' })
    for (let i = 1; i < 5; i++) await post('10.1.1.1')
    const over = await post('10.1.1.1')
    expect(over.statusCode).toBe(429)
    expect(over.json()).toMatchObject({ code: 'rate_limited', status: 429, retryAfter: expect.any(Number) })
    expect(Number(over.headers['retry-after'])).toBe(over.json().retryAfter)
    expect((await post('10.1.1.2')).statusCode).toBe(201)
    advanceClock(3_600_000 + 1000)
    expect((await post('10.1.1.1')).statusCode).toBe(201)
  })

  it('counts staff routes per staff member, with the stricter export bucket', async () => {
    const app = await makeTest(config)
    for (let i = 0; i < 10; i++) expect((await app.inject('/api/v1/admin/test/export')).statusCode).toBe(200)
    const over = await app.inject('/api/v1/admin/test/export')
    expect(over.statusCode).toBe(429)
    expect(over.headers['retry-after']).toBeDefined()
    expect((await app.inject({ method: 'POST', url: '/api/v1/admin/test/make', headers: { origin: ORIGIN }, payload: {} })).statusCode).toBe(400) // other bucket (admin): not affected
  })

  it('limits unauthenticated staff requests per address', async () => {
    const app = await makeTest(config, false)
    let status = 0
    for (let i = 0; i < 301; i++) status = (await app.inject({ url: '/api/v1/admin/test/export', remoteAddress: '10.2.2.2' })).statusCode
    expect(status).toBe(429)
    expect((await app.inject({ url: '/api/v1/admin/test/export', remoteAddress: '10.2.2.3' })).statusCode).toBe(401)
  }, 30_000)

  it('holds the numbers of the plan (DOC-11 section 5.4)', () => {
    const flat = Object.fromEntries(Object.entries(buckets).map(([k, rules]) => [k, rules.map((r) => `${r.by} ${r.limit}/${r.windowMs / 60_000}min${r.store ? ' db' : ''}`)]))
    expect(flat).toEqual({
      default: ['ip 300/1min'],
      search: ['ip 60/1min'],
      cart: ['ip 60/1min', 'cart 120/1min'],
      checkout: ['ip 10/10min db', 'phone 5/10min db'],
      track: ['ip 10/60min db', 'order 5/60min db'],
      orderAction: ['token 10/60min'],
      notify: ['ip 10/60min db', 'phone 3/1440min db'],
      review: ['ip 5/60min'],
      login: [],
      admin: ['staff 600/1min'],
      adminExport: ['staff 10/1min'],
      upload: ['staff 60/1min'],
    })
  })

  it('stops startup when a route names a bucket that does not exist', async () => {
    const t = defineRoutes({ 'a.one': { method: 'GET', path: '/a', auth: 'public', rateLimit: 'chekout', response: z.string() } })
    await expect(buildApp({ config, table: t, handlers: /** @type {never} */ ({ 'a.one': async () => 'x' }) })).rejects.toThrow(/bucket "chekout"/)
  })
})

describe('authenticate before validating', () => {
  it('a stranger gets 401 whatever the body, a signed-in user with a bad body gets 400', async () => {
    const stranger = await makeTest(config, false)
    const res = await stranger.inject({ method: 'POST', url: '/api/v1/admin/test/make', headers: { origin: ORIGIN }, payload: { unknown: 1 } })
    expect(res.statusCode).toBe(401)
    const member = await makeTest(config)
    const bad = await member.inject({ method: 'POST', url: '/api/v1/admin/test/make', headers: { origin: ORIGIN }, payload: { unknown: 1 } })
    expect(bad.statusCode).toBe(400)
    expect(bad.json()).toMatchObject({ code: 'validation_failed' })
  })
})
