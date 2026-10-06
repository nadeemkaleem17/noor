// M4-07: the order as its customer meets it, on a scratch database and through HTTP: the page by token (masked), finding an order by number and phone with
// one answer for every failure, and the two things a customer does alone: cancel before confirmation, and ask for cash on delivery.
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { auditLog } from '../src/db/schema/audit.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { carts } from '../src/db/schema/cart.js'
import { pages, settings } from '../src/db/schema/content.js'
import { customers } from '../src/db/schema/customers.js'
import { inventoryLevels, reservations } from '../src/db/schema/inventory.js'
import { orderEvents, orders } from '../src/db/schema/orders.js'
import { paymentEvents, payments } from '../src/db/schema/payments.js'
import { counters, idempotencyKeys, jobs, outboxEvents, rateLimitHits } from '../src/db/schema/platform.js'
import { products } from '../src/db/schema/products.js'
import { promoRedemptions, promos } from '../src/db/schema/promotions.js'
import { cities, couriers, shippingZones } from '../src/db/schema/shipping.js'
import { categories, formSchemas } from '../src/db/schema/taxonomy.js'
import { transaction } from '../src/platform/db.js'
import { uuidv7 } from '../src/platform/ids.js'
import { createServices } from '../src/modules/services.js'
import { closeHarness, config, createHarness, t } from './support/staff.js'
import { add, createShop, shop } from './support/shop.js'
import { dbAvailable } from './support/db.js'

const S = createShop()
/** @type {ReturnType<typeof createServices>} */
let svc
/** @type {{ type: 'staff', id: string, label: string, role: 'owner' }} */
const staff = { type: 'staff', id: '', label: 'Hina Owner', role: 'owner' }
let tcs = ''

const PHONE = '0300 1234567'
const ADDRESS = 'House 12, Street 4, Gulberg III'
const EMAIL = 'sana.private@example.com'
const bank = { accountTitle: 'Rubaya', bank: 'HBL', accountNumber: 'PK00HABB0000000000', instructions: 'Thank you' }
/** @param {boolean} cod */
const methods = (cod) => ({ methods: [{ type: 'cod', enabled: cod, label: 'Cash on delivery', sortOrder: 0 }, { type: 'bank_transfer', enabled: true, label: 'Bank transfer', sortOrder: 1 }], bankTransfer: bank })

/** @param {{ variantId: string }} p @param {{ method?: string, phone?: string }} [o] */
async function place(p, { method = 'cod', phone = PHONE } = {}) {
  const token = (await add(undefined, p.variantId, 1)).body.cartToken
  const r = await shop('POST', '/orders', {
    token, headers: { 'idempotency-key': uuidv7() },
    body: { customer: { name: 'Sana Malik', phone, email: EMAIL }, shippingAddress: { cityId: S.cityId, address: ADDRESS }, shippingMethodId: S.methodId, paymentMethod: method },
  })
  if (r.status !== 201) throw new Error(JSON.stringify(r.body))
  const all = await t.db.select().from(orders)
  const order = /** @type {NonNullable<(typeof all)[number]>} */ (all.find((o) => `${o.numberPrefix}-${o.number}` === r.body.orderNumber))
  return { order, number: /** @type {string} */ (r.body.orderNumber), token: /** @type {string} */ (r.body.trackingToken) }
}
const row = async (/** @type {string} */ id) => /** @type {NonNullable<(typeof orders.$inferSelect)>} */ ((await t.db.select().from(orders).where(eq(orders.id, id)))[0])
const go = (/** @type {string} */ id, /** @type {object} */ change) => transaction(t.db, (tx) => svc.orders.transition(tx, id, /** @type {never} */ (change), staff))
const get = (/** @type {string} */ token) => shop('GET', `/orders/by-token/${token}`)
const act = (/** @type {string} */ token, /** @type {string} */ what, /** @type {object} */ body = {}, /** @type {string | undefined} */ ip = undefined) => shop('POST', `/orders/by-token/${token}/${what}`, { body, ...(ip ? { ip } : {}) })
const track = (/** @type {string} */ orderNumber, /** @type {string} */ phone, /** @type {string | undefined} */ ip = undefined) => shop('POST', '/orders/track', { body: { orderNumber, phone }, ...(ip ? { ip } : {}) })
/** The answer without the one thing that differs between two requests. @param {{ status: number, body: Record<string, unknown> }} r */
const same = (r) => JSON.stringify([r.status, { ...r.body, requestId: undefined }])

