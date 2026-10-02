import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  ApiError, CursorPage, Enum, Id, Money, PageQuery, PkMobile, ThemeTokens, createClient, csv, defineRoutes, enums,
  errorCodes, errorStatus, fieldIssueCodes, flag, permissions, toFieldIssues, z, buildPath, buildQuery, money,
} from '../src'

const ID = '0192f5aa-1111-7222-8333-444455556666'

describe('error registry', () => {
  it('has unique codes, snake_case, and an HTTP status for each', () => {
    expect(new Set(errorCodes).size).toBe(errorCodes.length)
    for (const c of errorCodes) {
      expect(c).toMatch(/^[a-z][a-z_]*$/)
      expect(errorStatus[c]).toBeGreaterThanOrEqual(400)
    }
  })
  it('keeps field issue codes unique', () => {
    expect(new Set(fieldIssueCodes).size).toBe(fieldIssueCodes.length)
  })
})

describe('toFieldIssues', () => {
  const S = z.strictObject({
    name: z.string().min(2),
    qty: z.number().int().max(3),
    phone: PkMobile,
    kind: Enum.productKind,
    tags: z.array(z.string()).min(1),
  })
  it('maps Zod issues to stable field codes', () => {
    const r = S.safeParse({ qty: 9, phone: '051 1234567', kind: 'x', tags: [], extra: 1 })
    expect(r.success).toBe(false)
    if (r.success) return
    const byPath = Object.fromEntries(toFieldIssues(r.error).map((i) => [i.path, i.code]))
    expect(byPath).toMatchObject({ name: 'required', qty: 'too_big', phone: 'phone_invalid', kind: 'invalid_format', tags: 'too_small', extra: 'unrecognized_keys' })
  })
  it('maps a too-short string to too_short', () => {
    const r = S.safeParse({ name: 'a', qty: 1, phone: '0300 1234567', kind: 'stitched', tags: ['x'] })
    expect(r.success).toBe(false)
    if (!r.success) expect(toFieldIssues(r.error)).toEqual([{ path: 'name', code: 'too_short' }])
  })
})

describe('ApiError.from', () => {
  it('reads a problem document and keeps extra members as details', () => {
    const e = ApiError.from({ title: 'Insufficient stock', status: 409, code: 'insufficient_stock', requestId: 'r1', detail: 'Only 2 available', variantId: ID, available: 2 }, 409)
    expect(e.code).toBe('insufficient_stock')
    expect(e.status).toBe(409)
    expect(e.requestId).toBe('r1')
    expect(e.details).toEqual({ variantId: ID, available: 2 })
    expect(e.message).toBe('Only 2 available')
  })
  it('collects issues and ignores unknown issue codes', () => {
    const e = ApiError.from({ title: 'x', status: 400, code: 'validation_failed', issues: [{ path: 'customer.phone', code: 'phone_invalid' }, { path: 'a', code: 'made_up' }] }, 400)
    expect(e.issues).toEqual([{ path: 'customer.phone', code: 'phone_invalid' }])
  })
  it('falls back to a code from the status for non-problem bodies and unknown codes', () => {
    expect(ApiError.from(null, 404).code).toBe('not_found')
    expect(ApiError.from('<html>', 502).code).toBe('internal_error')
    expect(ApiError.from({ title: 't', status: 429, code: 'brand_new_code' }, 429).code).toBe('rate_limited')
  })
})

describe('enums', () => {
  it('has no duplicate values and only snake_case', () => {
    for (const [key, values] of Object.entries(enums)) {
      expect(new Set(values).size, key).toBe(values.length)
      for (const v of values) expect(v, key).toMatch(/^[a-z][a-z_]*$/)
    }
  })
  it('exposes zod enums', () => {
    expect(Enum.orderStatus.parse('pending_confirmation')).toBe('pending_confirmation')
    expect(Enum.productKind.safeParse('made-to-order').success).toBe(false)
  })
  it('permissions are unique resource:action strings', () => {
    expect(new Set(permissions).size).toBe(permissions.length)
    for (const p of permissions) expect(p).toMatch(/^[a-z]+:[a-z]+$/)
  })
})

