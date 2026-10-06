// M4-08: what the shop says during an order's life, on a scratch database: with no provider every message is written down as `skipped` once each; with a mailer the
// emails go out; a failure is retried without a second message; and what was written is removed when a customer is anonymised or after 90 days.
import { eq } from 'drizzle-orm'
import nodemailer from 'nodemailer'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { auditLog } from '../src/db/schema/audit.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { carts } from '../src/db/schema/cart.js'
import { pages, settings } from '../src/db/schema/content.js'
import { customers } from '../src/db/schema/customers.js'
import { reservations } from '../src/db/schema/inventory.js'
import { notificationLog } from '../src/db/schema/notifications.js'
import { orderEvents, orders } from '../src/db/schema/orders.js'
import { paymentEvents, payments } from '../src/db/schema/payments.js'
import { counters, idempotencyKeys, jobs, outboxEvents, rateLimitHits } from '../src/db/schema/platform.js'
import { products } from '../src/db/schema/products.js'
import { promoRedemptions, promos } from '../src/db/schema/promotions.js'
import { cities, couriers, shippingZones } from '../src/db/schema/shipping.js'
import { categories, formSchemas } from '../src/db/schema/taxonomy.js'
import { transaction } from '../src/platform/db.js'
import { uuidv7 } from '../src/platform/ids.js'
import { relayOnce } from '../src/platform/outbox.js'
import { eventHandlers } from '../src/modules/index.js'
import { createMailer, notificationJobs } from '../src/modules/notifications/index.js'
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
const EMAIL = 'sana.private@example.com'
const STAFF_EMAIL = 'orders@rubaya.test'

/** @param {{ variantId: string }} p @param {{ method?: string, phone?: string, email?: string | null }} [o] */
async function place(p, { method = 'cod', phone = PHONE, email = EMAIL } = {}) {
  const token = (await add(undefined, p.variantId, 1)).body.cartToken
  const r = await shop('POST', '/orders', {
    token, headers: { 'idempotency-key': uuidv7() },
    body: { customer: { name: 'Sana Malik', phone, ...(email ? { email } : {}) }, shippingAddress: { cityId: S.cityId, address: 'House 12, Street 4, Gulberg III' }, shippingMethodId: S.methodId, paymentMethod: method },
  })
  if (r.status !== 201) throw new Error(JSON.stringify(r.body))
  const all = await t.db.select().from(orders)
  return /** @type {NonNullable<(typeof all)[number]>} */ (all.find((o) => `${o.numberPrefix}-${o.number}` === r.body.orderNumber))
}
const go = (/** @type {string} */ id, /** @type {object} */ change) => transaction(t.db, (tx) => svc.orders.transition(tx, id, /** @type {never} */ (change), staff))
const log = () => t.db.select().from(notificationLog).orderBy(notificationLog.createdAt, notificationLog.id)
/** The log as "template/channel/status", sorted, for comparing. */
const summary = async () => (await log()).map((r) => `${r.template}/${r.channel}/${r.status}`).sort()
/** What the background process does: the relay turns events into jobs, the worker runs them (here, in order, once). @param {ReturnType<typeof createServices>} s */
async function drain(s = svc) {
  await relayOnce(t.db, eventHandlers)
  const handlers = notificationJobs(s.notifications)
  for (const j of await t.db.select().from(jobs)) {
    const h = /** @type {Record<string, (c: { job: { payload: unknown } }) => Promise<void>>} */ (handlers)[j.type]
    if (h) await h({ job: { payload: j.payload } })
    await t.db.delete(jobs).where(eq(jobs.id, j.id))
  }
}

