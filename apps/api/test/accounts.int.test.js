// Customer accounts (plan/10-api/11-account.md): registering, signing in, the orders an account may see, and leaving. On a scratch database, through HTTP.
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { auditLog } from '../src/db/schema/audit.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { customerAccounts, customerSessions, accountOrders } from '../src/db/schema/accounts.js'
import { carts } from '../src/db/schema/cart.js'
import { pages, settings } from '../src/db/schema/content.js'
import { customers } from '../src/db/schema/customers.js'
import { reservations } from '../src/db/schema/inventory.js'
import { orders } from '../src/db/schema/orders.js'
import { paymentEvents, payments } from '../src/db/schema/payments.js'
import { counters, idempotencyKeys, jobs, outboxEvents, rateLimitHits } from '../src/db/schema/platform.js'
import { products } from '../src/db/schema/products.js'
import { promoRedemptions, promos } from '../src/db/schema/promotions.js'
import { cities, couriers, shippingZones } from '../src/db/schema/shipping.js'
import { categories, formSchemas } from '../src/db/schema/taxonomy.js'
import { visitors, visits } from '../src/db/schema/visits.js'
import { setClock } from '../src/platform/clock.js'
import { uuidv7 } from '../src/platform/ids.js'
import { closeHarness, createHarness, signedIn, t } from './support/staff.js'
import { add, createShop, shop } from './support/shop.js'
import { dbAvailable } from './support/db.js'

const S = createShop()
const PASSWORD = 'tulip bakery 4821'
const VISITOR = 'c'.repeat(32)
let seq = 0

const register = (/** @type {object} */ over = {}) => shop('POST', '/account/register', { body: { name: 'Sana Malik', phone: '0300 1112223', password: PASSWORD, ...over } })
const login = (/** @type {object} */ over = {}) => shop('POST', '/account/login', { body: { phone: '0300 1112223', password: PASSWORD, ...over } })
const asAccount = (/** @type {string} */ method, /** @type {string} */ url, /** @type {string | undefined} */ token, /** @type {object | undefined} */ body = undefined) =>
  shop(method, url, { ...(token ? { headers: { 'x-customer-session': token } } : {}), ...(body ? { body } : {}) })

/** An order placed as a guest by the given phone. @param {{ variantId: string }} p @param {string} phone @param {string} [name] */
async function guestOrder(p, phone, name = 'Sana Malik') {
  const cart = (await add(undefined, p.variantId, 1)).body.cartToken
  const r = await shop('POST', '/orders', {
    token: cart, headers: { 'idempotency-key': uuidv7() },
    body: { customer: { name, phone }, shippingAddress: { cityId: S.cityId, address: 'House 12, Street 4, Gulberg III' }, shippingMethodId: S.methodId, paymentMethod: 'cod' },
  })
  if (r.status !== 201) throw new Error(JSON.stringify(r.body))
  return { token: /** @type {string} */ (r.body.trackingToken), number: /** @type {string} */ (r.body.orderNumber) }
}

