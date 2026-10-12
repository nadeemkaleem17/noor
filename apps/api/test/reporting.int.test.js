// M4-11: what staff see to run the shop and what the browsers report, on a scratch database and through HTTP: the menu badges, the to-do cards, the sales figures worked out in SQL
// over days in Pakistan, the search box by permission, failed jobs, and the speed counters.
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { auditLog } from '../src/db/schema/audit.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { carts } from '../src/db/schema/cart.js'
import { pages, settings } from '../src/db/schema/content.js'
import { customers } from '../src/db/schema/customers.js'
import { reservations } from '../src/db/schema/inventory.js'
import { notificationLog } from '../src/db/schema/notifications.js'
import { orders } from '../src/db/schema/orders.js'
import { paymentEvents, payments } from '../src/db/schema/payments.js'
import { counters, idempotencyKeys, jobs, jobsDead, outboxEvents, rateLimitHits } from '../src/db/schema/platform.js'
import { products } from '../src/db/schema/products.js'
import { promoRedemptions, promos } from '../src/db/schema/promotions.js'
import { webVitalsDaily } from '../src/db/schema/reporting.js'
import { reviews } from '../src/db/schema/reviews.js'
import { searchMisses } from '../src/db/schema/search.js'
import { cities, couriers, shippingZones } from '../src/db/schema/shipping.js'
import { categories, formSchemas } from '../src/db/schema/taxonomy.js'
import { setClock } from '../src/platform/clock.js'
import { uuidv7 } from '../src/platform/ids.js'
import { createServices } from '../src/modules/services.js'
import { app, closeHarness, config, createHarness, signedIn, t } from './support/staff.js'
import { add, createShop, shop } from './support/shop.js'
import { dbAvailable } from './support/db.js'

const S = createShop()
/** @type {ReturnType<typeof createServices>} */
let svc
let tcs = ''
let seq = 0
const today = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10)
const plus = (/** @type {string} */ day, /** @type {number} */ n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

/** @param {{ variantId: string }} p @param {{ name?: string, quantity?: number }} [o] */
async function place(p, { name = 'Sana Malik', quantity = 1 } = {}) {
  const token = (await add(undefined, p.variantId, quantity)).body.cartToken
  const r = await shop('POST', '/orders', {
    token, headers: { 'idempotency-key': uuidv7() },
    body: { customer: { name, phone: `0300${String(2000000 + ++seq).slice(-7)}` }, shippingAddress: { cityId: S.cityId, address: 'House 12, Street 4, Gulberg III' }, shippingMethodId: S.methodId, paymentMethod: 'cod' },
  })
  if (r.status !== 201) throw new Error(JSON.stringify(r.body))
  const order = /** @type {typeof orders.$inferSelect} */ ((await t.db.select().from(orders)).find((o) => `${o.numberPrefix}-${o.number}` === r.body.orderNumber))
  return { id: order.id, number: /** @type {string} */ (r.body.orderNumber), order }
}

/** Orders made bare, at exact instants, so the days they fall on are known. @param {{ status: string, at: string, cancelReason?: string, n?: number }[]} rows */
async function bare(rows) {
  const conn = await t.migrate.pool.getConnection()
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS=0')
    for (const r of rows) {
      for (let i = 0; i < (r.n ?? 1); i++) {
        const id = uuidv7()
        await conn.query(
          'INSERT INTO orders (id, number, number_prefix, tracking_token_hash, status, cancel_reason, customer_id, customer_name, customer_phone, ship_city_id, ship_city, ship_address, shipping_method_label, eta_min_days, eta_max_days, subtotal_minor, shipping_fee_minor, total_minor, payment_method, placed_at, status_changed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 2, 100, 0, 100, ?, ?, ?, ?, ?)',
          [id, 900_000_000 + ++seq, 'RB', id.replaceAll('-', '').padEnd(64, '0'), r.status, r.cancelReason ?? null, uuidv7(), 'Bare Customer', '+923001234567', uuidv7(), 'Lahore', 'House 1', 'Standard', 'cod', r.at, r.at, r.at, r.at],
        )
      }
    }
  } finally {
    await conn.query('SET FOREIGN_KEY_CHECKS=1')
    conn.release()
  }
}

