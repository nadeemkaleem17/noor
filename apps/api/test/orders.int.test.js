// M4-04: placing an order through HTTP on a scratch database, including the five acceptance tests of ADR-0020.
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { auditLog } from '../src/db/schema/audit.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { carts, cartLines } from '../src/db/schema/cart.js'
import { pages, settings } from '../src/db/schema/content.js'
import { customers } from '../src/db/schema/customers.js'
import { inventoryLevels } from '../src/db/schema/inventory.js'
import { orderEvents, orderLines, orders } from '../src/db/schema/orders.js'
import { counters, idempotencyKeys, outboxEvents, rateLimitHits } from '../src/db/schema/platform.js'
import { payments } from '../src/db/schema/payments.js'
import { products, variants } from '../src/db/schema/products.js'
import { promoRedemptions, promos } from '../src/db/schema/promotions.js'
import { reservations } from '../src/db/schema/inventory.js'
import { cities, shippingZones } from '../src/db/schema/shipping.js'
import { categories, formSchemas } from '../src/db/schema/taxonomy.js'
import { setClock } from '../src/platform/clock.js'
import { uuidv7 } from '../src/platform/ids.js'
import { trackingHash, trackingToken } from '../src/modules/orders/tracking.js'
import { closeHarness, config, createHarness, t } from './support/staff.js'
import { add, createShop, pkr, shop } from './support/shop.js'
import { dbAvailable } from './support/db.js'

const S = createShop()

/** The body of a storefront order: a name, an address in Lahore, cash on delivery. @param {object} [over] */
const orderBody = (over = {}) => ({
  customer: { name: 'Sana Malik', phone: '0300 1234567' },
  shippingAddress: { cityId: S.cityId, address: 'House 12, Street 4, Gulberg', landmark: 'Near the park' },
  shippingMethodId: S.methodId,
  paymentMethod: 'cod',
  ...over,
})
/** `orders.create` with a fresh idempotency key unless one is given. @param {string | undefined} token @param {object} [body] @param {{ key?: string, ip?: string }} [o] */
const place = (token, body = orderBody(), { key = uuidv7(), ip } = {}) =>
  shop('POST', '/orders', { ...(token ? { token } : {}), body, headers: { 'idempotency-key': key }, ...(ip ? { ip } : {}) })
/** A cart with one line, ready to order. @param {{ variantId: string }} p @param {number} [quantity] */
const cartOf = async (p, quantity = 1) => (await add(undefined, p.variantId, quantity)).body.cartToken
const level = async (/** @type {string} */ variantId) => (await t.db.select().from(inventoryLevels).where(eq(inventoryLevels.variantId, variantId)))[0]

