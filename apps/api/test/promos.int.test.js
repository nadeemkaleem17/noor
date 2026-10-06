// M4-02: promo codes made by staff, previewed, redeemed by orders (with the row lock) and given back, through HTTP on a scratch database.
// There are no orders yet, so an "order" here is an id handed to `redeem` and `reverse`.
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { auditLog } from '../src/db/schema/audit.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { customers } from '../src/db/schema/customers.js'
import { products } from '../src/db/schema/products.js'
import { promoRedemptions, promos } from '../src/db/schema/promotions.js'
import { categories } from '../src/db/schema/taxonomy.js'
import { setClock } from '../src/platform/clock.js'
import { transaction } from '../src/platform/db.js'
import { uuidv7 } from '../src/platform/ids.js'
import { createCustomersService } from '../src/modules/customers/index.js'
import { createPromotionsService } from '../src/modules/promotions/index.js'
import { closeHarness, createHarness, signedIn, t } from './support/staff.js'
import { dbAvailable } from './support/db.js'

const pkr = (/** @type {number} */ paisa) => ({ amount: paisa, currency: 'PKR' })
const base = { type: 'percent', percent: 10, scope: 'all', excludeSaleItems: true, firstOrderOnly: false, enabled: true }
const promo = (/** @type {string} */ code, /** @type {object} */ over = {}) => ({ code, ...base, ...over })

/** @type {ReturnType<typeof createPromotionsService>} */
let service
/** @type {ReturnType<typeof createCustomersService>} */
let people

/** A product with one variant at `price` paisa in `categoryId`. @param {Awaited<ReturnType<typeof signedIn>>['b']} b @param {string} categoryId @param {number} price @param {number} [compareAt] */
async function variant(b, categoryId, price, compareAt) {
  const handle = `p-${uuidv7().slice(-8)}`
  const r = await b.call('POST', '/admin/products', {
    body: {
      handle, status: 'draft', kind: 'accessory', title: handle, primaryCategoryId: categoryId, categoryIds: [], attributes: [], media: [], options: [],
      variants: [{ key: 'v', sku: handle.toUpperCase().slice(0, 40), optionValueKeys: [], price: pkr(price), ...(compareAt ? { compareAt: pkr(compareAt) } : {}), stockMode: 'counted', maxPerOrder: 10, enabled: true }],
    },
  })
  if (r.status !== 201) throw new Error(JSON.stringify(r.body))
  return { productId: /** @type {string} */ (r.body.id), variantId: /** @type {string} */ (r.body.variants[0].id) }
}
const category = async (/** @type {string} */ name, /** @type {string | null} */ parentId = null) => {
  const id = uuidv7()
  await t.db.insert(categories).values({ id, parentId, handle: `c-${id.slice(-8)}`, name, createdAt: new Date(), updatedAt: new Date() })
  return id
}
const customer = (/** @type {string} */ phone) => transaction(t.db, (tx) => people.upsertByPhone(tx, { phone, name: 'Buyer' }))
const redeem = (/** @type {string} */ promoId, /** @type {{ id: string, ordersCount: number }} */ who, orderId = uuidv7(), discountMinor = 1000) =>
  transaction(t.db, (tx) => service.redeem(tx, { promoId, orderId, customer: { id: who.id, ordersCount: who.ordersCount }, discountMinor }))

