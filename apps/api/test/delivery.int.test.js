// Delivery people, runs, the rider's ledger and receipts (plan/18-delivery-assignment-ledger-receipts.md): through the real HTTP API on a scratch database.
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { auditLog } from '../src/db/schema/audit.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { carts } from '../src/db/schema/cart.js'
import { pages, settings } from '../src/db/schema/content.js'
import { customers } from '../src/db/schema/customers.js'
import { deliveryAssignments, deliveryPeople, deliveryRuns, receipts, riderLedger } from '../src/db/schema/delivery.js'
import { reservations } from '../src/db/schema/inventory.js'
import { orders } from '../src/db/schema/orders.js'
import { counters, idempotencyKeys, outboxEvents, rateLimitHits } from '../src/db/schema/platform.js'
import { payments } from '../src/db/schema/payments.js'
import { products } from '../src/db/schema/products.js'
import { promoRedemptions, promos } from '../src/db/schema/promotions.js'
import { cities, couriers, shippingZones } from '../src/db/schema/shipping.js'
import { categories, formSchemas } from '../src/db/schema/taxonomy.js'
import { transaction } from '../src/platform/db.js'
import { uuidv7 } from '../src/platform/ids.js'
import { createServices } from '../src/modules/services.js'
import { closeHarness, config, createHarness, signedIn, t } from './support/staff.js'
import { add, createShop, shop } from './support/shop.js'
import { dbAvailable } from './support/db.js'

const S = createShop()
/** @type {ReturnType<typeof createServices>['orders']} */
let svc
const staff = { type: /** @type {const} */ ('staff'), id: uuidv7(), label: 'Hina Fulfilment', role: 'fulfilment' }
let phoneSeq = 0

const orderBody = () => ({
  customer: { name: 'Sana Malik', phone: `0300 ${String(1_000_000 + ++phoneSeq)}` },
  shippingAddress: { cityId: S.cityId, address: 'House 12, Street 4, Gulberg', landmark: 'Near the park' },
  shippingMethodId: S.methodId,
  paymentMethod: 'cod',
})
/** An order placed through the shop. @param {{ variantId: string }} p */
async function place(p) {
  const token = (await add(undefined, p.variantId, 1)).body.cartToken
  const r = await shop('POST', '/orders', { token, body: orderBody(), headers: { 'idempotency-key': uuidv7() } })
  if (r.status !== 201) throw new Error(JSON.stringify(r.body))
  const all = await t.db.select().from(orders)
  return /** @type {NonNullable<(typeof all)[number]>} */ (all.find((o) => `${o.numberPrefix}-${o.number}` === r.body.orderNumber))
}
/** An order that is confirmed and so can be given to a rider. */
async function confirmed(/** @type {{ variantId: string }} */ p) {
  const o = await place(p)
  await transaction(t.db, (tx) => svc.transition(tx, o.id, { version: o.version, to: 'confirmed', via: 'call' }, staff))
  return row(o.id)
}
const row = async (/** @type {string} */ id) => /** @type {typeof orders.$inferSelect} */ ((await t.db.select().from(orders).where(eq(orders.id, id)))[0])
const call = async (/** @type {string} */ role, /** @type {string} */ method, /** @type {string} */ url, /** @type {object | undefined} */ body = undefined) => (await signedIn(role)).b.call(method, url, body ? { body } : {})