describe('query helpers', () => {
  it('PageQuery applies defaults and accepts wire strings or native values', () => {
    expect(PageQuery.parse({})).toEqual({ page: 1, size: 50 })
    expect(PageQuery.parse({ page: '3', size: '25', sort: '-placedAt' })).toEqual({ page: 3, size: 25, sort: '-placedAt' })
    expect(PageQuery.parse({ page: 3, size: 25 })).toEqual({ page: 3, size: 25 })
  })
  it('PageQuery rejects unknown keys, bad sizes and short search text', () => {
    expect(PageQuery.safeParse({ extra: 1 }).success).toBe(false)
    expect(PageQuery.safeParse({ size: '30' }).success).toBe(false)
    expect(PageQuery.safeParse({ q: 'a' }).success).toBe(false)
  })
  it('csv and flag parse wire and native forms', () => {
    expect(csv(z.string()).parse('S,M')).toEqual(['S', 'M'])
    expect(csv(z.string()).parse(['S'])).toEqual(['S'])
    expect(flag.parse('1')).toBe(true)
    expect(flag.parse(false)).toBe(false)
  })
  it('buildPath and buildQuery follow the wire conventions', () => {
    expect(buildPath('/products/:id/reviews', { id: 'a b' })).toBe('/products/a%20b/reviews')
    expect(() => buildPath('/products/:id', {})).toThrow()
    expect(buildQuery({ size: ['S', 'M'], inStock: true, x: undefined, page: 2, o: false })).toBe('?size=S%2CM&inStock=1&page=2&o=0')
    expect(buildQuery({})).toBe('')
  })
})

describe('schemas', () => {
  it('Id is a UUID, Money is strict', () => {
    expect(Id.safeParse(ID).success).toBe(true)
    expect(Id.safeParse('nope').success).toBe(false)
    expect(Money.safeParse(money(100)).success).toBe(true)
  })
  it('ThemeTokens rejects a colour that could carry CSS', () => {
    const ok = {
      colors: { bg: '#FBF8F3', surface: '#FFFFFF', fg: '#141210', muted: '#6A6359', line: '#E7E0D4', accent: '#C9A227', sale: '#B23A2E', success: '#2F6B40', warning: '#855B1A', danger: '#B23A2E', focus: '#2C3E8C' },
      fonts: { heading: 'Playfair Display', body: 'Inter' },
      radius: { control: 'soft', card: 'soft', media: 'none' },
      density: 'comfortable', mediaRatio: '3/4', header: { layout: 'left', sticky: true },
    }
    expect(ThemeTokens.safeParse(ok).success).toBe(true)
    expect(ThemeTokens.safeParse({ ...ok, colors: { ...ok.colors, accent: 'red;}body{display:none' } }).success).toBe(false)
    expect(ThemeTokens.safeParse({ ...ok, fonts: { heading: 'Comic Sans', body: 'Inter' } }).success).toBe(false)
  })
})

// ---- client ----

const routes = defineRoutes({
  'catalog.getProduct': { method: 'GET', path: '/products/:id', auth: 'public', params: z.strictObject({ id: z.string() }), query: z.strictObject({ locale: Enum.locale.optional(), size: csv(z.string()).optional() }), response: z.strictObject({ id: z.string(), title: z.string() }) },
  'catalog.listProducts': { method: 'GET', path: '/products', auth: 'public', query: PageQuery, response: CursorPage(z.string()) },
  'orders.create': { method: 'POST', path: '/orders', auth: 'cart', idempotent: true, status: 201, body: z.strictObject({ customer: z.strictObject({ phone: PkMobile }) }), response: z.strictObject({ orderNumber: z.string() }) },
  'admin.products.delete': { method: 'DELETE', path: '/admin/products/:id', auth: 'staff', permission: 'products:delete', params: z.strictObject({ id: Id }), response: z.undefined() },
})

type Seen = { url: string; init: RequestInit }
function fake(status: number, body: unknown, seen: Seen[] = []): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(url), init: init ?? {} })
    return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
}

