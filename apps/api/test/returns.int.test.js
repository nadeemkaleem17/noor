// Return and exchange requests (plan/10-api/10-returns.md; RT-02 to RT-04): the customer asks through the order's link, staff decide in the admin.
// On a scratch database, through HTTP.
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { auditLog } from '../src/db/schema/audit.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { carts } from '../src/db/schema/cart.js'
import { pages, settings } from '../src/db/schema/content.js'
import { customers } from '../src/db/schema/customers.js'
import { reservations } from '../src/db/schema/inventory.js'
import { orderLines, orders } from '../src/db/schema/orders.js'
import { paymentEvents, payments } from '../src/db/schema/payments.js'
import { counters, idempotencyKeys, jobs, outboxEvents, rateLimitHits } from '../src/db/schema/platform.js'
import { products } from '../src/db/schema/products.js'
import { promoRedemptions, promos } from '../src/db/schema/promotions.js'
import { returnRequestLines, returnRequests } from '../src/db/schema/returns.js'
import { cities, couriers, shippingZones } from '../src/db/schema/shipping.js'
import { categories, formSchemas } from '../src/db/schema/taxonomy.js'
import { setClock } from '../src/platform/clock.js'
import { transaction } from '../src/platform/db.js'
import { uuidv7 } from '../src/platform/ids.js'
import { createServices } from '../src/modules/services.js'
import { closeHarness, config, createHarness, signedIn, t } from './support/staff.js'
import { add, createShop, shop } from './support/shop.js'
import { dbAvailable } from './support/db.js'

const S = createShop()
/** @type {ReturnType<typeof createServices>} */
let svc
const staff = { type: /** @type {const} */ ('staff'), id: '', label: 'Hina Owner', role: 'owner' }
let tcs = ''
let seq = 0

const go = (/** @type {string} */ id, /** @type {object} */ change) => transaction(t.db, (tx) => svc.orders.transition(tx, id, /** @type {never} */ (change), staff))

/** An order placed through the shop, with one line of the given quantity. @param {{ variantId: string }} p @param {number} [quantity] */
async function placed(p, quantity = 2) {
  const phone = `0300${String(1000000 + ++seq).slice(-7)}`
  const cart = (await add(undefined, p.variantId, quantity)).body.cartToken
  const r = await shop('POST', '/orders', {
    token: cart, headers: { 'idempotency-key': uuidv7() },
    body: { customer: { name: 'Sana Malik', phone }, shippingAddress: { cityId: S.cityId, address: 'House 12, Street 4, Gulberg III' }, shippingMethodId: S.methodId, paymentMethod: 'cod' },
  })
  if (r.status !== 201) throw new Error(JSON.stringify(r.body))
  const order = /** @type {typeof orders.$inferSelect} */ ((await t.db.select().from(orders)).find((o) => `${o.numberPrefix}-${o.number}` === r.body.orderNumber))
  const [line] = await t.db.select().from(orderLines).where(eq(orderLines.orderId, order.id))
  return {
    order, token: /** @type {string} */ (r.body.trackingToken), lineId: /** @type {string} */ (line?.id),
    async deliver() {
      await go(order.id, { version: 1, to: 'confirmed', via: 'call' })
      await go(order.id, { version: 2, to: 'dispatched', courierId: tcs })
      await go(order.id, { version: 3, to: 'delivered', cashReceived: true })
      return this
    },
  }
}
const page = (/** @type {{ token: string }} */ o) => shop('GET', `/orders/by-token/${o.token}`)
const ask = (/** @type {{ token: string, lineId: string }} */ o, /** @type {object} */ over = {}) =>
  shop('POST', `/orders/by-token/${o.token}/returns`, { body: { kind: 'return', reason: 'wrong_size', lines: [{ lineId: o.lineId, quantity: 1 }], ...over } })
const update = (/** @type {string} */ id, /** @type {object} */ body) => S.owner.call('POST', `/admin/returns/${id}/update`, { body })
const queue = (/** @type {string} */ qs = '') => S.owner.call('GET', `/admin/returns${qs}`)
const setDays = async (/** @type {number | undefined} */ days) => {
  const cur = (await S.owner.call('GET', '/admin/settings/store')).body
  const policies = { ...cur.value.policies }
  if (days === undefined) delete policies.returnsDays
  else policies.returnsDays = days
  const r = await S.owner.call('PUT', '/admin/settings/store', { body: { value: { ...cur.value, policies }, version: cur.version } })
  if (r.status !== 200) throw new Error(JSON.stringify(r.body))
}

