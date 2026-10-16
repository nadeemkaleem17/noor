// M4-03: the cart through HTTP on a scratch database, as the storefront server calls it (X-Cart-Token), with the real prices, stock, promos and delivery.
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { auditLog } from '../src/db/schema/audit.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { cartLines, carts } from '../src/db/schema/cart.js'
import { pages, settings } from '../src/db/schema/content.js'
import { customers } from '../src/db/schema/customers.js'
import { inventoryLevels } from '../src/db/schema/inventory.js'
import { outboxEvents } from '../src/db/schema/platform.js'
import { products, variants } from '../src/db/schema/products.js'
import { promoRedemptions, promos } from '../src/db/schema/promotions.js'
import { cities, shippingZones } from '../src/db/schema/shipping.js'
import { categories, formSchemas } from '../src/db/schema/taxonomy.js'
import { setClock } from '../src/platform/clock.js'
import { transaction } from '../src/platform/db.js'
import { uuidv7 } from '../src/platform/ids.js'
import { createCustomersService } from '../src/modules/customers/index.js'
import { closeHarness, createHarness, t } from './support/staff.js'
import { add, createShop, pkr, shop } from './support/shop.js'
import { dbAvailable } from './support/db.js'

const S = createShop()
/** @type {ReturnType<typeof createShop>['owner']} */
let owner
let cityId = ''
let zoneId = ''
let methodId = ''
const { product, promo } = S

