// M4-06: money in and out of orders, on a scratch database: the rows an order starts with, payments and refunds recorded by staff, cash at the door,
// what a cancel or a return owes back, orders nobody paid for, and a gateway's signed callback (a fake one that behaves like the real ones will).
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { auditLog } from '../src/db/schema/audit.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { carts } from '../src/db/schema/cart.js'
import { pages, settings } from '../src/db/schema/content.js'
import { customers } from '../src/db/schema/customers.js'
import { inventoryLevels, reservations } from '../src/db/schema/inventory.js'
import { orderEvents, orderLines, orders } from '../src/db/schema/orders.js'
import { paymentEvents, payments } from '../src/db/schema/payments.js'
import { counters, idempotencyKeys, jobs, outboxEvents, rateLimitHits } from '../src/db/schema/platform.js'
import { products } from '../src/db/schema/products.js'
import { promoRedemptions, promos } from '../src/db/schema/promotions.js'
import { cities, couriers, shippingZones } from '../src/db/schema/shipping.js'
import { categories, formSchemas } from '../src/db/schema/taxonomy.js'
import { setClock } from '../src/platform/clock.js'
import { transaction } from '../src/platform/db.js'
import { uuidv7 } from '../src/platform/ids.js'
import { createProviders, fakeProvider, signedFakeEvent } from '../src/modules/payments/index.js'
import { createServices } from '../src/modules/services.js'
import { app, closeHarness, config, createHarnessWith, t } from './support/staff.js'
import { add, createShop, shop } from './support/shop.js'
import { dbAvailable } from './support/db.js'

const SECRET = 'webhook-secret-for-the-fake-gateway'
const providers = createProviders([fakeProvider({ secret: SECRET, id: 'card' })])
const S = createShop()
/** @type {ReturnType<typeof createServices>} */
let svc
/** @type {{ type: 'staff', id: string, label: string, role: 'owner' }} */
const staff = { type: 'staff', id: '', label: 'Hina Owner', role: 'owner' }
let tcs = ''

const bank = { accountTitle: 'Rubaya', bank: 'HBL', accountNumber: 'PK00HABB0000000000', instructions: 'Thank you' }
const allMethods = { methods: [{ type: 'cod', enabled: true, label: 'Cash on delivery', sortOrder: 0 }, { type: 'bank_transfer', enabled: true, label: 'Bank transfer', sortOrder: 1 }, { type: 'card', enabled: true, label: 'Card', sortOrder: 2 }], bankTransfer: bank }

/** @param {object} [over] */
const body = (over = {}) => ({ customer: { name: 'Sana Malik', phone: '0300 1234567' }, shippingAddress: { cityId: S.cityId, address: 'House 12, Street 4, Gulberg' }, shippingMethodId: S.methodId, paymentMethod: 'cod', ...over })
/** @param {{ variantId: string }} p @param {{ quantity?: number, method?: string, phone?: string }} [o] */
async function place(p, { quantity = 1, method = 'cod', phone } = {}) {
  const token = (await add(undefined, p.variantId, quantity)).body.cartToken
  const r = await shop('POST', '/orders', { token, body: body({ paymentMethod: method, ...(phone ? { customer: { name: 'Sana Malik', phone } } : {}) }), headers: { 'idempotency-key': uuidv7() } })
  if (r.status !== 201) throw new Error(JSON.stringify(r.body))
  const all = await t.db.select().from(orders)
  const order = /** @type {NonNullable<(typeof all)[number]>} */ (all.find((o) => `${o.numberPrefix}-${o.number}` === r.body.orderNumber))
  return { order, created: r.body }
}
const row = async (/** @type {string} */ id) => /** @type {NonNullable<(typeof orders.$inferSelect)>} */ ((await t.db.select().from(orders).where(eq(orders.id, id)))[0])
const rowsOf = (/** @type {string} */ id) => t.db.select().from(payments).where(eq(payments.orderId, id)).orderBy(payments.createdAt, payments.id)
const pay = (/** @type {string} */ id, /** @type {object} */ input, key = uuidv7()) => svc.orders.recordPayment(id, /** @type {never} */ (input), staff, key)
const go = (/** @type {string} */ id, /** @type {object} */ change) => transaction(t.db, (tx) => svc.orders.transition(tx, id, /** @type {never} */ (change), staff))
const level = async (/** @type {string} */ variantId) => (await t.db.select().from(inventoryLevels).where(eq(inventoryLevels.variantId, variantId)))[0]
const eventIdOf = (/** @type {{ payload: unknown } | undefined} */ job) => String(/** @type {{ eventId: string }} */ (job?.payload ?? {}).eventId)
const rs = (/** @type {number} */ n) => ({ amount: n * 100, currency: 'PKR' })