describe.skipIf(!dbAvailable)('return requests (MySQL, through HTTP)', () => {
  beforeAll(async () => {
    await createHarness()
    svc = createServices({ db: t.db, config })
  }, 60_000)
  afterAll(closeHarness)
  afterEach(async () => {
    setClock(null)
    await t.migrate.db.delete(auditLog)
    await t.db.delete(returnRequestLines)
    await t.db.delete(returnRequests)
    await t.db.delete(outboxEvents)
    await t.db.delete(jobs)
    await t.db.delete(idempotencyKeys)
    await t.db.delete(rateLimitHits)
    await t.db.delete(paymentEvents)
    await t.db.delete(payments)
    await t.db.delete(reservations)
    await t.db.delete(orders)
    await t.db.delete(carts)
    await t.db.delete(promoRedemptions)
    await t.db.delete(promos)
    await t.db.delete(customers)
    await t.migrate.pool.query('DELETE FROM inventory_movements')
    await t.db.delete(products)
    await t.db.delete(formSchemas)
    await t.db.delete(shippingZones)
    await t.db.delete(cities)
    await t.db.delete(couriers)
    await t.db.delete(settings)
    await t.db.delete(pages)
    await t.db.delete(counters)
    await t.migrate.pool.query('DELETE FROM categories WHERE parent_id IS NOT NULL')
    await t.db.delete(categories)
    await t.db.delete(staffUsers)
  })
  const ready = async (days = 7) => {
    await S.setup()
    staff.id = /** @type {{ id: string }} */ ((await t.db.select().from(staffUsers))[0]).id
    await S.delivery()
    tcs = (await S.owner.call('POST', '/admin/couriers', { body: { name: 'TCS', trackingRequired: false, enabled: true } })).body.id
    await setDays(days)
  }

  it('is not offered until the order is delivered, and not at all while the shop takes no requests', async () => {
    await ready()
    const o = await placed(await S.product({ price: 200000, stock: 9 }))
    expect((await page(o)).body.returns).toMatchObject({ windowDays: 7, requests: [] })
    expect((await page(o)).body.returns.eligibleUntil).toBeUndefined()
    expect((await page(o)).body.lines[0].returnable).toBeUndefined()
    expect(await ask(o)).toMatchObject({ status: 409, body: { code: 'action_not_allowed' } })
    await o.deliver()
    const open = (await page(o)).body
    expect(open.returns.eligibleUntil).toEqual(expect.any(String))
    expect(open.lines[0].returnable).toBe(2)
    await setDays(undefined)
    expect((await page(o)).body.returns).toBeUndefined()
    expect(await ask(o)).toMatchObject({ status: 409, body: { code: 'action_not_allowed' } })
  }, 90_000)

  it('records the request with its lines, shows it on the order page and takes what it asked for off the offer', async () => {
    await ready()
    const o = await (await placed(await S.product({ price: 200000, stock: 9 }))).deliver()
    const sent = await ask(o, { kind: 'exchange', reason: 'wrong_size', note: 'Too tight at the waist', exchangeNote: 'Size L' })
    expect(sent).toMatchObject({ status: 201, body: { number: 'RR-0001' } })
    const after = (await page(o)).body
    expect(after.lines[0].returnable).toBe(1)
    expect(after.returns.requests).toEqual([
      expect.objectContaining({ number: 'RR-0001', kind: 'exchange', status: 'requested', reason: 'wrong_size', lines: [expect.objectContaining({ quantity: 1 })] }),
    ])
    // the other piece can still be asked for, the same piece cannot be asked for twice
    expect((await ask(o)).status).toBe(201)
    expect(await ask(o)).toMatchObject({ status: 400, body: { code: 'validation_failed', issues: [{ path: 'lines.0.quantity', code: 'too_big' }] } })
    expect((await page(o)).body.returns.eligibleUntil).toBeUndefined() // nothing is left to ask for
    const [row] = await t.db.select().from(returnRequests).where(eq(returnRequests.number, 1))
    expect(row).toMatchObject({ kind: 'exchange', exchangeNote: 'Size L', note: 'Too tight at the waist' })
  }, 90_000)

  it('refuses a line of another order, a quantity too large, the same line twice, and an expired window', async () => {
    await ready()
    const p = await S.product({ price: 200000, stock: 20 })
    const a = await (await placed(p)).deliver()
    const b = await (await placed(p)).deliver()
    expect(await ask(a, { lines: [{ lineId: b.lineId, quantity: 1 }] })).toMatchObject({ status: 400, body: { issues: [{ path: 'lines.0.lineId' }] } })
    expect(await ask(a, { lines: [{ lineId: a.lineId, quantity: 3 }] })).toMatchObject({ status: 400, body: { issues: [{ path: 'lines.0.quantity', code: 'too_big' }] } })
    expect(await ask(a, { lines: [{ lineId: a.lineId, quantity: 1 }, { lineId: a.lineId, quantity: 1 }] })).toMatchObject({ status: 400, body: { issues: [{ path: 'lines.1.lineId' }] } })
    expect(await ask(a, { reason: 'because' })).toMatchObject({ status: 400 })
    expect(await t.db.select().from(returnRequests)).toEqual([])
    setClock(new Date(Date.now() + 8 * 86_400_000))
    expect(await ask(a)).toMatchObject({ status: 409, body: { code: 'action_not_allowed' } })
    expect((await page(a)).body.returns.eligibleUntil).toBeUndefined()
  }, 90_000)

  it('never offers a made-to-measure line', async () => {
    await ready()
    const o = await (await placed(await S.product({ price: 200000, stock: 9 }))).deliver()
    expect((await page(o)).body.lines[0].variantId).toEqual(expect.any(String)) // "Buy again" is offered for it
    await t.db.update(orderLines).set({ customization: { measurements: { bust: 90 } } }).where(eq(orderLines.id, o.lineId))
    expect((await page(o)).body.lines[0].returnable).toBeUndefined()
    expect((await page(o)).body.lines[0].variantId).toBeUndefined() // nor can it be bought again as it was
    expect(await ask(o)).toMatchObject({ status: 400, body: { issues: [{ path: 'lines.0.quantity', code: 'too_big' }] } })
  }, 90_000)

  describe('the queue', () => {
    it('lists requests newest first with the order and its lines, and counts by status', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 20 })
      const a = await (await placed(p)).deliver()
      const b = await (await placed(p)).deliver()
      await ask(a)
      await ask(b, { kind: 'exchange', exchangeNote: 'Size M' })
      const q = (await queue()).body
      expect(q.counts).toMatchObject({ requested: 2, approved: 0 })
      expect(q.items.map((/** @type {{ number: string }} */ r) => r.number)).toEqual(['RR-0002', 'RR-0001'])
      expect(q.items[0]).toMatchObject({ kind: 'exchange', exchangeNote: 'Size M', customerName: 'Sana Malik', next: ['approved', 'declined'], lines: [{ quantity: 1, lineTotal: { amount: 200000 } }] })
      expect((await queue('?status=approved')).body.items).toEqual([])
      expect((await queue(`?orderId=${a.order.id}`)).body.items).toHaveLength(1)
    }, 90_000)

    it('moves a request through approve, receive and complete, with a pickup day and a refund; the customer sees it', async () => {
      await ready()
      const o = await (await placed(await S.product({ price: 200000, stock: 9 }))).deliver()
      await ask(o)
      const id = (await queue()).body.items[0].id
      expect(await update(id, { status: 'completed' })).toMatchObject({ status: 409, body: { code: 'action_not_allowed' } })
      const approved = await update(id, { status: 'approved', decisionNote: 'Send it back unwashed', pickupOn: '2026-11-02' })
      expect(approved).toMatchObject({ status: 200, body: { status: 'approved', decisionNote: 'Send it back unwashed', pickupOn: '2026-11-02', decidedBy: expect.any(String), next: ['received', 'completed', 'declined'] } })
      await update(id, { status: 'received' })
      const done = await update(id, { status: 'completed', refund: 200000 })
      expect(done.body).toMatchObject({ status: 'completed', refund: { amount: 200000, currency: 'PKR' }, next: [] })
      expect(await update(id, { status: 'declined', decisionNote: 'late' })).toMatchObject({ status: 409 })
      expect((await page(o)).body.returns.requests[0]).toMatchObject({ status: 'completed', pickupOn: '2026-11-02', refund: { amount: 200000 }, decisionNote: 'Send it back unwashed' })
      const log = (await t.db.select().from(auditLog)).filter((l) => l.entityType === 'return_request')
      expect(log.map((l) => l.action).sort()).toEqual(['return_request.approved', 'return_request.completed', 'return_request.received'])
      expect(log.find((l) => l.action === 'return_request.completed')?.category).toBe('money')
    }, 90_000)

    it('needs a reason to decline, refuses a refund above the order total, and a declined request frees its pieces', async () => {
      await ready()
      const o = await (await placed(await S.product({ price: 200000, stock: 9 }))).deliver()
      await ask(o, { lines: [{ lineId: o.lineId, quantity: 2 }] })
      const id = (await queue()).body.items[0].id
      expect(await update(id, { status: 'declined' })).toMatchObject({ status: 400, body: { issues: [{ path: 'decisionNote', code: 'required' }] } })
      expect(await update(id, { status: 'approved', refund: 99_999_999 })).toMatchObject({ status: 400, body: { issues: [{ path: 'refund', code: 'too_big' }] } })
      expect(await update(id, { status: 'received', pickupOn: '2026-11-02' })).toMatchObject({ status: 409 }) // not approved yet: a bad step is refused before its fields
      expect((await page(o)).body.lines[0].returnable).toBeUndefined() // both pieces are in the request
      expect(await update(id, { status: 'declined', decisionNote: 'Worn and washed' })).toMatchObject({ status: 200, body: { status: 'declined' } })
      expect((await page(o)).body.lines[0].returnable).toBe(2)
      expect((await page(o)).body.returns.requests[0]).toMatchObject({ status: 'declined', decisionNote: 'Worn and washed' })
    }, 90_000)

    it('is for people who may see orders and return them', async () => {
      await ready()
      const { b: viewer } = await signedIn('viewer')
      expect((await viewer.call('GET', '/admin/returns')).status).toBe(200)
      expect((await viewer.call('POST', `/admin/returns/${uuidv7()}/update`, { body: { status: 'approved' } })).status).toBe(403)
      expect((await S.owner.call('POST', `/admin/returns/${uuidv7()}/update`, { body: { status: 'approved' } })).status).toBe(404)
    }, 90_000)
  })
})
