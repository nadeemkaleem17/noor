// M4-10: orders for staff, on a scratch database and through HTTP: the list, one order in full and masked for those who may not read customers, every change
// through the one function that makes it, staff-typed orders and their quote, bulk actions and the export.
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { edges } from '../src/modules/orders/transitions.js'
import { TransitionBody } from '@noor/contract'
import { auditLog } from '../src/db/schema/audit.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { carts } from '../src/db/schema/cart.js'
import { pages, settings } from '../src/db/schema/content.js'
import { customers } from '../src/db/schema/customers.js'
import { inventoryLevels, reservations } from '../src/db/schema/inventory.js'
import { notificationLog } from '../src/db/schema/notifications.js'
import { orders } from '../src/db/schema/orders.js'
import { paymentEvents, payments } from '../src/db/schema/payments.js'
import { counters, idempotencyKeys, jobs, outboxEvents, rateLimitHits } from '../src/db/schema/platform.js'
import { products } from '../src/db/schema/products.js'
import { promoRedemptions, promos } from '../src/db/schema/promotions.js'
import { cities, couriers, shippingZones } from '../src/db/schema/shipping.js'
import { categories, formSchemas } from '../src/db/schema/taxonomy.js'
import { uuidv7 } from '../src/platform/ids.js'
import { closeHarness, createHarness, signedIn, t } from './support/staff.js'
import { add, createShop, shop } from './support/shop.js'
import { dbAvailable } from './support/db.js'

const S = createShop()
let tcs = ''
let seq = 0
const PHONE = '0300 1234567'

/** @param {{ variantId: string }} p @param {{ method?: string, phone?: string, name?: string, email?: string }} [o] */
async function place(p, { method = 'cod', phone = `0300${String(1000000 + ++seq).slice(-7)}`, name = 'Sana Malik', email = 'sana.private@example.com' } = {}) {
  const token = (await add(undefined, p.variantId, 1)).body.cartToken
  const r = await shop('POST', '/orders', {
    token, headers: { 'idempotency-key': uuidv7() },
    body: { customer: { name, phone, email }, shippingAddress: { cityId: S.cityId, address: 'House 12, Street 4, Gulberg III' }, shippingMethodId: S.methodId, paymentMethod: method },
  })
  if (r.status !== 201) throw new Error(JSON.stringify(r.body))
  const order = /** @type {typeof orders.$inferSelect} */ ((await t.db.select().from(orders)).find((o) => `${o.numberPrefix}-${o.number}` === r.body.orderNumber))
  return { order, id: order.id, number: /** @type {string} */ (r.body.orderNumber), phone }
}
const key = () => ({ 'idempotency-key': uuidv7() })