describe.skipIf(!dbAvailable)('delivery (MySQL, through HTTP)', () => {
  beforeAll(async () => {
    await createHarness()
    svc = createServices({ db: t.db, config }).orders
  }, 60_000)
  afterAll(closeHarness)
  afterEach(async () => {
    await t.migrate.db.delete(auditLog)
    await t.db.delete(riderLedger)
    await t.db.delete(receipts)
    await t.db.delete(deliveryAssignments)
    await t.db.delete(deliveryRuns)
    await t.db.delete(deliveryPeople)
    await t.db.delete(outboxEvents)
    await t.db.delete(idempotencyKeys)
    await t.db.delete(rateLimitHits)
    await t.db.delete(reservations)
    await t.db.delete(payments)
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
    const product = await S.product({ price: 500000, stock: 20 })
    const rider = await S.owner.call('POST', '/admin/delivery/people', { body: { name: 'Bilal Rider', phone: '0301 2223344', kind: 'freelancer', fee: { amount: 20000, currency: 'PKR' }, active: true } })
    if (rider.status !== 201) throw new Error(JSON.stringify(rider.body))
    return { product, rider: /** @type {{ id: string, version: number }} */ (rider.body) }
  }
  const balance = async (/** @type {string} */ personId) => (await S.owner.call('GET', `/admin/delivery/people/${personId}/ledger`)).body.closing.amount

  describe('people', () => {
    it('are made with the phone number written the standard way, listed with their balance, and changed with the version they read', async () => {
      const { rider } = await ready()
      expect((await S.owner.call('GET', '/admin/delivery/people')).body.items[0]).toMatchObject({ name: 'Bilal Rider', phone: '+923012223344', fee: { amount: 20000 }, balance: { amount: 0 }, ordersOut: 0 })
      const bad = await S.owner.call('POST', '/admin/delivery/people', { body: { name: 'X', phone: '12', kind: 'employee', active: true } })
      expect(bad.status).toBe(400)
      const ok = await S.owner.call('PUT', `/admin/delivery/people/${rider.id}`, { body: { name: 'Bilal R.', phone: '0301 2223344', kind: 'employee', active: true, version: rider.version } })
      expect(ok.body).toMatchObject({ name: 'Bilal R.', kind: 'employee', version: rider.version + 1 })
      const stale = await S.owner.call('PUT', `/admin/delivery/people/${rider.id}`, { body: { name: 'Again', phone: '0301 2223344', kind: 'employee', active: true, version: rider.version } })
      expect(stale.status).toBe(409)
    })
  })

  describe('assigning', () => {
    it('gives the confirmed orders to the rider in one run, and says why the others were skipped', async () => {
      const { product, rider } = await ready()
      const [a, b] = [await confirmed(product), await confirmed(product)]
      const pending = await place(product)
      const res = await S.owner.call('POST', '/admin/delivery/assign', { body: { personId: rider.id, orderIds: [a.id, b.id, pending.id, uuidv7(), a.id] } })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.number).toBe('RUN-0001')
      expect(res.body.assigned.sort()).toEqual([a.id, b.id].sort())
      expect(res.body.skipped.map((/** @type {{ code: string }} */ s) => s.code).sort()).toEqual(['not_assignable', 'not_found'])
      // an order already on a run is refused the second time; a new order joins the same open run
      const c = await confirmed(product)
      const again = await S.owner.call('POST', '/admin/delivery/assign', { body: { personId: rider.id, orderIds: [a.id, c.id] } })
      expect(again.body.runId).toBe(res.body.runId)
      expect(again.body.skipped).toEqual([expect.objectContaining({ id: a.id, code: 'already_assigned' })])
      const run = (await S.owner.call('GET', `/admin/delivery/runs/${res.body.runId}`)).body
      expect(run).toMatchObject({ number: 'RUN-0001', status: 'open', orders: 3, cashDue: { amount: 3 * a.totalMinor } })
      expect(run.assignments[0]).toMatchObject({ status: 'assigned', cashDue: { amount: a.totalMinor } })
    })

    it('does not give an order to a person who is switched off', async () => {
      const { product, rider } = await ready()
      await S.owner.call('PUT', `/admin/delivery/people/${rider.id}`, { body: { name: 'Bilal Rider', phone: '0301 2223344', kind: 'freelancer', active: false, version: rider.version } })
      const o = await confirmed(product)
      expect((await S.owner.call('POST', '/admin/delivery/assign', { body: { personId: rider.id, orderIds: [o.id] } })).status).toBe(400)
    })
  })

  describe('a run, the cash and the receipts', () => {
    it('puts the cash on the rider when the run goes out, takes the fee off when an order is delivered, and gives the customer a receipt', async () => {
      const { product, rider } = await ready()
      const [a, b] = [await confirmed(product), await confirmed(product)]
      const assigned = await S.owner.call('POST', '/admin/delivery/assign', { body: { personId: rider.id, orderIds: [a.id, b.id] } })
      const runId = assigned.body.runId
      const out = await S.owner.call('POST', `/admin/delivery/runs/${runId}/send-out`)
      expect(out.status, JSON.stringify(out.body)).toBe(200)
      expect(out.body.status).toBe('out')
      expect(await row(a.id)).toMatchObject({ status: 'dispatched', trackingNumber: 'RUN-0001', courierName: 'Own delivery' })
      expect(await balance(rider.id)).toBe(2 * a.totalMinor)
      expect((await S.owner.call('POST', `/admin/delivery/runs/${runId}/send-out`)).status).toBe(409) // it is already out
      expect((await S.owner.call('GET', '/admin/delivery/people')).body.items[0].ordersOut).toBe(2)

      const first = out.body.assignments.find((/** @type {{ orderId: string }} */ x) => x.orderId === a.id)
      const delivered = await S.owner.call('POST', `/admin/delivery/assignments/${first.id}/deliver`)
      expect(delivered.status, JSON.stringify(delivered.body)).toBe(200)
      expect(await row(a.id)).toMatchObject({ status: 'delivered', paidMinor: a.totalMinor })
      const line = delivered.body.assignments.find((/** @type {{ orderId: string }} */ x) => x.orderId === a.id)
      expect(line).toMatchObject({ status: 'delivered', collected: { amount: a.totalMinor }, receiptNumber: 'RC-000001' })
      // the rider still owes the cash of both orders; the fee for the delivered one is theirs
      expect(await balance(rider.id)).toBe(2 * a.totalMinor - 20000)
      expect((await S.owner.call('GET', `/admin/delivery/receipts/${line.receiptId}`)).body).toMatchObject({ number: 'RC-000001', kind: 'customer', amount: { amount: a.totalMinor }, status: 'issued', customerName: 'Sana Malik' })
      expect((await S.owner.call('POST', `/admin/delivery/assignments/${first.id}/deliver`)).status).toBe(409) // once
      const actions = (await t.db.select().from(auditLog)).map((e) => e.action)
      for (const action of ['delivery_person.created', 'delivery.assigned', 'delivery.sent_out', 'delivery.delivered']) expect(actions, action).toContain(action)
    })

    it('keeps the cash on the rider after a failed delivery, and takes it off when the parcel is back and the order returned', async () => {
      const { product, rider } = await ready()
      const o = await confirmed(product)
      const { body: assigned } = await S.owner.call('POST', '/admin/delivery/assign', { body: { personId: rider.id, orderIds: [o.id] } })
      const out = (await S.owner.call('POST', `/admin/delivery/runs/${assigned.runId}/send-out`)).body
      const id = out.assignments[0].id
      const failed = await S.owner.call('POST', `/admin/delivery/assignments/${id}/fail`, { body: { reason: 'Phone off, nobody home' } })
      expect(failed.body.assignments[0]).toMatchObject({ status: 'failed', failReason: 'Phone off, nobody home' })
      expect(await balance(rider.id)).toBe(o.totalMinor)
      expect((await S.owner.call('POST', `/admin/delivery/runs/${assigned.runId}/close`)).status).toBe(200) // nothing is still out: a failed one stays with its own record
      const back = await S.owner.call('POST', `/admin/delivery/assignments/${id}/return`)
      expect(back.status, JSON.stringify(back.body)).toBe(200)
      expect(back.body.assignments[0].status).toBe('returned')
      expect(await row(o.id)).toMatchObject({ status: 'returned' })
      expect(await balance(rider.id)).toBe(0)
      // the order may go to a rider again only if it is confirmed again: a returned order is not
      expect((await S.owner.call('POST', '/admin/delivery/assign', { body: { personId: rider.id, orderIds: [o.id] } })).body.skipped[0].code).toBe('not_assignable')
    })

    it('takes an order off a run that has not gone out, and a run that never went out is closed with nothing owed', async () => {
      const { product, rider } = await ready()
      const [a, b] = [await confirmed(product), await confirmed(product)]
      const { body: assigned } = await S.owner.call('POST', '/admin/delivery/assign', { body: { personId: rider.id, orderIds: [a.id, b.id] } })
      const run = (await S.owner.call('GET', `/admin/delivery/runs/${assigned.runId}`)).body
      const removed = await S.owner.call('POST', `/admin/delivery/assignments/${run.assignments[0].id}/remove`)
      expect(removed.body.orders).toBe(1)
      const closed = await S.owner.call('POST', `/admin/delivery/runs/${assigned.runId}/close`)
      expect(closed.body.status).toBe('closed')
      expect(await balance(rider.id)).toBe(0)
      // both orders are free again
      expect((await S.owner.call('POST', '/admin/delivery/assign', { body: { personId: rider.id, orderIds: [a.id, b.id] } })).body.assigned).toHaveLength(2)
    })

    it('refuses to close a run while an order is still out', async () => {
      const { product, rider } = await ready()
      const o = await confirmed(product)
      const { body: assigned } = await S.owner.call('POST', '/admin/delivery/assign', { body: { personId: rider.id, orderIds: [o.id] } })
      await S.owner.call('POST', `/admin/delivery/runs/${assigned.runId}/send-out`)
      expect((await S.owner.call('POST', `/admin/delivery/runs/${assigned.runId}/close`)).status).toBe(409)
    })
  })

  describe('the ledger', () => {
    it('takes a deposit with a receipt, pays a fee with a receipt, adjusts with a note, and a voided receipt reverses itself', async () => {
      const { product, rider } = await ready()
      const o = await confirmed(product)
      const { body: assigned } = await S.owner.call('POST', '/admin/delivery/assign', { body: { personId: rider.id, orderIds: [o.id] } })
      await S.owner.call('POST', `/admin/delivery/runs/${assigned.runId}/send-out`)
      const owed = o.totalMinor
      const dep = await S.owner.call('POST', `/admin/delivery/people/${rider.id}/deposit`, { body: { amount: 1000_00, note: 'Evening hand-in' } })
      expect(dep.status, JSON.stringify(dep.body)).toBe(201)
      expect(dep.body).toMatchObject({ number: 'DP-000001', kind: 'deposit', amount: { amount: 100000 } })
      expect(await balance(rider.id)).toBe(owed - 100000)
      const fee = await S.owner.call('POST', `/admin/delivery/people/${rider.id}/pay-fee`, { body: { amount: 20000 } })
      expect(fee.body).toMatchObject({ number: 'FP-000001', kind: 'fee' })
      expect(await balance(rider.id)).toBe(owed - 100000 + 20000)
      const adj = await S.owner.call('POST', `/admin/delivery/people/${rider.id}/adjust`, { body: { amount: -5000, note: 'Short change refunded to a customer' } })
      expect(adj.status, JSON.stringify(adj.body)).toBe(200)
      expect(adj.body.closing.amount).toBe(owed - 100000 + 20000 - 5000)

      const voided = await S.owner.call('POST', `/admin/delivery/receipts/${dep.body.id}/void`, { body: { reason: 'Wrong amount typed' } })
      expect(voided.body).toMatchObject({ status: 'void', voidReason: 'Wrong amount typed' })
      expect(await balance(rider.id)).toBe(owed + 20000 - 5000)
      expect((await S.owner.call('POST', `/admin/delivery/receipts/${dep.body.id}/void`, { body: { reason: 'Again' } })).status).toBe(409)
      const statement = (await S.owner.call('GET', `/admin/delivery/people/${rider.id}/ledger`)).body
      expect(statement.entries.map((/** @type {{ kind: string }} */ e) => e.kind)).toEqual(['cash_due', 'deposit', 'fee_paid', 'adjustment', 'reversal'])
      // the running balance is on every line, and the last one is the closing balance
      expect(statement.entries.at(-1).balance.amount).toBe(statement.closing.amount)
      // the rows of the ledger are never edited or removed: the receipt stays, marked void
      expect((await t.db.select().from(riderLedger)).length).toBe(5)
      const voidList = await S.owner.call('GET', '/admin/delivery/receipts?status=void')
      expect(voidList.status, JSON.stringify(voidList.body)).toBe(200)
      expect(voidList.body.items).toHaveLength(1)
      expect((await S.owner.call('GET', '/admin/delivery/receipts?kind=deposit')).body.total).toBe(1)
      const actions = (await t.db.select().from(auditLog)).map((e) => e.action)
      for (const action of ['delivery.deposit', 'delivery.fee_paid', 'delivery.adjustment', 'delivery.receipt_voided']) expect(actions, action).toContain(action)
    })

    it('shows a statement for a range of days with the balance carried in', async () => {
      const { product, rider } = await ready()
      const o = await confirmed(product)
      const { body: assigned } = await S.owner.call('POST', '/admin/delivery/assign', { body: { personId: rider.id, orderIds: [o.id] } })
      await S.owner.call('POST', `/admin/delivery/runs/${assigned.runId}/send-out`)
      const future = '2099-01-01'
      const later = (await S.owner.call('GET', `/admin/delivery/people/${rider.id}/ledger?from=${future}&to=${future}`)).body
      expect(later.entries).toEqual([])
      expect(later.opening.amount).toBe(o.totalMinor)
      expect(later.closing.amount).toBe(o.totalMinor)
    })

    it('shows the order its own delivery history', async () => {
      const { product, rider } = await ready()
      const o = await confirmed(product)
      const { body: assigned } = await S.owner.call('POST', '/admin/delivery/assign', { body: { personId: rider.id, orderIds: [o.id] } })
      const history = (await S.owner.call('GET', `/admin/orders/${o.id}/delivery`)).body.items
      expect(history).toEqual([expect.objectContaining({ runNumber: 'RUN-0001', personName: 'Bilal Rider', status: 'assigned', runId: assigned.runId })])
    })
  })

  describe('who may', () => {
    it('lets fulfilment assign and send out but not touch the ledger, and support only look', async () => {
      const { product, rider } = await ready()
      const o = await confirmed(product)
      const assign = await call('fulfilment', 'POST', '/admin/delivery/assign', { personId: rider.id, orderIds: [o.id] })
      expect(assign.status, JSON.stringify(assign.body)).toBe(200)
      expect((await call('fulfilment', 'GET', `/admin/delivery/people/${rider.id}/ledger`)).status).toBe(403)
      expect((await call('fulfilment', 'POST', `/admin/delivery/people/${rider.id}/deposit`, { amount: 100 })).status).toBe(403)
      expect((await call('support', 'GET', '/admin/delivery/runs')).status).toBe(200)
      expect((await call('support', 'POST', '/admin/delivery/assign', { personId: rider.id, orderIds: [o.id] })).status).toBe(403)
      expect((await call('catalog', 'GET', '/admin/delivery/people')).status).toBe(403)
      expect((await call('manager', 'POST', '/admin/delivery/receipts/' + uuidv7() + '/void', { reason: 'x' })).status).toBe(404)
      expect((await call('fulfilment', 'POST', '/admin/delivery/receipts/' + uuidv7() + '/void', { reason: 'x' })).status).toBe(403)
    })
  })
})