describe.skipIf(!dbAvailable)('public orders (MySQL, through HTTP)', () => {
  beforeAll(async () => {
    await createHarness()
    svc = createServices({ db: t.db, config })
  }, 60_000)
  afterAll(closeHarness)
  afterEach(async () => {
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
  const ready = async () => {
    await S.setup()
    staff.id = /** @type {{ id: string }} */ ((await t.db.select().from(staffUsers))[0]).id
    await S.delivery()
    tcs = (await S.owner.call('POST', '/admin/couriers', { body: { name: 'TCS', trackingRequired: false, enabled: true, trackingUrlPattern: 'https://track.example/{tracking}' } })).body.id
    await put(true, 0)
  }
  /** @param {boolean} cod @param {number} version */
  const put = async (cod, version) => {
    const r = await S.owner.call('PUT', '/admin/settings/payments', { body: { value: methods(cod), version } })
    if (r.status !== 200) throw new Error(JSON.stringify(r.body))
  }

  describe('the order page', () => {
    it('shows the order masked: no full phone, address or email anywhere in the answer', async () => {
      await ready()
      const { order, number, token } = await place(await S.product({ price: 200000, stock: 5 }))
      const r = await get(token)
      expect(r.status).toBe(200)
      expect(r.headers['cache-control']).toBe('private, no-store')
      expect(r.body).toMatchObject({
        orderNumber: number, status: 'pending_confirmation', total: { amount: 225000 }, subtotal: { amount: 200000 }, shippingFee: { amount: 25000 },
        paymentMethod: 'cod', paymentLabel: 'Cash on delivery', dueOnDelivery: { amount: 225000 }, paid: { amount: 0 },
        customer: { firstName: 'Sana M.', phoneMasked: '0300 ••••567' },
        delivery: { city: 'Lahore', addressMasked: 'House 12, St•••', methodLabel: 'Standard' },
        allowedActions: ['cancel'],
        timeline: [{ step: 'placed', current: true }, { step: 'confirmed', current: false }, { step: 'dispatched', current: false }, { step: 'delivered', current: false }],
      })
      expect(r.body.lines).toHaveLength(1)
      const text = JSON.stringify(r.body)
      for (const secret of ['1234567', 'Gulberg', 'Street 4', EMAIL, 'Malik', order.customerId, order.id, order.trackingTokenHash]) expect(text).not.toContain(secret)
      expect(r.body.delivery.eta).toBeDefined()
    }, 90_000)

    it('follows the order: confirmed, dispatched with a courier link, delivered, then nothing more to do', async () => {
      await ready()
      const { order, token } = await place(await S.product({ price: 200000, stock: 5 }))
      await go(order.id, { version: 1, to: 'confirmed', via: 'call' })
      expect((await get(token)).body).toMatchObject({ status: 'confirmed', timeline: [{ step: 'placed' }, { step: 'confirmed', current: true }, {}, {}], allowedActions: [] })
      await go(order.id, { version: 2, to: 'dispatched', courierId: tcs, trackingNumber: 'TCS 99/1' })
      const sent = (await get(token)).body
      expect(sent.delivery).toMatchObject({ courier: 'TCS', trackingNumber: 'TCS 99/1', trackingUrl: 'https://track.example/TCS%2099%2F1' })
      expect(sent.timeline[2]).toMatchObject({ step: 'dispatched', current: true })
      await go(order.id, { version: 3, to: 'delivered', cashReceived: true })
      const done = (await get(token)).body
      expect(done).toMatchObject({ status: 'delivered', paymentStatus: 'paid', paid: { amount: 225000 }, dueOnDelivery: { amount: 0 } })
      expect(done.delivery.eta).toBeUndefined()
    }, 90_000)

    it('a cancelled order says so, and when and why', async () => {
      await ready()
      const { order, token } = await place(await S.product({ price: 200000, stock: 5 }))
      await go(order.id, { version: 1, to: 'cancelled', reason: 'unreachable' })
      expect((await get(token)).body).toMatchObject({ status: 'cancelled', closed: { status: 'cancelled', reason: 'unreachable' }, allowedActions: [] })
    }, 90_000)

    it('a bank transfer shows the account until it is paid; a token of one order never opens another; a wrong token is not found', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 5 })
      const a = await place(p, { method: 'bank_transfer' })
      const b = await place(p, { phone: '03211111111' })
      const open = (await get(a.token)).body
      expect(open).toMatchObject({ status: 'pending', bankTransfer: bank, allowedActions: ['cancel', 'switch_to_cod'] })
      expect(open.orderNumber).toBe(a.number)
      expect((await get(b.token)).body.orderNumber).toBe(b.number)
      expect((await get(b.token)).body.bankTransfer).toBeUndefined()
      await svc.orders.recordPayment(a.order.id, /** @type {never} */ ({ kind: 'full', amount: { amount: 225000, currency: 'PKR' }, method: 'bank_transfer' }), staff, uuidv7())
      const paid = (await get(a.token)).body
      expect(paid.bankTransfer).toBeUndefined()
      expect(paid).toMatchObject({ status: 'confirmed', paymentStatus: 'paid', paid: { amount: 225000 } })
      // a link made under another TRACKING_KEY no longer opens anything
      const rotated = createServices({ db: t.db, config: { ...config, TRACKING_KEY: 'k'.repeat(40) } })
      await expect(rotated.orders.getByToken(a.token)).rejects.toMatchObject({ code: 'not_found' })
      for (const bad of ['nope', `${a.token}x`, a.token.slice(1)]) expect((await get(bad)).status).toBe(404)
    }, 90_000)
  })

  describe('finding an order by number and phone', () => {
    it('the right pair gives the token of the page; the number may be typed as it comes', async () => {
      await ready()
      const { number, token } = await place(await S.product({ price: 200000, stock: 5 }))
      const digits = number.split('-')[1] ?? ''
      for (const [n, ph] of [[number, PHONE], [number.toLowerCase(), '+92 300 1234567'], [` ${number.replace('-', ' ')} `, '300-1234567'], [digits, '03001234567']]) {
        const r = await track(n ?? '', ph ?? '')
        expect([n, r.status, r.body.trackingToken]).toEqual([n, 200, token])
      }
      expect((await get(token)).body.orderNumber).toBe(number)
    }, 90_000)

    it('a wrong phone, a wrong number, a malformed number and a malformed phone get byte-identical answers', async () => {
      await ready()
      const { number } = await place(await S.product({ price: 200000, stock: 5 }))
      const digits = Number(number.split('-')[1])
      const answers = [
        await track(number, '0300 7654321'), // wrong phone
        await track(`RB-${digits + 7}`, PHONE), // no such order
        await track('RB-???', PHONE), // not a number at all
        await track(number, 'call me'), // not a phone
        await track(`XX-${digits}`, PHONE), // right number, wrong prefix
        await track('', ''),
      ]
      expect(answers[0]?.status).toBe(404)
      expect(answers[0]?.body).toMatchObject({ code: 'order_not_found' })
      expect(new Set(answers.map(same)).size).toBe(1)
    }, 90_000)

    it('limits guesses: five an hour for one order number, however many addresses they come from', async () => {
      await ready()
      const { number } = await place(await S.product({ price: 200000, stock: 5 }))
      for (let i = 0; i < 5; i++) expect((await track(number, `030012345${i}0`)).status).toBe(404)
      const sixth = await track(number, PHONE) // even the right phone, from a new address
      expect(sixth.status).toBe(429)
      expect(sixth.body).toMatchObject({ code: 'rate_limited' })
    }, 90_000)

    it('limits one address to ten an hour', async () => {
      await ready()
      for (let i = 0; i < 10; i++) expect((await track(`RB-${20_000 + i}`, PHONE, '198.51.100.7')).status).toBe(404)
      expect((await track('RB-20011', PHONE, '198.51.100.7')).status).toBe(429)
    }, 90_000)
  })

  describe('cancelling', () => {
    it('before confirmation: the order is cancelled for "customer request", the stock goes back, and the history says the customer did it', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 5 })
      const { order, token } = await place(p)
      expect((await t.db.select().from(inventoryLevels).where(eq(inventoryLevels.variantId, p.variantId)))[0]).toMatchObject({ reserved: 1 })
      const r = await act(token, 'cancel', { reason: 'Ordered by mistake' })
      expect(r.status).toBe(200)
      expect(r.body).toMatchObject({ status: 'cancelled', closed: { status: 'cancelled', reason: 'customer_request' }, allowedActions: [] })
      expect(await row(order.id)).toMatchObject({ status: 'cancelled', cancelReason: 'customer_request' })
      expect((await t.db.select().from(inventoryLevels).where(eq(inventoryLevels.variantId, p.variantId)))[0]).toMatchObject({ reserved: 0, onHand: 5 })
      const last = (await t.db.select().from(orderEvents).where(eq(orderEvents.orderId, order.id))).at(-1)
      expect(last).toMatchObject({ actorType: 'storefront', toStatus: 'cancelled', data: { reason: 'customer_request', note: 'Ordered by mistake' } })
      expect((await act(token, 'cancel')).status).toBe(409) // again: it is already cancelled
    }, 90_000)

    it('not once the order is confirmed, and not when money has been paid', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 5 })
      const confirmed = await place(p)
      await go(confirmed.order.id, { version: 1, to: 'confirmed', via: 'call' })
      expect(await act(confirmed.token, 'cancel')).toMatchObject({ status: 409, body: { code: 'action_not_allowed' } })
      expect((await row(confirmed.order.id)).status).toBe('confirmed')

      const part = await place(p, { method: 'bank_transfer', phone: '03211111111' })
      await svc.orders.recordPayment(part.order.id, /** @type {never} */ ({ kind: 'full', amount: { amount: 10000, currency: 'PKR' }, method: 'bank_transfer' }), staff, uuidv7())
      expect(await act(part.token, 'cancel')).toMatchObject({ status: 409, body: { code: 'action_not_allowed' } })
      expect((await row(part.order.id)).status).toBe('pending')
    }, 90_000)

    it('rejects a reason that is too long, and an unknown token is not found', async () => {
      await ready()
      const { token } = await place(await S.product({ price: 200000, stock: 5 }))
      expect((await act(token, 'cancel', { reason: 'x'.repeat(201) })).status).toBe(400)
      expect((await act('nope', 'cancel')).status).toBe(404)
    }, 90_000)

    it('ten actions an hour for one token', async () => {
      await ready()
      const { token } = await place(await S.product({ price: 200000, stock: 5 }), { method: 'bank_transfer' })
      await svc.orders.recordPayment(/** @type {string} */ ((await t.db.select().from(orders))[0]?.id), /** @type {never} */ ({ kind: 'full', amount: { amount: 10000, currency: 'PKR' }, method: 'bank_transfer' }), staff, uuidv7())
      for (let i = 0; i < 10; i++) expect((await act(token, 'cancel')).status).toBe(409)
      expect((await act(token, 'cancel')).status).toBe(429)
    }, 90_000)
  })

  describe('asking for cash on delivery', () => {
    it('an unpaid prepaid order becomes cash on delivery and waits for the call', async () => {
      await ready()
      const { order, token } = await place(await S.product({ price: 200000, stock: 5 }), { method: 'bank_transfer' })
      const r = await act(token, 'switch-to-cod')
      expect(r.status).toBe(200)
      expect(r.body).toMatchObject({ status: 'pending_confirmation', paymentMethod: 'cod', dueOnDelivery: { amount: 225000 }, allowedActions: ['cancel'] })
      expect(r.body.bankTransfer).toBeUndefined()
      expect(await row(order.id)).toMatchObject({ status: 'pending_confirmation', paymentMethod: 'cod' })
      expect((await t.db.select().from(reservations))[0]?.expiresAt).toBeNull() // no longer on a clock
      expect(await act(token, 'switch-to-cod')).toMatchObject({ status: 409, body: { code: 'action_not_allowed' } })
    }, 90_000)

    it('is refused when cash on delivery is switched off, and the page does not offer it', async () => {
      await ready()
      const { order, token } = await place(await S.product({ price: 200000, stock: 5 }), { method: 'bank_transfer' })
      await put(false, 1)
      expect((await get(token)).body.allowedActions).toEqual(['cancel'])
      expect(await act(token, 'switch-to-cod')).toMatchObject({ status: 422, body: { code: 'payment_method_not_allowed' } })
      expect((await row(order.id)).status).toBe('pending')
    }, 90_000)

    it('is refused for a customer who is blocked from cash on delivery', async () => {
      await ready()
      const { order, token } = await place(await S.product({ price: 200000, stock: 5 }), { method: 'bank_transfer' })
      await t.db.update(customers).set({ noCod: true }).where(eq(customers.id, order.customerId))
      expect(await act(token, 'switch-to-cod')).toMatchObject({ status: 422, body: { code: 'payment_method_not_allowed' } })
    }, 90_000)
  })
})