describe.skipIf(!dbAvailable)('admin orders (MySQL, through HTTP)', () => {
  beforeAll(createHarness, 60_000)
  afterAll(closeHarness)
  afterEach(async () => {
    await t.migrate.db.delete(auditLog)
    await t.db.delete(notificationLog)
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
  const ready = async () => {
    await S.setup()
    await S.delivery()
    tcs = (await S.owner.call('POST', '/admin/couriers', { body: { name: 'TCS', trackingRequired: false, enabled: true } })).body.id
  }
  const get = (/** @type {string} */ ref, b = S.owner) => b.call('GET', `/admin/orders/${ref}`)
  const to = (/** @type {string} */ id, /** @type {object} */ body, b = S.owner) => b.call('POST', `/admin/orders/${id}/transitions`, { body })

  it('the transition body has one variant for each way an order may go', () => {
    const wanted = new Set(Object.values(edges).flat())
    const offered = new Set(TransitionBody.options.map((o) => o.shape.to.value))
    expect(offered).toEqual(wanted)
  })

  describe('finding orders', () => {
    it('lists with filters, search by number, name, phone and tracking number, pages, and sorts; counts for the tabs', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 9 })
      const a = await place(p, { name: 'Sana Malik' })
      const b = await place(p, { name: 'Ayesha Khan', phone: '03211111111' })
      const c = await place(p, { method: 'cod', name: 'Hina Raza' })
      await to(b.id, { version: 1, to: 'confirmed', via: 'call' })

      const list = async (/** @type {string} */ qs = '') => (await S.owner.call('GET', `/admin/orders${qs}`)).body
      expect((await list()).total).toBe(3)
      expect((await list()).items.map((/** @type {{ id: string }} */ r) => r.id)).toEqual([c.id, b.id, a.id]) // newest first
      expect((await list('?status=confirmed')).items.map((/** @type {{ id: string }} */ r) => r.id)).toEqual([b.id])
      expect((await list('?status=confirmed,pending_confirmation')).total).toBe(3)
      expect((await list(`?q=${a.number}`)).items.map((/** @type {{ id: string }} */ r) => r.id)).toEqual([a.id])
      expect((await list(`?q=${a.number.split('-')[1]}`)).total).toBe(1)
      expect((await list('?q=ayesha')).total).toBe(1)
      expect((await list('?q=3211111')).total).toBe(1)
      expect((await list('?paymentMethod=bank_transfer')).total).toBe(0)
      expect((await list('?hasDeposit=1')).total).toBe(0)
      expect((await list(`?customerId=${a.order.customerId}`)).total).toBe(1)
      expect((await list('?page=2&size=50')).items).toEqual([])
      expect((await list('?sort=total')).total).toBe(3)
      const row = (await list(`?q=${a.number}`)).items[0]
      expect(row).toMatchObject({ orderNumber: a.number, customerName: 'Sana Malik', city: 'Lahore', itemCount: 1, firstItemTitle: expect.any(String), total: { amount: 225000 }, paymentMethod: 'cod', paymentStatus: 'unpaid' })
      expect((await S.owner.call('GET', '/admin/orders/counts')).body).toEqual({ pending: 0, pending_confirmation: 2, confirmed: 1, dispatched: 0, delivered: 0, cancelled: 0, returned: 0 })
      // the dispatch dialog and the city filter read their choices without settings:read
      const look = await (await signedIn('fulfilment')).b.call('GET', '/admin/orders/lookups')
      expect(look.status).toBe(200)
      expect(look.body.couriers).toEqual([{ id: tcs, name: 'TCS', trackingRequired: false }])
      expect(look.body.cities.some((/** @type {{ name: string }} */ c) => c.name === 'Lahore')).toBe(true)
      // a tab of orders waiting for somebody lists the oldest first
      expect((await list('?status=pending_confirmation')).items.map((/** @type {{ id: string }} */ r) => r.id)).toEqual([a.id, c.id])
    }, 120_000)

    it('one order in full: by id or by the number on the screen, with its lines, money, history and what may be done next', async () => {
      await ready()
      const o = await place(await S.product({ price: 200000, stock: 5 }))
      const byId = (await get(o.id)).body
      for (const ref of [o.number, o.number.toLowerCase(), o.number.split('-')[1] ?? '']) expect((await get(ref)).body.id).toBe(o.id)
      expect((await get('RB-99999999')).status).toBe(404)
      expect((await get('nonsense')).status).toBe(404)
      expect(byId).toMatchObject({
        orderNumber: o.number, status: 'pending_confirmation', channel: 'storefront', version: 1,
        customer: { name: 'Sana Malik', email: 'sana.private@example.com', ordersCount: 1 },
        shippingAddress: { city: 'Lahore', address: 'House 12, Street 4, Gulberg III' },
        shipping: { label: 'Standard', fee: { amount: 25000 } },
        total: { amount: 225000 }, paid: { amount: 0 }, dueOnDelivery: { amount: 225000 }, paymentMethod: 'cod',
        payments: [{ kind: 'full', state: 'pending_confirmation', amount: { amount: 225000 } }],
        confirmationAttempts: 0, allowedActions: expect.arrayContaining(['confirm', 'edit_address', 'edit_items', 'cancel']),
      })
      expect(byId.lines).toHaveLength(1)
      expect(byId.events[0]).toMatchObject({ type: 'placed', actorType: 'storefront' })
      expect(byId.customerLink).toMatch(/^http:\/\/localhost:5174\/orders\/[\w-]{43}$/)
      expect(byId.whatsappConfirmUrl).toMatch(/^https:\/\/wa\.me\/923\d{9}\?text=Hi%20Sana%2C%20this%20is%20/)
      expect(byId.whatsappConfirmUrl).not.toContain(o.id)
    }, 90_000)

    it('without customers:read a viewer sees the order masked: no email, no address line, no phone, no way to message the customer', async () => {
      await ready()
      const o = await place(await S.product({ price: 200000, stock: 5 }), { phone: PHONE })
      const viewer = (await signedIn('viewer')).b
      const r = await get(o.id, viewer)
      expect(r.status).toBe(200)
      expect(r.body.customer).toMatchObject({ name: 'Sana M.', phone: '0300 ••••567' })
      expect(r.body.customer.email).toBeUndefined()
      expect(r.body.shippingAddress).toEqual({ cityId: expect.any(String), city: 'Lahore' })
      expect(r.body.whatsappConfirmUrl).toBeUndefined()
      const text = JSON.stringify(r.body)
      for (const secret of ['Gulberg', 'Street 4', 'sana.private', 'Sana Malik', '1234567', '+9230']) expect(text, secret).not.toContain(secret)

      const list = (await viewer.call('GET', `/admin/orders?q=${o.number}`)).body
      expect(list.items[0]).toMatchObject({ customerName: 'Sana M.', customerPhone: '0300 ••••567' })
      expect((await viewer.call('GET', '/admin/orders?q=sana')).body.total).toBe(0) // a name is not searchable without seeing it
      expect((await viewer.call('GET', '/admin/orders?q=1234567')).body.total).toBe(0)
      expect((await viewer.call('GET', `/admin/orders/${o.id}/invoice`)).body).toMatchObject({ customer: { name: 'Sana M.', phone: '0300 ••••567' }, shippingAddress: { city: 'Lahore', address: '' } })
    }, 90_000)
  })

  describe('changing an order', () => {
    it('confirm, dispatch and deliver, each by its own permission; a stale version and a wrong step are refused', async () => {
      await ready()
      const o = await place(await S.product({ price: 200000, stock: 5 }))
      const viewer = (await signedIn('viewer')).b
      expect(await to(o.id, { version: 1, to: 'confirmed', via: 'call' }, viewer)).toMatchObject({ status: 403, body: { code: 'forbidden' } })
      expect((await to(o.id, { version: 1, to: 'confirmed' })).status).toBe(400) // `via` is needed
      const confirmed = await to(o.id, { version: 1, to: 'confirmed', via: 'call' })
      expect(confirmed.body).toMatchObject({ status: 'confirmed', version: 2, allowedActions: expect.arrayContaining(['dispatch']) })
      expect(await to(o.id, { version: 1, to: 'dispatched', courierId: tcs })).toMatchObject({ status: 409, body: { code: 'stale_write' } })
      expect(await to(o.id, { version: 2, to: 'delivered' })).toMatchObject({ status: 409, body: { code: 'invalid_transition' } })
      const sent = await to(o.id, { version: 2, to: 'dispatched', courierId: tcs, trackingNumber: 'TCS-77' })
      expect(sent.body).toMatchObject({ status: 'dispatched', courier: { name: 'TCS' }, trackingNumber: 'TCS-77', invoiceNumber: expect.stringMatching(/^INV-\d{4}-\d{6}$/), allowedActions: ['deliver', 'return', 'update_tracking', 'record_payment'] })
      expect((await to(o.number, { version: 3, to: 'delivered', cashReceived: true })).body).toMatchObject({ status: 'delivered', paymentStatus: 'paid', paid: { amount: 225000 } })
      const fulfilment = (await signedIn('fulfilment')).b
      const p2 = await place(await S.product({ price: 200000, stock: 5 }))
      expect((await to(p2.id, { version: 1, to: 'cancelled', reason: 'duplicate' }, fulfilment)).body).toMatchObject({ status: 'cancelled', cancelReason: 'duplicate' }) // fulfilment may cancel
    }, 120_000)

    it('edit re-prices on the server and the preview says the same before anything is saved', async () => {
      await ready()
      const p = await S.product({ price: 100000, stock: 9 })
      const o = await place(p)
      const line = (await get(o.id)).body.lines[0]
      const body = { version: 1, lines: [{ lineId: line.id, quantity: 3 }] }
      const preview = await S.owner.call('POST', `/admin/orders/${o.id}/edit-preview`, { body })
      expect(preview.body).toMatchObject({ before: { subtotal: { amount: 100000 }, total: { amount: 125000 } }, after: { subtotal: { amount: 300000 }, total: { amount: 325000 } }, promoStillApplies: true })
      expect((await get(o.id)).body.total.amount).toBe(125000) // nothing written
      const edited = await S.owner.call('PUT', `/admin/orders/${o.id}`, { body })
      expect(edited.body).toMatchObject({ version: 2, total: { amount: 325000 }, lines: [{ quantity: 3 }] })
      expect((await t.db.select().from(inventoryLevels).where(eq(inventoryLevels.variantId, p.variantId)))[0]).toMatchObject({ reserved: 3 })
      expect((await S.owner.call('PUT', `/admin/orders/${o.id}`, { body: { ...body, total: { amount: 1, currency: 'PKR' } } })).status).toBe(400) // never a price from the client
      expect((await S.owner.call('PUT', `/admin/orders/${o.id}`, { body })).status).toBe(409) // the version moved on
    }, 90_000)

    it('notes and confirmation attempts go to the history; attempts only while waiting for confirmation', async () => {
      await ready()
      const o = await place(await S.product({ price: 200000, stock: 5 }))
      const note = await S.owner.call('POST', `/admin/orders/${o.id}/notes`, { body: { body: 'Customer asked for a gift wrap' } })
      expect(note).toMatchObject({ status: 201, body: { type: 'note', actorType: 'staff', data: { body: 'Customer asked for a gift wrap' } } })
      expect((await S.owner.call('POST', `/admin/orders/${o.id}/notes`, { body: { body: '' } })).status).toBe(400)
      const attempt = await S.owner.call('POST', `/admin/orders/${o.id}/confirmation-attempts`, { body: { channel: 'call', outcome: 'no_answer' } })
      expect(attempt).toMatchObject({ status: 201, body: { type: 'confirmation_attempt', data: { channel: 'call', outcome: 'no_answer' } } })
      expect((await get(o.id)).body).toMatchObject({ confirmationAttempts: 1, events: expect.arrayContaining([expect.objectContaining({ type: 'note' })]) })
      await to(o.id, { version: 1, to: 'confirmed', via: 'call' })
      expect((await S.owner.call('POST', `/admin/orders/${o.id}/confirmation-attempts`, { body: { channel: 'call', outcome: 'busy' } })).status).toBe(409)
      expect((await (await signedIn('viewer')).b.call('POST', `/admin/orders/${o.id}/notes`, { body: { body: 'x' } })).status).toBe(403)
    }, 90_000)

    it('a payment is recorded once per Idempotency-Key; a refund above what was paid is refused; the tracking of a parcel on its way can be corrected', async () => {
      await ready()
      const o = await place(await S.product({ price: 200000, stock: 5 }))
      const pay = (/** @type {object} */ body, /** @type {string} */ k) => S.owner.call('POST', `/admin/orders/${o.id}/payments`, { body, headers: { 'idempotency-key': k } })
      const body = { kind: 'full', amount: { amount: 100000, currency: 'PKR' }, method: 'cash', reference: 'Receipt 7' }
      const k = uuidv7()
      const first = await pay(body, k)
      expect(first).toMatchObject({ status: 201, body: { paid: { amount: 100000 }, payments: expect.arrayContaining([expect.objectContaining({ state: 'captured', reference: 'Receipt 7', recordedBy: expect.any(String) })]) } })
      expect((await pay(body, k)).body.payments).toEqual(first.body.payments)
      expect((await t.db.select().from(payments).where(eq(payments.orderId, o.id))).filter((x) => x.provider === 'manual')).toHaveLength(1)
      expect((await pay({ ...body, kind: 'refund', amount: { amount: 100001, currency: 'PKR' } }, uuidv7())).status).toBe(400)
      expect((await S.owner.call('POST', `/admin/orders/${o.id}/payments`, { body })).status).toBe(400) // no key

      await to(o.id, { version: 1, to: 'confirmed', via: 'call' })
      await to(o.id, { version: 2, to: 'dispatched', courierId: tcs, trackingNumber: 'WRONG' })
      const fixed = await S.owner.call('PUT', `/admin/orders/${o.id}/tracking`, { body: { courierId: tcs, trackingNumber: 'RIGHT-1', version: 3 } })
      expect(fixed.body).toMatchObject({ trackingNumber: 'RIGHT-1', version: 4 })
    }, 120_000)
  })

  describe('an order typed by staff', () => {
    it('is priced by the server, marked as staff work, and confirmed at once when the customer was phoned; no cart is left behind', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 5 })
      const body = {
        customer: { name: 'Hina Raza', phone: '0345 1112223' }, shippingAddress: { cityId: S.cityId, address: 'Flat 4, Block B, DHA Phase 5' }, shippingMethodId: S.methodId, paymentMethod: 'cod',
        lines: [{ variantId: p.variantId, quantity: 2 }], confirmedOnCall: true, note: 'Ordered by phone',
      }
      const quote = await S.owner.call('POST', '/admin/orders/quote', { body: { lines: body.lines, cityId: S.cityId, shippingMethodId: S.methodId, phone: '0345 1112223' } })
      expect(quote).toMatchObject({ status: 200, body: { subtotal: { amount: 400000 }, total: { amount: 425000 } } })
      expect(await t.db.select().from(carts)).toEqual([])

      const k = uuidv7()
      const made = await S.owner.call('POST', '/admin/orders', { body, headers: { 'idempotency-key': k } })
      expect(made).toMatchObject({ status: 201, body: { channel: 'admin', status: 'confirmed', total: { amount: 425000 }, customer: { name: 'Hina Raza' } } })
      expect(made.body.events.map((/** @type {{ type: string }} */ e) => e.type)).toEqual(expect.arrayContaining(['placed', 'note', 'status_changed']))
      expect(made.body.events.find((/** @type {{ type: string }} */ e) => e.type === 'placed')).toMatchObject({ actorType: 'staff' })
      expect((await t.db.select().from(orders).where(eq(orders.id, made.body.id)))[0]?.createdBy).toBeTruthy()
      expect(await t.db.select().from(carts)).toEqual([])
      expect((await t.db.select().from(inventoryLevels).where(eq(inventoryLevels.variantId, p.variantId)))[0]).toMatchObject({ reserved: 2 })

      const again = await S.owner.call('POST', '/admin/orders', { body, headers: { 'idempotency-key': k } })
      expect(again.body.id).toBe(made.body.id)
      expect(await t.db.select().from(orders)).toHaveLength(1)
    }, 120_000)

    it('refuses a price from the client, too much stock, and an unknown variant; a code is the only discount', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 2 })
      const base = { customer: { name: 'Hina Raza', phone: '0345 1112223' }, shippingAddress: { cityId: S.cityId, address: 'Flat 4, Block B, DHA Phase 5' }, shippingMethodId: S.methodId, paymentMethod: 'cod', lines: [{ variantId: p.variantId, quantity: 1 }] }
      const post = (/** @type {object} */ b) => S.owner.call('POST', '/admin/orders', { body: b, headers: key() })
      expect((await post({ ...base, total: { amount: 1, currency: 'PKR' } })).status).toBe(400)
      expect((await post({ ...base, discount: { amount: 1, currency: 'PKR' } })).status).toBe(400)
      expect((await post({ ...base, lines: [{ variantId: p.variantId, quantity: 3 }] })).status).toBe(409)
      expect((await post({ ...base, lines: [{ variantId: uuidv7(), quantity: 1 }] })).status).toBeGreaterThanOrEqual(400)
      expect((await post({ ...base, lines: [] })).status).toBe(400)
      expect(await t.db.select().from(orders)).toEqual([])
      expect(await t.db.select().from(carts)).toEqual([])
      await S.promo('STAFF10')
      expect((await post({ ...base, promoCode: 'STAFF10' })).body).toMatchObject({ discount: { amount: 20000 }, promoCode: 'STAFF10', total: { amount: 205000 } })
      expect((await (await signedIn('viewer')).b.call('POST', '/admin/orders', { body: base, headers: key() })).status).toBe(403)
    }, 120_000)
  })

  describe('many at once and out of the system', () => {
    it('bulk confirm and dispatch: each order on its own, the unknown one listed, the rest done; delivery by its own permission', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 9 })
      const [a, b, c] = [await place(p), await place(p), await place(p)]
      const bulk = (/** @type {object} */ body, br = S.owner) => br.call('POST', '/admin/orders/bulk', { body })
      expect((await bulk({ ids: [a.id, b.number, c.id], action: 'confirm', params: { via: 'call' } })).body).toEqual({ succeeded: [a.id, b.number, c.id], failed: [] })
      const sent = await bulk({ ids: [a.number, 'RB-99999999', b.id, c.id], action: 'dispatch', params: { courierId: tcs, tracking: [{ orderNumber: a.number, trackingNumber: 'T-1' }, { orderNumber: b.number, trackingNumber: 'T-2' }] } })
      expect(sent.body).toEqual({ succeeded: [a.number, b.id, c.id], failed: [{ id: 'RB-99999999', code: 'not_found' }] })
      expect((await get(a.id)).body).toMatchObject({ status: 'dispatched', trackingNumber: 'T-1' })
      expect((await get(b.id)).body.trackingNumber).toBe('T-2')
      expect((await get(c.id)).body.trackingNumber).toBeUndefined()
      const again = await bulk({ ids: [a.id], action: 'confirm', params: { via: 'call' } }) // already on its way
      expect(again.body).toEqual({ succeeded: [], failed: [{ id: a.id, code: 'invalid_transition' }] })
      const done = await bulk({ ids: [a.id, b.id], action: 'deliver', params: { cashReceived: true } })
      expect(done.body.succeeded).toHaveLength(2)
      expect((await bulk({ ids: [c.id], action: 'deliver', params: { cashReceived: false } }, (await signedIn('viewer')).b)).status).toBe(403)
      expect((await bulk({ ids: [], action: 'confirm', params: { via: 'call' } })).status).toBe(400)
    }, 150_000)

    it('a promo preview gives the discount the storefront cart gives for the same lines', async () => {
      await ready()
      const p = await S.product({ price: 300000, stock: 9 })
      const promo = { code: 'SAME10', type: 'percent', percent: 10, scope: 'all', excludeSaleItems: true, firstOrderOnly: false, enabled: true }
      expect((await S.owner.call('POST', '/admin/promos', { body: promo })).status).toBe(201)
      const preview = await S.owner.call('POST', '/admin/promos/preview', { body: { promo, lines: [{ variantId: p.variantId, quantity: 2 }] } })
      const token = (await add(undefined, p.variantId, 2)).body.cartToken
      const applied = await shop('PUT', '/cart/promo', { token, body: { code: 'SAME10' } })
      expect(applied.status).toBe(200)
      expect(preview.body.discount).toEqual(applied.body.discount)
      expect(preview.body.discount.amount).toBe(60000)
    }, 90_000)

    it('the invoice has the store, the lines and what to collect, and takes nothing from the order', async () => {
      await ready()
      const o = await place(await S.product({ price: 200000, stock: 5 }))
      const inv = (await S.owner.call('GET', `/admin/orders/${o.id}/invoice`)).body
      expect(inv).toMatchObject({ orderNumber: o.number, customer: { name: 'Sana Malik' }, shippingAddress: { city: 'Lahore', address: 'House 12, Street 4, Gulberg III' }, totals: { total: { amount: 225000 } }, paid: { amount: 0 }, amountToCollect: { amount: 225000 }, paymentMethod: 'cod' })
      expect(inv.invoiceNumber).toBeUndefined() // numbers are given at dispatch, never by looking
      expect(inv.lines).toHaveLength(1)
      expect((await get(o.id)).body.invoiceNumber).toBeUndefined()
    }, 90_000)

    it('the export is a spreadsheet-safe file, written down in the audit log, limited to a year and 5,000 rows', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 9 })
      const o = await place(p, { name: '=HYPERLINK("http://evil","click")' })
      await place(p)
      const range = { from: new Date(Date.now() - 86_400_000).toISOString(), to: new Date(Date.now() + 86_400_000).toISOString() }
      await t.migrate.db.delete(auditLog)
      const r = await S.owner.call('POST', '/admin/orders/exports', { body: range })
      expect(r.status).toBe(200)
      expect(r.body.rowCount).toBe(2)
      expect(r.body.filename).toMatch(/^orders-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/)
      const text = /** @type {string} */ (r.body.csv)
      expect(text.charCodeAt(0)).toBe(0xfeff)
      const lines = text.slice(1).split('\r\n')
      expect(lines[0]).toBe('Order,Placed at,Status,Channel,Payment method,Payment status,Subtotal,Discount,Shipping,Total,Paid,Promo code,Customer,Phone,City,Address,Courier,Tracking number,Invoice')
      const mine = lines.find((l) => l.startsWith(o.number))
      expect(mine).toContain(',2000.00,0.00,250.00,2250.00,0.00,') // money in rupees with two decimals, in numeric columns
      expect(mine).toContain(`"'=HYPERLINK(""http://evil"",""click"")"`) // made text, never a formula
      expect((await t.db.select().from(auditLog)).filter((a) => a.action === 'order.exported')).toHaveLength(1)

      expect((await S.owner.call('POST', '/admin/orders/exports', { body: { from: range.from, to: new Date(Date.now() + 400 * 86_400_000).toISOString() } })).status).toBe(400)
      expect((await S.owner.call('POST', '/admin/orders/exports', { body: { from: range.to, to: range.from } })).status).toBe(400)
      expect((await (await signedIn('support')).b.call('POST', '/admin/orders/exports', { body: range })).status).toBe(403)
    }, 120_000)

    it('the customers export is the same kind of file, for those who may, and written down', async () => {
      await ready()
      await place(await S.product({ price: 200000, stock: 5 }), { name: 'Sana Malik' })
      await t.migrate.db.delete(auditLog)
      const r = await S.owner.call('POST', '/admin/customers/exports', { body: {} })
      expect(r.status).toBe(200)
      expect(r.body.rowCount).toBe(1)
      expect(/** @type {string} */ (r.body.csv).slice(1).split('\r\n')[1]).toMatch(/^Sana Malik,0300 \d{7},sana\.private@example\.com,Lahore,1,0,0,0,0\.00,/)
      expect((await t.db.select().from(auditLog)).filter((a) => a.action === 'customer.exported')).toHaveLength(1)
      expect((await (await signedIn('viewer')).b.call('POST', '/admin/customers/exports', { body: {} })).status).toBe(403)
    }, 90_000)
  })
})