describe.skipIf(!dbAvailable)('cart (MySQL, through HTTP)', () => {
  beforeAll(async () => {
    await createHarness()
  }, 60_000)
  afterAll(closeHarness)
  afterEach(async () => {
    setClock(null)
    await t.migrate.db.delete(auditLog)
    await t.db.delete(outboxEvents)
    await t.db.delete(carts) // lines go with them
    await t.db.delete(promoRedemptions)
    await t.db.delete(promos)
    await t.db.delete(customers)
    await t.migrate.pool.query('DELETE FROM inventory_movements') // the ledger is cleaned as the migration user
    await t.db.delete(products)
    await t.db.delete(formSchemas)
    await t.db.delete(shippingZones)
    await t.db.delete(cities)
    await t.db.delete(settings)
    await t.db.delete(pages)
    await t.migrate.pool.query('DELETE FROM categories WHERE parent_id IS NOT NULL')
    await t.db.delete(categories)
    await t.db.delete(staffUsers)
  })
  const setup = async () => {
    await S.setup()
    owner = S.owner
  }
  const delivery = async () => {
    await S.delivery()
    ;({ cityId, zoneId, methodId } = S)
  }

  describe('reading', () => {
    it('no token, or one nobody knows, is an empty cart and makes none; the answer is never cached', async () => {
      await setup()
      const none = await shop('GET', '/cart')
      expect(none.status).toBe(200)
      expect(none.body).toMatchObject({ lines: [], count: 0, subtotal: pkr(0), total: pkr(0), hasBlockingIssues: false })
      expect(none.body.id).toBeUndefined()
      expect(none.headers['cache-control']).toBe('private, no-store')
      expect((await shop('GET', '/cart', { token: 'not-a-token-anyone-issued' })).body.lines).toEqual([])
      expect((await shop('GET', '/cart?summary=1')).body).toEqual({ count: 0 })
      expect(await t.db.select().from(carts)).toEqual([])
    }, 60_000)
  })

  describe('adding lines', () => {
    it('makes the cart on the first add and hands out its token once; later adds carry no token', async () => {
      await setup()
      const p = await product()
      const first = await add(undefined, p.variantId, 2)
      expect(first.status).toBe(200)
      expect(first.body.cartToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
      expect(first.body).toMatchObject({ count: 2, subtotal: pkr(1000000), total: pkr(1000000), lines: [{ quantity: 2, unitPrice: pkr(500000), lineSubtotal: pkr(1000000), available: 10, issues: [] }] })
      const token = first.body.cartToken
      const second = await add(token, p.variantId, 1)
      expect(second.body.cartToken).toBeUndefined()
      expect(second.body).toMatchObject({ count: 3, lines: [{ quantity: 3 }] })
      expect((await shop('GET', '/cart?summary=1', { token })).body).toEqual({ count: 3 })
      // the cookie value is never stored: only its hash
      const [row] = await t.db.select().from(carts)
      expect(row?.tokenHash).not.toBe(token)
      expect(row?.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    }, 60_000)

    it('the same variant with the same customisation is one line (key order does not matter); a different one is another line', async () => {
      await setup()
      const form = await owner.call('POST', '/admin/form-schemas', {
        body: { title: 'Dress', allowNotes: true, fields: [{ key: 'chest', label: 'Chest', type: 'number', required: true, min: 20, max: 60, unit: 'in' }, { key: 'waist', label: 'Waist', type: 'number', required: false, unit: 'in' }] },
      })
      const p = await product({ schema: form.body.id, kind: 'made_to_order', mode: 'made_to_order', mto: true })
      const a = await add(undefined, p.variantId, 1, { measurements: { chest: 38, waist: 32 } })
      expect(a.status).toBe(200)
      const token = a.body.cartToken
      const same = await add(token, p.variantId, 1, { measurements: { waist: 32, chest: 38 } })
      expect(same.body.lines).toHaveLength(1)
      expect(same.body.lines[0].quantity).toBe(2)
      expect(same.body.lines[0].customization.summary).toBe('Chest 38 in, Waist 32 in')
      const other = await add(token, p.variantId, 1, { measurements: { chest: 40 } })
      expect(other.body.lines).toHaveLength(2)
      expect(other.body.count).toBe(3)
      // made to order: a deposit is due on the lines, and nothing runs out
      expect(other.body.lines[0]).toMatchObject({ madeToOrder: { leadMinDays: 10, leadMaxDays: 14, depositPercent: 30 } })
      expect(other.body.depositDue.amount).toBe(Math.ceil(1500000 * 0.3))
    }, 60_000)

    it('refuses a customisation that does not fit the product, naming the field', async () => {
      await setup()
      const form = await owner.call('POST', '/admin/form-schemas', {
        body: { title: 'Dress', allowNotes: false, fields: [{ key: 'chest', label: 'Chest', type: 'number', required: true, min: 20, max: 60 }] },
      })
      const withForm = await product({ schema: form.body.id })
      const plain = await product()
      const issues = async (/** @type {string} */ variantId, /** @type {object} */ customization) => {
        const r = await add(undefined, variantId, 1, customization)
        expect(r.status).toBe(400)
        return r.body.issues.map((/** @type {{ path: string, code: string }} */ i) => `${i.path}:${i.code}`)
      }
      expect(await issues(withForm.variantId, { notes: 'hem short' })).toEqual(expect.arrayContaining(['customization.measurements.chest:required', 'customization.notes:invalid_format']))
      expect(await issues(withForm.variantId, { measurements: { chest: 99 } })).toEqual(['customization.measurements.chest:too_big'])
      expect(await issues(withForm.variantId, { measurements: { chest: 'wide' } })).toEqual(['customization.measurements.chest:invalid_format'])
      expect(await issues(withForm.variantId, { measurements: { chest: 38, sleeve: 20 } })).toEqual(['customization.measurements.sleeve:invalid_format'])
      expect(await issues(plain.variantId, { measurements: { chest: 38 } })).toEqual(['customization.measurements.chest:invalid_format'])
      expect(await issues(plain.variantId, { bundle: [{ productId: uuidv7(), variantId: uuidv7() }] })).toEqual(['customization.bundle:invalid_format'])
      expect(await t.db.select().from(carts)).toEqual([]) // a refused add leaves no cart behind
    }, 60_000)

    it('refuses a variant that cannot be sold: switched off, or its product is not active', async () => {
      await setup()
      const off = await product({ enabled: false })
      const draft = await product({ status: 'draft' })
      for (const v of [off, draft]) {
        const r = await add(undefined, v.variantId)
        expect(r.status).toBe(409)
        expect(r.body).toMatchObject({ code: 'variant_unavailable', variantId: v.variantId })
      }
      expect((await add(undefined, uuidv7())).body.code).toBe('variant_unavailable')
    }, 60_000)

    it('keeps to the stock and the limit per order, counting every line of the same variant together', async () => {
      await setup()
      const p = await product({ stock: 3, maxPerOrder: 5 })
      const a = await add(undefined, p.variantId, 2, { notes: 'x' }).then((r) => r) // notes not allowed here: refused
      expect(a.status).toBe(400)
      const first = await add(undefined, p.variantId, 2)
      const token = first.body.cartToken
      const more = await add(token, p.variantId, 2)
      expect(more.status).toBe(409)
      expect(more.body).toMatchObject({ code: 'insufficient_stock', variantId: p.variantId, available: 3 })
      const limit = await product({ stock: 50, maxPerOrder: 2 })
      const over = await add(token, limit.variantId, 3)
      expect(over.body).toMatchObject({ code: 'max_per_order', variantId: limit.variantId, max: 2 })
      expect((await shop('GET', '/cart', { token })).body.count).toBe(2) // nothing changed
    }, 60_000)

    it('allows 50 lines and no more', async () => {
      await setup()
      const p = await product({ stock: 99, maxPerOrder: 99 })
      const first = await add(undefined, p.variantId)
      const token = first.body.cartToken
      const [cart] = await t.db.select().from(carts)
      const at = new Date()
      await t.db.insert(cartLines).values(
        Array.from({ length: 49 }, (_, i) => ({ id: uuidv7(), cartId: /** @type {string} */ (cart?.id), variantId: p.variantId, quantity: 1, customizationHash: String(i + 1).padStart(64, '0'), seenUnitPriceMinor: 500000, createdAt: at, updatedAt: at })),
      )
      const full = await add(token, p.variantId, 1, { notes: 'a new line' })
      // notes are not allowed on this product, so use a measurement-free route to a new identity: another variant
      expect(full.status).toBe(400)
      const other = await product()
      const r = await add(token, other.variantId)
      expect(r.status).toBe(409)
      expect(r.body).toMatchObject({ code: 'cart_full', max: 50 })
      // adding to a line that exists is still fine
      expect((await add(token, p.variantId, 1)).status).toBe(200)
    }, 60_000)
  })

  describe('changing and removing', () => {
    it('sets a quantity, removes at zero, and refuses a line that is not in this cart', async () => {
      await setup()
      const p = await product({ stock: 4 })
      const q = await product()
      const first = await add(undefined, p.variantId, 1)
      const token = first.body.cartToken
      const lineId = first.body.lines[0].id
      expect((await shop('PUT', `/cart/lines/${lineId}`, { token, body: { quantity: 3 } })).body.lines[0].quantity).toBe(3)
      const tooMany = await shop('PUT', `/cart/lines/${lineId}`, { token, body: { quantity: 5 } })
      expect(tooMany.body).toMatchObject({ code: 'insufficient_stock', available: 4 })
      // somebody else's cart cannot touch this line
      const other = await add(undefined, q.variantId)
      expect((await shop('PUT', `/cart/lines/${lineId}`, { token: other.body.cartToken, body: { quantity: 1 } })).status).toBe(404)
      expect((await shop('DELETE', `/cart/lines/${lineId}`, { token: other.body.cartToken })).status).toBe(404)
      expect((await shop('PUT', `/cart/lines/${lineId}`, { body: { quantity: 1 } })).status).toBe(404) // and no token at all
      expect((await shop('PUT', `/cart/lines/${lineId}`, { token, body: { quantity: 0 } })).body.lines).toEqual([])
      expect((await shop('DELETE', `/cart/lines/${uuidv7()}`, { token })).status).toBe(404)
    }, 60_000)
  })

  describe('prices and issues', () => {
    it('a price that changed is shown once with the old price; low stock and sold out are shown with what is left', async () => {
      await setup()
      const p = await product({ stock: 5 })
      const first = await add(undefined, p.variantId, 3)
      const token = first.body.cartToken
      await t.db.update(variants).set({ priceMinor: 550000 }).where(eq(variants.id, p.variantId))
      const changed = await shop('GET', '/cart', { token })
      expect(changed.body.lines[0]).toMatchObject({ issues: ['price_changed'], unitPrice: pkr(550000), previousUnitPrice: pkr(500000) })
      expect(changed.body.subtotal).toEqual(pkr(1650000))
      expect((await shop('GET', '/cart', { token })).body.lines[0].issues).toEqual([]) // seen now
      await t.db.update(inventoryLevels).set({ onHand: 2 }).where(eq(inventoryLevels.variantId, p.variantId))
      const low = await shop('GET', '/cart', { token })
      expect(low.body.lines[0]).toMatchObject({ quantity: 3, available: 2, issues: ['low_stock'] })
      expect(low.body.hasBlockingIssues).toBe(false)
      await t.db.update(inventoryLevels).set({ onHand: 0 }).where(eq(inventoryLevels.variantId, p.variantId))
      const out = await shop('GET', '/cart', { token })
      expect(out.body.lines[0].issues).toEqual(['sold_out'])
      expect(out.body.hasBlockingIssues).toBe(true)
      await t.db.update(variants).set({ enabled: false }).where(eq(variants.id, p.variantId))
      expect((await shop('GET', '/cart', { token })).body.lines[0].issues).toEqual(['unavailable'])
    }, 60_000)
  })

  describe('promo', () => {
    it('applies a code, replaces it with another, and takes it off again', async () => {
      await setup()
      const p = await product({ price: 699000 })
      const first = await add(undefined, p.variantId)
      const token = first.body.cartToken
      await promo('TEN', { percent: 10 })
      await promo('TWENTY', { percent: 20 })
      const ten = await shop('PUT', '/cart/promo', { token, body: { code: ' ten ' } })
      expect(ten.body).toMatchObject({ promo: { code: 'TEN', label: '10% off', discount: pkr(69900) }, discount: pkr(69900), total: pkr(629100) })
      expect(ten.body.lines[0].lineDiscount).toEqual(pkr(69900))
      expect((await shop('PUT', '/cart/promo', { token, body: { code: 'TWENTY' } })).body).toMatchObject({ promo: { code: 'TWENTY' }, discount: pkr(139800) })
      const off = await shop('DELETE', '/cart/promo', { token })
      expect(off.body).toMatchObject({ discount: pkr(0), total: pkr(699000) })
      expect(off.body.promo).toBeUndefined()
      expect((await shop('DELETE', '/cart/promo')).body.lines).toEqual([]) // no cart: nothing to take off
    }, 60_000)

    it('refuses a code with the reason: unknown, not applicable, below the minimum spend (with the amount)', async () => {
      await setup()
      const p = await product({ price: 300000 })
      const token = (await add(undefined, p.variantId)).body.cartToken
      expect((await shop('PUT', '/cart/promo', { token, body: { code: 'NOSUCH' } })).body.code).toBe('promo_not_found')
      await promo('BIG', { minSpend: pkr(500000) })
      const min = await shop('PUT', '/cart/promo', { token, body: { code: 'BIG' } })
      expect(min.status).toBe(422)
      expect(min.body).toMatchObject({ code: 'promo_min_spend', minSpend: pkr(500000) })
      await promo('SALE', { excludeSaleItems: true })
      await t.db.update(variants).set({ compareAtMinor: 400000 }).where(eq(variants.id, p.variantId))
      expect((await shop('PUT', '/cart/promo', { token, body: { code: 'SALE' } })).body.code).toBe('promo_not_applicable')
      // with no cart at all nothing is eligible
      expect((await shop('PUT', '/cart/promo', { body: { code: 'SALE' } })).body.code).toBe('promo_not_applicable')
    }, 60_000)

    it('a code that stops applying later leaves the cart at full price and says why', async () => {
      await setup()
      const p = await product()
      const token = (await add(undefined, p.variantId)).body.cartToken
      const made = await promo('SOON')
      await shop('PUT', '/cart/promo', { token, body: { code: 'SOON' } })
      await owner.call('PUT', `/admin/promos/${made.body.id}`, { body: { code: 'SOON', type: 'percent', percent: 10, scope: 'all', excludeSaleItems: true, firstOrderOnly: false, enabled: false, version: 1 } })
      const after = await shop('GET', '/cart', { token })
      expect(after.body).toMatchObject({ discount: pkr(0), total: pkr(500000), promoProblem: 'promo_not_found' })
      expect(after.body.promo).toBeUndefined()
    }, 60_000)
  })

  describe('quote', () => {
    it('needs a cart with lines and a city that is served, and a method of that city', async () => {
      await setup()
      await delivery()
      expect((await shop('POST', '/cart/quote', { body: { cityId } })).body.code).toBe('cart_empty')
      const p = await product({ price: 100000 })
      const token = (await add(undefined, p.variantId)).body.cartToken
      const lonely = await owner.call('POST', '/admin/shipping/cities', { body: { name: 'Nowhere', province: 'Sindh' } })
      const noZone = await shop('POST', '/cart/quote', { token, body: { cityId: lonely.body.id } })
      expect(noZone.status).toBe(422)
      expect(noZone.body.code).toBe('city_not_served')
      const bad = await shop('POST', '/cart/quote', { token, body: { cityId, shippingMethodId: uuidv7() } })
      expect(bad.body.code).toBe('shipping_method_invalid')
      expect(zoneId).toBeTruthy()
    }, 60_000)

    it('adds the delivery fee, lists the options and the payment methods, and says how far free delivery is', async () => {
      await setup()
      await delivery()
      const p = await product({ price: 300000 })
      const token = (await add(undefined, p.variantId)).body.cartToken
      // before any city is known the bag is measured against the lowest threshold of any zone (the progress bar of the bag)
      expect((await shop('GET', '/cart', { token })).body.messages).toEqual([{ code: 'free_shipping_remaining', amount: pkr(200000), percent: 60 }])
      const q = await shop('POST', '/cart/quote', { token, body: { cityId } })
      expect(q.status).toBe(200)
      expect(q.body.shipping).toMatchObject({ label: 'Standard', fee: pkr(25000), etaMinDays: 3, etaMaxDays: 5 })
      expect(q.body.shippingOptions.map((/** @type {{ label: string }} */ o) => o.label)).toEqual(['Standard', 'Express'])
      expect(q.body.total).toEqual(pkr(325000))
      expect(q.body.messages).toEqual([{ code: 'free_shipping_remaining', amount: pkr(200000), percent: 60 }])
      expect(q.body.paymentOptions).toEqual([{ method: 'cod', label: 'Cash on delivery', allowed: true }])
      const express = q.body.shippingOptions.find((/** @type {{ label: string }} */ o) => o.label === 'Express').methodId
      expect((await shop('POST', '/cart/quote', { token, body: { cityId, shippingMethodId: express } })).body).toMatchObject({ shipping: { label: 'Express', fee: pkr(45000) }, total: pkr(345000) })
      // two more and the order passes Rs. 5,000: delivery is free
      await add(token, p.variantId, 1)
      expect((await shop('POST', '/cart/quote', { token, body: { cityId, shippingMethodId: methodId } })).body).toMatchObject({ shipping: { fee: pkr(0) }, total: pkr(600000), messages: [{ code: 'free_shipping_applied' }] })
    }, 60_000)

    it('cash on delivery is refused above the limit set in the payment settings', async () => {
      await setup()
      await delivery()
      await owner.call('PUT', '/admin/settings/payments', { body: { value: { methods: [{ type: 'cod', enabled: true, label: 'Cash on delivery', sortOrder: 0 }], codLimitMinor: 400000 }, version: 0 } })
      const p = await product({ price: 450000 })
      const token = (await add(undefined, p.variantId)).body.cartToken
      const q = await shop('POST', '/cart/quote', { token, body: { cityId } })
      expect(q.body.paymentOptions[0]).toMatchObject({ method: 'cod', allowed: false, reason: 'cod_limit_exceeded' })
    }, 60_000)

    it('with a phone it knows the customer: No COD, and their own promo limit', async () => {
      await setup()
      await delivery()
      const people = createCustomersService({ db: t.db })
      const who = await transaction(t.db, (tx) => people.upsertByPhone(tx, { phone: '0300 1234567', name: 'Sana' }))
      await t.db.update(customers).set({ noCod: true, noCodReason: 'refused twice' }).where(eq(customers.id, who.id))
      const made = await promo('ONCE', { perCustomerLimit: 1 })
      await t.db.insert(promoRedemptions).values({ id: uuidv7(), promoId: made.body.id, orderId: uuidv7(), customerId: who.id, discountMinor: 1000, createdAt: new Date() })
      const p = await product({ price: 100000 })
      const token = (await add(undefined, p.variantId)).body.cartToken
      await shop('PUT', '/cart/promo', { token, body: { code: 'ONCE' } })
      const anonymous = await shop('POST', '/cart/quote', { token, body: { cityId } })
      expect(anonymous.body.promo.code).toBe('ONCE')
      expect(anonymous.body.paymentOptions[0].allowed).toBe(true)
      const known = await shop('POST', '/cart/quote', { token, body: { cityId, phone: '+92 300 1234567' } })
      expect(known.body.promoProblem).toBe('promo_customer_limit')
      expect(known.body).toMatchObject({ discount: pkr(0) })
      expect(known.body.paymentOptions[0]).toMatchObject({ allowed: false, reason: 'cod_not_available' })
    }, 60_000)
  })

  it('carts nobody touched for 30 days are removed, with their lines', async () => {
    await setup()
    const p = await product()
    const fresh = await add(undefined, p.variantId)
    const old = await add(undefined, p.variantId)
    const [a, b] = await t.db.select().from(carts)
    const oldCart = [a, b].find((c) => c && c.tokenHash !== fresh.body.id)
    await t.db.update(carts).set({ updatedAt: new Date(Date.now() - 31 * 86_400_000) }).where(eq(carts.id, /** @type {string} */ (old.body.id)))
    const { createCartService } = await import('../src/modules/cart/index.js')
    await createCartService({ db: t.db, media: { imagesFor: async () => ({}) }, stock: { available: async () => new Map() }, shipping: { deliveryOptions: async () => [] }, settings: { value: async () => ({ value: { methods: [] } }) }, promotions: { findRule: async () => undefined, findRuleById: async () => undefined, customerProblem: async () => undefined }, customers: { findByPhone: async () => undefined } }).cleanup()
    expect((await t.db.select().from(carts)).map((c) => c.id)).toEqual([fresh.body.id])
    expect(oldCart).toBeTruthy()
    expect(await t.db.select().from(cartLines)).toHaveLength(1)
  }, 60_000)
})