describe('createClient', () => {
  it('builds the URL, sends only the query keys the caller provided, and parses the response', async () => {
    const seen: Seen[] = []
    const api = createClient(routes, { baseUrl: 'http://x/api/v1/', fetch: fake(200, { id: 'p1', title: 'Lawn' }, seen), headers: () => ({ 'x-cart-token': 't' }) })
    const out = await api('catalog.getProduct', { params: { id: 'p 1' }, query: { size: ['S', 'M'] } })
    expect(out).toEqual({ id: 'p1', title: 'Lawn' })
    expect(seen[0]?.url).toBe('http://x/api/v1/products/p%201?size=S%2CM')
    expect(seen[0]?.init.method).toBe('GET')
    expect((seen[0]?.init.headers as Record<string, string>)['x-cart-token']).toBe('t')
  })

  it('does not append schema defaults to the URL', async () => {
    const seen: Seen[] = []
    const api = createClient(routes, { baseUrl: 'http://x', fetch: fake(200, { items: [] }, seen) })
    await api('catalog.listProducts', { query: { page: 2 } })
    await api('catalog.listProducts')
    expect(seen.map((s) => s.url)).toEqual(['http://x/products?page=2', 'http://x/products'])
  })

  it('validates the body, normalises the phone, and requires an idempotency key', async () => {
    const seen: Seen[] = []
    const api = createClient(routes, { baseUrl: 'http://x', fetch: fake(201, { orderNumber: 'RB-10001' }, seen) })
    await api('orders.create', { body: { customer: { phone: '0300 1234567' } }, idempotencyKey: ID })
    expect(JSON.parse(String(seen[0]?.init.body))).toEqual({ customer: { phone: '+923001234567' } })
    expect((seen[0]?.init.headers as Record<string, string>)['idempotency-key']).toBe(ID)
    // @ts-expect-error idempotencyKey is required by the route's type
    await expect(api('orders.create', { body: { customer: { phone: '0300 1234567' } } })).rejects.toThrow(/idempotencyKey/)
    await expect(api('orders.create', { body: { customer: { phone: '051 1234567' } }, idempotencyKey: ID })).rejects.toThrow()
  })

  it('throws ApiError with the code, status, details and issues from a problem response', async () => {
    const api = createClient(routes, { baseUrl: 'http://x', fetch: fake(409, { title: 't', status: 409, code: 'insufficient_stock', requestId: 'r', available: 1 }) })
    const err = await api('orders.create', { body: { customer: { phone: '0300 1234567' } }, idempotencyKey: ID }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ code: 'insufficient_stock', status: 409, details: { available: 1 } })
  })

  it('maps a network failure to unavailable and returns undefined for 204', async () => {
    const down = createClient(routes, { baseUrl: 'http://x', fetch: (async () => { throw new TypeError('fetch failed') }) as typeof fetch })
    await expect(down('catalog.listProducts')).rejects.toMatchObject({ code: 'unavailable', status: 0 })
    const ok = createClient(routes, { baseUrl: 'http://x', fetch: fake(204, null) })
    expect(await ok('admin.products.delete', { params: { id: ID } })).toBeUndefined()
  })

  // Compile-time checks: tsc verifies the @ts-expect-error lines; the function is never called.
  const typeChecks = () => {
    const api = createClient(routes, { baseUrl: 'http://x' })
    expectTypeOf(api).parameter(0).toEqualTypeOf<'catalog.getProduct' | 'catalog.listProducts' | 'orders.create' | 'admin.products.delete'>()
    // @ts-expect-error unknown route key
    void api('nope')
    // @ts-expect-error missing required params
    void api('catalog.getProduct', {})
    // @ts-expect-error auth 'staff' needs a permission
    defineRoutes({ bad: { method: 'GET', path: '/x', auth: 'staff', response: z.string() } })
    // @ts-expect-error a public route must not name a permission
    defineRoutes({ bad: { method: 'GET', path: '/x', auth: 'public', permission: 'orders:read', response: z.string() } })
  }
  it('type checks are present', () => {
    expect(typeof typeChecks).toBe('function')
  })
})