describe.skipIf(!dbAvailable)('notifications (MySQL)', () => {
  beforeAll(async () => {
    await createHarness()
    svc = createServices({ db: t.db, config })
  }, 60_000)
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
  const ready = async (staffEmails = [STAFF_EMAIL]) => {
    await S.setup()
    staff.id = /** @type {{ id: string }} */ ((await t.db.select().from(staffUsers))[0]).id
    await S.delivery()
    tcs = (await S.owner.call('POST', '/admin/couriers', { body: { name: 'TCS', trackingRequired: false, enabled: true } })).body.id
    await S.owner.call('PUT', '/admin/settings/payments', { body: { value: { methods: [{ type: 'cod', enabled: true, label: 'Cash on delivery', sortOrder: 0 }, { type: 'bank_transfer', enabled: true, label: 'Bank transfer', sortOrder: 1 }], bankTransfer: { accountTitle: 'Rubaya', bank: 'HBL', accountNumber: 'PK00HABB0000000000', instructions: 'Thank you' } }, version: 0 } })
    const store = await S.owner.call('GET', '/admin/settings/store')
    const put = await S.owner.call('PUT', '/admin/settings/store', { body: { value: { ...store.body.value, notifications: { staffEmails } }, version: store.body.version } })
    if (put.status !== 200) throw new Error(JSON.stringify(put.body))
  }

  it('a whole order life with no provider: one skipped message per template and channel, nothing twice', async () => {
    await ready()
    const o = await place(await S.product({ price: 200000, stock: 5 }))
    await drain()
    await go(o.id, { version: 1, to: 'confirmed', via: 'call' })
    await drain()
    await go(o.id, { version: 2, to: 'dispatched', courierId: tcs, trackingNumber: 'TCS-1' })
    await drain()
    await go(o.id, { version: 3, to: 'delivered', cashReceived: true })
    await drain()
    await drain() // the same events again change nothing
    const wanted = ['order.placed', 'order.confirmed', 'order.dispatched', 'order.delivered'].flatMap((x) => [`${x}/whatsapp/skipped`, `${x}/email/skipped`])
    expect(await summary()).toEqual([...wanted, 'staff.new_order/email/skipped'].sort())

    const rows = await log()
    const dispatched = rows.find((r) => r.template === 'order.dispatched' && r.channel === 'whatsapp')
    expect(dispatched).toMatchObject({ audience: 'customer', orderId: o.id, recipient: '+923001234567', locale: 'en', provider: null })
    expect(dispatched?.body).toMatch(/^Order RB-\d+ is on its way with TCS, tracking no. TCS-1\. Please keep Rs 2,250 ready for the rider\. http:\/\/localhost:5174\/orders\/[\w-]{43}$/)
    expect(rows.find((r) => r.template === 'staff.new_order')).toMatchObject({ audience: 'staff', recipient: STAFF_EMAIL })
    for (const r of rows.filter((x) => x.audience === 'customer')) for (const secret of ['Gulberg', 'Street 4', '1234567', EMAIL]) expect(r.body).not.toContain(secret)

    // the order's history says what was skipped, once per message and never the text
    const events = (await t.db.select().from(orderEvents).where(eq(orderEvents.orderId, o.id))).filter((e) => e.type === 'notification')
    expect(events).toHaveLength(8)
    expect(events[0]).toMatchObject({ actorType: 'system', public: false, data: { status: 'skipped' } })
    expect(JSON.stringify(events)).not.toContain('Order RB-')
  }, 120_000)

  it('without an email address there is only the WhatsApp message; without staff emails, no staff message', async () => {
    await ready([])
    await place(await S.product({ price: 200000, stock: 5 }), { email: null })
    await drain()
    expect(await summary()).toEqual(['order.placed/whatsapp/skipped'])
  }, 90_000)

  it('a bank transfer gets the account to pay into; made-to-order gets its lead time; a cancel is said too', async () => {
    await ready([])
    const bank = await place(await S.product({ price: 200000, stock: 5 }), { method: 'bank_transfer', email: null })
    await go(bank.id, { version: 1, to: 'cancelled', reason: 'customer_request' })
    const mto = await place(await S.product({ price: 1000000, kind: 'made_to_order', mode: 'made_to_order', mto: true }), { method: 'bank_transfer', phone: '03211111111', email: null })
    await svc.orders.recordPayment(mto.id, /** @type {never} */ ({ kind: 'deposit', amount: { amount: 300000, currency: 'PKR' }, method: 'cash' }), staff, uuidv7())
    await drain() // the deposit confirmed the order
    const rows = await log()
    expect(rows.find((r) => r.template === 'order.bank_details')?.body).toMatch(/^Order RB-\d+: please transfer Rs 2,250 to Rubaya, HBL, PK00HABB0000000000 and send the receipt here with your order number\.$/)
    expect(rows.find((r) => r.template === 'order.cancelled')?.body).toMatch(/^Order RB-\d+ has been cancelled\./)
    expect(rows.find((r) => r.template === 'order.confirmed_mto')?.body).toMatch(/will be made in about 14 days/)
    expect(rows.map((r) => r.template).sort()).toEqual(['order.bank_details', 'order.bank_details', 'order.cancelled', 'order.confirmed_mto'])
  }, 120_000)

  describe('with a mailer', () => {
    /** @param {string} [fail] makes every send fail with this message */
    const mailerOf = (fail) => {
      /** @type {{ to: string, subject: string, text: string, html: string }[]} */
      const sent = []
      const transport = nodemailer.createTransport({ jsonTransport: true })
      const real = transport.sendMail.bind(transport)
      transport.sendMail = /** @type {never} */ (async (/** @type {{ to: string, subject: string, text: string, html: string }} */ m) => {
        if (fail) throw new Error(fail)
        sent.push(m)
        return real(m)
      })
      return { sent, services: createServices({ db: t.db, config, mailer: createMailer(config, transport) }) }
    }

    it('the emails are sent with the same text in plain and HTML, and the WhatsApp message is still only written down', async () => {
      await ready()
      const m = mailerOf()
      await place(await S.product({ price: 200000, stock: 5 }))
      await drain(m.services)
      expect(await summary()).toEqual(['order.placed/email/sent', 'order.placed/whatsapp/skipped', 'staff.new_order/email/sent'])
      const customer = m.sent.find((x) => x.to === EMAIL)
      expect(customer?.subject).toMatch(/^Rubaya: order RB-\d+$/)
      expect(customer?.text).toMatch(/^Hi Sana, we received your order/)
      expect(customer?.html).toMatch(/^<p>Hi Sana, .*<a href="http:\/\/localhost:5174\/orders\//)
      expect(m.sent.find((x) => x.to === STAFF_EMAIL)?.subject).toMatch(/^New order RB-\d+ \(Rs 2,250\)$/)
      expect((await log()).find((r) => r.status === 'sent')).toMatchObject({ provider: 'smtp' })
      expect((await log()).filter((r) => r.status === 'sent').every((r) => r.sentAt && r.providerRef)).toBe(true)
    }, 90_000)

    it('a failed send is marked failed and the job fails to be retried; the retry sends it once', async () => {
      await ready()
      const broken = mailerOf('connection refused')
      const o = await place(await S.product({ price: 200000, stock: 5 }))
      await expect(drain(broken.services)).rejects.toThrow('not sent')
      expect(await summary()).toEqual(['order.placed/email/failed', 'order.placed/whatsapp/skipped', 'staff.new_order/email/failed'])
      expect((await log()).find((r) => r.status === 'failed')?.error).toBe('connection refused')

      const working = mailerOf()
      await working.services.notifications.forOrder('order.placed', o.id) // what the job's retry does
      await working.services.notifications.forOrder('order.placed', o.id)
      expect(await summary()).toEqual(['order.placed/email/sent', 'order.placed/whatsapp/skipped', 'staff.new_order/email/sent'])
      expect(working.sent).toHaveLength(2) // the customer's and the staff's, once each
      const told = (await t.db.select().from(orderEvents).where(eq(orderEvents.orderId, o.id))).filter((e) => e.type === 'notification')
      expect(told.map((e) => /** @type {{ channel: string, status: string }} */ (e.data)).map((d) => `${d.channel}/${d.status}`).sort()).toEqual(['email/sent', 'whatsapp/skipped'])
    }, 90_000)
  })

  describe('what is kept', () => {
    it('anonymising a customer clears the recipient and text of their messages and the personal fields of their finished orders; open orders block it', async () => {
      await ready([])
      const p = await S.product({ price: 200000, stock: 5 })
      const done = await place(p)
      await go(done.id, { version: 1, to: 'confirmed', via: 'call' })
      await go(done.id, { version: 2, to: 'dispatched', courierId: tcs })
      await go(done.id, { version: 3, to: 'delivered', cashReceived: true })
      await drain()
      const open = await place(p)
      const staffInfo = { staffId: staff.id, name: staff.label, role: 'owner' }
      const info = { ip: '127.0.0.1', userAgent: 'test', requestId: uuidv7() }
      await expect(svc.customers.anonymise(staffInfo, done.customerId, '4567', info)).rejects.toMatchObject({ code: 'action_not_allowed' })

      await go(open.id, { version: 1, to: 'cancelled', reason: 'duplicate' })
      await svc.customers.anonymise(staffInfo, done.customerId, '4567', info)
      const rows = await log()
      expect(rows.length).toBeGreaterThan(0)
      expect(rows.every((r) => r.recipient === '(removed)' && r.body === '(removed)')).toBe(true)
      expect((await t.db.select().from(orders).where(eq(orders.id, done.id)))[0]).toMatchObject({ customerName: 'Removed customer', customerEmail: null, shipAddress: '(removed)', totalMinor: 225000 })
    }, 120_000)

    it('rows older than 90 days are deleted', async () => {
      await ready([])
      const o = await place(await S.product({ price: 200000, stock: 5 }))
      await drain()
      expect(await log()).toHaveLength(2)
      await t.db.update(notificationLog).set({ createdAt: new Date(Date.now() - 91 * 86_400_000) }).where(eq(notificationLog.channel, 'whatsapp'))
      await svc.notifications.cleanup()
      expect((await log()).map((r) => r.channel)).toEqual(['email'])
      expect(o.id).toBeTruthy()
    }, 90_000)
  })
})
