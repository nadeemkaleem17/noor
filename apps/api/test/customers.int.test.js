// M4-01: customers found by phone, counted by order changes, flagged and annotated by staff, anonymised on request. Through HTTP on a scratch database.
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { auditLog } from '../src/db/schema/audit.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { customerNotes, customers } from '../src/db/schema/customers.js'
import { transaction } from '../src/platform/db.js'
import { createCustomersService } from '../src/modules/customers/index.js'
import { app, closeHarness, createHarness, signedIn, t } from './support/staff.js'
import { dbAvailable } from './support/db.js'

/** @type {ReturnType<typeof createCustomersService>} */
let service
const upsert = (/** @type {object} */ input) => transaction(t.db, (tx) => service.upsertByPhone(tx, /** @type {never} */ (input)))
const update = (/** @type {string} */ _id, /** @type {object} */ over = {}) => ({ name: 'Sana Malik', noCod: false, vip: false, marketingConsent: false, version: 1, ...over })

describe.skipIf(!dbAvailable)('customers (MySQL, through HTTP)', () => {
  beforeAll(async () => {
    await createHarness()
    service = createCustomersService({ db: t.db })
  }, 60_000)
  afterAll(closeHarness)
  afterEach(async () => {
    await t.migrate.db.delete(auditLog)
    await t.db.delete(customers) // notes go with them
    await t.db.delete(staffUsers)
  })

  describe('a customer is a phone number', () => {
    it('is found again however the number is typed, and keeps the latest name and city', async () => {
      const a = await upsert({ phone: '0300 1234567', name: 'Sana', city: 'Lahore' })
      const b = await upsert({ phone: '+92 300 1234567', name: 'Sana Malik', email: 'sana@example.com' })
      const c = await upsert({ phone: '923001234567', name: 'Sana M.', city: 'Karachi' })
      expect(new Set([a.id, b.id, c.id]).size).toBe(1)
      const rows = await t.db.select().from(customers)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ phone: '+923001234567', name: 'Sana M.', city: 'Karachi', email: 'sana@example.com' }) // email kept when a later order had none
    })

    it('never touches the flags of an existing customer, and refuses a number that is not a mobile number', async () => {
      const first = await upsert({ phone: '03001234567', name: 'Sana' })
      await t.db.update(customers).set({ noCod: true, noCodReason: 'refused twice', vip: true }).where(eq(customers.id, first.id))
      await upsert({ phone: '03001234567', name: 'Sana again' })
      expect((await t.db.select().from(customers))[0]).toMatchObject({ noCod: true, noCodReason: 'refused twice', vip: true })
      await expect(upsert({ phone: '12345', name: 'X' })).rejects.toMatchObject({ code: 'validation_failed' })
    })

    it('makes one customer when the same number orders twice at once', async () => {
      const made = await Promise.all(Array.from({ length: 6 }, (_, i) => upsert({ phone: '0321 7654321', name: `Buyer ${i}` })))
      expect(new Set(made.map((c) => c.id)).size).toBe(1)
      expect(await t.db.select().from(customers)).toHaveLength(1)
    }, 30_000)
  })

  describe('counters', () => {
    it('add up in one statement, so changes made at the same time are all kept', async () => {
      const c = await upsert({ phone: '03001234567', name: 'Sana' })
      const first = new Date('2026-10-01T05:00:00.000Z')
      const later = new Date('2026-10-03T05:00:00.000Z')
      await transaction(t.db, (tx) => service.applyOrderChange(tx, c.id, { orders: 1, orderedAt: later }))
      await transaction(t.db, (tx) => service.applyOrderChange(tx, c.id, { orders: 1, orderedAt: first })) // an older order never moves "last" backwards
      await Promise.all(Array.from({ length: 5 }, () => transaction(t.db, (tx) => service.applyOrderChange(tx, c.id, { delivered: 1, spentMinor: 100_000 }))))
      await transaction(t.db, (tx) => service.applyOrderChange(tx, c.id, { orders: -1, cancelled: 1 }))
      const row = (await t.db.select().from(customers))[0]
      expect(row).toMatchObject({ ordersCount: 1, deliveredCount: 5, cancelledCount: 1, refusedCount: 0, spentMinor: 500_000 })
      expect(row?.firstOrderAt?.toISOString()).toBe(first.toISOString())
      expect(row?.lastOrderAt?.toISOString()).toBe(later.toISOString())
    })
  })

  describe('staff screens', () => {
    it('list and filter by name, phone digits, email, city, flags and order counts, and sort', async () => {
      const { b } = await signedIn('support')
      const sana = await upsert({ phone: '03001234567', name: 'Sana Malik', email: 'sana@example.com', city: 'Lahore' })
      const bilal = await upsert({ phone: '03217654321', name: 'Bilal Raza', city: 'Karachi' })
      await t.db.update(customers).set({ vip: true, ordersCount: 4, refusedCount: 1, spentMinor: 900_000 }).where(eq(customers.id, sana.id))
      await t.db.update(customers).set({ noCod: true, noCodReason: 'refused', ordersCount: 1 }).where(eq(customers.id, bilal.id))
      const names = async (/** @type {string} */ q) => (await b.call('GET', `/admin/customers${q}`)).body.items.map((/** @type {{ name: string }} */ c) => c.name)
      expect(await names('?q=sana')).toEqual(['Sana Malik'])
      expect(await names('?q=sana@example.com')).toEqual(['Sana Malik']) // an e-mail address whole: a fragment would read every row
      expect(await names('?q=example.com')).toEqual([])
      expect(await names('?q=0321765')).toEqual(['Bilal Raza']) // the start of the number, typed as people type it
      expect(await names('?q=7654')).toEqual([])
      expect(await names('?cityName=Karachi')).toEqual(['Bilal Raza'])
      expect(await names('?flag=vip')).toEqual(['Sana Malik'])
      expect(await names('?flag=no_cod')).toEqual(['Bilal Raza'])
      expect(await names('?minOrders=3')).toEqual(['Sana Malik'])
      expect(await names('?hasRefusals=1')).toEqual(['Sana Malik'])
      expect(await names('?sort=-spent')).toEqual(['Sana Malik', 'Bilal Raza'])
      expect(await names('?sort=name')).toEqual(['Bilal Raza', 'Sana Malik'])
      const all = (await b.call('GET', '/admin/customers')).body
      expect(all.total).toBe(2)
      expect(all.items.find((/** @type {{ name: string }} */ c) => c.name === 'Sana Malik')).toMatchObject({ phone: '+923001234567', spent: { amount: 900_000, currency: 'PKR' }, vip: true, ordersCount: 4 })
    }, 60_000)

    it('a search for "%" matches nothing: it is text, not a wildcard', async () => {
      const { b } = await signedIn('support')
      await upsert({ phone: '03001234567', name: 'Sana' })
      expect((await b.call('GET', '/admin/customers?q=%25%25')).body.items).toEqual([])
    }, 30_000)

    it('who may read, write and look up: support reads and writes; fulfilment reads and looks up; viewer has none', async () => {
      const c = await upsert({ phone: '03001234567', name: 'Sana' })
      const can = async (/** @type {string} */ role, /** @type {string} */ method, /** @type {string} */ url, /** @type {object} */ body = {}) => {
        const { b } = await signedIn(role)
        const r = await b.call(method, url, Object.keys(body).length ? { body } : {})
        await t.db.delete(staffUsers)
        return r.status
      }
      expect(await can('support', 'GET', '/admin/customers')).toBe(200)
      expect(await can('support', 'PUT', `/admin/customers/${c.id}`, update(c.id))).toBe(200)
      expect(await can('support', 'GET', '/admin/customers/by-phone?phone=03001234567')).toBe(403) // lookup is for the staff order form: orders:edit
      expect(await can('fulfilment', 'GET', '/admin/customers/by-phone?phone=03001234567')).toBe(200)
      expect(await can('fulfilment', 'PUT', `/admin/customers/${c.id}`, update(c.id, { version: 2 }))).toBe(403)
      expect(await can('viewer', 'GET', '/admin/customers')).toBe(403)
      expect(await can('support', 'POST', `/admin/customers/${c.id}/anonymise`, { confirm: '4567' })).toBe(403)
    }, 120_000)

    it('looks a customer up by phone in any format', async () => {
      const { b } = await signedIn('fulfilment')
      await upsert({ phone: '03001234567', name: 'Sana Malik' })
      const hit = await b.call('GET', `/admin/customers/by-phone?phone=${encodeURIComponent('+92 300-1234567')}`)
      expect(hit.body.customer).toMatchObject({ name: 'Sana Malik', phone: '+923001234567' })
      expect((await b.call('GET', '/admin/customers/by-phone?phone=03211111111')).body).toEqual({})
      expect((await b.call('GET', '/admin/customers/by-phone?phone=abc')).body).toEqual({})
    }, 30_000)

    it('detail shows counters, average order, notes and (until there are orders) no addresses', async () => {
      const { b, user } = await signedIn('support', { name: 'Hina Support' })
      const c = await upsert({ phone: '03001234567', name: 'Sana Malik' })
      await t.db.update(customers).set({ deliveredCount: 2, spentMinor: 1_000_000 }).where(eq(customers.id, c.id))
      const note = await b.call('POST', `/admin/customers/${c.id}/notes`, { body: { body: 'Prefers calls after 5pm' } })
      expect(note.status).toBe(201)
      expect(note.body).toMatchObject({ body: 'Prefers calls after 5pm', staffName: 'Hina Support' })
      await b.call('POST', `/admin/customers/${c.id}/notes`, { body: { body: 'Second note' } })
      const detail = (await b.call('GET', `/admin/customers/${c.id}`)).body
      expect(detail).toMatchObject({ averageOrder: { amount: 500_000 }, addresses: [], version: 1 })
      expect(detail.notes.map((/** @type {{ body: string }} */ n) => n.body)).toEqual(['Second note', 'Prefers calls after 5pm'])
      expect((await t.db.select().from(customerNotes))[0]?.staffUserId).toBe(user.id)
      expect((await b.call('POST', `/admin/customers/${c.id}/notes`, { body: { body: '   ' } })).status).toBe(400)
      expect((await b.call('GET', '/admin/customers/0190f2c0-0000-7000-8000-0000000000ff')).status).toBe(404)
    }, 60_000)

    it('update saves flags with the version, needs a reason for No COD, and the audit entry holds no name or email', async () => {
      const { b } = await signedIn('support')
      const c = await upsert({ phone: '03001234567', name: 'Sana Malik', email: 'sana@example.com' })
      const noReason = await b.call('PUT', `/admin/customers/${c.id}`, { body: update(c.id, { noCod: true }) })
      expect(noReason.status).toBe(400)
      expect(noReason.body.issues ?? noReason.body.errors ?? JSON.stringify(noReason.body)).toBeTruthy()
      const ok = await b.call('PUT', `/admin/customers/${c.id}`, { body: update(c.id, { name: 'Sana M. Malik', email: 'new@example.com', noCod: true, noCodReason: 'Refused two parcels', vip: true, marketingConsent: true, consentNote: 'Asked at checkout' }) })
      expect(ok.status).toBe(200)
      expect(ok.body).toMatchObject({ name: 'Sana M. Malik', noCod: true, noCodReason: 'Refused two parcels', vip: true, marketingConsent: true, version: 2 })
      const stale = await b.call('PUT', `/admin/customers/${c.id}`, { body: update(c.id, { version: 1 }) })
      expect(stale.status).toBe(409)
      expect(stale.body.code).toBe('stale_write')
      // turning No COD off clears the reason
      const off = await b.call('PUT', `/admin/customers/${c.id}`, { body: update(c.id, { name: 'Sana M. Malik', noCod: false, vip: true, marketingConsent: true, consentNote: 'Asked at checkout', version: 2 }) })
      expect(off.body.noCodReason).toBeUndefined()
      const audit = JSON.stringify(await t.db.select().from(auditLog))
      expect(audit).toContain('customer.updated')
      expect(audit).toContain('Refused two parcels')
      for (const secret of ['Sana M. Malik', 'Sana Malik', 'new@example.com', 'sana@example.com']) expect(audit, secret).not.toContain(secret)
    }, 60_000)
  })

  describe('anonymise (plan/11-security-auth.md section 8.2)', () => {
    it('needs the last four digits typed, and is refused while an order is open', async () => {
      const { b } = await signedIn('owner')
      const c = await upsert({ phone: '03001234567', name: 'Sana Malik' })
      const wrong = await b.call('POST', `/admin/customers/${c.id}/anonymise`, { body: { confirm: '0000' } })
      expect(wrong.status).toBe(400)
      expect((await t.db.select().from(customers))[0]?.name).toBe('Sana Malik')

      const withOpenOrder = createCustomersService({ db: t.db, orders: { openCount: async () => 2, addresses: async () => [], anonymise: async () => {} } })
      await expect(withOpenOrder.anonymise({ staffId: 'x', name: 'x', role: 'owner' }, c.id, '4567', { ip: '1', userAgent: 'u', requestId: 'r' })).rejects.toMatchObject({ code: 'action_not_allowed', details: { openOrders: 2 } })
      expect((await t.db.select().from(customers))[0]?.name).toBe('Sana Malik')
    }, 60_000)

    it('removes the name, phone, email, city and notes, keeps the counts, is audited, and cannot be repeated or edited after', async () => {
      const { b } = await signedIn('owner')
      const c = await upsert({ phone: '03001234567', name: 'Sana Malik', email: 'sana@example.com', city: 'Lahore' })
      await t.db.update(customers).set({ ordersCount: 3, deliveredCount: 3, spentMinor: 750_000, marketingConsent: true, vip: true }).where(eq(customers.id, c.id))
      await b.call('POST', `/admin/customers/${c.id}/notes`, { body: { body: 'Lives near the park' } })

      const done = await b.call('POST', `/admin/customers/${c.id}/anonymise`, { body: { confirm: '4567' } })
      expect(done.status).toBe(204)
      const row = (await t.db.select().from(customers))[0]
      expect(row).toMatchObject({ name: 'Removed customer', email: null, city: null, marketingConsent: false, ordersCount: 3, deliveredCount: 3, spentMinor: 750_000, vip: true, version: 2 })
      expect(row?.anonymisedAt).toBeTruthy()
      expect(row?.phone).toMatch(/^\+0\d{14}$/)
      expect(await t.db.select().from(customerNotes)).toEqual([])

      const audit = await t.db.select().from(auditLog)
      expect(audit.map((a) => a.action)).toContain('customer.anonymised')
      expect(audit.find((a) => a.action === 'customer.anonymised')?.category).toBe('security')
      expect(JSON.stringify(audit)).not.toContain('Sana')

      expect((await b.call('POST', `/admin/customers/${c.id}/anonymise`, { body: { confirm: row?.phone.slice(-4) } })).status).toBe(409)
      expect((await b.call('PUT', `/admin/customers/${c.id}`, { body: update(c.id, { version: 2 }) })).status).toBe(409)
      expect((await b.call('POST', `/admin/customers/${c.id}/notes`, { body: { body: 'x' } })).status).toBe(409)

      // the number is free again: the next order from it is a new customer
      const again = await upsert({ phone: '03001234567', name: 'Sana Malik' })
      expect(again.id).not.toBe(c.id)
      expect(await t.db.select().from(customers)).toHaveLength(2)
    }, 60_000)

    it('is a step-up route', async () => {
      const { routes } = await import('@noor/contract')
      expect(routes['admin.customers.anonymise'].stepUp).toBe(true)
      expect(app).toBeTruthy()
    })
  })
})
