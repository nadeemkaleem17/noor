// M4-05: what happens to an order after it is placed: every edge of the table with its guards and effects, and editing before dispatch. On a scratch database.
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { auditLog } from '../src/db/schema/audit.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { carts } from '../src/db/schema/cart.js'
import { pages, settings } from '../src/db/schema/content.js'
import { customers } from '../src/db/schema/customers.js'
import { inventoryLevels, inventoryMovements, reservations } from '../src/db/schema/inventory.js'
import { orderEvents, orderLines, orders } from '../src/db/schema/orders.js'
import { counters, idempotencyKeys, outboxEvents, rateLimitHits } from '../src/db/schema/platform.js'
import { products, variants } from '../src/db/schema/products.js'
import { promoRedemptions, promos } from '../src/db/schema/promotions.js'
import { cities, couriers, shippingZones } from '../src/db/schema/shipping.js'
import { categories, formSchemas } from '../src/db/schema/taxonomy.js'
import { setClock } from '../src/platform/clock.js'
import { transaction } from '../src/platform/db.js'
import { uuidv7 } from '../src/platform/ids.js'
import { createServices } from '../src/modules/services.js'
import { closeHarness, config, createHarness, t } from './support/staff.js'
import { add, createShop, pkr, shop } from './support/shop.js'
import { dbAvailable } from './support/db.js'

const S = createShop()
/** @type {ReturnType<typeof createServices>['orders']} */
let svc
/** @type {import('../src/modules/orders/changes.js').OrderActor} */
const staff = { type: 'staff', id: uuidv7(), label: 'Hina Fulfilment', role: 'fulfilment' }
let courier = { tcs: '', rider: '', off: '' }

const body = (/** @type {object} */ over = {}) => ({
  customer: { name: 'Sana Malik', phone: '0300 1234567' },
  shippingAddress: { cityId: S.cityId, address: 'House 12, Street 4, Gulberg', landmark: 'Near the park' },
  shippingMethodId: S.methodId,
  paymentMethod: 'cod',
  ...over,
})
/** @typedef {typeof orders.$inferSelect} OrderRow */
/** Places an order of `quantity` of a product through the API. @param {{ variantId: string }} p @param {{ quantity?: number, body?: object, phone?: string, promo?: string }} [o] */
async function place(p, { quantity = 1, body: over = {}, phone, promo } = {}) {
  const token = (await add(undefined, p.variantId, quantity)).body.cartToken
  if (promo) await shop('PUT', '/cart/promo', { token, body: { code: promo } })
  const b = body({ ...(phone ? { customer: { name: 'Sana Malik', phone } } : {}), ...over })
  const r = await shop('POST', '/orders', { token, body: b, headers: { 'idempotency-key': uuidv7() } })
  if (r.status !== 201) throw new Error(JSON.stringify(r.body))
  const all = await t.db.select().from(orders)
  return /** @type {NonNullable<(typeof all)[number]>} */ (all.find((o) => `${o.numberPrefix}-${o.number}` === r.body.orderNumber))
}
const row = async (/** @type {string} */ id) => /** @type {OrderRow} */ ((await t.db.select().from(orders).where(eq(orders.id, id)))[0])
/** @param {string} id @param {object} change @param {import('../src/modules/orders/changes.js').OrderActor} [actor] */
const go = (id, change, actor = staff) => transaction(t.db, (tx) => svc.transition(tx, id, /** @type {never} */ (change), actor))
const level = async (/** @type {string} */ variantId) => (await t.db.select().from(inventoryLevels).where(eq(inventoryLevels.variantId, variantId)))[0]
const events = async (/** @type {string} */ id) => (await t.db.select().from(orderEvents).where(eq(orderEvents.orderId, id))).sort((a, b) => (a.id < b.id ? -1 : 1))
const customerOf = async () => (await t.db.select().from(customers))[0]
/** The order confirmed and dispatched, ready to deliver or return. @param {string} id */
async function dispatched(id) {
  await go(id, { version: 1, to: 'confirmed', via: 'call' })
  await go(id, { version: 2, to: 'dispatched', courierId: courier.tcs, trackingNumber: 'TCS123' })
}

