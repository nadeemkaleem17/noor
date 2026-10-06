// M4-12 (plan/13-quality.md sections 6.2 and 6.3): the shop at the size the plan promises (3,000 products, 25,000 variants, 20,000 orders, 20,000 audit entries) on a scratch
// database, then (1) every query behind the listed paths is run through EXPLAIN and must not scan a big table, and (2) every endpoint of the budget table is timed and
// must stay under its budget. Run with `pnpm --filter @noor/api test:perf` (about five minutes; not part of `pnpm test`).
// The budgets in budgets.js are the measured p95 times 1.5 (DOC-13 Q-13-2): they guard against a regression, they are not promises about production.
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { and, isNull, lt, lte, or } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { jobs } from '../src/db/schema/platform.js'
import { runSeed } from '../src/seed/index.js'
import { uuidv7 } from '../src/platform/ids.js'
import { app, closeHarness, config, createHarness, signedIn, t } from '../test/support/staff.js'
import { dbAvailable } from '../test/support/db.js'
import { budgets } from './budgets.js'

const here = path.dirname(fileURLToPath(import.meta.url))
/** The tables that must never be read from end to end by a listed query. */
const BIG = new Set(['products', 'variants', 'orders', 'order_lines', 'audit_log', 'customers', 'product_search', 'inventory_levels', 'jobs'])
const ORDERS = 20_000
const CUSTOMERS = 3_000

/** @type {{ sql: string, values: unknown[] }[]} */
let captured = []
/** What a query would do, as the optimiser plans it now. @param {{ sql: string, values: unknown[] }} q */
async function explain(q) {
  const [rows] = /** @type {[Record<string, unknown>[], unknown]} */ (await t.migrate.pool.query(`EXPLAIN ${q.sql}`, q.values))
  return rows
}

/** Runs `fn`, collects every SELECT it sends to the database, and explains each: a full scan of a big table is a failure. @param {string} label @param {() => Promise<unknown>} fn */
async function expectIndexed(label, fn) {
  captured = []
  await fn()
  const selects = [...captured]
  expect(selects.length, `${label}: no query seen`).toBeGreaterThan(0)
  /** @type {string[]} */
  const scans = []
  for (const q of selects) {
    for (const r of await explain(q)) {
      if (r.type === 'ALL' && BIG.has(String(r.table))) scans.push(`${r.table} (${r.rows} rows): ${q.sql.slice(0, 160)}`)
    }
  }
  expect(scans, `${label} scans a big table`).toEqual([])
}

/** The 95th percentile in milliseconds of `n` runs after two warm-up runs. @param {() => Promise<unknown>} fn @param {number} [n] */
async function p95(fn, n = 40) {
  await fn()
  await fn()
  /** @type {number[]} */
  const times = []
  for (let i = 0; i < n; i++) {
    const start = performance.now()
    await fn()
    times.push(performance.now() - start)
  }
  times.sort((a, b) => a - b)
  return times[Math.min(times.length - 1, Math.ceil(n * 0.95) - 1)] ?? 0
}

let seq = 0
const ipOf = () => `10.50.${Math.floor(++seq / 250) % 250}.${(seq % 250) + 1}`
/** @param {string} method @param {string} url @param {{ token?: string, body?: object, headers?: Record<string, string> }} [o] */
async function call(method, url, { token, body, headers = {} } = {}) {
  const r = await app.inject({ method: /** @type {'GET'} */ (method), url: `/api/v1${url}`, remoteAddress: ipOf(), headers: { ...(token ? { 'x-cart-token': token } : {}), ...headers }, ...(body ? { payload: body } : {}) })
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : undefined }
}