describe.skipIf(!dbAvailable)('orders (MySQL, through HTTP)', () => {
  beforeAll(async () => {
    await createHarness()
  }, 60_000)
  afterAll(closeHarness)
  afterEach(async () => {
    setClock(null)
    await t.migrate.db.delete(auditLog)
    await t.db.delete(outboxEvents)
    await t.db.delete(idempotencyKeys)
    await t.db.delete(rateLimitHits) // five orders per phone in ten minutes is a rule of the product, not of every test
    await t.db.delete(reservations)
    await t.db.delete(payments)
    await t.db.delete(orders) // lines and events go with them
    await t.db.delete(carts)
    await t.db.delete(promoRedemptions)
    await t.db.delete(promos)
    await t.db.delete(customers)
    await t.migrate.pool.query('DELETE FROM inventory_movements')
    await t.db.delete(products)
    await t.db.delete(formSchemas)
    await t.db.delete(shippingZones)
    await t.db.delete(cities)
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
  }

  describe('a cash on delivery order', () => {
    it('is written with everything copied into it, holds the stock, takes number 10001 and gives back a link', async () => {
      await ready()
      const p = await S.product({ price: 450000, stock: 5, title: 'Embroidered lawn' })
      const token = await cartOf(p, 2)
      const r = await place(token, orderBody({ customer: { name: 'Sana Malik', phone: '0300 1234567', email: 'sana@example.com' }, shippingAddress: { cityId: S.cityId, address: 'House 12, Street 4, Gulberg', landmark: 'Near the park', notes: 'Call first' } }))
      expect(r.status).toBe(201)
      expect(r.body).toMatchObject({ orderNumber: 'RB-10001', status: 'pending_confirmation', total: pkr(900000) }) // 2 x 4,500 is over Rs. 5,000: delivery is free
      expect(r.body.trackingToken).toBe(trackingToken(config, (await t.db.select().from(orders))[0]?.id ?? ''))
      expect(r.body.payment).toBeUndefined()

      const [order] = await t.db.select().from(orders)
      expect(order).toMatchObject({
        number: 10001, numberPrefix: 'RB', status: 'pending_confirmation', channel: 'storefront', locale: 'en',
        customerName: 'Sana Malik', customerPhone: '+923001234567', customerEmail: 'sana@example.com',
        shipCity: 'Lahore', shipAddress: 'House 12, Street 4, Gulberg', shipLandmark: 'Near the park', shipNotes: 'Call first',
        shippingMethodLabel: 'Standard', etaMinDays: 3, etaMaxDays: 5, subtotalMinor: 900000, discountMinor: 0, shippingFeeMinor: 0, totalMinor: 900000, depositDueMinor: 0,
        paymentMethod: 'cod', paymentStatus: 'unpaid', paidMinor: 0, promoCode: null, version: 1,
      })
      expect(order?.trackingTokenHash).toBe(trackingHash(r.body.trackingToken))
      const [line] = await t.db.select().from(orderLines)
      expect(line).toMatchObject({ orderId: order?.id, position: 1, title: 'Embroidered lawn', sku: p.sku, quantity: 2, unitPriceMinor: 450000, lineSubtotalMinor: 900000, discountMinor: 0, stockTracked: true })
      expect((await t.db.select().from(orderEvents)).map((e) => [e.type, e.toStatus, e.actorType, e.public])).toEqual([['placed', 'pending_confirmation', 'storefront', true]])
      expect((await t.db.select().from(outboxEvents)).filter((e) => e.type === 'order.placed')).toHaveLength(1)

      // stock is held for the order, with no expiry for cash on delivery
      expect(await level(p.variantId)).toMatchObject({ onHand: 5, reserved: 2 })
      expect((await t.db.select().from(reservations))[0]).toMatchObject({ orderId: order?.id, orderLineId: line?.id, quantity: 2, status: 'active', expiresAt: null })
      // the cart has done its job
      expect(await t.db.select().from(carts)).toEqual([])
      expect((await shop('GET', '/cart', { token })).body.lines).toEqual([])
      // and the customer is counted
      expect((await t.db.select().from(customers))[0]).toMatchObject({ phone: '+923001234567', name: 'Sana Malik', city: 'Lahore', ordersCount: 1, deliveredCount: 0 })
    }, 90_000)

    it('numbers follow each other, and a customer who orders twice is one customer however the phone is typed', async () => {
      await ready()
      const p = await S.product({ stock: 10 })
      const first = await place(await cartOf(p))
      const second = await place(await cartOf(p), orderBody({ customer: { name: 'Sana M.', phone: '+92 300-1234567' } }))
      expect([first.body.orderNumber, second.body.orderNumber]).toEqual(['RB-10001', 'RB-10002'])
      const people = await t.db.select().from(customers)
      expect(people).toHaveLength(1)
      expect(people[0]).toMatchObject({ name: 'Sana M.', ordersCount: 2 })
      expect(await level(p.variantId)).toMatchObject({ reserved: 2 })
    }, 90_000)

    it('snapshots: renaming the product or changing its price later does not touch the order', async () => {
      await ready()
      const p = await S.product({ price: 300000, title: 'Old name' })
      await place(await cartOf(p))
      await t.db.update(products).set({ title: 'New name' }).where(eq(products.id, p.productId))
      await t.db.update(variants).set({ priceMinor: 999999 }).where(eq(variants.id, p.variantId))
      expect((await t.db.select().from(orderLines))[0]).toMatchObject({ title: 'Old name', unitPriceMinor: 300000, lineSubtotalMinor: 300000 })
      expect((await t.db.select().from(orders))[0]).toMatchObject({ subtotalMinor: 300000, totalMinor: 325000, shippingFeeMinor: 25000 })
    }, 90_000)

    it('the extra checkout fields are checked against the store settings; the marketing box is kept only when the store asks', async () => {
      await ready()
      await S.owner.call('PUT', '/admin/settings/checkout', { body: { value: { extraFields: [{ key: 'giftNote', label: 'Gift note', type: 'text', required: true }], marketingConsent: { enabled: true, label: 'Send me offers' } }, version: 0 } })
      const p = await S.product()
      const token = await cartOf(p)
      const missing = await place(token)
      expect(missing.status).toBe(400)
      expect(missing.body.issues).toEqual([{ path: 'customFields.giftNote', code: 'required' }])
      const unknown = await place(token, orderBody({ customFields: { giftNote: 'Happy Eid', surprise: 'x' } }))
      expect(unknown.body.issues).toEqual([{ path: 'customFields.surprise', code: 'invalid_format' }])
      const ok = await place(token, orderBody({ customFields: { giftNote: 'Happy Eid' }, marketingConsent: true }))
      expect(ok.status).toBe(201)
      expect((await t.db.select().from(orders))[0]?.customFields).toEqual({ giftNote: 'Happy Eid' })
      expect((await t.db.select().from(customers))[0]).toMatchObject({ marketingConsent: true, consentNote: 'Ticked at checkout' })
    }, 90_000)
  })

  describe('prepaid orders', () => {
    it('bank transfer: pending, stock held for 48 hours, the account to pay shown', async () => {
      await ready()
      await S.owner.call('PUT', '/admin/settings/payments', {
        body: { value: { methods: [{ type: 'cod', enabled: true, label: 'Cash on delivery', sortOrder: 0 }, { type: 'bank_transfer', enabled: true, label: 'Bank transfer', sortOrder: 1 }], bankTransfer: { accountTitle: 'Rubaya', bank: 'HBL', accountNumber: 'PK00HABB0000000000', instructions: 'Send a screenshot' } }, version: 0 },
      })
      const p = await S.product({ price: 100000 })
      const r = await place(await cartOf(p), orderBody({ paymentMethod: 'bank_transfer' }))
      expect(r.status).toBe(201)
      expect(r.body.status).toBe('pending')
      expect(r.body.payment.instructions).toContain('Rubaya')
      expect(r.body.payment.instructions).toContain('PK00HABB0000000000')
      const hold = (await t.db.select().from(reservations))[0]
      expect(hold?.expiresAt).toBeTruthy()
      expect(Math.round(((hold?.expiresAt?.getTime() ?? 0) - Date.now()) / 60_000)).toBe(48 * 60)
    }, 90_000)

    it('a method that is not on is refused, and so is cash on delivery above the limit, with the reason and the cart', async () => {
      await ready()
      const p = await S.product({ price: 450000 })
      const token = await cartOf(p)
      const off = await place(token, orderBody({ paymentMethod: 'card' }))
      expect(off.status).toBe(422)
      expect(off.body).toMatchObject({ code: 'payment_method_not_allowed', reason: 'not_enabled' })
      await S.owner.call('PUT', '/admin/settings/payments', { body: { value: { methods: [{ type: 'cod', enabled: true, label: 'Cash on delivery', sortOrder: 0 }], codLimitMinor: 400000 }, version: 0 } })
      const over = await place(token)
      expect(over.body).toMatchObject({ code: 'payment_method_not_allowed', reason: 'cod_limit_exceeded' })
      expect(over.body.cart.lines).toHaveLength(1)
      expect(await t.db.select().from(orders)).toEqual([])
      expect((await level(p.variantId))?.reserved).toBe(0)
    }, 90_000)
  })

  describe('refusals leave nothing behind and say what changed', () => {
    it('an empty or unknown cart, a city that is not served, a method that is not of that city', async () => {
      await ready()
      expect((await place(undefined)).body.code).toBe('cart_empty')
      expect((await place('nobody')).body.code).toBe('cart_empty')
      const p = await S.product()
      const token = await cartOf(p)
      const lonely = await S.owner.call('POST', '/admin/shipping/cities', { body: { name: 'Nowhere', province: 'Sindh' } })
      expect((await place(token, orderBody({ shippingAddress: { cityId: lonely.body.id, address: 'House 12, Street 4' } }))).body.code).toBe('city_not_served')
      expect((await place(token, orderBody({ shippingMethodId: uuidv7() }))).body.code).toBe('shipping_method_invalid')
      expect(await t.db.select().from(orders)).toEqual([])
      expect(await t.db.select().from(carts)).toHaveLength(1) // the cart is still there to try again
    }, 90_000)

    it('a price that changed, or a total that is not the one the customer saw, is refused with the new cart; nothing is held', async () => {
      await ready()
      const p = await S.product({ price: 300000 })
      const token = await cartOf(p)
      await t.db.update(variants).set({ priceMinor: 350000 }).where(eq(variants.id, p.variantId))
      const changed = await place(token)
      expect(changed.status).toBe(409)
      expect(changed.body).toMatchObject({ code: 'price_changed', cart: { subtotal: pkr(350000), lines: [{ issues: ['price_changed'] }] } })
      // the cart was not marked seen by the refused order: the customer is told once more by the cart itself
      const retry = await place(token, orderBody({ expectedTotal: pkr(999) }))
      expect(retry.body.code).toBe('price_changed')
      const seen = await shop('GET', '/cart', { token })
      expect(seen.body.lines[0].issues).toEqual(['price_changed'])
      expect((await shop('GET', '/cart', { token })).body.lines[0].issues).toEqual([]) // now seen
      const right = await place(token, orderBody({ expectedTotal: pkr(375000) })) // 350000 + 25000 delivery
      expect(right.status).toBe(201)
      expect((await level(p.variantId))?.reserved).toBe(1)
    }, 90_000)

    it('a line that is sold out blocks the order and shows the cart', async () => {
      await ready()
      const p = await S.product({ stock: 3 })
      const token = await cartOf(p, 2)
      await t.db.update(inventoryLevels).set({ onHand: 0 }).where(eq(inventoryLevels.variantId, p.variantId))
      const r = await place(token)
      expect(r.body).toMatchObject({ code: 'cart_has_issues', cart: { hasBlockingIssues: true } })
    }, 90_000)

    it('a code that no longer applies is refused as promo_invalid with its reason', async () => {
      await ready()
      const p = await S.product()
      const token = await cartOf(p)
      const made = await S.promo('GONE')
      await shop('PUT', '/cart/promo', { token, body: { code: 'GONE' } })
      await S.owner.call('PUT', `/admin/promos/${made.body.id}`, { body: { code: 'GONE', type: 'percent', percent: 10, scope: 'all', excludeSaleItems: true, firstOrderOnly: false, enabled: false, version: 1 } })
      const r = await place(token)
      expect(r.status).toBe(409)
      expect(r.body).toMatchObject({ code: 'promo_invalid', reason: 'promo_not_found' })
    }, 90_000)

    it('the customer and the address are checked: a phone that is not a mobile number, a short address', async () => {
      await ready()
      const token = await cartOf(await S.product())
      const bad = await place(token, orderBody({ customer: { name: 'Sana', phone: '12345' }, shippingAddress: { cityId: S.cityId, address: 'short' } }))
      expect(bad.status).toBe(400)
      expect(bad.body.issues.map((/** @type {{ path: string }} */ i) => i.path).sort()).toEqual(['customer.phone', 'shippingAddress.address'])
    }, 90_000)
  })

  describe('promo, deposit and No COD', () => {
    it('redeems the code with the order: the discount is shared over the lines, the use is counted, the shipping is waived', async () => {
      await ready()
      const a = await S.product({ price: 699000 })
      const b = await S.product({ price: 123456 })
      const token = await cartOf(a)
      await add(token, b.variantId)
      await S.promo('EID10', { percent: 10 })
      await shop('PUT', '/cart/promo', { token, body: { code: 'EID10' } })
      const r = await place(token)
      expect(r.status).toBe(201)
      const [order] = await t.db.select().from(orders)
      expect(order).toMatchObject({ subtotalMinor: 822456, discountMinor: 82246, shippingFeeMinor: 0, totalMinor: 740210, promoCode: 'EID10' }) // 822456 - 82246, over Rs. 5,000 after discount
      expect((await t.db.select().from(orderLines)).map((l) => l.discountMinor).sort((x, y) => x - y)).toEqual([12346, 69900])
      expect((await t.db.select().from(promos))[0]?.usageCount).toBe(1)
      expect((await t.db.select().from(promoRedemptions))[0]).toMatchObject({ orderId: order?.id, discountMinor: 82246, customerId: order?.customerId, reversedAt: null })
    }, 90_000)

    it('a free-shipping code records what it saved', async () => {
      await ready()
      const p = await S.product({ price: 100000 })
      const token = await cartOf(p)
      await S.promo('FREESHIP', { type: 'free_shipping', percent: undefined })
      await shop('PUT', '/cart/promo', { token, body: { code: 'FREESHIP' } })
      expect((await place(token)).status).toBe(201)
      expect((await t.db.select().from(orders))[0]).toMatchObject({ discountMinor: 0, shippingFeeMinor: 0, totalMinor: 100000 })
      expect((await t.db.select().from(promoRedemptions))[0]).toMatchObject({ discountMinor: 0, shippingWaivedMinor: 25000 })
    }, 90_000)

    it('a code with a limit of one per customer is refused the second time, as promo_invalid', async () => {
      await ready()
      await S.promo('ONCE', { perCustomerLimit: 1 })
      const p = await S.product({ stock: 10 })
      const first = await cartOf(p)
      await shop('PUT', '/cart/promo', { token: first, body: { code: 'ONCE' } })
      expect((await place(first)).status).toBe(201)
      const second = await cartOf(p)
      await shop('PUT', '/cart/promo', { token: second, body: { code: 'ONCE' } })
      const r = await place(second)
      expect(r.body).toMatchObject({ code: 'promo_invalid', reason: 'promo_customer_limit' })
      expect((await t.db.select().from(promos))[0]?.usageCount).toBe(1)
      expect(await t.db.select().from(orders)).toHaveLength(1)
    }, 90_000)

    it('made to order: the deposit is stored on the order and its lines, nothing is held in stock', async () => {
      await ready()
      const p = await S.product({ price: 1000000, kind: 'made_to_order', mode: 'made_to_order', mto: true })
      expect((await place(await cartOf(p))).status).toBe(201)
      const [order] = await t.db.select().from(orders)
      expect(order).toMatchObject({ depositDueMinor: 300000, totalMinor: 1000000 })
      expect((await t.db.select().from(orderLines))[0]).toMatchObject({ depositMinor: 300000, stockTracked: false, leadMinDays: 10, leadMaxDays: 14 })
      expect(await t.db.select().from(reservations)).toEqual([])
    }, 90_000)

    it('a customer flagged No COD cannot order cash on delivery from the storefront', async () => {
      await ready()
      const p = await S.product({ stock: 5 })
      expect((await place(await cartOf(p))).status).toBe(201)
      await t.db.update(customers).set({ noCod: true, noCodReason: 'refused twice' })
      const r = await place(await cartOf(p))
      expect(r.body).toMatchObject({ code: 'payment_method_not_allowed', reason: 'cod_not_available' })
    }, 90_000)
  })

  describe('ADR-0020 acceptance', () => {
    it('two lines of one variant, 2 + 2 against a stock of 3: insufficient_stock, the stock unchanged', async () => {
      await ready()
      const p = await S.product({ stock: 3 })
      const token = await cartOf(p, 2)
      const [cart] = await t.db.select().from(carts)
      const at = new Date()
      // the cart itself refuses a second line that would pass the stock; a second line can still arrive another way (an older cart, a price update)
      await t.db.insert(cartLines).values({ id: uuidv7(), cartId: /** @type {string} */ (cart?.id), variantId: p.variantId, quantity: 2, customizationHash: 'b'.padStart(64, '0'), seenUnitPriceMinor: 500000, createdAt: at, updatedAt: at })
      const r = await place(token)
      expect(r.status).toBe(409)
      expect(r.body).toMatchObject({ code: 'insufficient_stock', variantId: p.variantId, available: 3 })
      expect(r.body.cart.lines).toHaveLength(2)
      expect(await level(p.variantId)).toMatchObject({ onHand: 3, reserved: 0 })
      expect(await t.db.select().from(orders)).toEqual([])
    }, 90_000)

    it('50 orders at once for the last unit: exactly one succeeds, the rest are refused, and the numbers have no gap', async () => {
      await ready()
      const p = await S.product({ stock: 1 })
      const carts50 = await Promise.all(Array.from({ length: 50 }, () => cartOf(p)))
      const results = await Promise.all(carts50.map((token, i) => place(token, orderBody({ customer: { name: `Buyer ${i}`, phone: `03${String(10 + (i % 80)).padStart(2, '0')}${String(1000000 + i).slice(-7)}` } }), { ip: `10.88.${i}.1` })))
      const won = results.filter((r) => r.status === 201)
      expect(won).toHaveLength(1)
      // the others are refused whichever way they meet the empty shelf: while the winner holds the row (insufficient_stock) or after it has committed (the cart now shows the line sold out)
      const refused = results.filter((r) => r.status === 409)
      expect(refused).toHaveLength(49)
      expect(new Set(refused.map((r) => r.body.code))).toEqual(new Set(refused.map((r) => r.body.code).filter((c) => c === 'insufficient_stock' || c === 'cart_has_issues')))
      expect(await level(p.variantId)).toMatchObject({ onHand: 1, reserved: 1 })
      expect((await t.db.select().from(orders)).map((o) => o.number)).toEqual([10001])
      expect((await t.db.select().from(counters).where(eq(counters.name, 'order_number')))[0]?.value).toBe(10001) // the 49 that failed gave their numbers back
      expect(await t.db.select().from(carts)).toHaveLength(49) // only the winner's cart is gone
    }, 180_000)

    it('the same Idempotency-Key twice: one order, the same answer; another body with that key is refused', async () => {
      await ready()
      const p = await S.product({ stock: 5 })
      const token = await cartOf(p)
      const key = uuidv7()
      const first = await place(token, orderBody(), { key })
      const again = await place(token, orderBody(), { key }) // the cart is gone, but the answer is remembered
      expect(first.status).toBe(201)
      expect(again.status).toBe(201)
      expect(again.body).toEqual(first.body)
      expect(await t.db.select().from(orders)).toHaveLength(1)
      expect((await level(p.variantId))?.reserved).toBe(1)
      const other = await place(token, orderBody({ shippingAddress: { cityId: S.cityId, address: 'Another house, Another street' } }), { key })
      expect(other.status).toBe(422)
      expect(other.body.code).toBe('idempotency_mismatch')
      // a refusal is remembered too: the same refused request gets the same refusal
      const empty = uuidv7()
      expect((await place('nobody', orderBody(), { key: empty })).body.code).toBe('cart_empty')
      expect((await place('nobody', orderBody(), { key: empty })).body.code).toBe('cart_empty')
    }, 90_000)

    it('the header is required and must be a UUID', async () => {
      await ready()
      const token = await cartOf(await S.product())
      expect((await shop('POST', '/orders', { token, body: orderBody() })).status).toBe(400)
      expect((await shop('POST', '/orders', { token, body: orderBody(), headers: { 'idempotency-key': 'not-a-uuid' } })).status).toBe(400)
    }, 90_000)

    it('a body with a total, discount, shipping fee or unit price is rejected by the schema, and nothing is made', async () => {
      await ready()
      const token = await cartOf(await S.product())
      for (const money of [{ total: pkr(1) }, { discount: pkr(1) }, { shippingFee: pkr(0) }, { unitPrice: pkr(1) }, { subtotal: 1 }, { cartId: uuidv7() }]) {
        const r = await place(token, orderBody(money))
        expect(r.status, JSON.stringify(money)).toBe(400)
        expect(r.body.code).toBe('validation_failed')
      }
      expect(await t.db.select().from(orders)).toEqual([])
      expect((await level((await t.db.select().from(variants))[0]?.id ?? ''))?.reserved).toBe(0)
    }, 90_000)
  })

  it('the database refuses an order whose total is not subtotal - discount + shipping, and a line whose subtotal is not price times quantity', async () => {
    await ready()
    await place(await cartOf(await S.product({ price: 300000 })))
    const [order] = await t.db.select().from(orders)
    await expect(t.db.update(orders).set({ totalMinor: 1 }).where(eq(orders.id, order?.id ?? ''))).rejects.toThrow()
    await expect(t.db.update(orderLines).set({ lineSubtotalMinor: 1 }).where(eq(orderLines.orderId, order?.id ?? ''))).rejects.toThrow()
    expect((await t.db.select().from(orders))[0]?.totalMinor).toBe(325000)
  }, 90_000)

  it('the tracking link of one order is not the link of another, and changes with the key', () => {
    const a = trackingToken(config, uuidv7())
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(trackingToken(config, uuidv7())).not.toBe(a)
    const id = uuidv7()
    expect(trackingToken(config, id)).toBe(trackingToken(config, id))
    expect(trackingToken({ ...config, TRACKING_KEY: 'x'.repeat(40) }, id)).not.toBe(trackingToken(config, id))
    expect(trackingHash(a)).toMatch(/^[0-9a-f]{64}$/)
  })
})