describe.skipIf(!dbAvailable)('reporting (MySQL, through HTTP)', () => {
  beforeAll(async () => {
    await createHarness()
    svc = createServices({ db: t.db, config })
  }, 60_000)
  afterAll(closeHarness)
  afterEach(async () => {
    setClock(null)
    await t.migrate.db.delete(auditLog)
    for (const table of [webVitalsDaily, searchMisses, jobsDead, reviews, notificationLog, outboxEvents, jobs, idempotencyKeys, rateLimitHits, paymentEvents, payments, reservations]) await t.db.delete(table)
    await t.db.delete(orders)
    for (const table of [carts, promoRedemptions, promos, customers]) await t.db.delete(table)
    await t.migrate.pool.query('DELETE FROM inventory_movements')
    for (const table of [products, formSchemas, shippingZones, cities, couriers, settings, pages, counters]) await t.db.delete(table)
    await t.migrate.pool.query('DELETE FROM categories WHERE parent_id IS NOT NULL')
    await t.db.delete(categories)
    await t.db.delete(staffUsers)
  })
  const ready = async () => {
    await S.setup()
    await S.delivery()
    tcs = (await S.owner.call('POST', '/admin/couriers', { body: { name: 'TCS', trackingRequired: false, enabled: true } })).body.id
  }
  const q = (/** @type {string} */ url, b = S.owner) => b.call('GET', `/admin${url}`)
  const range = (/** @type {string} */ from, /** @type {string} */ to) => `from=${from}&to=${to}`

  describe('the menu and the to-do cards', () => {
    it('count what waits, and the to-do for confirmation equals the orders tab; each card only for those who may see it', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 3 }) // one left once two are reserved: low stock
      const a = await place(p)
      await place(p)
      const sold = await S.product({ price: 100000, stock: 1 })
      await place(sold)
      await S.owner.call('POST', `/admin/orders/${a.id}/transitions`, { body: { version: 1, to: 'confirmed', via: 'call' } })

      const todo = (await q('/dashboard/todo')).body
      const tabs = (await q('/orders/counts')).body
      expect(todo.toConfirm.count).toBe(tabs.pending_confirmation)
      expect(todo.toConfirm.count).toBe(2)
      expect(Date.parse(todo.toConfirm.oldestAt)).toBeLessThanOrEqual(Date.now())
      expect(todo.toDispatch.count).toBe(1)
      expect(todo.soldOut.count).toBe(1)
      expect(todo.lowStock.count).toBe(1)
      expect(todo).toMatchObject({ reviewsPending: { count: 0 }, failedJobs: { count: 0 } })
      expect(todo.awaitingPayment).toBeUndefined() // only cash on delivery is on
      expect((await q('/nav/counts')).body).toEqual({ ordersNeedingAction: 3, reviewsPending: 0 })
      // with reviews switched off in the store settings the menu has no Reviews: its count is not given
      const store = (await S.owner.call('GET', '/admin/settings/store')).body
      const off = await S.owner.call('PUT', '/admin/settings/store', { body: { value: { ...store.value, features: { ...store.value.features, reviews: false } }, version: store.version } })
      expect(off.status).toBe(200)
      expect((await q('/nav/counts')).body).toEqual({ ordersNeedingAction: 3 })
      await S.owner.call('PUT', '/admin/settings/store', { body: { value: store.value, version: off.body.version } })

      const catalog = (await signedIn('catalog')).b
      const theirs = (await q('/dashboard/todo', catalog)).body
      expect(theirs.toConfirm).toBeUndefined()
      expect(theirs.soldOut).toEqual({ count: 1 })
      expect((await q('/nav/counts', catalog)).body.ordersNeedingAction).toBeUndefined()
    }, 120_000)

    it('a made-to-order piece is not waiting to be dispatched while its making time runs; awaiting payment shows once a prepaid method is on', async () => {
      await ready()
      const mto = await S.product({ price: 1000000, kind: 'made_to_order', mode: 'made_to_order', mto: true })
      const token = (await add(undefined, mto.variantId, 1)).body.cartToken
      await S.owner.call('PUT', '/admin/settings/payments', { body: { value: { methods: [{ type: 'cod', enabled: true, label: 'Cash', sortOrder: 0 }, { type: 'bank_transfer', enabled: true, label: 'Bank', sortOrder: 1 }], bankTransfer: { accountTitle: 'Rubaya', bank: 'HBL', accountNumber: 'PK00HABB0000000000', instructions: 'Thank you' } }, version: 0 } })
      const r = await shop('POST', '/orders', {
        token, headers: { 'idempotency-key': uuidv7() },
        body: { customer: { name: 'Sana Malik', phone: '03001234567' }, shippingAddress: { cityId: S.cityId, address: 'House 12, Street 4, Gulberg III' }, shippingMethodId: S.methodId, paymentMethod: 'bank_transfer' },
      })
      expect(r.status).toBe(201)
      expect((await q('/dashboard/todo')).body.awaitingPayment).toEqual({ count: 1 })
      const id = /** @type {string} */ ((await t.db.select().from(orders))[0]?.id)
      await S.owner.call('POST', `/admin/orders/${id}/payments`, { body: { kind: 'deposit', amount: { amount: 300000, currency: 'PKR' }, method: 'cash' }, headers: { 'idempotency-key': uuidv7() } })
      const todo = (await q('/dashboard/todo')).body
      expect(todo.toDispatch.count).toBe(0) // confirmed by the deposit, but the piece is still being made
      expect(todo.awaitingPayment).toEqual({ count: 0 })
    }, 120_000)
  })

  describe('sales', () => {
    it('net sales is the sum of the orders placed, leaving out cancelled and returned ones; orders leave out cancelled; the figures equal a hand-written sum', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 9 })
      const a = await place(p)
      await place(p)
      const c = await place(p)
      await S.owner.call('POST', `/admin/orders/${c.id}/transitions`, { body: { version: 1, to: 'cancelled', reason: 'duplicate' } })
      const day = today()
      const s = (await q(`/dashboard/summary?${range(day, day)}`)).body
      const [sum] = /** @type {{ n: string }[]} */ ((await t.migrate.pool.query("select coalesce(sum(total_minor), 0) as n from orders where status not in ('cancelled', 'returned')"))[0])
      expect(s.current.netSales.amount).toBe(Number(sum?.n))
      expect(s.current).toMatchObject({ netSales: { amount: 450000 }, orders: 2, averageOrder: { amount: 225000 } })
      expect(s.current.deliveredRate).toBeUndefined() // too few finished orders to say
      expect(s.current.cancelledByReason).toEqual({ duplicate: 1 })
      expect(s.previous).toMatchObject({ netSales: { amount: 0 }, orders: 0 })
      expect(s.bucket).toBe('day')
      expect(s.byDay).toEqual([{ day, sales: { amount: 450000, currency: 'PKR' }, orders: 2 }])
      expect(a.id).toBeTruthy()
    }, 120_000)

    it('days are Pakistan days: an order at 00:30 in Pakistan is the next day, and the rates appear once 20 orders are final', async () => {
      await ready()
      await bare([
        { status: 'confirmed', at: '2026-03-10 18:30:00' }, // 23:30 on the 10th in Pakistan
        { status: 'confirmed', at: '2026-03-10 19:30:00' }, // 00:30 on the 11th
        { status: 'delivered', at: '2026-03-11 06:00:00', n: 20 },
        { status: 'cancelled', cancelReason: 'unreachable', at: '2026-03-11 07:00:00', n: 5 },
      ])
      const s = (await q(`/dashboard/summary?${range('2026-03-10', '2026-03-11')}`)).body
      expect(s.byDay).toEqual([{ day: '2026-03-10', sales: { amount: 100, currency: 'PKR' }, orders: 1 }, { day: '2026-03-11', sales: { amount: 2100, currency: 'PKR' }, orders: 21 }])
      expect(s.current).toMatchObject({ orders: 22, netSales: { amount: 2200 } })
      expect(s.current.deliveredRate).toBeCloseTo(20 / 25)
      expect(s.current.cancelledRate).toBeCloseTo(5 / 25)
      expect(s.current.cancelledByReason).toEqual({ unreachable: 5 })
      // the period before is the two days before it
      expect((await q(`/dashboard/summary?${range('2026-03-12', '2026-03-13')}`)).body.previous.orders).toBe(22)
    }, 120_000)

    it('a long range is shown by the week, Monday to Sunday, and the weeks add up to the whole', async () => {
      await ready()
      await bare([{ status: 'confirmed', at: '2026-03-02 06:00:00', n: 2 }, { status: 'confirmed', at: '2026-03-11 06:00:00' }, { status: 'confirmed', at: '2026-04-05 06:00:00' }]) // a Monday, a Wednesday, a Sunday
      const s = (await q(`/dashboard/summary?${range('2026-03-01', '2026-04-12')}`)).body
      expect(s.bucket).toBe('week')
      expect(s.byDay[0].day).toBe('2026-02-23') // the Monday of the week of the 1st
      expect(s.byDay.every((/** @type {{ day: string }} */ d) => new Date(`${d.day}T00:00:00Z`).getUTCDay() === 1)).toBe(true)
      expect(s.byDay.find((/** @type {{ day: string }} */ d) => d.day === '2026-03-02')).toMatchObject({ orders: 2 })
      expect(s.byDay.find((/** @type {{ day: string }} */ d) => d.day === '2026-03-09')).toMatchObject({ orders: 1 })
      expect(s.byDay.find((/** @type {{ day: string }} */ d) => d.day === '2026-03-30')).toMatchObject({ orders: 1 }) // Sunday the 5th belongs to the week of the 30th
      expect(s.byDay.reduce((/** @type {number} */ n, /** @type {{ sales: { amount: number } }} */ d) => n + d.sales.amount, 0)).toBe(s.current.netSales.amount)
    }, 90_000)

    it('refuses a range that runs backwards or past a year, and a person who may not read orders', async () => {
      await ready()
      expect((await q(`/dashboard/summary?${range('2026-03-12', '2026-03-10')}`)).status).toBe(400)
      expect((await q(`/dashboard/summary?${range('2025-01-01', '2026-03-10')}`)).status).toBe(400)
      expect((await q('/dashboard/summary?from=yesterday&to=today')).status).toBe(400)
      const catalog = (await signedIn('catalog')).b
      expect((await q(`/dashboard/summary?${range('2026-03-10', '2026-03-11')}`, catalog)).status).toBe(403)
      expect((await q(`/dashboard/top-products?${range('2026-03-10', '2026-03-11')}`, catalog)).status).toBe(403)
    }, 60_000)

    it('top products by net sales with units and a picture where there is one; cancelled orders do not count', async () => {
      await ready()
      const a = await S.product({ price: 300000, stock: 9, title: 'Alpha dress' })
      const b = await S.product({ price: 100000, stock: 9, title: 'Beta scarf' })
      await place(a, { quantity: 2 })
      await place(b)
      const gone = await place(a)
      await S.owner.call('POST', `/admin/orders/${gone.id}/transitions`, { body: { version: 1, to: 'cancelled', reason: 'duplicate' } })
      const day = today()
      const top = (await q(`/dashboard/top-products?${range(day, day)}&limit=5`)).body
      expect(top.items).toMatchObject([{ productId: a.productId, title: 'Alpha dress', units: 2, sales: { amount: 600000 } }, { productId: b.productId, title: 'Beta scarf', units: 1, sales: { amount: 100000 } }])
      expect((await q(`/dashboard/top-products?${range(day, day)}&limit=1`)).body.items).toHaveLength(1)
      expect((await q(`/dashboard/top-products?${range(day, day)}&limit=21`)).status).toBe(400)
    }, 120_000)

    it('searches that found nothing, most asked first, within the days asked', async () => {
      await ready()
      await t.db.insert(searchMisses).values([
        { day: '2026-03-10', query: 'silk shawl', count: 3 }, { day: '2026-03-11', query: 'silk shawl', count: 4 }, { day: '2026-03-11', query: 'bridal', count: 5 }, { day: '2026-03-20', query: 'later', count: 9 },
      ])
      const r = (await q(`/dashboard/zero-searches?${range('2026-03-10', '2026-03-12')}`)).body
      expect(r.items).toEqual([{ query: 'silk shawl', count: 7 }, { query: 'bridal', count: 5 }])
      expect((await q(`/dashboard/zero-searches?${range('2026-03-10', '2026-03-12')}&limit=1`)).body.items).toHaveLength(1)
    }, 60_000)
  })

  describe('the search box', () => {
    it('finds orders by number, tracking number, name and phone; products by title, handle and SKU; customers by name and phone', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 5, title: 'Embroidered lawn' })
      const o = await place(p, { name: 'Sana Malik' })
      await S.owner.call('POST', `/admin/orders/${o.id}/transitions`, { body: { version: 1, to: 'confirmed', via: 'call' } })
      await S.owner.call('POST', `/admin/orders/${o.id}/transitions`, { body: { version: 2, to: 'dispatched', courierId: tcs, trackingNumber: 'TCS-7788' } })
      const phone = /** @type {string} */ (o.order.customerPhone).replace('+92', '0')
      const find = async (/** @type {string} */ text) => (await q(`/search?q=${encodeURIComponent(text)}`)).body

      expect((await find(o.number)).orders.map((/** @type {{ id: string }} */ r) => r.id)).toEqual([o.id])
      expect((await find(o.number.split('-')[1] ?? '')).orders).toHaveLength(1)
      expect((await find('TCS-7788')).orders).toHaveLength(1)
      expect((await find('sana')).orders).toHaveLength(1)
      expect((await find('sana')).customers).toMatchObject([{ name: 'Sana Malik', ordersCount: 1 }])
      expect((await find(phone.slice(0, 7))).orders).toHaveLength(1)
      expect((await find(phone.slice(0, 7))).customers).toHaveLength(1)
      expect((await find('Embroid')).products).toMatchObject([{ id: p.productId, title: 'Embroidered lawn' }])
      const bySku = (await find(p.sku)).products
      expect(bySku).toMatchObject([{ id: p.productId, sku: p.sku }])
      expect((await find('nothing at all')).orders).toEqual([])
      expect((await q('/search?q=a')).status).toBe(400)
      expect((await find('%%')).orders).toEqual([]) // a wildcard is only a character
    }, 120_000)

    it('gives each section only to those who may see it: a catalog user gets products, a viewer gets orders by number but no names, no customers', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 5, title: 'Embroidered lawn' })
      const o = await place(p, { name: 'Sana Malik' })
      const catalog = (await signedIn('catalog')).b
      const viewer = (await signedIn('viewer')).b
      const c = (await q('/search?q=sana', catalog)).body
      expect(c).toEqual({ orders: [], products: [], customers: [] })
      expect((await q('/search?q=embroid', catalog)).body).toMatchObject({ orders: [], customers: [], products: [{ title: 'Embroidered lawn' }] })
      expect((await q('/search?q=sana', viewer)).body).toEqual({ orders: [], products: [], customers: [] }) // a name is no way in without seeing it
      const byNumber = (await q(`/search?q=${o.number}`, viewer)).body
      expect(byNumber.orders).toMatchObject([{ id: o.id, customerName: 'Sana M.' }])
      expect(byNumber.customers).toEqual([])
    }, 90_000)
  })

  describe('jobs and the system', () => {
    it('failed jobs are listed and one can be sent back to the queue; only by someone who may manage', async () => {
      await ready()
      const at = new Date()
      const id = uuidv7()
      await t.db.insert(jobsDead).values({ id, type: 'notify.order', payload: { type: 'order.placed', payload: { orderId: uuidv7() } }, uniqueKey: 'event:x:notify.order', runAt: at, attempts: 8, maxAttempts: 8, lastError: 'connection refused', createdAt: at, diedAt: at })
      await t.db.insert(jobsDead).values({ id: uuidv7(), type: 'media.process', payload: {}, runAt: at, attempts: 8, maxAttempts: 8, createdAt: at, diedAt: new Date(at.getTime() - 1000) })
      const list = (await q('/jobs/dead')).body
      expect(list).toMatchObject({ total: 2, items: [{ id, type: 'notify.order', attempts: 8, lastError: 'connection refused' }, { type: 'media.process' }] })
      expect((await q('/jobs/dead?type=media.process')).body.total).toBe(1)
      expect((await q('/dashboard/todo')).body.failedJobs.count).toBe(2)

      const support = (await signedIn('support')).b
      expect((await support.call('POST', `/admin/jobs/dead/${id}/retry`)).status).toBe(403)
      await t.migrate.db.delete(auditLog)
      expect((await S.owner.call('POST', `/admin/jobs/dead/${id}/retry`)).status).toBe(204)
      expect((await q('/jobs/dead')).body.total).toBe(1)
      expect(await t.db.select().from(jobs).where(eq(jobs.type, 'notify.order'))).toMatchObject([{ attempts: 0, maxAttempts: 8 }])
      expect((await t.db.select().from(auditLog)).filter((a) => a.action === 'job.retried')).toHaveLength(1)
      expect((await S.owner.call('POST', `/admin/jobs/dead/${id}/retry`)).status).toBe(404)
    }, 90_000)

    it('the system page counts the queue and shows the age of the oldest job waiting', async () => {
      await ready()
      expect((await q('/system')).body).toMatchObject({ environment: config.APP_ENV, queue: { pending: 0, dead: 0 } })
      await t.db.insert(jobs).values({ id: uuidv7(), type: 'noop', payload: {}, runAt: new Date(Date.now() - 120_000), attempts: 0, maxAttempts: 8, createdAt: new Date() })
      const sys = (await q('/system')).body
      expect(sys.queue.pending).toBe(1)
      expect(sys.queue.oldestPendingAgeSec).toBeGreaterThanOrEqual(119)
    }, 60_000)
  })

  describe('what sells, nightly', () => {
    it('the units of delivered orders of the last 90 days become each product\'s sales count; later returns and old orders do not', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 9 })
      const o = await place(p, { quantity: 3 })
      await S.owner.call('POST', `/admin/orders/${o.id}/transitions`, { body: { version: 1, to: 'confirmed', via: 'call' } })
      await S.owner.call('POST', `/admin/orders/${o.id}/transitions`, { body: { version: 2, to: 'dispatched', courierId: tcs } })
      await S.owner.call('POST', `/admin/orders/${o.id}/transitions`, { body: { version: 3, to: 'delivered', cashReceived: true } })
      const units = async () => (await t.db.select({ n: products.salesCount }).from(products).where(eq(products.id, p.productId)))[0]?.n
      expect(await units()).toBe(0)
      await svc.reporting.salesCounts()
      expect(await units()).toBe(3)
      setClock(new Date(Date.now() + 91 * 86_400_000))
      await svc.reporting.salesCounts()
      expect(await units()).toBe(0)
    }, 120_000)
  })

  describe('what the browsers say', () => {
    const post = (/** @type {string} */ url, /** @type {object} */ body) => app.inject({ method: 'POST', url: `/api/v1${url}`, remoteAddress: `10.8.${Math.floor(++seq / 250)}.${(seq % 250) + 1}`, payload: body })

    it('speeds are counted by day, page and size bucket, with nothing about who; the 75th percentile comes from the counts', async () => {
      await ready()
      for (const v of [900, 1000, 1050, 5000]) expect((await post('/vitals', { name: 'LCP', value: v, route: 'product' })).statusCode).toBe(204)
      expect((await post('/vitals', { name: 'CLS', value: 0.123, route: 'Cart' })).statusCode).toBe(204)
      expect((await post('/vitals', { name: 'INP', value: 150, route: 'some/odd/page', navigationType: 'navigate' })).statusCode).toBe(204)
      const rows = await t.db.select().from(webVitalsDaily)
      expect(rows.find((r) => r.route === 'product' && r.metric === 'LCP' && r.bucket === 9)).toMatchObject({ count: 1, day: today() }) // 900 ms
      expect(rows.find((r) => r.route === 'product' && r.metric === 'LCP' && r.bucket === 10)?.count).toBe(2) // 1000 and 1050
      expect(rows.find((r) => r.route === 'cart' && r.metric === 'CLS')?.bucket).toBe(12)
      expect(rows.find((r) => r.metric === 'INP')?.route).toBe('other')
      expect(await svc.reporting.p75('product', 'LCP')).toEqual({ samples: 4, p75: 1100 }) // three of four are within the 1000-1100 ms bucket
      expect(await svc.reporting.p75('home', 'LCP')).toEqual({ samples: 0 })
      expect((await post('/vitals', { name: 'LCP', value: -1, route: 'home' })).statusCode).toBe(400)
      expect((await post('/vitals', { name: 'FID', value: 5, route: 'home' })).statusCode).toBe(400)
      expect((await post('/vitals', { name: 'LCP', value: 5, route: 'home', userId: 'someone' })).statusCode).toBe(400)
      // far out values land in the last bucket instead of making new ones
      await post('/vitals', { name: 'LCP', value: 600_000, route: 'home' })
      expect((await t.db.select().from(webVitalsDaily).where(eq(webVitalsDaily.route, 'home')))[0]?.bucket).toBe(100)
    }, 60_000)

    it('counts older than 180 days are removed', async () => {
      await ready()
      await t.db.insert(webVitalsDaily).values([{ day: plus(today(), -181), route: 'home', metric: 'LCP', bucket: 5, count: 4 }, { day: plus(today(), -10), route: 'home', metric: 'LCP', bucket: 5, count: 4 }])
      await svc.reporting.cleanup()
      expect((await t.db.select().from(webVitalsDaily)).map((r) => r.day)).toEqual([plus(today(), -10)])
    }, 60_000)

    it('a browser error is accepted and cut to size; one with extra fields or no release is not', async () => {
      await ready()
      const ok = await post('/client-errors', { message: 'x'.repeat(5000), stack: 'y'.repeat(9000), route: '/orders/abc', app: 'storefront', release: 'abc1234' })
      expect(ok.statusCode).toBe(204)
      expect((await post('/client-errors', { message: 'boom', route: '/', app: 'admin', release: 'abc1234', email: 'a@b.c' })).statusCode).toBe(400)
      expect((await post('/client-errors', { message: 'boom', route: '/', app: 'phone', release: 'abc1234' })).statusCode).toBe(400)
      expect((await post('/client-errors', { message: 'boom', route: '/', app: 'admin' })).statusCode).toBe(400)
    }, 60_000)
  })
})