describe.skipIf(!dbAvailable)('performance (3,000 products, 20,000 orders)', () => {
  /** @type {Awaited<ReturnType<typeof signedIn>>['b']} */
  let owner
  /** @type {{ category: string, handle: string, variants: string[], attr: string, orderNumber: string, phone: string, token: string, customerPhone: string, sku: string, entityId: string }} */
  let pick
  /** @type {Record<string, number>} */
  const measured = {}
  let delivery = { cityId: '', methodId: '' }

  beforeAll(async () => {
    await createHarness()
    // the capture goes in front of the application pool: every SELECT of the app is kept
    for (const name of /** @type {const} */ (['query', 'execute'])) {
      const original = /** @type {(...a: any[]) => unknown} */ (t.pool[name]).bind(t.pool)
      const spy = (/** @type {any[]} */ ...args) => {
        const first = args[0]
        const sql = typeof first === 'string' ? first : first?.sql
        const values = typeof first === 'string' ? args[1] : (first?.values ?? args[1])
        if (typeof sql === 'string' && /^\s*select/i.test(sql)) captured.push({ sql, values: values ?? [] })
        return original(...args)
      }
      Object.assign(t.pool, { [name]: spy })
    }
    await runSeed({ db: t.migrate.db, config, flags: { perf: true } })

    // orders, lines, customers and audit entries, in bulk, in the shape the services write
    const conn = await t.migrate.pool.getConnection()
    try {
      await conn.query('SET SESSION cte_max_recursion_depth = 100000')
      await conn.query('CREATE TEMPORARY TABLE seq (n INT PRIMARY KEY)')
      await conn.query(`INSERT INTO seq WITH RECURSIVE s AS (SELECT 1 AS n UNION ALL SELECT n + 1 FROM s WHERE n < ${ORDERS}) SELECT n FROM s`)
      await conn.query(`INSERT INTO customers (id, phone, name, city, created_at, updated_at, last_order_at) SELECT UUID(), CONCAT('+92300', LPAD(n, 7, '0')), CONCAT('Customer ', n), 'Lahore', NOW(3), NOW(3), NOW(3) FROM seq WHERE n <= ${CUSTOMERS}`)
      await conn.query('CREATE TEMPORARY TABLE cust (rn INT PRIMARY KEY, id CHAR(36), phone VARCHAR(16), name VARCHAR(80))')
      await conn.query('INSERT INTO cust SELECT ROW_NUMBER() OVER (ORDER BY phone), id, phone, name FROM customers')
      await conn.query('CREATE TEMPORARY TABLE cty (rn INT PRIMARY KEY, id CHAR(36), name VARCHAR(60))')
      await conn.query('INSERT INTO cty SELECT ROW_NUMBER() OVER (ORDER BY id), id, name FROM cities')
      await conn.query('CREATE TEMPORARY TABLE var (rn INT PRIMARY KEY, id CHAR(36), product_id CHAR(36), sku VARCHAR(40))')
      await conn.query('INSERT INTO var SELECT ROW_NUMBER() OVER (ORDER BY id), id, product_id, sku FROM variants')
      const [[nv]] = /** @type {[{ n: number }[], unknown]} */ (await conn.query('SELECT COUNT(*) AS n FROM var'))
      const placed = 'DATE_SUB(DATE_SUB(NOW(3), INTERVAL (s.n % 90) DAY), INTERVAL (s.n % 1440) MINUTE)'
      await conn.query(
        `INSERT INTO orders (id, number, number_prefix, tracking_token_hash, status, channel, locale, customer_id, customer_name, customer_phone, ship_city_id, ship_city, ship_address, shipping_method_label, eta_min_days, eta_max_days, subtotal_minor, discount_minor, shipping_fee_minor, total_minor, payment_method, payment_status, placed_at, status_changed_at, created_at, updated_at, tracking_number, version)
         SELECT UUID(), 200000 + s.n, 'RB', SHA2(CONCAT('token', s.n), 256), ELT(1 + s.n % 7, 'pending', 'pending_confirmation', 'confirmed', 'dispatched', 'delivered', 'cancelled', 'returned'), 'storefront', 'en', c.id, c.name, c.phone, y.id, y.name, CONCAT('House ', s.n, ', Street 4, Gulberg III'), 'Standard', 3, 5, 1000000, 0, 25000, 1025000, 'cod', 'unpaid', ${placed}, ${placed}, NOW(3), NOW(3), IF(s.n % 7 = 3, CONCAT('TCS', s.n), NULL), 1
         FROM seq s JOIN cust c ON c.rn = 1 + s.n % ${CUSTOMERS} JOIN cty y ON y.rn = 1 + s.n % 200`,
      )
      await conn.query('CREATE TEMPORARY TABLE ord (rn INT PRIMARY KEY, id CHAR(36))')
      await conn.query('INSERT INTO ord SELECT ROW_NUMBER() OVER (ORDER BY number), id FROM orders')
      await conn.query(
        `INSERT INTO order_lines (id, order_id, position, product_id, variant_id, kind, title, variant_label, sku, quantity, unit_price_minor, line_subtotal_minor, stock_tracked)
         SELECT UUID(), o.id, p.pos, v.product_id, v.id, 'stitched', CONCAT('Item ', v.sku), '', v.sku, 1, 500000, 500000, 1
         FROM ord o JOIN (SELECT 1 AS pos UNION SELECT 2) p JOIN var v ON v.rn = 1 + (o.rn * 2 + p.pos) % ${nv?.n ?? 1}`,
      )
      await conn.query(
        `INSERT INTO audit_log (id, at, actor_type, actor_label, actor_role, action, entity_type, entity_id, entity_label, category)
         SELECT UUID(), NOW(3), 'staff', 'Hina', 'owner', 'order.confirmed', 'order', o.id, CONCAT('RB-', 200000 + o.rn), 'money' FROM ord o`,
      )
      // a queue with a backlog of due jobs, so the claim's plan means something
      await conn.query(`INSERT INTO jobs (id, type, payload, run_at, attempts, max_attempts, created_at) SELECT UUID(), 'noop', JSON_OBJECT(), DATE_SUB(NOW(3), INTERVAL n SECOND), 0, 8, NOW(3) FROM seq`)
      await conn.query('ANALYZE TABLE jobs, orders, order_lines, audit_log, customers, products, variants, product_search, inventory_levels, product_attribute_values, product_categories')
    } finally {
      conn.release()
    }

    owner = (await signedIn('owner')).b
    // a zone that delivers to Lahore, one promo code, and the things the paths below need
    const [lahore] = /** @type {[{ id: string }[], unknown]} */ (await t.migrate.pool.query("SELECT id FROM cities WHERE name = 'Lahore'"))
    const zone = await owner.call('POST', '/admin/shipping/zones', {
      body: { name: 'Major', cityIds: [lahore[0]?.id], methods: [{ label: 'Standard', fee: { amount: 25000, currency: 'PKR' }, etaMinDays: 3, etaMaxDays: 5, codAllowed: true, enabled: true }] },
    })
    if (zone.status !== 201) throw new Error(JSON.stringify(zone.body))
    const promo = await owner.call('POST', '/admin/promos', { body: { code: 'PERF10', type: 'percent', percent: 10, scope: 'all', excludeSaleItems: false, firstOrderOnly: false, enabled: true } })
    if (promo.status !== 201) throw new Error(JSON.stringify(promo.body))
    const [vs] = /** @type {[{ id: string }[], unknown]} */ (await t.migrate.pool.query("SELECT v.id FROM variants v JOIN products p ON p.id = v.product_id JOIN inventory_levels l ON l.variant_id = v.id WHERE p.status = 'active' AND v.enabled = 1 AND v.stock_mode = 'counted' AND l.on_hand - l.reserved >= 50 LIMIT 400"))
    const [[prod]] = /** @type {[{ handle: string, category_id: string }[], unknown]} */ (await t.migrate.pool.query("SELECT p.handle, p.primary_category_id AS category_id FROM products p WHERE p.status = 'active' AND p.handle LIKE 'perf-%' LIMIT 1"))
    const [[cat]] = /** @type {[{ handle: string }[], unknown]} */ (await t.migrate.pool.query('SELECT c.handle FROM categories c JOIN products p ON p.primary_category_id = c.id GROUP BY c.id ORDER BY COUNT(*) DESC LIMIT 1'))
    const listing = (await call('GET', `/products?category=${cat?.handle}&limit=1`)).body
    const facet = /** @type {{ key: string, values: { value: string }[] }[]} */ (listing.facets ?? []).find((f) => !['kind', 'size', 'color', 'inStock'].includes(f.key) && f.values.length)
    const [[ord]] = /** @type {[{ number: number, phone: string, token: string, id: string, sku: string }[], unknown]} */ (
      await t.migrate.pool.query("SELECT o.number, o.customer_phone AS phone, o.id, l.sku FROM orders o JOIN order_lines l ON l.order_id = o.id WHERE o.number = 200777 LIMIT 1")
    )
    pick = {
      category: cat?.handle ?? '', handle: prod?.handle ?? '', variants: vs.map((v) => v.id), attr: facet ? `attr.${facet.key}=${facet.values[0]?.value}` : '',
      orderNumber: `RB-${ord?.number}`, phone: String(ord?.phone), token: '', customerPhone: String(ord?.phone), sku: String(ord?.sku), entityId: String(ord?.id),
    }
    // a real order link: the token of an order made through the API
    const cart = (await call('POST', '/cart/lines', { body: { variantId: pick.variants[0], quantity: 1 } })).body.cartToken
    const placed = await call('POST', '/orders', { token: cart, headers: { 'idempotency-key': uuidv7() }, body: { customer: { name: 'Perf Buyer', phone: '03451239999' }, shippingAddress: { cityId: lahore[0]?.id, address: 'House 9, Street 4, Gulberg III' }, shippingMethodId: zone.body.methods[0].id, paymentMethod: 'cod' } })
    if (placed.status !== 201) throw new Error(JSON.stringify(placed.body))
    pick.token = placed.body.trackingToken
    delivery = { cityId: String(lahore[0]?.id), methodId: String(zone.body.methods[0].id) }
  }, 900_000)

  afterAll(async () => {
    writeFileSync(path.join(here, '..', '..', '..', '.data', 'perf-report.json'), JSON.stringify({ at: new Date().toISOString(), orders: ORDERS, p95Ms: measured }, null, 2))
    await closeHarness()
  })

  const lahore = () => delivery
  /** Fills a cart of `n` lines and returns its token. @param {number} n @param {number} [offset] */
  async function cartOf(n, offset = 0) {
    /** @type {string | undefined} */
    let token
    for (let i = 0; i < n; i++) token = (await call('POST', '/cart/lines', { ...(token ? { token } : {}), body: { variantId: pick.variants[(offset + i) % pick.variants.length], quantity: 1 } })).body.cartToken
    return /** @type {string} */ (token)
  }

  describe('the queries behind the listed paths use their indexes (DOC-13 section 6.3)', () => {
    it('the product listing: a category with an attribute filter, under each sort, with its facets', async () => {
      for (const sort of ['featured', 'newest', 'price_asc', 'price_desc', 'bestselling']) {
        await expectIndexed(`listing by ${sort}`, () => call('GET', `/products?category=${pick.category}${pick.attr ? `&${pick.attr}` : ''}&sort=${sort}&limit=24`))
      }
    }, 120_000)

    it('the size facet, text search, and a product by handle', async () => {
      await expectIndexed('size facet', () => call('GET', `/products?category=${pick.category}&size=M&limit=24`))
      await expectIndexed('text search', () => call('GET', '/products?q=lawn&limit=24'))
      await expectIndexed('product by handle', () => call('GET', `/products/${pick.handle}`))
    }, 120_000)

    it('a cart by its token, an order by number, by token hash, and by phone; orders by status and date', async () => {
      const token = await cartOf(1)
      await expectIndexed('cart by token', () => call('GET', '/cart', { token }))
      await expectIndexed('order by number', () => owner.call('GET', `/admin/orders/${pick.orderNumber}`))
      await expectIndexed('order by token hash', () => call('GET', `/orders/by-token/${pick.token}`))
      await expectIndexed('orders by status and date', () => owner.call('GET', '/admin/orders?status=confirmed&from=2026-01-01T00:00:00Z&sort=-placedAt'))
      await expectIndexed('orders by phone prefix', () => owner.call('GET', `/admin/orders?q=${pick.phone.replace('+92', '0').slice(0, 10)}`))
      await expectIndexed('orders by name prefix', () => owner.call('GET', '/admin/orders?q=Customer%201234'))
      await expectIndexed('the order tabs', () => owner.call('GET', '/admin/orders/counts'))
    }, 120_000)

    it('order lines by SKU, the audit log of one order, customers by phone prefix, and the job queue claim', async () => {
      await expectIndexed('order lines by sku', () => t.pool.query('SELECT id FROM order_lines WHERE sku = ?', [pick.sku]))
      await expectIndexed('audit list by entity', () => owner.call('GET', `/admin/audit?entityType=order&entityId=${pick.entityId}`))
      await expectIndexed('customers by phone prefix', () => owner.call('GET', `/admin/customers?q=${pick.customerPhone.replace('+92', '0').slice(0, 10)}`))
      await expectIndexed('the admin search', () => owner.call('GET', `/admin/search?q=${encodeURIComponent(pick.orderNumber)}`))
      // the claim runs inside a transaction on its own connection, so its select is built here the same way (platform/jobs.js) and explained
      await expectIndexed('the job claim', async () => {
        const at = new Date()
        const q = t.db.select({ id: jobs.id }).from(jobs).where(and(lte(jobs.runAt, at), or(isNull(jobs.lockedAt), lt(jobs.lockedAt, new Date(at.getTime() - 60_000))))).orderBy(jobs.runAt, jobs.id).limit(10).toSQL()
        captured.push({ sql: q.sql, values: q.params })
      })
    }, 120_000)
  })

  describe('the endpoints stay inside their budgets (DOC-13 section 6.2)', () => {
    /** @param {string} name @param {() => Promise<unknown>} fn */
    async function within(name, fn) {
      const ms = await p95(fn)
      measured[name] = Math.round(ms * 10) / 10
      expect(ms, `${name}: p95 ${ms.toFixed(1)} ms over its budget of ${budgets[name]} ms`).toBeLessThanOrEqual(/** @type {number} */ (budgets[name]))
    }

    it('the catalog', async () => {
      await within('catalog.listProducts', () => call('GET', `/products?category=${pick.category}${pick.attr ? `&${pick.attr}` : ''}&limit=24`))
      await within('catalog.getProduct', () => call('GET', `/products/${pick.handle}`))
    }, 300_000)

    it('the cart', async () => {
      const token = await cartOf(2)
      await within('cart.get', () => call('GET', '/cart', { token }))
      let i = 10
      await within('cart.addLine', async () => call('POST', '/cart/lines', { token: (await call('POST', '/cart/lines', { body: { variantId: pick.variants[i++ % pick.variants.length], quantity: 1 } })).body.cartToken, body: { variantId: pick.variants[i++ % pick.variants.length], quantity: 1 } }))
      await within('cart.quote', () => call('POST', '/cart/quote', { token, body: { cityId: lahore().cityId, shippingMethodId: lahore().methodId } }))
    }, 300_000)

    it('orders', async () => {
      let n = 0
      await within('orders.create', async () => {
        const token = await cartOf(3, ++n * 3)
        await call('PUT', '/cart/promo', { token, body: { code: 'PERF10' } })
        const start = performance.now()
        const r = await call('POST', '/orders', { token, headers: { 'idempotency-key': uuidv7() }, body: { customer: { name: 'Perf Buyer', phone: `0345${String(1000000 + n).slice(-7)}` }, shippingAddress: { cityId: lahore().cityId, address: 'House 9, Street 4, Gulberg III' }, shippingMethodId: lahore().methodId, paymentMethod: 'cod' } })
        expect(r.status).toBe(201)
        void start
      })
      await within('orders.getByToken', () => call('GET', `/orders/by-token/${pick.token}`))
    }, 400_000)

    it('the admin', async () => {
      await within('admin.orders.list', () => owner.call('GET', '/admin/orders?status=pending_confirmation&q=Customer%2012'))
      await within('admin.products.list', () => owner.call('GET', '/admin/products?status=active&size=50'))
      const day = (/** @type {number} */ back) => new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10)
      await within('admin.dashboard.summary', () => owner.call('GET', `/admin/dashboard/summary?from=${day(29)}&to=${day(0)}`))
      await within('admin.search', () => owner.call('GET', '/admin/search?q=Customer%2012'))
    }, 300_000)
  })
})
