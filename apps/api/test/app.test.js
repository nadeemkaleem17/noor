// M0-API-SPIKE-1 (plan/08-backend-architecture.md section 15): route table -> Fastify -> OpenAPI, errors, startup rules.
import { afterEach, describe, expect, it } from 'vitest'
import { Enum, PkMobile, defineRoutes, errorStatus, z } from '@noor/contract'
import { buildApp } from '../src/app.js'
import { ConfigError, parseConfig } from '../src/platform/config.js'
import { DomainError } from '../src/platform/errors.js'

const dbEnv = {
  TRACKING_KEY: 'k'.repeat(40),
  DATA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), DATABASE_URL: 'mysql://app:pw@localhost:3306/rubaya', DATABASE_MIGRATION_URL: 'mysql://migrate:pw@localhost:3306/rubaya' }
const config = /** @type {import('../src/platform/config.js').Config} */ (parseConfig({ NODE_ENV: 'test', APP_ENV: 'ci', ADMIN_ORIGIN: 'http://localhost:5173', LOG_LEVEL: 'silent', ...dbEnv }))
const apps = /** @type {Awaited<ReturnType<typeof buildApp>>[]} */ ([])
/**
 * @param {Parameters<typeof buildApp>[0]} [o]
 */
const make = async (o = { config }) => {
  const app = await buildApp(o)
  apps.push(app)
  return app
}
afterEach(async () => {
  while (apps.length) await apps.pop()?.close()
})