describe.skipIf(!dbAvailable)('payments (MySQL)', () => {
  beforeAll(async () => {
    await createHarnessWith(providers)
    svc = createServices({ db: t.db, config, providers })
  }, 60_000)
  afterAll(closeHarness)
  afterEach(async () => {
    setClock(null)
    await t.migrate.db.delete(auditLog)
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
  const ready = async (/** @type {boolean} */ prepaid = false) => {
    await S.setup()
    staff.id = /** @type {{ id: string }} */ ((await t.db.select().from(staffUsers))[0]).id // payments remember who recorded them
    await S.delivery()
    tcs = (await S.owner.call('POST', '/admin/couriers', { body: { name: 'TCS', trackingRequired: false, enabled: true } })).body.id
    if (prepaid) await S.owner.call('PUT', '/admin/settings/payments', { body: { value: allMethods, version: 0 } })
  }

  describe('the row an order starts with', () => {
    it('cash on delivery waits for the cash; with a deposit, for what is left after it', async () => {
      await ready()
      const plain = await place(await S.product({ price: 200000, stock: 5 }))
      expect(await rowsOf(plain.order.id)).toMatchObject([{ kind: 'full', method: 'cod', provider: 'cod', state: 'pending_confirmation', amountMinor: 225000 }])
      expect(await row(plain.order.id)).toMatchObject({ paidMinor: 0, paymentStatus: 'unpaid' })
      const mto = await place(await S.product({ price: 1000000, kind: 'made_to_order', mode: 'made_to_order', mto: true }), { phone: '03211111111' })
      expect(await rowsOf(mto.order.id)).toMatchObject([{ kind: 'balance', provider: 'cod', state: 'pending_confirmation', amountMinor: 700000 }])
      expect(mto.order.depositDueMinor).toBe(300000)
    }, 90_000)

    it('a bank transfer waits 48 hours for the transfer and gives the account to pay into', async () => {
      await ready(true)
      const { order, created } = await place(await S.product({ price: 200000, stock: 5 }), { method: 'bank_transfer' })
      const [p] = await rowsOf(order.id)
      expect(p).toMatchObject({ kind: 'full', method: 'bank_transfer', provider: 'bank_transfer', state: 'initiated', amountMinor: 225000 })
      expect(Math.round(((p?.expiresAt?.getTime() ?? 0) - Date.now()) / 3_600_000)).toBe(48)
      expect(created.payment.instructions).toBe(`Send Rs. 2,250 to Rubaya, HBL, PK00HABB0000000000. Write ${created.orderNumber} in the reference and send the receipt on WhatsApp. Thank you`)
      expect(created.payment.redirectUrl).toBeUndefined()
    }, 90_000)

    it('a gateway gives a page to go to, holds the stock 30 minutes, and keeps its own reference', async () => {
      await ready(true)
      const { order, created } = await place(await S.product({ price: 200000, stock: 5 }), { method: 'card' })
      expect(created.payment.redirectUrl).toMatch(/^https:\/\/fake-gateway\.invalid\/pay\//)
      const [p] = await rowsOf(order.id)
      expect(p).toMatchObject({ method: 'card', provider: 'card', state: 'initiated' })
      expect(p?.providerRef).toBe(`fake-${p?.id}`)
      expect(Math.round(((p?.expiresAt?.getTime() ?? 0) - Date.now()) / 60_000)).toBe(30)
      expect(Math.round((((await t.db.select().from(reservations))[0]?.expiresAt?.getTime() ?? 0) - Date.now()) / 60_000)).toBe(30)
    }, 90_000)
  })

  describe('payments and refunds recorded by staff', () => {
    it('a deposit then the rest: the paid amount and the status follow, the order is not confirmed by it', async () => {
      await ready()
      const { order } = await place(await S.product({ price: 1000000, kind: 'made_to_order', mode: 'made_to_order', mto: true }))
      const first = await pay(order.id, { kind: 'deposit', amount: rs(3000), method: 'cash', reference: 'Receipt 41' })
      expect(first).toMatchObject({ paidMinor: 300000, paymentStatus: 'deposit_paid', confirmed: false })
      expect(await row(order.id)).toMatchObject({ paidMinor: 300000, paymentStatus: 'deposit_paid', status: 'pending_confirmation' })
      await pay(order.id, { kind: 'balance', amount: rs(7000), method: 'bank_transfer' })
      expect(await row(order.id)).toMatchObject({ paidMinor: 1000000, paymentStatus: 'paid' })
      const manual = (await rowsOf(order.id)).filter((r) => r.provider === 'manual')
      expect(manual.map((r) => [r.kind, r.state, r.amountMinor, r.reference ?? null])).toEqual([['deposit', 'captured', 300000, 'Receipt 41'], ['balance', 'captured', 700000, null]])
      expect(manual.every((r) => r.recordedBy === null || r.recordedBy === staff.id)).toBe(true)
      const events = (await t.db.select().from(orderEvents).where(eq(orderEvents.orderId, order.id))).filter((e) => e.type === 'payment_recorded')
      expect(events).toHaveLength(2)
      expect(events.every((e) => !e.public)).toBe(true)
      expect((await t.db.select().from(auditLog)).filter((a) => a.action === 'order.payment_recorded')).toHaveLength(2)
    }, 90_000)

    it('refuses more than is owed, a deposit where none is due, a refund of money that was not paid, and money for a closed order', async () => {
      await ready()
      const { order } = await place(await S.product({ price: 200000, stock: 5 }))
      const code = async (/** @type {object} */ input) => {
        try {
          await pay(order.id, input)
          return 'ok'
        } catch (e) {
          return /** @type {{ code: string, details: { issues?: { path: string }[] } }} */ (e).details.issues?.[0]?.path ?? /** @type {{ code: string }} */ (e).code
        }
      }
      expect(await code({ kind: 'full', amount: rs(2251), method: 'cash' })).toBe('amount')
      expect(await code({ kind: 'deposit', amount: rs(100), method: 'cash' })).toBe('kind')
      expect(await code({ kind: 'refund', amount: rs(1), method: 'cash' })).toBe('amount')
      expect(await code({ kind: 'full', amount: { amount: 0, currency: 'PKR' }, method: 'cash' })).toBe('amount')
      await go(order.id, { version: 1, to: 'cancelled', reason: 'duplicate' })
      expect(await code({ kind: 'full', amount: rs(100), method: 'cash' })).toBe('action_not_allowed')
      expect(await rowsOf(order.id)).toHaveLength(1) // only the cash on delivery row, now closed
    }, 90_000)

    it('the same Idempotency-Key records once; the same key with another amount is refused', async () => {
      await ready()
      const { order } = await place(await S.product({ price: 200000, stock: 5 }))
      const key = uuidv7()
      const input = { kind: 'full', amount: rs(1000), method: 'cash' }
      const a = await pay(order.id, input, key)
      const b = await pay(order.id, input, key)
      expect(b).toEqual(a)
      expect((await rowsOf(order.id)).filter((r) => r.provider === 'manual')).toHaveLength(1)
      expect((await row(order.id)).paidMinor).toBe(100000)
      await expect(pay(order.id, { ...input, amount: rs(500) }, key)).rejects.toMatchObject({ code: 'idempotency_mismatch' })
    }, 90_000)

    it('the transfer a prepaid order waited for is captured, not counted twice, and the order is confirmed at once', async () => {
      await ready(true)
      const p = await S.product({ price: 200000, stock: 5 })
      const { order } = await place(p, { method: 'bank_transfer' })
      const r = await pay(order.id, { kind: 'full', amount: rs(2250), method: 'bank_transfer', reference: 'TXN-7788' })
      expect(r).toMatchObject({ paymentStatus: 'paid', confirmed: true })
      const after = await row(order.id)
      expect(after).toMatchObject({ status: 'confirmed', paidMinor: 225000 })
      const rows = await rowsOf(order.id)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ state: 'captured', provider: 'bank_transfer', reference: 'TXN-7788' })
      expect((await t.db.select().from(reservations))[0]?.expiresAt).toBeNull()
      expect((await t.db.select().from(outboxEvents)).some((e) => e.type === 'order.confirmed')).toBe(true)
    }, 90_000)

    it('a part payment of a prepaid order leaves it pending', async () => {
      await ready(true)
      const { order } = await place(await S.product({ price: 200000, stock: 5 }), { method: 'bank_transfer' })
      expect(await pay(order.id, { kind: 'full', amount: rs(1000), method: 'bank_transfer' })).toMatchObject({ paymentStatus: 'unpaid', confirmed: false })
      expect((await row(order.id)).status).toBe('pending')
    }, 90_000)
  })

  describe('cash at the door', () => {
    it('captures what was waiting when the cash is received; without it the cash stays owed', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 5 })
      const received = (await place(p)).order
      await go(received.id, { version: 1, to: 'confirmed', via: 'call' })
      await go(received.id, { version: 2, to: 'dispatched', courierId: tcs })
      await go(received.id, { version: 3, to: 'delivered', cashReceived: true })
      expect(await rowsOf(received.id)).toMatchObject([{ provider: 'cod', state: 'captured', amountMinor: 225000 }])
      expect(await row(received.id)).toMatchObject({ paidMinor: 225000, paymentStatus: 'paid' })

      const owed = (await place(p, { phone: '03211111111' })).order
      await go(owed.id, { version: 1, to: 'confirmed', via: 'call' })
      await go(owed.id, { version: 2, to: 'dispatched', courierId: tcs })
      await go(owed.id, { version: 3, to: 'delivered' })
      expect(await rowsOf(owed.id)).toMatchObject([{ state: 'pending_confirmation' }])
      expect(await row(owed.id)).toMatchObject({ paidMinor: 0, paymentStatus: 'unpaid' })
    }, 90_000)

    it('after a deposit, the cash taken at the door is only the balance', async () => {
      await ready()
      const { order } = await place(await S.product({ price: 1000000, kind: 'made_to_order', mode: 'made_to_order', mto: true }))
      await pay(order.id, { kind: 'deposit', amount: rs(3000), method: 'cash' })
      await go(order.id, { version: 1, to: 'confirmed', via: 'call' })
      await go(order.id, { version: 2, to: 'dispatched', courierId: tcs })
      await go(order.id, { version: 3, to: 'delivered', cashReceived: true })
      const cod = (await rowsOf(order.id)).find((r) => r.provider === 'cod')
      expect(cod).toMatchObject({ state: 'captured', amountMinor: 700000 })
      expect(await row(order.id)).toMatchObject({ paidMinor: 1000000, paymentStatus: 'paid' })
    }, 90_000)

    it('a parcel refused at the door closes the cash that was waiting', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 5 })
      const { order } = await place(p)
      await go(order.id, { version: 1, to: 'confirmed', via: 'call' })
      await go(order.id, { version: 2, to: 'dispatched', courierId: tcs })
      const [line] = await t.db.select().from(orderLines)
      await go(order.id, { version: 3, to: 'returned', returnType: 'refused_at_door', lines: [{ lineId: line?.id, quantity: 1, restock: true }] })
      expect(await rowsOf(order.id)).toMatchObject([{ provider: 'cod', state: 'failed' }])
      expect(await row(order.id)).toMatchObject({ status: 'returned', paidMinor: 0, paymentStatus: 'unpaid' })
    }, 90_000)
  })

  describe('money to pay back', () => {
    it('cancelling after a deposit: refund due, then partly refunded, then refunded; never more than was paid', async () => {
      await ready()
      const { order } = await place(await S.product({ price: 1000000, kind: 'made_to_order', mode: 'made_to_order', mto: true }))
      await pay(order.id, { kind: 'deposit', amount: rs(3000), method: 'cash' })
      await go(order.id, { version: 1, to: 'cancelled', reason: 'customer_request', refundAcknowledged: true })
      expect(await row(order.id)).toMatchObject({ status: 'cancelled', paidMinor: 300000, paymentStatus: 'refund_due' })
      expect((await rowsOf(order.id)).filter((r) => r.provider === 'cod').map((r) => r.state)).toEqual(['failed'])
      await pay(order.id, { kind: 'refund', amount: rs(1000), method: 'cash' })
      expect(await row(order.id)).toMatchObject({ paidMinor: 200000, refundedMinor: 100000, paymentStatus: 'partially_refunded' })
      await expect(pay(order.id, { kind: 'refund', amount: rs(2001), method: 'cash' })).rejects.toMatchObject({ code: 'validation_failed' })
      await pay(order.id, { kind: 'refund', amount: rs(2000), method: 'cash' })
      expect(await row(order.id)).toMatchObject({ paidMinor: 0, refundedMinor: 300000, paymentStatus: 'refunded' })
      const refunds = (await rowsOf(order.id)).filter((r) => r.kind === 'refund')
      expect(refunds.map((r) => r.amountMinor)).toEqual([100000, 200000]) // a refund is its own row, so amounts add up
      expect((await t.db.select().from(orderEvents).where(eq(orderEvents.orderId, order.id))).filter((e) => e.type === 'refund_recorded')).toHaveLength(2)
    }, 90_000)

    it('a paid order returned in part owes the value of the goods that came back', async () => {
      await ready(true)
      const p = await S.product({ price: 200000, stock: 5 })
      const { order } = await place(p, { quantity: 2, method: 'bank_transfer' })
      await pay(order.id, { kind: 'full', amount: { amount: order.totalMinor, currency: 'PKR' }, method: 'bank_transfer' })
      await go(order.id, { version: 2, to: 'dispatched', courierId: tcs })
      await go(order.id, { version: 3, to: 'delivered' })
      expect(await row(order.id)).toMatchObject({ paymentStatus: 'paid' })
      const [line] = await t.db.select().from(orderLines)
      await go(order.id, { version: 4, to: 'returned', returnType: 'customer_return', lines: [{ lineId: line?.id, quantity: 1, restock: true }] })
      expect(await row(order.id)).toMatchObject({ status: 'delivered', paymentStatus: 'refund_due' })
      await pay(order.id, { kind: 'refund', amount: rs(2000), method: 'bank_transfer' })
      expect((await row(order.id)).paymentStatus).toBe('partially_refunded')
    }, 90_000)
  })

  describe('changes to an order change what it waits for', () => {
    it('switching an unpaid prepaid order to cash on delivery closes the transfer and waits for cash', async () => {
      await ready(true)
      const { order } = await place(await S.product({ price: 200000, stock: 5 }), { method: 'bank_transfer' })
      await go(order.id, { version: 1, to: 'pending_confirmation' })
      expect((await rowsOf(order.id)).map((r) => [r.provider, r.state, r.amountMinor])).toEqual([['bank_transfer', 'expired', 225000], ['cod', 'pending_confirmation', 225000]])
    }, 90_000)

    it('editing the lines moves the amount the open row waits for', async () => {
      await ready()
      const p = await S.product({ price: 100000, stock: 5 })
      const { order } = await place(p)
      const [line] = await t.db.select().from(orderLines)
      await transaction(t.db, (tx) => svc.orders.edit(tx, order.id, { version: 1, lines: [{ lineId: line?.id ?? '', quantity: 3 }] }, staff))
      expect(await rowsOf(order.id)).toMatchObject([{ state: 'pending_confirmation', amountMinor: 325000 }])
    }, 90_000)
  })

  describe('orders nobody paid for', () => {
    it('are cancelled when their time is up: the stock goes back and the order says why; a paid one is left alone', async () => {
      await ready(true)
      const p = await S.product({ price: 200000, stock: 5 })
      const unpaid = (await place(p, { method: 'bank_transfer' })).order
      const paid = (await place(p, { method: 'bank_transfer', phone: '03211111111' })).order
      await pay(paid.id, { kind: 'full', amount: { amount: paid.totalMinor, currency: 'PKR' }, method: 'bank_transfer' })
      expect(await svc.orders.expireUnpaid()).toBe(0) // not yet
      await t.db.update(payments).set({ expiresAt: new Date(Date.now() - 60_000) }).where(eq(payments.orderId, unpaid.id))
      expect(await svc.orders.expireUnpaid()).toBe(1)
      expect(await row(unpaid.id)).toMatchObject({ status: 'cancelled', cancelReason: 'payment_expired' })
      expect((await rowsOf(unpaid.id)).map((r) => r.state)).toEqual(['expired'])
      expect(await row(paid.id)).toMatchObject({ status: 'confirmed' })
      expect(await level(p.variantId)).toMatchObject({ reserved: 1 }) // only the paid order still holds one
      const last = (await t.db.select().from(orderEvents).where(eq(orderEvents.orderId, unpaid.id))).at(-1)
      expect(last).toMatchObject({ actorType: 'system', toStatus: 'cancelled', data: { reason: 'payment_expired' } })
    }, 90_000)
  })

  describe('a gateway calls back (fake, signed like a real one)', () => {
    /** @param {string} paymentId @param {object} [over] */
    const event = (paymentId, over = {}) => ({ eventId: `evt-${uuidv7()}`, paymentId, state: 'captured', amountMinor: 225000, providerRef: `fake-${paymentId}`, ...over })
    const post = (/** @type {string} */ provider, /** @type {{ raw: Buffer, headers: Record<string, string> }} */ signed) =>
      app.inject({ method: 'POST', url: `/api/v1/webhooks/${provider}`, remoteAddress: '203.0.113.9', headers: signed.headers, payload: signed.raw })

    it('a bad signature is refused and nothing is stored; an unknown provider is not found', async () => {
      await ready(true)
      const { order } = await place(await S.product({ price: 200000, stock: 5 }), { method: 'card' })
      const [p] = await rowsOf(order.id)
      const bad = signedFakeEvent('another-secret', event(p?.id ?? ''))
      expect((await post('card', bad)).statusCode).toBe(401)
      expect(await t.db.select().from(paymentEvents)).toEqual([])
      expect(await t.db.select().from(jobs)).toEqual([])
      expect((await post('cod', signedFakeEvent(SECRET, event(p?.id ?? '')))).statusCode).toBe(404) // cash on delivery has no callback
      expect((await post('nosuch', signedFakeEvent(SECRET, event(p?.id ?? '')))).statusCode).toBe(404)
    }, 90_000)

    it('a good event is stored and answered at once; the same event again is a no-op; the job then captures the payment and confirms the order', async () => {
      await ready(true)
      const { order } = await place(await S.product({ price: 200000, stock: 5 }), { method: 'card' })
      const [p] = await rowsOf(order.id)
      const evt = event(p?.id ?? '')
      const first = await post('card', signedFakeEvent(SECRET, evt))
      expect(first.statusCode).toBe(200)
      expect(JSON.parse(first.body)).toEqual({ received: true, duplicate: false })
      const again = await post('card', signedFakeEvent(SECRET, evt))
      expect(JSON.parse(again.body)).toEqual({ received: true, duplicate: true })
      expect(await t.db.select().from(paymentEvents)).toHaveLength(1)
      const queued = await t.db.select().from(jobs)
      expect(queued.map((j) => j.type)).toEqual(['payments.apply_event'])
      expect((await rowsOf(order.id))[0]?.state).toBe('initiated') // not applied yet: that is the job's work

      await svc.orders.applyPaymentEvent(eventIdOf(queued[0]))
      expect((await rowsOf(order.id))[0]).toMatchObject({ state: 'captured', providerRef: `fake-${p?.id}` })
      expect(await row(order.id)).toMatchObject({ status: 'confirmed', paidMinor: 225000, paymentStatus: 'paid' })
      expect((await t.db.select().from(paymentEvents))[0]?.processedAt).toBeTruthy()
      // applying it again changes nothing
      await svc.orders.applyPaymentEvent(eventIdOf(queued[0]))
      expect((await row(order.id)).version).toBe(2)
    }, 90_000)

    it('an amount that is not the amount asked for is never captured; a failure marks the payment failed; an unknown payment is ignored', async () => {
      await ready(true)
      const p = await S.product({ price: 200000, stock: 5 })
      const wrong = (await place(p, { method: 'card' })).order
      const other = (await place(p, { method: 'card', phone: '03211111111' })).order
      const [pw] = await rowsOf(wrong.id)
      const [po] = await rowsOf(other.id)
      for (const e of [event(pw?.id ?? '', { amountMinor: 100 }), event(po?.id ?? '', { state: 'failed' }), event(uuidv7())]) await post('card', signedFakeEvent(SECRET, e))
      for (const j of await t.db.select().from(jobs)) await svc.orders.applyPaymentEvent(eventIdOf(j))
      expect((await rowsOf(wrong.id))[0]?.state).toBe('initiated')
      expect((await row(wrong.id)).status).toBe('pending')
      expect((await rowsOf(other.id))[0]?.state).toBe('failed')
      expect((await t.db.select().from(paymentEvents)).every((e) => e.processedAt)).toBe(true)
    }, 90_000)
  })
})