describe.skipIf(!dbAvailable)('customer accounts (MySQL, through HTTP)', () => {
  beforeAll(async () => {
    await createHarness()
  }, 60_000)
  afterAll(closeHarness)
  afterEach(async () => {
    setClock(null)
    await t.migrate.db.delete(auditLog)
    await t.db.delete(accountOrders)
    await t.db.delete(customerSessions)
    await t.db.delete(customerAccounts)
    await t.db.delete(visits)
    await t.db.delete(visitors)
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
  }

  describe('registering and signing in', () => {
    it('registers with a number and a password, answers with a session and the account (the number masked), and stores no password', async () => {
      await ready()
      const r = await register({ email: 'sana@example.com' })
      expect(r.status).toBe(201)
      expect(r.body).toMatchObject({ token: expect.any(String), expiresAt: expect.any(String), account: { name: 'Sana Malik', phoneMasked: '0300 ••••223', email: 'sana@example.com', registeredAt: expect.any(String) } })
      const [account] = await t.db.select().from(customerAccounts)
      expect(account?.passwordHash).toMatch(/^\$argon2id\$/)
      expect(JSON.stringify(await t.db.select().from(customerSessions))).not.toContain(r.body.token) // only a hash is kept
      expect((await asAccount('GET', '/account', r.body.token)).body).toMatchObject({ name: 'Sana Malik' })
    }, 60_000)

    it('refuses a weak password, a bad number, and a number that already has an account', async () => {
      await ready()
      expect(await register({ password: 'short' })).toMatchObject({ status: 400 })
      expect(await register({ password: 'password' })).toMatchObject({ status: 422, body: { code: 'password_too_weak' } })
      expect(await register({ phone: '12345' })).toMatchObject({ status: 400, body: { issues: [{ path: 'phone' }] } })
      expect((await register()).status).toBe(201)
      expect(await register({ name: 'Someone Else', phone: '+92 300 1112223' })).toMatchObject({ status: 409, body: { code: 'account_exists' } })
      expect(await t.db.select().from(customerAccounts)).toHaveLength(1)
    }, 60_000)

    it('signs in with the same words however the number is written; a wrong password, an unknown number and a bad number all answer the same', async () => {
      await ready()
      await register()
      expect((await login({ phone: '+923001112223' })).status).toBe(200)
      expect((await login({ phone: '3001112223' })).body.account.name).toBe('Sana Malik')
      const wrong = await login({ password: 'not the password' })
      const unknown = await login({ phone: '0345 9998887' })
      const garbage = await login({ phone: 'not a number' })
      for (const r of [wrong, unknown, garbage]) expect(r).toMatchObject({ status: 401, body: { code: 'invalid_credentials' } })
      expect((await t.db.select().from(customerAccounts))[0]?.lastLoginAt).toBeTruthy()
    }, 90_000)

    it('stops guessing at one number: the ninth try in a quarter of an hour is refused, wherever it comes from', async () => {
      await ready()
      await register()
      for (let i = 0; i < 8; i += 1) expect((await login({ password: `wrong ${i}` })).status).toBe(401)
      expect((await login()).status).toBe(429)
    }, 90_000)

    it('a session ends at logout and after 30 days; no session is no access', async () => {
      await ready()
      const { body } = await register()
      expect((await asAccount('GET', '/account', undefined)).status).toBe(401)
      expect((await asAccount('GET', '/account', 'made-up-token')).status).toBe(401)
      expect((await asAccount('POST', '/account/logout', body.token)).status).toBe(204)
      expect((await asAccount('GET', '/account', body.token)).status).toBe(401)
      const again = (await login()).body
      setClock(new Date(Date.now() + 31 * 86_400_000))
      expect((await asAccount('GET', '/account', again.token)).status).toBe(401)
    }, 90_000)
  })

  describe('what an account sees', () => {
    it('registering does not change the customer of that number and shows none of their orders; an order is added by its own link, only if it is the account\'s own number', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 9 })
      const mine = await guestOrder(p, '0300 1112223', 'Sana Malik')
      const other = await guestOrder(p, '0301 5556667', 'Bilal Khan')
      const { body } = await register({ name: 'Somebody Typed This' })
      expect((await t.db.select().from(customers).where(eq(customers.phone, '+923001112223')))[0]?.name).toBe('Sana Malik') // not renamed
      expect((await asAccount('GET', '/account/orders', body.token)).body.items).toEqual([]) // registering shows no order

      expect(await asAccount('POST', '/account/orders/claim', body.token, { order: other.token })).toMatchObject({ status: 404 }) // not this number's
      expect(await asAccount('POST', '/account/orders/claim', body.token, { order: 'not-an-order-link' })).toMatchObject({ status: 404 })
      const claimed = await asAccount('POST', '/account/orders/claim', body.token, { order: mine.token })
      expect(claimed).toMatchObject({ status: 200, body: { orderNumber: mine.number } })
      await asAccount('POST', '/account/orders/claim', body.token, { order: mine.token }) // twice is the same
      const listed = (await asAccount('GET', '/account/orders', body.token)).body.items
      expect(listed).toEqual([{ orderNumber: mine.number, placedAt: expect.any(String), total: expect.objectContaining({ currency: 'PKR' }), status: 'pending_confirmation', trackingToken: mine.token }])
    }, 90_000)

    it('changes the name and email; a new password ends every other session and keeps this one; the old password stops working', async () => {
      await ready()
      const a = (await register()).body
      const b = (await login()).body
      expect((await asAccount('PUT', '/account', a.token, { name: 'Sana M. Malik', email: 'new@example.com' })).body).toMatchObject({ name: 'Sana M. Malik', email: 'new@example.com' })
      expect((await t.db.select().from(customers))[0]).toMatchObject({ name: 'Sana M. Malik', email: 'new@example.com' })
      expect((await asAccount('POST', '/account/password', a.token, { currentPassword: 'wrong one', newPassword: 'another long phrase 99' })).status).toBe(401)
      expect((await asAccount('POST', '/account/password', a.token, { currentPassword: PASSWORD, newPassword: 'password' })).body.code).toBe('password_too_weak')
      expect((await asAccount('POST', '/account/password', a.token, { currentPassword: PASSWORD, newPassword: 'another long phrase 99' })).status).toBe(204)
      expect((await asAccount('GET', '/account', a.token)).status).toBe(200)
      expect((await asAccount('GET', '/account', b.token)).status).toBe(401)
      expect((await login()).status).toBe(401)
      expect((await login({ password: 'another long phrase 99' })).status).toBe(200)
    }, 90_000)

    it('leaving takes the account, its sessions and its list of orders, and nothing of the shop\'s records', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 9 })
      const mine = await guestOrder(p, '0300 1112223')
      const { body } = await register()
      await asAccount('POST', '/account/orders/claim', body.token, { order: mine.token })
      expect((await asAccount('POST', '/account/delete', body.token, { password: 'wrong' })).status).toBe(401)
      expect((await asAccount('POST', '/account/delete', body.token, { password: PASSWORD })).status).toBe(204)
      expect((await asAccount('GET', '/account', body.token)).status).toBe(401)
      expect(await t.db.select().from(customerAccounts)).toEqual([])
      expect(await t.db.select().from(accountOrders)).toEqual([])
      expect(await t.db.select().from(customers)).toHaveLength(1)
      expect(await t.db.select().from(orders)).toHaveLength(1)
    }, 90_000)
  })

  describe('visits', () => {
    it('signing in is the reliable link: the browser\'s visits become the customer\'s', async () => {
      await ready()
      const when = new Date()
      await t.db.insert(visitors).values({ id: VISITOR, firstSeenAt: when, lastVisitAt: when, visitsCount: 3 })
      await register({ visitor: VISITOR })
      const [c] = await t.db.select().from(customers)
      expect(c?.visitsCount).toBe(3)
      expect((await t.db.select().from(visitors))[0]?.customerId).toBe(c?.id)
      // a browser stays with the first customer it was linked to
      await shop('POST', '/account/register', { body: { name: 'Bilal', phone: '0301 5556667', password: PASSWORD, visitor: VISITOR } })
      expect((await t.db.select().from(customers).where(eq(customers.phone, '+923015556667')))[0]?.visitsCount).toBe(0)
    }, 90_000)
  })

  describe('in the admin', () => {
    it('shows when a customer registered, filters to those who did, and lets staff take an account away (audited)', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 9 })
      await guestOrder(p, '0301 5556667', 'Bilal Khan') // a guest: no account
      const { body } = await register({ email: 'sana@example.com' })
      const all = (await S.owner.call('GET', '/admin/customers')).body.items
      expect(all.map((/** @type {{ registeredAt?: string }} */ c) => Boolean(c.registeredAt)).sort()).toEqual([false, true])
      const only = (await S.owner.call('GET', '/admin/customers?registered=1')).body.items
      expect(only).toHaveLength(1)
      expect(only[0]).toMatchObject({ name: 'Sana Malik', email: 'sana@example.com', registeredAt: expect.any(String) })
      const detail = (await S.owner.call('GET', `/admin/customers/${only[0].id}`)).body
      expect(detail).toMatchObject({ registeredAt: expect.any(String), lastLoginAt: expect.any(String) })

      const { b: viewer } = await signedIn('viewer')
      expect((await viewer.call('POST', `/admin/customers/${only[0].id}/remove-account`)).status).toBe(403)
      expect((await S.owner.call('POST', `/admin/customers/${only[0].id}/remove-account`)).status).toBe(204)
      expect((await S.owner.call('POST', `/admin/customers/${only[0].id}/remove-account`)).status).toBe(404) // nothing left to remove
      expect((await asAccount('GET', '/account', body.token)).status).toBe(401)
      expect((await S.owner.call('GET', '/admin/customers?registered=1')).body.items).toEqual([])
      expect(await t.db.select().from(customers)).toHaveLength(2) // the customer stays
      expect((await t.db.select().from(auditLog)).some((a) => a.action === 'customer.account_removed' && a.category === 'security')).toBe(true)
    }, 90_000)
  })
})