describe('real route table', () => {
  it('answers with a request id on every response', async () => {
    const app = await make()
    const res = await app.inject('/healthz')
    expect(res.statusCode).toBe(200)
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
    expect((await app.inject({ url: '/healthz', headers: { 'x-request-id': 'req-from-the-edge-1' } })).headers['x-request-id']).toBe('req-from-the-edge-1')
    expect((await app.inject({ url: '/healthz', headers: { 'x-request-id': '<script>' } })).headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('denies the staff route by default (no session exists yet)', async () => {
    const app = await make()
    const res = await app.inject('/api/v1/admin/system')
    expect(res.statusCode).toBe(401)
    expect(res.headers['content-type']).toContain('application/problem+json')
    expect(res.json()).toMatchObject({ code: 'unauthenticated', status: 401, requestId: expect.any(String) })
  })

  it('answers unknown URLs with a not_found problem', async () => {
    const app = await make()
    const res = await app.inject('/api/v1/nope')
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ code: 'not_found', type: 'https://rubaya.pk/problems/not_found' })
  })

  it('exposes /healthz and a /readyz that reports failing dependencies', async () => {
    const ok = await make()
    expect((await ok.inject('/healthz')).json()).toEqual({ ok: true })
    expect((await ok.inject('/readyz')).statusCode).toBe(200)
    const down = await make({ config, readiness: async () => ['database'] })
    const r = await down.inject('/readyz')
    expect(r.statusCode).toBe(503)
    expect(r.json()).toEqual({ ok: false, failing: ['database'] })
  })

  it('generates the OpenAPI document from the table (snapshot, DOC-08 section 17)', async () => {
    const app = await make()
    await app.ready()
    await expect(JSON.stringify(app.swagger(), null, 2) + '\n').toMatchFileSnapshot('./openapi.snapshot.json')
  })
})

describe('request id', () => {
  it('echoes a well-formed inbound id and replaces anything else', async () => {
    const app = await make()
    const good = await app.inject({ url: '/healthz', headers: { 'x-request-id': 'req-12345678' } })
    expect(good.headers['x-request-id']).toBe('req-12345678')
    const bad = await app.inject({ url: '/healthz', headers: { 'x-request-id': '<script>alert(1)</script>' } })
    expect(bad.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
  })
})

// ---- a test-only table: validation, domain errors, permissions, idempotency, statuses ----

const table = defineRoutes({
  'test.echo': {
    method: 'POST', path: '/test/echo/:id', auth: 'public', status: 201,
    params: z.strictObject({ id: z.string().min(2) }),
    query: z.strictObject({ n: z.preprocess((v) => (typeof v === 'string' ? Number(v) : v), z.number().int().max(5)).optional() }),
    body: z.strictObject({ phone: PkMobile, kind: Enum.productKind }),
    response: z.strictObject({ id: z.string(), phone: z.string(), n: z.number().optional() }),
  },
  'test.stock': { method: 'GET', path: '/test/stock', auth: 'public', response: z.strictObject({ ok: z.boolean() }) },
  'test.boom': { method: 'GET', path: '/test/boom', auth: 'public', response: z.strictObject({ ok: z.boolean() }) },
  'test.badshape': { method: 'GET', path: '/test/badshape', auth: 'public', response: z.strictObject({ ok: z.boolean() }) },
  'test.orders': { method: 'POST', path: '/test/orders', auth: 'cart', idempotent: true, status: 201, body: z.strictObject({}), response: z.strictObject({ ok: z.boolean() }) },
  'test.secret': { method: 'GET', path: '/test/secret', auth: 'staff', permission: 'orders:read', response: z.strictObject({ ok: z.boolean() }) },
  'test.delete': { method: 'DELETE', path: '/test/thing', auth: 'public', status: 204, response: z.undefined() },
})

const handlers = /** @type {import('../src/platform/http/route-registrar.js').Handlers<typeof table>} */ ({
  'test.echo': async ({ params, query, body }) => ({ id: params.id, phone: body.phone, ...(query.n === undefined ? {} : { n: query.n }) }),
  'test.stock': async () => {
    throw new DomainError('insufficient_stock', { variantId: 'v1', available: 2 })
  },
  'test.boom': async () => {
    throw new Error('database password is hunter2')
  },
  'test.badshape': async () => /** @type {{ ok: boolean; }} */ (/** @type {unknown} */ (({ ok: 'yes' }))),
  'test.orders': async () => ({ ok: true }),
  'test.secret': async () => ({ ok: true }),
  'test.delete': async () => undefined,
})

/**
 * @param {Partial<Parameters<typeof buildApp<typeof table>>[0]>} [extra]
 */
const withTable = (extra = {}) =>
  make(/** @type {Parameters<typeof buildApp>[0]} */ ({ config, table, handlers, ...extra }))

describe('registrar and error format', () => {
  it('validates params, query and body with the contract schemas, and uses the output values', async () => {
    const app = await withTable()
    const ok = await app.inject({ method: 'POST', url: '/api/v1/test/echo/ab?n=3', payload: { phone: '0300 1234567', kind: 'stitched' } })
    expect(ok.statusCode).toBe(201)
    expect(ok.json()).toEqual({ id: 'ab', phone: '+923001234567', n: 3 })
  })

  it('returns validation_failed with field issue codes (including unknown keys)', async () => {
    const app = await withTable()
    const res = await app.inject({ method: 'POST', url: '/api/v1/test/echo/a?n=9', payload: { phone: '051 1234567', kind: 'x', extra: 1 } })
    expect(res.statusCode).toBe(400)
    const issues = Object.fromEntries((/** @type {{ path: string; code: string; }[]} */ (res.json().issues)).map((i) => [i.path, i.code]))
    expect(res.json().code).toBe('validation_failed')
    // validation stops at the first failing part (params), so only that part's issues are reported
    expect(issues).toEqual({ id: 'too_short' })
    const body = await app.inject({ method: 'POST', url: '/api/v1/test/echo/abc', payload: { phone: '051 1234567', kind: 'x', extra: 1 } })
    expect(Object.fromEntries((/** @type {{ path: string; code: string; }[]} */ (body.json().issues)).map((i) => [i.path, i.code]))).toEqual({
      phone: 'phone_invalid', kind: 'invalid_format', extra: 'unrecognized_keys',
    })
  })

  it('renders a DomainError with the registry status and its details', async () => {
    const app = await withTable()
    const res = await app.inject('/api/v1/test/stock')
    expect(res.statusCode).toBe(errorStatus.insufficient_stock)
    expect(res.json()).toMatchObject({ code: 'insufficient_stock', variantId: 'v1', available: 2, status: 409 })
  })

  it('hides internals on unexpected errors', async () => {
    const app = await withTable()
    const res = await app.inject('/api/v1/test/boom')
    expect(res.statusCode).toBe(500)
    expect(res.json().code).toBe('internal_error')
    expect(res.body).not.toContain('hunter2')
  })

  it('fails a response that does not match its schema (outside production)', async () => {
    const app = await withTable()
    const res = await app.inject('/api/v1/test/badshape')
    expect(res.statusCode).toBe(500)
    expect(res.json().code).toBe('internal_error')
  })

  it('rejects a body over the 1 MB limit with payload_too_large', async () => {
    const app = await withTable()
    const res = await app.inject({ method: 'POST', url: '/api/v1/test/orders', headers: { 'idempotency-key': '6f1c0f70-6a7c-4d0b-9d63-2b4e1f1d5e55' }, payload: { pad: 'x'.repeat(1_100_000) } })
    expect(res.statusCode).toBe(413)
    expect(res.json().code).toBe('payload_too_large')
  })

  it('requires a UUID Idempotency-Key on idempotent routes', async () => {
    const app = await withTable()
    const missing = await app.inject({ method: 'POST', url: '/api/v1/test/orders', payload: {} })
    expect(missing.statusCode).toBe(400)
    expect(missing.json().issues).toEqual([{ path: 'Idempotency-Key', code: 'required' }])
    const bad = await app.inject({ method: 'POST', url: '/api/v1/test/orders', headers: { 'idempotency-key': 'nope' }, payload: {} })
    expect(bad.json().issues).toEqual([{ path: 'Idempotency-Key', code: 'invalid_format' }])
    const ok = await app.inject({ method: 'POST', url: '/api/v1/test/orders', headers: { 'idempotency-key': '6f1c0f70-6a7c-4d0b-9d63-2b4e1f1d5e55' }, payload: {} })
    expect(ok.statusCode).toBe(201)
  })

  it('checks the staff permission after authentication', async () => {
    /**
     * @param {string[]} permissions
     */
    const withActor = (permissions) => withTable(/** @type {never} */ ({ authorize: async () => ({ staffId: 's1', permissions: new Set(permissions) }) }))
    expect((await (await withActor(['orders:read'])).inject('/api/v1/test/secret')).statusCode).toBe(200)
    const denied = await (await withActor(['products:read'])).inject('/api/v1/test/secret')
    expect(denied.statusCode).toBe(403)
    expect(denied.json().code).toBe('forbidden')
  })

  it('sends an empty 204 for routes that declare it', async () => {
    const app = await withTable()
    const res = await app.inject({ method: 'DELETE', url: '/api/v1/test/thing' })
    expect(res.statusCode).toBe(204)
    expect(res.body).toBe('')
  })
})

describe('startup rules', () => {
  it('refuses to start when a route has no handler, or a handler has no route', async () => {
    const t = defineRoutes({ 'a.one': { method: 'GET', path: '/a', auth: 'public', response: z.string() } })
    await expect(buildApp({ config, table: t, handlers: /** @type {never} */ ({}) })).rejects.toThrow(/Routes without a handler: \[a\.one\]/)
    await expect(buildApp({ config, table: t, handlers: /** @type {never} */ ({ 'a.one': async () => 'x', 'b.two': async () => 'y' }) })).rejects.toThrow(/Handlers without a route: \[b\.two\]/)
  })
})

describe('config', () => {
  it('stops with the names of the missing or invalid variables', () => {
    const err = (() => { try { parseConfig({ NODE_ENV: 'production', PORT: 'abc' }) } catch (e) { return e } })()
    expect(err).toBeInstanceOf(ConfigError)
    const vars = (/** @type {ConfigError} */ (err)).variables.join(' ')
    expect(vars).toContain('APP_ENV (required)')
    expect(vars).toContain('ADMIN_ORIGIN (required)')
    expect(vars).toContain('PORT')
    expect(vars).toContain('DATABASE_URL (required)')
    expect(vars).toContain('DATABASE_MIGRATION_URL (required)')
  })
  it('applies safe defaults and freezes the result', () => {
    const c = parseConfig({ NODE_ENV: 'test', APP_ENV: 'production', ADMIN_ORIGIN: 'https://admin.rubaya.pk', ...dbEnv })
    expect(c).toMatchObject({ HOST: '127.0.0.1', PORT: 3000, TRUST_PROXY_HOPS: 0, LOG_LEVEL: 'info' })
    expect(Object.isFrozen(c)).toBe(true)
  })
  it('refuses to start a production process on local file storage (DOC-14 section 6)', () => {
    const env = { NODE_ENV: 'production', APP_ENV: 'production', ADMIN_ORIGIN: 'https://admin.rubaya.pk', ...dbEnv }
    expect(() => parseConfig(env)).toThrow("STORAGE_DRIVER (local storage is for development only)")
    expect(parseConfig({ ...env, NODE_ENV: 'development' }).STORAGE_DRIVER).toBe('local')
  })
  it('needs a tracking key outside local development and CI', () => {
    const withoutKey = { ...dbEnv, TRACKING_KEY: undefined }
    const base = { NODE_ENV: 'development', ADMIN_ORIGIN: 'https://admin.rubaya.pk', ...withoutKey }
    expect(() => parseConfig({ ...base, APP_ENV: 'production' })).toThrow('TRACKING_KEY')
    expect(() => parseConfig({ ...base, APP_ENV: 'staging' })).toThrow('TRACKING_KEY')
    expect(parseConfig({ ...base, APP_ENV: 'local' }).TRACKING_KEY).toBeUndefined()
    expect(() => parseConfig({ ...base, APP_ENV: 'production', TRACKING_KEY: 'too short' })).toThrow('TRACKING_KEY')
  })
  it('allows weak passwords only when the process is local', () => {
    const base = { NODE_ENV: 'development', ADMIN_ORIGIN: 'https://admin.rubaya.pk', ...dbEnv }
    expect(parseConfig({ ...base, APP_ENV: 'local' }).RELAXED_PASSWORDS).toBe(false)
    expect(parseConfig({ ...base, APP_ENV: 'local', RELAXED_PASSWORDS: '1' }).RELAXED_PASSWORDS).toBe(true)
    for (const APP_ENV of ['ci', 'staging', 'production']) expect(() => parseConfig({ ...base, APP_ENV, RELAXED_PASSWORDS: '1', TWO_FACTOR_REQUIRED: '1' })).toThrow('RELAXED_PASSWORDS')
  })
  it('keeps two-step sign-in required unless the process is local or CI', () => {
    const base = { NODE_ENV: 'development', ADMIN_ORIGIN: 'https://admin.rubaya.pk', ...dbEnv }
    expect(parseConfig({ ...base, APP_ENV: 'production' }).TWO_FACTOR_REQUIRED).toBe(true)
    expect(() => parseConfig({ ...base, APP_ENV: 'production', TWO_FACTOR_REQUIRED: '0' })).toThrow('TWO_FACTOR_REQUIRED')
    expect(() => parseConfig({ ...base, APP_ENV: 'staging', TWO_FACTOR_REQUIRED: '0' })).toThrow('TWO_FACTOR_REQUIRED')
    expect(parseConfig({ ...base, APP_ENV: 'local', TWO_FACTOR_REQUIRED: '0' }).TWO_FACTOR_REQUIRED).toBe(false)
  })
})

// keeps the unused-type import honest for the table type used above
/**
 * @typedef {import('@noor/contract').RouteTable} _T
 */