describe.skipIf(!dbAvailable)('order changes (MySQL)', () => {
  beforeAll(async () => {
    await createHarness()
    svc = createServices({ db: t.db, config }).orders
  }, 60_000)
  afterAll(closeHarness)
  afterEach(async () => {
    setClock(null)
    await t.migrate.db.delete(auditLog)
    await t.db.delete(outboxEvents)
    await t.db.delete(idempotencyKeys)
    await t.db.delete(rateLimitHits)
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
  const ready = async () => {
    await S.setup()
    await S.delivery()
    const make = async (/** @type {string} */ name, /** @type {boolean} */ trackingRequired, enabled = true) => (await S.owner.call('POST', '/admin/couriers', { body: { name, trackingRequired, enabled, trackingUrlPattern: 'https://t.example/{tracking}' } })).body.id
    courier = { tcs: await make('TCS', true), rider: await make('Own rider', false), off: await make('Old courier', true, false) }
  }

  describe('confirming', () => {
    it('needs how the customer confirmed, records it, and is refused for a version that is out of date', async () => {
      await ready()
      const order = await place(await S.product({ stock: 5 }))
      await expect(go(order.id, { version: 1, to: 'confirmed' })).rejects.toMatchObject({ code: 'validation_failed' })
      await expect(go(order.id, { version: 7, to: 'confirmed', via: 'call' })).rejects.toMatchObject({ code: 'stale_write', details: { currentVersion: 1 } })
      const done = await go(order.id, { version: 1, to: 'confirmed', via: 'whatsapp', note: 'Replied yes' })
      expect(done).toMatchObject({ status: 'confirmed', version: 2 })
      const after = await row(order.id)
      expect(after).toMatchObject({ status: 'confirmed', version: 2 })
      expect(after.confirmedAt).toBeTruthy()
      const last = (await events(order.id)).at(-1)
      expect(last).toMatchObject({ type: 'status_changed', fromStatus: 'pending_confirmation', toStatus: 'confirmed', actorType: 'staff', actorLabel: 'Hina Fulfilment', public: true, data: { via: 'whatsapp', note: 'Replied yes' } })
      expect((await t.db.select().from(outboxEvents)).filter((e) => e.type === 'order.confirmed')).toHaveLength(1)
      const audit = (await t.db.select().from(auditLog)).find((a) => a.action === 'order.confirmed')
      expect(audit).toMatchObject({ entityType: 'order', category: 'money', actorLabel: 'Hina Fulfilment' })
      // a second go at the same edge is not an edge
      await expect(go(order.id, { version: 2, to: 'confirmed', via: 'call' })).rejects.toMatchObject({ code: 'invalid_transition' })
    }, 90_000)

    it('is blocked while a deposit is due and unpaid, and a customer with No COD needs an override reason', async () => {
      await ready()
      const order = await place(await S.product({ price: 1000000, kind: 'made_to_order', mode: 'made_to_order', mto: true }))
      expect(order.depositDueMinor).toBe(300000)
      await expect(go(order.id, { version: 1, to: 'confirmed', via: 'call' })).rejects.toMatchObject({ code: 'deposit_unpaid' })
      expect((await row(order.id)).status).toBe('pending_confirmation')
      await t.db.update(orders).set({ paidMinor: 300000 }).where(eq(orders.id, order.id))
      await t.db.update(customers).set({ noCod: true, noCodReason: 'refused twice' })
      await expect(go(order.id, { version: 1, to: 'confirmed', via: 'call' })).rejects.toMatchObject({ code: 'validation_failed', details: { issues: [{ path: 'codOverrideReason', code: 'required' }] } })
      await go(order.id, { version: 1, to: 'confirmed', via: 'call', codOverrideReason: 'Paid the deposit' })
      expect((await events(order.id)).at(-1)?.data).toMatchObject({ codOverrideReason: 'Paid the deposit' })
    }, 90_000)

    it('a prepaid order is confirmed once it has been paid, and can switch to cash on delivery while it is not', async () => {
      await ready()
      await S.owner.call('PUT', '/admin/settings/payments', {
        body: { value: { methods: [{ type: 'cod', enabled: true, label: 'Cash on delivery', sortOrder: 0 }, { type: 'bank_transfer', enabled: true, label: 'Bank transfer', sortOrder: 1 }], bankTransfer: { accountTitle: 'Rubaya', bank: 'HBL', accountNumber: 'PK00HABB0000000000', instructions: 'x' } }, version: 0 },
      })
      const p = await S.product({ price: 100000, stock: 5 })
      const order = await place(p, { body: { paymentMethod: 'bank_transfer' } })
      expect(order.status).toBe('pending')
      expect((await t.db.select().from(reservations))[0]?.expiresAt).toBeTruthy()
      await expect(go(order.id, { version: 1, to: 'confirmed' })).rejects.toMatchObject({ code: 'deposit_unpaid' })
      await go(order.id, { version: 1, to: 'pending_confirmation' }) // to cash on delivery
      expect(await row(order.id)).toMatchObject({ status: 'pending_confirmation', paymentMethod: 'cod' })
      expect((await t.db.select().from(reservations))[0]?.expiresAt).toBeNull() // the 30 minutes no longer apply
      // and a second order that was paid goes straight to confirmed
      const paid = await place(p, { body: { paymentMethod: 'bank_transfer' }, phone: '03211111111' })
      await t.db.update(orders).set({ paidMinor: paid.totalMinor }).where(eq(orders.id, paid.id))
      await go(paid.id, { version: 1, to: 'confirmed' }, { type: 'system', label: 'payment' })
      expect(await row(paid.id)).toMatchObject({ status: 'confirmed' })
      expect((await t.db.select().from(reservations)).every((r) => r.expiresAt === null)).toBe(true)
    }, 90_000)

    it('cash on delivery is not offered to a customer who is flagged, nor when it is switched off', async () => {
      await ready()
      await S.owner.call('PUT', '/admin/settings/payments', {
        body: { value: { methods: [{ type: 'cod', enabled: true, label: 'Cash on delivery', sortOrder: 0 }, { type: 'bank_transfer', enabled: true, label: 'Bank transfer', sortOrder: 1 }], bankTransfer: { accountTitle: 'Rubaya', bank: 'HBL', accountNumber: 'PK00HABB0000000000', instructions: 'x' } }, version: 0 },
      })
      const order = await place(await S.product({ price: 100000, stock: 5 }), { body: { paymentMethod: 'bank_transfer' } })
      await t.db.update(customers).set({ noCod: true, noCodReason: 'x' })
      await expect(go(order.id, { version: 1, to: 'pending_confirmation' })).rejects.toMatchObject({ code: 'payment_method_not_allowed' })
      expect((await row(order.id)).paymentMethod).toBe('bank_transfer')
    }, 90_000)

    it('reverting needs a reason and clears the time of confirmation', async () => {
      await ready()
      const order = await place(await S.product({ stock: 5 }))
      await go(order.id, { version: 1, to: 'confirmed', via: 'call' })
      await expect(go(order.id, { version: 2, to: 'pending_confirmation' })).rejects.toMatchObject({ code: 'validation_failed' })
      await go(order.id, { version: 2, to: 'pending_confirmation', reason: 'Customer wants a different size' })
      expect(await row(order.id)).toMatchObject({ status: 'pending_confirmation', confirmedAt: null, paymentMethod: 'cod' })
    }, 90_000)
  })

  describe('dispatching', () => {
    it('needs an enabled courier and, if the courier requires it, a tracking number; takes the goods off the shelf; assigns an invoice number once', async () => {
      await ready()
      const p = await S.product({ stock: 5 })
      const order = await place(p, { quantity: 2 })
      await go(order.id, { version: 1, to: 'confirmed', via: 'call' })
      await expect(go(order.id, { version: 2, to: 'dispatched' })).rejects.toMatchObject({ code: 'validation_failed' })
      await expect(go(order.id, { version: 2, to: 'dispatched', courierId: courier.off, trackingNumber: 'X1' })).rejects.toMatchObject({ code: 'validation_failed' })
      await expect(go(order.id, { version: 2, to: 'dispatched', courierId: courier.tcs })).rejects.toMatchObject({ code: 'validation_failed', details: { issues: [{ path: 'trackingNumber', code: 'required' }] } })
      // every refusal left the stock and the numbers alone
      expect(await level(p.variantId)).toMatchObject({ onHand: 5, reserved: 2 })
      expect((await t.db.select().from(counters)).find((c) => c.name.startsWith('invoice_'))?.value ?? 0).toBe(0)

      await go(order.id, { version: 2, to: 'dispatched', courierId: courier.tcs, trackingNumber: ' TCS-991 ' })
      const after = await row(order.id)
      expect(after).toMatchObject({ status: 'dispatched', courierId: courier.tcs, courierName: 'TCS', trackingNumber: 'TCS-991', version: 3 })
      expect(after.invoiceNumber).toBe(`INV-${new Date().getUTCFullYear()}-000001`)
      expect(after.dispatchedAt).toBeTruthy()
      expect(await level(p.variantId)).toMatchObject({ onHand: 3, reserved: 0 })
      expect((await t.db.select().from(reservations))[0]?.status).toBe('committed')
      expect((await t.db.select().from(inventoryMovements)).filter((m) => m.reason === 'sale').map((m) => m.delta)).toEqual([-2])
      // a retry cannot dispatch again, so cannot take a second number
      await expect(go(order.id, { version: 3, to: 'dispatched', courierId: courier.tcs, trackingNumber: 'TCS-992' })).rejects.toMatchObject({ code: 'invalid_transition' })
      expect((await row(order.id)).invoiceNumber).toBe(after.invoiceNumber)

      // the next order gets the next number, with no gap
      const second = await place(p, { phone: '03211111111' })
      await go(second.id, { version: 1, to: 'confirmed', via: 'call' })
      await go(second.id, { version: 2, to: 'dispatched', courierId: courier.rider })
      expect((await row(second.id)).invoiceNumber).toBe(`INV-${new Date().getUTCFullYear()}-000002`)
      expect((await row(second.id)).trackingNumber).toBeNull() // Own rider needs none
    }, 90_000)

    it('the tracking can be corrected while the parcel is on its way, and only then', async () => {
      await ready()
      const order = await place(await S.product({ stock: 5 }))
      await expect(transaction(t.db, (tx) => svc.updateTracking(tx, order.id, { courierId: courier.tcs, trackingNumber: 'A', version: 1 }, staff))).rejects.toMatchObject({ code: 'action_not_allowed' })
      await dispatched(order.id)
      const r = await transaction(t.db, (tx) => svc.updateTracking(tx, order.id, { courierId: courier.tcs, trackingNumber: 'TCS-FIXED', version: 3 }, staff))
      expect(r.version).toBe(4)
      expect((await row(order.id)).trackingNumber).toBe('TCS-FIXED')
      expect((await events(order.id)).at(-1)).toMatchObject({ type: 'tracking_updated', data: { before: { trackingNumber: 'TCS123' } } })
      await expect(transaction(t.db, (tx) => svc.updateTracking(tx, order.id, { courierId: courier.tcs, trackingNumber: 'B', version: 3 }, staff))).rejects.toMatchObject({ code: 'stale_write' })
    }, 90_000)
  })

  describe('delivering', () => {
    it('counts the customer as delivered with the total spent, and only follows a dispatch', async () => {
      await ready()
      const order = await place(await S.product({ price: 300000, stock: 5 }))
      await expect(go(order.id, { version: 1, to: 'delivered' })).rejects.toMatchObject({ code: 'invalid_transition' })
      await dispatched(order.id)
      await go(order.id, { version: 3, to: 'delivered', cashReceived: true })
      const after = await row(order.id)
      expect(after).toMatchObject({ status: 'delivered', version: 4 })
      expect(after.deliveredAt).toBeTruthy()
      expect(await customerOf()).toMatchObject({ ordersCount: 1, deliveredCount: 1, spentMinor: 325000 })
      expect((await events(order.id)).at(-1)?.data).toEqual({ cashReceived: true })
    }, 90_000)
  })

  describe('cancelling', () => {
    it('needs a reason, releases the stock, gives the promo use back and moves the customer counters; the timeline names the reason and the actor', async () => {
      await ready()
      await S.promo('EID10')
      const p = await S.product({ stock: 5 })
      const order = await place(p, { quantity: 2, promo: 'EID10' })
      expect(await level(p.variantId)).toMatchObject({ reserved: 2 })
      expect((await t.db.select().from(promos))[0]?.usageCount).toBe(1)
      await expect(go(order.id, { version: 1, to: 'cancelled' })).rejects.toMatchObject({ code: 'validation_failed' })
      await expect(go(order.id, { version: 1, to: 'cancelled', reason: 'because' })).rejects.toMatchObject({ code: 'validation_failed' })
      await go(order.id, { version: 1, to: 'cancelled', reason: 'unreachable', note: 'Phone off for 2 days' })
      expect(await row(order.id)).toMatchObject({ status: 'cancelled', cancelReason: 'unreachable' })
      expect((await row(order.id)).closedAt).toBeTruthy()
      expect(await level(p.variantId)).toMatchObject({ onHand: 5, reserved: 0 })
      expect((await t.db.select().from(reservations))[0]?.status).toBe('released')
      expect((await t.db.select().from(promos))[0]?.usageCount).toBe(0)
      expect((await t.db.select().from(promoRedemptions))[0]?.reversedAt).toBeTruthy()
      expect(await customerOf()).toMatchObject({ ordersCount: 0, cancelledCount: 1 })
      expect((await events(order.id)).at(-1)).toMatchObject({ toStatus: 'cancelled', actorLabel: 'Hina Fulfilment', data: { reason: 'unreachable', note: 'Phone off for 2 days' } })
      await expect(go(order.id, { version: 2, to: 'confirmed', via: 'call' })).rejects.toMatchObject({ code: 'invalid_transition' }) // final
    }, 90_000)

    it('with money already received, the refund must be acknowledged; after dispatch it is not an edge', async () => {
      await ready()
      const order = await place(await S.product({ stock: 5 }))
      await t.db.update(orders).set({ paidMinor: 100000 }).where(eq(orders.id, order.id))
      await expect(go(order.id, { version: 1, to: 'cancelled', reason: 'customer_request' })).rejects.toMatchObject({ code: 'validation_failed', details: { issues: [{ path: 'refundAcknowledged', code: 'required' }] } })
      await go(order.id, { version: 1, to: 'cancelled', reason: 'customer_request', refundAcknowledged: true })
      expect((await events(order.id)).at(-1)?.data).toMatchObject({ refundDue: 100000 })
      const other = await place(await S.product({ stock: 5 }), { phone: '03211111111' })
      await dispatched(other.id)
      await expect(go(other.id, { version: 3, to: 'cancelled', reason: 'other' })).rejects.toMatchObject({ code: 'invalid_transition' })
    }, 90_000)

    it('the customer can cancel through their link: the same edge, with the storefront as the actor', async () => {
      await ready()
      const order = await place(await S.product({ stock: 5 }))
      await go(order.id, { version: 1, to: 'cancelled', reason: 'customer_request' }, { type: 'storefront' })
      expect((await events(order.id)).at(-1)).toMatchObject({ actorType: 'storefront', actorLabel: null, data: { reason: 'customer_request' } })
      expect((await t.db.select().from(auditLog)).find((a) => a.action === 'order.cancelled')?.actorType).toBe('storefront')
    }, 90_000)

    it('two people acting on one order at once: one wins, the other is told it changed', async () => {
      await ready()
      const order = await place(await S.product({ stock: 5 }))
      const results = await Promise.allSettled([go(order.id, { version: 1, to: 'confirmed', via: 'call' }), go(order.id, { version: 1, to: 'cancelled', reason: 'duplicate' })])
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      expect(/** @type {PromiseRejectedResult} */ (results.find((r) => r.status === 'rejected')).reason).toMatchObject({ code: 'stale_write' })
      expect((await row(order.id)).version).toBe(2)
    }, 90_000)
  })

  describe('returns', () => {
    it('a parcel refused at the door comes back whole: restocked, the order closed, the customer marked as having refused', async () => {
      await ready()
      const p = await S.product({ stock: 5 })
      const order = await place(p, { quantity: 2 })
      await dispatched(order.id)
      expect(await level(p.variantId)).toMatchObject({ onHand: 3 })
      const [line] = await t.db.select().from(orderLines)
      await expect(go(order.id, { version: 3, to: 'returned', returnType: 'refused_at_door', lines: [{ lineId: line?.id, quantity: 1, restock: true }] })).rejects.toMatchObject({ code: 'validation_failed' }) // not the whole parcel
      await expect(go(order.id, { version: 3, to: 'returned', returnType: 'customer_return', lines: [{ lineId: line?.id, quantity: 2, restock: true }] })).rejects.toMatchObject({ code: 'validation_failed' })
      await go(order.id, { version: 3, to: 'returned', returnType: 'refused_at_door', lines: [{ lineId: line?.id, quantity: 2, restock: true }], note: 'Refused to pay' })
      expect(await row(order.id)).toMatchObject({ status: 'returned' })
      expect((await row(order.id)).closedAt).toBeTruthy()
      expect(await level(p.variantId)).toMatchObject({ onHand: 5, reserved: 0 })
      expect((await t.db.select().from(orderLines))[0]?.returnedQuantity).toBe(2)
      expect(await customerOf()).toMatchObject({ refusedCount: 1, ordersCount: 1, deliveredCount: 0 })
    }, 90_000)

    it('returning 1 of 2 units with Restock: no does not put it back; the rest later closes the order and takes the sale back', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 5 })
      const order = await place(p, { quantity: 2 })
      await dispatched(order.id)
      await go(order.id, { version: 3, to: 'delivered' })
      const [line] = await t.db.select().from(orderLines)
      const spent = (await customerOf())?.spentMinor
      expect(spent).toBe(425000) // 2 x 2,000 + Rs. 250 delivery

      await go(order.id, { version: 4, to: 'returned', returnType: 'customer_return', lines: [{ lineId: line?.id, quantity: 1, restock: false }] })
      expect(await row(order.id)).toMatchObject({ status: 'delivered', version: 5, closedAt: null }) // a partial return leaves it delivered
      expect(await level(p.variantId)).toMatchObject({ onHand: 3 }) // not restocked
      expect((await t.db.select().from(inventoryMovements)).filter((m) => m.reason === 'return_damaged' || m.reason === 'damaged').length).toBe(2) // the unit came in and went out as damaged
      expect((await t.db.select().from(orderLines))[0]?.returnedQuantity).toBe(1)
      expect((await events(order.id)).at(-1)).toMatchObject({ type: 'partial_return', data: { returnType: 'customer_return' } })
      expect((await customerOf())?.spentMinor).toBe(225000)

      await go(order.id, { version: 5, to: 'returned', returnType: 'customer_return', lines: [{ lineId: line?.id, quantity: 1, restock: true }] })
      expect(await row(order.id)).toMatchObject({ status: 'returned' })
      expect(await level(p.variantId)).toMatchObject({ onHand: 4 })
      expect(await customerOf()).toMatchObject({ deliveredCount: 0, spentMinor: 0 }) // the partial return and the rest together take back exactly the total
      await expect(go(order.id, { version: 6, to: 'returned', returnType: 'customer_return', lines: [{ lineId: line?.id, quantity: 1, restock: true }] })).rejects.toMatchObject({ code: 'invalid_transition' })
    }, 90_000)

    it('refuses more than was ordered, an unknown line, or the same line twice', async () => {
      await ready()
      const order = await place(await S.product({ stock: 5 }), { quantity: 2 })
      await dispatched(order.id)
      await go(order.id, { version: 3, to: 'delivered' })
      const [line] = await t.db.select().from(orderLines)
      const paths = async (/** @type {object[]} */ lines) => {
        try {
          await go(order.id, { version: 4, to: 'returned', returnType: 'customer_return', lines })
          return []
        } catch (e) {
          return /** @type {{ details: { issues: { path: string }[] } }} */ (e).details.issues.map((i) => i.path)
        }
      }
      expect(await paths([{ lineId: line?.id, quantity: 3, restock: true }])).toEqual(['lines.0.quantity'])
      expect(await paths([{ lineId: uuidv7(), quantity: 1, restock: true }])).toEqual(['lines.0.lineId'])
      expect(await paths([{ lineId: line?.id, quantity: 1, restock: true }, { lineId: line?.id, quantity: 1, restock: true }])).toEqual(['lines.1.lineId'])
      expect(await paths([])).toEqual(['lines'])
    }, 90_000)
  })

  describe('editing (plan/09-data-model/07 section 6)', () => {
    it('re-prices on the server when the quantity changes, adjusts what is held, and keeps before and after in an event', async () => {
      await ready()
      const p = await S.product({ price: 100000, stock: 5 })
      const order = await place(p, { quantity: 1 })
      expect(order.totalMinor).toBe(125000)
      const [line] = await t.db.select().from(orderLines)
      const r = await transaction(t.db, (tx) => svc.edit(tx, order.id, { version: 1, lines: [{ lineId: line?.id, quantity: 3 }] }, staff))
      expect(r).toMatchObject({ version: 2, subtotal: pkr(300000), total: pkr(325000) })
      expect(await row(order.id)).toMatchObject({ subtotalMinor: 300000, shippingFeeMinor: 25000, totalMinor: 325000, version: 2 })
      expect((await t.db.select().from(orderLines))[0]).toMatchObject({ quantity: 3, lineSubtotalMinor: 300000 })
      expect(await level(p.variantId)).toMatchObject({ reserved: 3 })
      expect((await events(order.id)).at(-1)).toMatchObject({ type: 'edited', public: false, data: { changes: { total: [pkr(125000), pkr(325000)], lines: [expect.any(String), expect.any(String)] } } })
      expect((await t.db.select().from(auditLog)).filter((a) => a.action === 'order.edited')).toHaveLength(1)
    }, 90_000)

    it('an existing line keeps the price of the day it was ordered; a line added now costs today\'s price; a removed line frees its stock', async () => {
      await ready()
      const a = await S.product({ price: 100000, stock: 5 })
      const b = await S.product({ price: 200000, stock: 5 })
      const order = await place(a)
      await t.db.update(variants).set({ priceMinor: 150000 }).where(eq(variants.id, a.variantId))
      await t.db.update(variants).set({ priceMinor: 250000 }).where(eq(variants.id, b.variantId))
      const [line] = await t.db.select().from(orderLines)
      await transaction(t.db, (tx) => svc.edit(tx, order.id, { version: 1, lines: [{ lineId: line?.id, quantity: 1 }, { variantId: b.variantId, quantity: 1 }] }, staff))
      const lines = await t.db.select().from(orderLines)
      expect(lines.map((l) => [l.variantId === a.variantId ? 'a' : 'b', l.unitPriceMinor]).sort()).toEqual([['a', 100000], ['b', 250000]])
      expect(await row(order.id)).toMatchObject({ subtotalMinor: 350000, shippingFeeMinor: 25000, totalMinor: 375000 }) // Rs. 3,500 is under the free-delivery threshold
      expect(await level(a.variantId)).toMatchObject({ reserved: 1 })
      expect(await level(b.variantId)).toMatchObject({ reserved: 1 })
      // taking the first line out gives its stock back
      const second = (await t.db.select().from(orderLines)).find((l) => l.variantId === b.variantId)
      await transaction(t.db, (tx) => svc.edit(tx, order.id, { version: 2, lines: [{ lineId: second?.id, quantity: 1 }] }, staff))
      expect(await t.db.select().from(orderLines)).toHaveLength(1)
      expect(await level(a.variantId)).toMatchObject({ reserved: 0 })
      expect(await row(order.id)).toMatchObject({ subtotalMinor: 250000, totalMinor: 275000 })
    }, 90_000)

    it('city and method: a new city is priced again; a method that does not exist there is refused', async () => {
      await ready()
      const order = await place(await S.product({ price: 100000, stock: 5 }))
      await transaction(t.db, (tx) => svc.edit(tx, order.id, { version: 1, shippingMethodId: S.expressId }, staff))
      expect(await row(order.id)).toMatchObject({ shippingMethodLabel: 'Express', shippingFeeMinor: 45000, totalMinor: 145000 })
      await expect(transaction(t.db, (tx) => svc.edit(tx, order.id, { version: 2, shippingMethodId: uuidv7() }, staff))).rejects.toMatchObject({ code: 'shipping_method_invalid' })
      const lonely = await S.owner.call('POST', '/admin/shipping/cities', { body: { name: 'Nowhere', province: 'Sindh' } })
      await expect(transaction(t.db, (tx) => svc.edit(tx, order.id, { version: 2, shippingAddress: { cityId: lonely.body.id, address: 'House 1, Some street' } }, staff))).rejects.toMatchObject({ code: 'city_not_served' })
    }, 90_000)

    it('the address and notes change; nothing about money does; the customer name is updated on the order', async () => {
      await ready()
      const order = await place(await S.product({ price: 100000, stock: 5 }))
      const before = await row(order.id)
      await transaction(t.db, (tx) => svc.edit(tx, order.id, { version: 1, shippingAddress: { cityId: S.cityId, address: 'Flat 4, Another road, DHA', notes: 'Ring twice' }, customer: { name: 'Sana M. Malik' } }, staff))
      const after = await row(order.id)
      expect(after).toMatchObject({ shipAddress: 'Flat 4, Another road, DHA', shipNotes: 'Ring twice', shipLandmark: null, customerName: 'Sana M. Malik', totalMinor: before.totalMinor })
      const audit = JSON.stringify((await t.db.select().from(auditLog)).filter((a) => a.action === 'order.edited'))
      expect(audit).not.toContain('Another road') // the audit trail never holds an address
    }, 90_000)

    it('a confirmed order can still change its address and notes, but not its lines, city or method; a dispatched one nothing', async () => {
      await ready()
      const order = await place(await S.product({ stock: 5 }))
      await go(order.id, { version: 1, to: 'confirmed', via: 'call' })
      await transaction(t.db, (tx) => svc.edit(tx, order.id, { version: 2, shippingAddress: { cityId: S.cityId, address: 'New house, New street, Lahore' } }, staff))
      const [line] = await t.db.select().from(orderLines)
      await expect(transaction(t.db, (tx) => svc.edit(tx, order.id, { version: 3, lines: [{ lineId: line?.id, quantity: 2 }] }, staff))).rejects.toMatchObject({ code: 'action_not_allowed' })
      await expect(transaction(t.db, (tx) => svc.edit(tx, order.id, { version: 3, shippingMethodId: S.expressId }, staff))).rejects.toMatchObject({ code: 'action_not_allowed' })
      await go(order.id, { version: 3, to: 'dispatched', courierId: courier.tcs, trackingNumber: 'T1' })
      await expect(transaction(t.db, (tx) => svc.edit(tx, order.id, { version: 4, shippingAddress: { cityId: S.cityId, address: 'Too late, dispatched already' } }, staff))).rejects.toMatchObject({ code: 'action_not_allowed' })
    }, 90_000)

    it('adding more than there is in stock is refused and leaves the order and the stock as they were', async () => {
      await ready()
      const p = await S.product({ stock: 3 })
      const order = await place(p, { quantity: 2 })
      const [line] = await t.db.select().from(orderLines)
      await expect(transaction(t.db, (tx) => svc.edit(tx, order.id, { version: 1, lines: [{ lineId: line?.id, quantity: 5 }] }, staff))).rejects.toMatchObject({ code: 'insufficient_stock', details: { variantId: p.variantId, available: 3 } })
      expect(await level(p.variantId)).toMatchObject({ onHand: 3, reserved: 2 })
      expect((await row(order.id)).version).toBe(1)
      expect((await t.db.select().from(orderLines))[0]?.quantity).toBe(2)
      await expect(transaction(t.db, (tx) => svc.edit(tx, order.id, { version: 1, lines: [] }, staff))).rejects.toMatchObject({ code: 'validation_failed' })
    }, 90_000)

    it('the promo is checked again: when the order falls below its minimum the preview says so, and saving gives the code back', async () => {
      await ready()
      await S.promo('BIG', { minSpend: pkr(300000) })
      const p = await S.product({ price: 200000, stock: 10 })
      const order = await place(p, { quantity: 2, promo: 'BIG' })
      expect(order).toMatchObject({ discountMinor: 40000, promoCode: 'BIG' })
      const [line] = await t.db.select().from(orderLines)
      const preview = await svc.previewEdit(t.db, order.id, { version: 1, lines: [{ lineId: line?.id, quantity: 1 }] })
      expect(preview).toMatchObject({ promoStillApplies: false, before: { discount: pkr(40000) }, after: { discount: pkr(0), subtotal: pkr(200000) } })
      expect((await row(order.id)).version).toBe(1) // a preview writes nothing
      const keep = await svc.previewEdit(t.db, order.id, { version: 1, lines: [{ lineId: line?.id, quantity: 3 }] })
      expect(keep).toMatchObject({ promoStillApplies: true, after: { discount: pkr(60000) } })

      const saved = await transaction(t.db, (tx) => svc.edit(tx, order.id, { version: 1, lines: [{ lineId: line?.id, quantity: 1 }] }, staff))
      expect(saved.promoDropped).toBe('promo_min_spend')
      expect(await row(order.id)).toMatchObject({ promoCode: null, discountMinor: 0 })
      expect((await t.db.select().from(promos))[0]?.usageCount).toBe(0)
      expect((await events(order.id)).at(-1)?.data).toMatchObject({ promoDropped: 'promo_min_spend' })
    }, 90_000)

    it('a code that still applies follows the new amounts, in the order and in its redemption', async () => {
      await ready()
      await S.promo('TEN')
      const order = await place(await S.product({ price: 100000, stock: 10 }), { quantity: 1, promo: 'TEN' })
      const [line] = await t.db.select().from(orderLines)
      await transaction(t.db, (tx) => svc.edit(tx, order.id, { version: 1, lines: [{ lineId: line?.id, quantity: 4 }] }, staff))
      expect(await row(order.id)).toMatchObject({ subtotalMinor: 400000, discountMinor: 40000 })
      expect((await t.db.select().from(promoRedemptions))[0]).toMatchObject({ discountMinor: 40000 })
      expect((await t.db.select().from(orderLines))[0]?.discountMinor).toBe(40000)
    }, 90_000)

    it('an out-of-date version is refused', async () => {
      await ready()
      const order = await place(await S.product({ stock: 5 }))
      await expect(transaction(t.db, (tx) => svc.edit(tx, order.id, { version: 9, shippingAddress: { cityId: S.cityId, address: 'Somewhere else, entirely' } }, staff))).rejects.toMatchObject({ code: 'stale_write' })
      await expect(svc.previewEdit(t.db, order.id, { version: 9 })).rejects.toMatchObject({ code: 'stale_write' })
    }, 90_000)
  })

  describe('the customer counters', () => {
    it('after a random sequence of changes on several orders they equal what the orders themselves say (DOC-09.7 section 8)', async () => {
      await ready()
      const p = await S.product({ price: 150000, stock: 60, maxPerOrder: 10 })
      let seed = 20261006
      const rnd = (/** @type {number} */ n) => ((seed = (seed * 1664525 + 1013904223) % 4294967296), seed % n)
      const ids = []
      for (let i = 0; i < 8; i++) ids.push((await place(p, { quantity: 1 + rnd(3), phone: i % 2 ? '03001234567' : '03217654321' })).id)
      for (let round = 0; round < 40; round++) {
        const id = /** @type {string} */ (ids[rnd(ids.length)])
        const o = await row(id)
        const v = o.version
        const lines = await t.db.select().from(orderLines).where(eq(orderLines.orderId, id))
        const pick = rnd(6)
        try {
          if (o.status === 'pending_confirmation') await go(id, pick < 4 ? { version: v, to: 'confirmed', via: 'call' } : { version: v, to: 'cancelled', reason: 'duplicate' })
          else if (o.status === 'confirmed') await go(id, pick < 4 ? { version: v, to: 'dispatched', courierId: courier.tcs, trackingNumber: 'T' + round } : pick === 4 ? { version: v, to: 'pending_confirmation', reason: 'again' } : { version: v, to: 'cancelled', reason: 'other' })
          else if (o.status === 'dispatched') await go(id, pick < 3 ? { version: v, to: 'delivered' } : { version: v, to: 'returned', returnType: 'refused_at_door', lines: lines.map((l) => ({ lineId: l.id, quantity: l.quantity - l.returnedQuantity, restock: pick % 2 === 0 })) })
          else if (o.status === 'delivered') {
            const open = lines.filter((l) => l.returnedQuantity < l.quantity)
            if (open.length && pick < 3) {
              const one = /** @type {NonNullable<(typeof open)[number]>} */ (open[0])
              const all = pick === 0 // everything left, or one unit of the first line
              await go(id, { version: v, to: 'returned', returnType: 'customer_return', lines: all ? open.map((l) => ({ lineId: l.id, quantity: l.quantity - l.returnedQuantity, restock: true })) : [{ lineId: one.id, quantity: 1, restock: pick === 1 }] })
            }
          }
        } catch (e) {
          if (!['invalid_transition', 'validation_failed'].includes(/** @type {{ code: string }} */ (e).code)) throw e // a refused step changes nothing and is part of a random walk
        }
      }
      // what the orders say, worked out again from their rows
      const all = await t.db.select().from(orders)
      expect(new Set(all.map((o) => o.status)).size).toBeGreaterThanOrEqual(3) // the walk really went somewhere
      const allLines = await t.db.select().from(orderLines)
      const worth = (/** @type {typeof allLines[number]} */ l, /** @type {number} */ q) => Math.round(((l.lineSubtotalMinor - l.discountMinor) * q) / l.quantity)
      const returnedBeforeClose = (/** @type {string} */ id) => allLines.filter((l) => l.orderId === id).reduce((n, l) => n + worth(l, l.returnedQuantity), 0)
      for (const phone of ['+923001234567', '+923217654321']) {
        const mine = all.filter((o) => o.customerPhone === phone)
        const refusedOrders = []
        for (const o of mine.filter((x) => x.status === 'returned')) if ((await events(o.id)).some((e) => /** @type {{ returnType?: string } | null} */ (e.data)?.returnType === 'refused_at_door')) refusedOrders.push(o)
        const expected = {
          ordersCount: mine.filter((o) => o.status !== 'cancelled').length,
          cancelledCount: mine.filter((o) => o.status === 'cancelled').length,
          deliveredCount: mine.filter((o) => o.status === 'delivered').length,
          refusedCount: refusedOrders.length,
          spentMinor: mine.filter((o) => o.status === 'delivered').reduce((n, o) => n + o.totalMinor - returnedBeforeClose(o.id), 0),
        }
        const c = (await t.db.select().from(customers)).find((x) => x.phone === phone)
        expect({ phone, ...Object.fromEntries(Object.keys(expected).map((k) => [k, /** @type {Record<string, unknown>} */ (c)[k]])) }).toEqual({ phone, ...expected })
      }
      // and the stock agrees with the orders: reserved is what unconfirmed-or-confirmed orders hold
      const holding = all.filter((o) => ['pending_confirmation', 'confirmed'].includes(o.status)).reduce((n, o) => n + allLines.filter((l) => l.orderId === o.id).reduce((m, l) => m + l.quantity, 0), 0)
      expect((await level(p.variantId))?.reserved).toBe(holding)
    }, 180_000)
  })

  describe('notes, attempts and what the screens may offer', () => {
    it('a note is private; confirmation attempts are logged only while the order waits for confirmation', async () => {
      await ready()
      const order = await place(await S.product({ stock: 5 }))
      const note = await transaction(t.db, (tx) => svc.addNote(tx, order.id, 'Customer called, will pay on delivery', staff))
      expect(note).toMatchObject({ type: 'note', actorLabel: 'Hina Fulfilment', data: { body: 'Customer called, will pay on delivery' } })
      const attempt = await transaction(t.db, (tx) => svc.logAttempt(tx, order.id, { channel: 'call', outcome: 'no_answer' }, staff))
      expect(attempt.data).toEqual({ channel: 'call', outcome: 'no_answer' })
      expect((await events(order.id)).filter((e) => e.public)).toHaveLength(1) // only "placed": notes and attempts are staff-only
      await go(order.id, { version: 1, to: 'confirmed', via: 'call' })
      await expect(transaction(t.db, (tx) => svc.logAttempt(tx, order.id, { channel: 'call', outcome: 'busy' }, staff))).rejects.toMatchObject({ code: 'action_not_allowed' })
      await expect(transaction(t.db, (tx) => svc.addNote(tx, uuidv7(), 'x', staff))).rejects.toMatchObject({ code: 'not_found' })
    }, 90_000)

    it('describe: the actions of the order now, and the markers of this customer', async () => {
      await ready()
      const p = await S.product({ price: 3000000, stock: 5 })
      const first = await place(p)
      expect((await svc.describe(t.db, first.id)).allowedActions).toEqual(['confirm', 'edit_address', 'edit_items', 'cancel', 'record_payment'])
      expect((await svc.describe(t.db, first.id)).riskMarkers).toEqual(['high_value']) // Rs. 30,000 by cash on delivery
      await dispatched(first.id)
      await go(first.id, { version: 3, to: 'delivered' })
      const second = await place(p) // the same phone again, within a day
      const d = await svc.describe(t.db, second.id)
      expect(d.riskMarkers.sort()).toEqual(['duplicate_suspect', 'high_value', 'repeat_customer'])
      expect(d.duplicateOf).toMatchObject({ id: first.id, orderNumber: first.numberPrefix + '-' + first.number })
      await t.db.update(customers).set({ noCod: true, refusedCount: 1 })
      expect((await svc.describe(t.db, second.id)).riskMarkers).toEqual(expect.arrayContaining(['cod_blocked', 'refused_before']))
      await expect(svc.describe(t.db, uuidv7())).rejects.toMatchObject({ code: 'not_found' })
    }, 90_000)
  })
})