describe.skipIf(!dbAvailable)('promos (MySQL, through HTTP)', () => {
  beforeAll(async () => {
    await createHarness()
    service = createPromotionsService({ db: t.db })
    people = createCustomersService({ db: t.db })
  }, 60_000)
  afterAll(closeHarness)
  afterEach(async () => {
    setClock(null)
    await t.migrate.db.delete(auditLog)
    await t.db.delete(promoRedemptions)
    await t.db.delete(promos) // targets go with them
    await t.db.delete(customers)
    await t.db.delete(products)
    await t.migrate.pool.query('DELETE FROM categories WHERE parent_id IS NOT NULL') // children first: a parent with children cannot go
    await t.db.delete(categories)
    await t.db.delete(staffUsers)
  })

  describe('making and changing codes', () => {
    it('stores the code upper-case, reads the rule back in words, and refuses a code that is taken', async () => {
      const { b } = await signedIn('owner')
      const lawn = await category('Lawn')
      const r = await b.call('POST', '/admin/promos', { body: promo(' eid10 ', { scope: 'categories', targetIds: [lawn], maxDiscount: pkr(200000), minSpend: pkr(500000), perCustomerLimit: 1 }) })
      expect(r.status).toBe(201)
      expect(r.body).toMatchObject({ code: 'EID10', type: 'percent', percent: 10, status: 'active', usageCount: 0, used: false, version: 1, targets: [{ id: lawn, type: 'category', label: 'Lawn' }] })
      expect(r.body.summary).toBe('10% off Lawn, up to Rs. 2,000, on orders over Rs. 5,000. Once per customer. Not on sale items.')
      const again = await b.call('POST', '/admin/promos', { body: promo('EID10') })
      expect(again.status).toBe(400)
      expect(JSON.stringify(again.body)).toContain('not_unique')
    }, 60_000)

    it('refuses fields that do not fit the type, and targets that do not exist', async () => {
      const { b } = await signedIn('owner')
      expect((await b.call('POST', '/admin/promos', { body: promo('NOPCT', { percent: undefined }) })).status).toBe(400)
      expect((await b.call('POST', '/admin/promos', { body: promo('FIXED', { type: 'fixed', percent: undefined }) })).status).toBe(400) // needs an amount
      expect((await b.call('POST', '/admin/promos', { body: promo('CAPFIX', { type: 'fixed', percent: undefined, amount: pkr(50000), maxDiscount: pkr(1000) }) })).status).toBe(400) // a cap is for percentages
      expect((await b.call('POST', '/admin/promos', { body: promo('BACKWARDS', { startsAt: '2026-10-10T00:00:00.000Z', endsAt: '2026-10-01T00:00:00.000Z' }) })).status).toBe(400)
      expect((await b.call('POST', '/admin/promos', { body: promo('GHOST', { scope: 'products', targetIds: [uuidv7()] }) })).status).toBe(400)
      expect((await b.call('POST', '/admin/promos', { body: promo('x') })).status).toBe(400) // too short
    }, 60_000)

    it('saves changes with the version; a stale save is refused', async () => {
      const { b } = await signedIn('owner')
      const made = (await b.call('POST', '/admin/promos', { body: promo('SPRING') })).body
      const ok = await b.call('PUT', `/admin/promos/${made.id}`, { body: { ...promo('SPRING', { percent: 15, note: 'Spring campaign' }), version: 1 } })
      expect(ok.status).toBe(200)
      expect(ok.body).toMatchObject({ percent: 15, note: 'Spring campaign', version: 2 })
      const stale = await b.call('PUT', `/admin/promos/${made.id}`, { body: { ...promo('SPRING'), version: 1 } })
      expect(stale.status).toBe(409)
      expect(stale.body.code).toBe('stale_write')
      expect((await t.db.select().from(auditLog)).map((a) => a.action).filter((a) => a.startsWith('promo.')).sort()).toEqual(['promo.created', 'promo.updated'])
    }, 60_000)

    it('derives the status from the switch, the window and the usage limit, and filters by it', async () => {
      const { b } = await signedIn('owner')
      const make = (/** @type {string} */ code, /** @type {object} */ over) => b.call('POST', '/admin/promos', { body: promo(code, over) })
      await make('LIVE', {})
      await make('SOON', { startsAt: '2099-01-01T00:00:00.000Z' })
      await make('OLD', { startsAt: '2020-01-01T00:00:00.000Z', endsAt: '2020-02-01T00:00:00.000Z' })
      await make('OFF', { enabled: false })
      const full = (await make('FULL', { usageLimit: 1 })).body
      const who = await customer('03001234567')
      await redeem(full.id, who)
      const codes = async (/** @type {string} */ q) => (await b.call('GET', `/admin/promos${q}`)).body.items.map((/** @type {{ code: string }} */ p) => p.code).sort()
      expect(await codes('?status=active')).toEqual(['LIVE'])
      expect(await codes('?status=scheduled')).toEqual(['SOON'])
      expect(await codes('?status=expired')).toEqual(['FULL', 'OLD'])
      expect(await codes('?status=disabled')).toEqual(['OFF'])
      expect(await codes('?q=li')).toEqual(['LIVE'])
      expect(await codes('?type=fixed')).toEqual([])
      expect((await b.call('GET', '/admin/promos?sort=code')).body.items.map((/** @type {{ code: string }} */ p) => p.code)).toEqual(['FULL', 'LIVE', 'OFF', 'OLD', 'SOON'])
    }, 60_000)

    it('the code and type of a used promo are fixed; the rest can change; only an unused promo can be deleted', async () => {
      const { b } = await signedIn('owner')
      const used = (await b.call('POST', '/admin/promos', { body: promo('USED') })).body
      await redeem(used.id, await customer('03001234567'))
      expect((await b.call('GET', `/admin/promos/${used.id}`)).body.used).toBe(true)
      const rename = await b.call('PUT', `/admin/promos/${used.id}`, { body: { ...promo('RENAMED'), version: 1 } })
      expect(rename.status).toBe(400)
      expect(JSON.stringify(rename.body)).toContain('code')
      const retype = await b.call('PUT', `/admin/promos/${used.id}`, { body: { ...promo('USED', { type: 'fixed', percent: undefined, amount: pkr(50000) }), version: 1 } })
      expect(retype.status).toBe(400)
      expect((await b.call('PUT', `/admin/promos/${used.id}`, { body: { ...promo('USED', { percent: 20 }), version: 1 } })).status).toBe(200)
      const del = await b.call('DELETE', `/admin/promos/${used.id}`)
      expect(del.status).toBe(409)
      expect(del.body.code).toBe('in_use')
      const fresh = (await b.call('POST', '/admin/promos', { body: promo('FRESH') })).body
      expect((await b.call('DELETE', `/admin/promos/${fresh.id}`)).status).toBe(204)
      expect((await b.call('GET', `/admin/promos/${fresh.id}`)).status).toBe(404)
    }, 60_000)

    it('turns several codes on or off at once and reports the one that is gone', async () => {
      const { b } = await signedIn('owner')
      const one = (await b.call('POST', '/admin/promos', { body: promo('ONE') })).body
      const two = (await b.call('POST', '/admin/promos', { body: promo('TWO') })).body
      const ghost = uuidv7()
      const r = await b.call('POST', '/admin/promos/bulk', { body: { ids: [one.id, two.id, ghost], action: 'disable' } })
      expect(r.body.succeeded.sort()).toEqual([one.id, two.id].sort())
      expect(r.body.failed).toEqual([{ id: ghost, code: 'not_found' }])
      expect((await b.call('GET', `/admin/promos/${one.id}`)).body).toMatchObject({ enabled: false, status: 'disabled' })
      await b.call('POST', '/admin/promos/bulk', { body: { ids: [one.id], action: 'enable' } })
      expect((await b.call('GET', `/admin/promos/${one.id}`)).body.status).toBe('active')
    }, 60_000)

    it('support can read codes but not change them; catalog cannot read; delete is its own permission', async () => {
      const { b: owner } = await signedIn('owner')
      const made = (await owner.call('POST', '/admin/promos', { body: promo('ROLES') })).body
      const status = async (/** @type {string} */ role, /** @type {string} */ method, /** @type {string} */ url, /** @type {object} */ body = {}) => {
        const { b } = await signedIn(role)
        const r = await b.call(method, url, Object.keys(body).length ? { body } : {})
        return r.status
      }
      expect(await status('support', 'GET', '/admin/promos')).toBe(200)
      expect(await status('support', 'POST', '/admin/promos', promo('NOPE'))).toBe(403)
      expect(await status('support', 'DELETE', `/admin/promos/${made.id}`)).toBe(403)
      expect(await status('catalog', 'GET', '/admin/promos')).toBe(403)
    }, 120_000)
  })

  describe('preview (plan/10-api/06 section 4)', () => {
    it('gives the same numbers as the cart rules: 10% of Rs. 6,990.00 and Rs. 1,234.56 is 69900 and 12346 paisa', async () => {
      const { b } = await signedIn('owner')
      const cat = await category('Women')
      const a = await variant(b, cat, 699000)
      const c = await variant(b, cat, 123456)
      const r = await b.call('POST', '/admin/promos/preview', { body: { promo: promo('TEST10'), lines: [{ variantId: a.variantId, quantity: 1 }, { variantId: c.variantId, quantity: 1 }] } })
      expect(r.status).toBe(200)
      expect(r.body).toMatchObject({ applies: true, discount: pkr(82246), eligibleSubtotal: pkr(822456), lineDiscounts: [{ variantId: a.variantId, discount: pkr(69900) }, { variantId: c.variantId, discount: pkr(12346) }] })
    }, 60_000)

    it('a category target includes the categories below it; sale items are left out; the reason is a promo code', async () => {
      const { b } = await signedIn('owner')
      const women = await category('Women')
      const lawn = await category('Lawn', women)
      const men = await category('Men')
      const inLawn = await variant(b, lawn, 400000)
      const onSale = await variant(b, lawn, 300000, 450000)
      const inMen = await variant(b, men, 200000)
      const lines = [inLawn, onSale, inMen].map((v) => ({ variantId: v.variantId, quantity: 1 }))
      const scoped = await b.call('POST', '/admin/promos/preview', { body: { promo: promo('WOMEN', { scope: 'categories', targetIds: [women] }), lines } })
      expect(scoped.body).toMatchObject({ applies: true, eligibleSubtotal: pkr(400000), discount: pkr(40000) })
      expect(scoped.body.lineDiscounts.map((/** @type {{ discount: { amount: number } }} */ l) => l.discount.amount)).toEqual([40000, 0, 0])
      const minSpend = await b.call('POST', '/admin/promos/preview', { body: { promo: promo('BIG', { minSpend: pkr(700000) }), lines } })
      expect(minSpend.body).toMatchObject({ applies: false, reason: 'promo_min_spend', discount: pkr(0), eligibleSubtotal: pkr(600000) })
      const ghost = await b.call('POST', '/admin/promos/preview', { body: { promo: promo('ANY'), lines: [{ variantId: uuidv7(), quantity: 1 }] } })
      expect(ghost.status).toBe(400)
    }, 60_000)
  })

  describe('redeeming (ADR-0020 section 2)', () => {
    it('two orders for the last allowed use: one succeeds, the other gets promo_usage_limit', async () => {
      const { b } = await signedIn('owner')
      const made = (await b.call('POST', '/admin/promos', { body: promo('LAST1', { usageLimit: 1, perCustomerLimit: undefined }) })).body
      const [x, y] = await Promise.all([customer('03001234567'), customer('03217654321')])
      const results = await Promise.allSettled([redeem(made.id, x), redeem(made.id, y)])
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      const failed = /** @type {PromiseRejectedResult} */ (results.find((r) => r.status === 'rejected'))
      expect(failed.reason).toMatchObject({ code: 'promo_usage_limit' })
      expect((await t.db.select().from(promos))[0]?.usageCount).toBe(1)
      expect(await t.db.select().from(promoRedemptions)).toHaveLength(1)
    }, 60_000)

    it('one customer cannot go past their own limit, even with two orders at once', async () => {
      const { b } = await signedIn('owner')
      const made = (await b.call('POST', '/admin/promos', { body: promo('ONCE', { perCustomerLimit: 1 }) })).body
      const who = await customer('03001234567')
      const results = await Promise.allSettled([redeem(made.id, who), redeem(made.id, who)])
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      expect(/** @type {PromiseRejectedResult} */ (results.find((r) => r.status === 'rejected')).reason).toMatchObject({ code: 'promo_customer_limit' })
      expect((await t.db.select().from(promos))[0]?.usageCount).toBe(1)
    }, 60_000)

    it('first-order-only refuses a customer who has ordered before; a code that is off, ended or not yet started is refused', async () => {
      const { b } = await signedIn('owner')
      const first = (await b.call('POST', '/admin/promos', { body: promo('NEWBIE', { firstOrderOnly: true }) })).body
      const veteran = await customer('03001234567')
      await expect(redeem(first.id, { id: veteran.id, ordersCount: 2 })).rejects.toMatchObject({ code: 'promo_first_order_only' })
      await expect(redeem(first.id, { id: veteran.id, ordersCount: 0 })).resolves.toBeUndefined()

      const off = (await b.call('POST', '/admin/promos', { body: promo('OFFNOW', { enabled: false }) })).body
      await expect(redeem(off.id, veteran)).rejects.toMatchObject({ code: 'promo_not_found' })
      const soon = (await b.call('POST', '/admin/promos', { body: promo('LATER', { startsAt: '2099-01-01T00:00:00.000Z' }) })).body
      await expect(redeem(soon.id, veteran)).rejects.toMatchObject({ code: 'promo_not_started' })
      const old = (await b.call('POST', '/admin/promos', { body: promo('ENDED', { startsAt: '2020-01-01T00:00:00.000Z', endsAt: '2020-02-01T00:00:00.000Z' }) })).body
      await expect(redeem(old.id, veteran)).rejects.toMatchObject({ code: 'promo_expired' })
    }, 60_000)

    it('cancelling gives the use back, once, and the customer can use the code again', async () => {
      const { b } = await signedIn('owner')
      const made = (await b.call('POST', '/admin/promos', { body: promo('AGAIN', { usageLimit: 5, perCustomerLimit: 1 }) })).body
      const who = await customer('03001234567')
      const orderId = uuidv7()
      await redeem(made.id, who, orderId)
      await expect(redeem(made.id, who)).rejects.toMatchObject({ code: 'promo_customer_limit' })
      await transaction(t.db, (tx) => service.reverse(tx, orderId))
      await transaction(t.db, (tx) => service.reverse(tx, orderId)) // a retry changes nothing
      expect((await t.db.select().from(promos))[0]?.usageCount).toBe(0)
      expect((await t.db.select().from(promoRedemptions))[0]?.reversedAt).toBeTruthy()
      await expect(redeem(made.id, who)).resolves.toBeUndefined()
      expect((await t.db.select().from(promos))[0]?.usageCount).toBe(1)
      // a promo with a reversed redemption was still used: it cannot be deleted
      expect((await b.call('DELETE', `/admin/promos/${made.id}`)).status).toBe(409)
    }, 60_000)

    it('an order has at most one redemption', async () => {
      const { b } = await signedIn('owner')
      const one = (await b.call('POST', '/admin/promos', { body: promo('ONE1', { perCustomerLimit: undefined }) })).body
      const two = (await b.call('POST', '/admin/promos', { body: promo('TWO2', { perCustomerLimit: undefined }) })).body
      const who = await customer('03001234567')
      const orderId = uuidv7()
      await redeem(one.id, who, orderId)
      await expect(redeem(two.id, who, orderId)).rejects.toThrow()
      expect(await t.db.select().from(promoRedemptions).where(eq(promoRedemptions.orderId, orderId))).toHaveLength(1)
      expect((await t.db.select().from(promos).where(eq(promos.id, two.id)))[0]?.usageCount).toBe(0) // the failed attempt left no count behind
    }, 60_000)

    it('findRule gives the cart what it needs, with the code in any case and the category tree expanded', async () => {
      const { b } = await signedIn('owner')
      const women = await category('Women')
      const lawn = await category('Lawn', women)
      await b.call('POST', '/admin/promos', { body: promo('TREE', { scope: 'categories', targetIds: [women] }) })
      const found = await service.findRule(t.db, ' tree ')
      expect(found?.code).toBe('TREE')
      expect([...(found?.rule.categoryIds ?? [])].sort()).toEqual([women, lawn].sort())
      expect(await service.findRule(t.db, 'NOSUCH')).toBeUndefined()
    }, 60_000)
  })
})
