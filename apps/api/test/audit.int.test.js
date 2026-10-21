// M1-03: the audit trail is append-only at the database, readable through the API with masking, and every admin mutation writes to it.
import { eq, inArray } from 'drizzle-orm'
import { generateSync } from 'otplib'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { routes, themePresets } from '@noor/contract'
import { auditLog } from '../src/db/schema/audit.js'
import { loginAttempts, staffUsers } from '../src/db/schema/auth.js'
import { menus, pages, settings } from '../src/db/schema/content.js'
import { customers } from '../src/db/schema/customers.js'
import { media } from '../src/db/schema/media.js'
import { promos } from '../src/db/schema/promotions.js'
import { orders } from '../src/db/schema/orders.js'
import { carts } from '../src/db/schema/cart.js'
import { notificationLog } from '../src/db/schema/notifications.js'
import { paymentEvents, payments } from '../src/db/schema/payments.js'
import { counters, idempotencyKeys, jobs, jobsDead, outboxEvents, rateLimitHits } from '../src/db/schema/platform.js'
import { promoRedemptions } from '../src/db/schema/promotions.js'
import { add, createShop, shop } from './support/shop.js'
import { reviewPhotos, reviews } from '../src/db/schema/reviews.js'
import { cities, couriers, shippingZones } from '../src/db/schema/shipping.js'
import { collections, products } from '../src/db/schema/products.js'
import { reservations } from '../src/db/schema/inventory.js'
import { attributes, categories, formSchemas, sizeCharts, sizeSystems } from '../src/db/schema/taxonomy.js'
import { uuidv7 } from '../src/platform/ids.js'
import { setClock } from '../src/platform/clock.js'
import { record } from '../src/modules/audit/index.js'
import { newTotpSecret } from '../src/modules/auth/totp.js'
import { browser, closeHarness, createHarness, makeStaff, PASSWORD, signedIn, t } from './support/staff.js'
import { dbAvailable } from './support/db.js'

const count = async () => (await t.db.select().from(auditLog)).length
const now = () => Math.floor(Date.now() / 1000)

describe.skipIf(!dbAvailable)('audit trail (MySQL)', () => {
  beforeAll(createHarness, 60_000)
  afterAll(closeHarness)
  afterEach(async () => {
    setClock(null)
    await t.migrate.db.delete(auditLog) // only the migration user may remove entries
    await t.db.delete(loginAttempts)
    await t.db.delete(reviewPhotos)
    await t.db.delete(reviews)
    for (const table of [notificationLog, paymentEvents, payments, promoRedemptions, carts, outboxEvents, jobs, jobsDead, idempotencyKeys, rateLimitHits]) await t.db.delete(table)
    await t.db.delete(orders) // the orders of the review and order samples; their lines go with them
    await t.db.delete(counters)
    await t.db.delete(media)
    await t.db.delete(customers)
    await t.db.delete(promos)
    await t.db.delete(collections)
    await t.db.delete(reservations)
    await t.migrate.pool.query('DELETE FROM inventory_movements')
    await t.db.delete(products)
    for (const table of [pages, menus, settings, shippingZones, couriers]) await t.db.delete(table)
    await t.db.delete(cities).where(inArray(cities.name, ['Newtown', 'Oldtown', 'Oldtown City', 'Lahore']))
    for (let i = 0; i < 4; i++) await t.migrate.pool.query('DELETE c FROM categories c LEFT JOIN categories k ON k.parent_id = c.id WHERE k.id IS NULL')
    for (const table of [attributes, sizeCharts, sizeSystems, formSchemas]) await t.db.delete(table)
    await t.db.delete(staffUsers)
  })

  describe('append-only', () => {
    const entry = { actor: { type: /** @type {const} */ ('system'), label: 'test' }, action: 'test.happened', entityType: 'test' }

    it('the application user can add and read entries but not change or delete them', async () => {
      const id = await record(t.db, entry)
      expect(await count()).toBe(1)
      await expect(t.db.update(auditLog).set({ actorLabel: 'tampered' }).where(eq(auditLog.id, id))).rejects.toMatchObject({ cause: { sqlMessage: 'audit_log is append-only' } })
      await expect(t.db.delete(auditLog).where(eq(auditLog.id, id))).rejects.toMatchObject({ cause: { sqlMessage: 'audit_log is append-only' } })
      expect((await t.db.select().from(auditLog))[0]?.actorLabel).toBe('test')
    })

    it('the migration user (retention job) can delete entries', async () => {
      await record(t.db, entry)
      await t.migrate.db.delete(auditLog)
      expect(await count()).toBe(0)
    })

    it('redacts secret-looking fields of a diff and cuts long text', async () => {
      const id = await record(t.db, { ...entry, diff: { name: ['A', 'B'], passwordHash: ['x', 'y'], totpSecret: [null, 'JBSW'], sessionToken: ['a', 'b'] }, entityLabel: 'x'.repeat(500) })
      const [row] = await t.db.select().from(auditLog).where(eq(auditLog.id, id))
      expect(row?.diff).toEqual({ name: ['A', 'B'], passwordHash: '[redacted]', totpSecret: '[redacted]', sessionToken: '[redacted]' })
      expect(row?.entityLabel).toHaveLength(200)
    })
  })

  describe('reading it', () => {
    it('lists newest first with a cursor, filters, and finds by text', async () => {
      const { b } = await signedIn('owner')
      await t.migrate.db.delete(auditLog)
      for (let i = 0; i < 5; i++) await record(t.db, { actor: { type: 'staff', id: null, label: 'Ayesha', role: 'manager' }, action: i % 2 ? 'product.updated' : 'order.confirmed', entityType: i % 2 ? 'product' : 'order', entityId: `e${i}`, entityLabel: `Item ${i}`, category: i === 4 ? 'security' : 'general' })
      const first = await b.call('GET', '/admin/audit?limit=2')
      expect(first.status).toBe(200)
      expect(first.body.items.map((/** @type {{ entityId: string }} */ e) => e.entityId)).toEqual(['e4', 'e3'])
      expect(first.body.nextCursor).toBeTruthy()
      const second = await b.call('GET', `/admin/audit?limit=2&cursor=${first.body.nextCursor}`)
      expect(second.body.items.map((/** @type {{ entityId: string }} */ e) => e.entityId)).toEqual(['e2', 'e1'])
      const last = await b.call('GET', `/admin/audit?limit=2&cursor=${second.body.nextCursor}`)
      expect(last.body.items.map((/** @type {{ entityId: string }} */ e) => e.entityId)).toEqual(['e0'])
      expect(last.body.nextCursor).toBeUndefined()
      expect((await b.call('GET', '/admin/audit?entityType=product')).body.items).toHaveLength(2)
      expect((await b.call('GET', '/admin/audit?category=security')).body.items).toHaveLength(1)
      expect((await b.call('GET', '/admin/audit?action=order.confirmed')).body.items).toHaveLength(3)
      expect((await b.call('GET', '/admin/audit?q=Item%203')).body.items).toHaveLength(1)
      expect((await b.call('GET', '/admin/audit?entityType=product&entityId=e1')).body.items).toHaveLength(1)
      expect((await b.call('GET', `/admin/audit?from=${new Date(Date.now() + 3_600_000).toISOString()}`)).body.items).toHaveLength(0)
    }, 60_000)

    it('shows a summary of changes and the detail with before and after, never a secret', async () => {
      const { b } = await signedIn('owner')
      await t.migrate.db.delete(auditLog)
      const id = await record(t.db, { actor: { type: 'staff', label: 'A', role: 'manager' }, action: 'product.updated', entityType: 'product', entityId: 'p1', diff: { price: [699000, 749000], status: ['draft', 'active'], passwordHash: ['a', 'b'] }, reason: 'sale', ip: '203.0.113.42', userAgent: 'Chrome', requestId: '0190f2c0-0000-7000-8000-000000000001' })
      const list = await b.call('GET', '/admin/audit?entityId=p1')
      expect(list.body.items[0].summary).toBe('price 699000 → 749000; status draft → active; passwordHash')
      const detail = await b.call('GET', `/admin/audit/${id}`)
      expect(detail.body.diff).toEqual({ price: [699000, 749000], status: ['draft', 'active'], passwordHash: '[redacted]' })
      expect(detail.body).toMatchObject({ userAgent: 'Chrome', requestId: '0190f2c0-0000-7000-8000-000000000001', reason: 'sale' })
      expect((await b.call('GET', '/admin/audit/0190f2c0-0000-7000-8000-0000000000ff')).status).toBe(404)
    }, 60_000)

    it('an owner sees full addresses, a manager sees them masked', async () => {
      const { b: owner } = await signedIn('owner')
      const { b: manager } = await signedIn('manager')
      await t.migrate.db.delete(auditLog)
      await record(t.db, { actor: { type: 'system', label: 's' }, action: 'x.y', entityType: 'x', ip: '203.0.113.42' })
      await record(t.db, { actor: { type: 'system', label: 's' }, action: 'x.z', entityType: 'x', ip: '2001:db8:85a3::8a2e:370:7334' })
      const full = (await owner.call('GET', '/admin/audit?entityType=x')).body.items.map((/** @type {{ ip: string }} */ e) => e.ip)
      const masked = (await manager.call('GET', '/admin/audit?entityType=x')).body.items.map((/** @type {{ ip: string }} */ e) => e.ip)
      expect(full).toEqual(['2001:db8:85a3::8a2e:370:7334', '203.0.113.42'])
      expect(masked).toEqual(['2001:db8:85a3:•••', '203.0.113.•••'])
    }, 60_000)

    it('is closed to roles without audit:read and has no way to write', async () => {
      for (const role of ['catalog', 'fulfilment', 'support', 'viewer']) {
        const { b } = await signedIn(role)
        expect((await b.call('GET', '/admin/audit')).status, role).toBe(403)
        await t.db.delete(staffUsers)
      }
      const { b } = await signedIn('owner')
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) expect((await b.call(method, '/admin/audit', { body: {} })).status, method).toBe(404)
      expect((await b.call('DELETE', '/admin/audit/0190f2c0-0000-7000-8000-0000000000ff')).status).toBe(404)
      expect(Object.entries(routes).filter(([k, r]) => k.startsWith('admin.audit.') && r.method !== 'GET')).toEqual([])
    }, 60_000)

    it('a failed sign-in shows the email tried and the address, no password', async () => {
      const { b } = await signedIn('owner')
      await t.migrate.db.delete(auditLog)
      await browser('198.51.100.7').call('POST', '/admin/auth/login', { body: { email: 'nobody@rubaya.pk', password: 'not the password 1' } })
      const r = await b.call('GET', '/admin/audit?category=security')
      const failed = r.body.items.find((/** @type {{ action: string }} */ e) => e.action === 'auth.login_failed')
      expect(failed).toMatchObject({ entityLabel: 'nobody@rubaya.pk', ip: '198.51.100.7', actorType: 'system' })
      expect(JSON.stringify(r.body)).not.toContain('not the password')
    }, 60_000)
  })

  describe('every admin mutation writes exactly one entry', () => {
    /**
     * Each non-GET admin route has a sample: `prepare` builds the situation, `act` makes the one request. The test checks it
     * succeeded and left one new audit row. A route with no sample and no exemption fails the last test, so a new mutation cannot ship unaudited.
     * @typedef {{ prepare: () => Promise<any>, act: (ctx: any) => Promise<{ status: number }>, rows?: number }} Sample
     */
    const email = () => `s${Math.random().toString(36).slice(2, 8)}@rubaya.pk`
    const target = async (role = 'viewer') => makeStaff(role)

    /** @type {Record<string, Sample>} */
    const samples = {
      'admin.auth.login': { prepare: async () => ({ u: await target() }), act: ({ u }) => browser().call('POST', '/admin/auth/login', { body: { email: u.email, password: PASSWORD } }) },
      'admin.auth.verifyTwoFactor': {
        prepare: async () => {
          const secret = newTotpSecret()
          const u = await makeStaff('manager', { totp: secret })
          const b = browser()
          await b.call('POST', '/admin/auth/login', { body: { email: u.email, password: PASSWORD } })
          return { b, secret }
        },
        act: ({ b, secret }) => b.call('POST', '/admin/auth/2fa', { body: { code: generateSync({ secret, epoch: now() }) } }),
      },
      'admin.auth.logout': { prepare: async () => signedIn('viewer'), act: ({ b }) => b.call('POST', '/admin/auth/logout') },
      'admin.auth.resetPassword': {
        prepare: async () => {
          const { b } = await signedIn('owner')
          const u = await target()
          const link = await b.call('POST', `/admin/staff/${u.id}/password-reset`)
          await t.migrate.db.delete(auditLog)
          return { token: link.body.resetLink.split('/').pop() }
        },
        act: ({ token }) => browser().call('POST', `/admin/auth/password-reset/${token}`, { body: { password: 'a long reset passphrase' } }),
      },
      'admin.auth.acceptInvite': {
        prepare: async () => {
          const { b } = await signedIn('owner')
          const r = await b.call('POST', '/admin/staff', { body: { name: 'New', email: email(), role: 'viewer' } })
          return { token: r.body.inviteLink.split('/').pop() }
        },
        act: ({ token }) => browser().call('POST', `/admin/auth/invites/${token}`, { body: { password: 'a long invite passphrase' } }),
      },
      'admin.me.update': { prepare: async () => signedIn('viewer'), act: ({ b }) => b.call('PUT', '/admin/me', { body: { name: 'New Name' } }) },
      'admin.me.changePassword': { prepare: async () => signedIn('viewer'), act: ({ b }) => b.call('POST', '/admin/me/password', { body: { currentPassword: PASSWORD, newPassword: 'another long passphrase' } }) },
      'admin.me.twoFactor.enable': {
        prepare: async () => {
          const s = await signedIn('support')
          const begin = await s.b.call('POST', '/admin/me/2fa/begin')
          return { ...s, secret: begin.body.secret }
        },
        act: ({ b, secret }) => b.call('POST', '/admin/me/2fa/enable', { body: { code: generateSync({ secret, epoch: now() }) } }),
      },
      'admin.me.twoFactor.regenerateCodes': {
        prepare: async () => {
          const s = await signedIn('support')
          const begin = await s.b.call('POST', '/admin/me/2fa/begin')
          await s.b.call('POST', '/admin/me/2fa/enable', { body: { code: generateSync({ secret: begin.body.secret, epoch: now() }) } })
          await t.migrate.db.delete(auditLog)
          return s
        },
        act: ({ b }) => b.call('POST', '/admin/me/2fa/recovery-codes'),
      },
      'admin.me.twoFactor.disable': {
        prepare: async () => {
          const s = await signedIn('support')
          const begin = await s.b.call('POST', '/admin/me/2fa/begin')
          await s.b.call('POST', '/admin/me/2fa/enable', { body: { code: generateSync({ secret: begin.body.secret, epoch: now() }) } })
          await t.migrate.db.delete(auditLog)
          return s
        },
        act: ({ b }) => b.call('DELETE', '/admin/me/2fa'),
      },
      'admin.me.sessions.revoke': {
        prepare: async () => {
          const { b, user } = await signedIn('viewer')
          const other = browser('10.5.5.5')
          await other.login(user.email)
          const list = await b.call('GET', '/admin/me/sessions')
          return { b, id: list.body.items.find((/** @type {{ current: boolean }} */ s) => !s.current).id }
        },
        act: ({ b, id }) => b.call('DELETE', `/admin/me/sessions/${id}`),
      },
      'admin.me.sessions.revokeOthers': { prepare: async () => signedIn('viewer'), act: ({ b }) => b.call('POST', '/admin/me/sessions/revoke-others') },
      'admin.staff.invite': { prepare: async () => signedIn('owner'), act: ({ b }) => b.call('POST', '/admin/staff', { body: { name: 'Fresh', email: email(), role: 'viewer' } }) },
      'admin.staff.setPermissions': { prepare: async () => ({ ...(await signedIn('owner')), u: await target() }), act: ({ b, u }) => b.call('PUT', `/admin/staff/${u.id}/permissions`, { body: { grants: ['orders:note'], revokes: [], version: 1 } }) },
      'admin.staff.update': { prepare: async () => ({ ...(await signedIn('owner')), u: await target() }), act: ({ b, u }) => b.call('PUT', `/admin/staff/${u.id}`, { body: { name: 'Renamed', role: 'support', version: 1 } }) },
      'admin.staff.resendInvite': {
        prepare: async () => {
          const s = await signedIn('owner')
          const r = await s.b.call('POST', '/admin/staff', { body: { name: 'Pending', email: email(), role: 'viewer' } })
          await t.migrate.db.delete(auditLog)
          return { ...s, id: r.body.id }
        },
        act: ({ b, id }) => b.call('POST', `/admin/staff/${id}/invite`),
      },
      'admin.staff.resetPassword': { prepare: async () => ({ ...(await signedIn('owner')), u: await target() }), act: ({ b, u }) => b.call('POST', `/admin/staff/${u.id}/password-reset`) },
      'admin.staff.resetTwoFactor': { prepare: async () => ({ ...(await signedIn('owner')), u: await target() }), act: ({ b, u }) => b.call('DELETE', `/admin/staff/${u.id}/2fa`) },
      'admin.staff.revokeSessions': { prepare: async () => ({ ...(await signedIn('owner')), u: await target() }), act: ({ b, u }) => b.call('POST', `/admin/staff/${u.id}/sessions/revoke`) },
      'admin.staff.clearLock': { prepare: async () => ({ ...(await signedIn('owner')), u: await target() }), act: ({ b, u }) => b.call('POST', `/admin/staff/${u.id}/unlock`) },
      'admin.staff.deactivate': { prepare: async () => ({ ...(await signedIn('owner')), u: await target() }), act: ({ b, u }) => b.call('POST', `/admin/staff/${u.id}/deactivate`) },
      'admin.staff.reactivate': {
        prepare: async () => {
          const s = { ...(await signedIn('owner')), u: await target() }
          await s.b.call('POST', `/admin/staff/${s.u.id}/deactivate`)
          await t.migrate.db.delete(auditLog)
          return s
        },
        act: ({ b, u }) => b.call('POST', `/admin/staff/${u.id}/reactivate`),
      },
    }

    /** A pending upload slot, which is all the alt-text and delete routes need. */
    const slot = async () => {
      const s = await signedIn('catalog')
      const r = await s.b.call('POST', '/admin/media/uploads', { body: { filename: 'a.jpg', contentType: 'image/jpeg', bytes: 100 } })
      await t.migrate.db.delete(auditLog)
      return { ...s, id: r.body.mediaId }
    }
    samples['admin.media.update'] = { prepare: slot, act: ({ b, id }) => b.call('PUT', `/admin/media/${id}`, { body: { alt: 'Green suit' } }) }
    samples['admin.customers.highlightRules.save'] = { prepare: async () => signedIn('owner'), act: (/** @type {any} */ { b }) => b.call('PUT', '/admin/customers/highlight-rules', { body: { rules: [{ kind: 'orders', minCount: 1, maxCount: 5, color: '#3b82f6', label: 'New', enabled: true }] } }) }
    samples['admin.messages.test'] = { prepare: async () => signedIn('owner'), act: (/** @type {any} */ { b }) => b.call('POST', '/admin/messages/test', { body: { to: '0300 1234567' } }) }
    samples['admin.emails.test'] = { prepare: async () => signedIn('owner'), act: (/** @type {any} */ { b }) => b.call('POST', '/admin/emails/test', { body: { event: 'placed', to: 'me@example.com' } }) }
    samples['admin.searchIndex.rebuild'] = { prepare: async () => signedIn('owner'), act: (/** @type {any} */ { b }) => b.call('POST', '/admin/search-index/rebuild') }
    samples['admin.media.delete'] = { prepare: slot, act: ({ b, id }) => b.call('DELETE', `/admin/media/${id}`) }

    /** The five documents, a page and a menu: one sample each. Versions start at 0 because nothing was saved yet. */
    const docSample = (/** @type {string} */ url, /** @type {unknown} */ value) => ({ prepare: async () => signedIn('owner'), act: (/** @type {any} */ { b }) => b.call('PUT', url, { body: { value, version: 0 } }) })
    samples['admin.settings.updateStore'] = docSample('/admin/settings/store', { brand: { name: 'Rubaya Atelier' }, contact: { socials: [] }, priceDisplay: { showDecimals: false, rounding: 'none' }, orderNumberPrefix: 'RB', locale: { default: 'en', supported: ['en'] }, features: { wishlist: true, reviews: true, notifyMe: true, customSizing: false }, policies: {}, seo: {}, notifications: { staffEmails: [] }, thresholds: { lowStock: 3, highValueCodMinor: 100 } })
    samples['admin.settings.updateTheme'] = docSample('/admin/settings/theme', themePresets.monochrome)
    samples['admin.settings.updateCheckout'] = docSample('/admin/settings/checkout', { extraFields: [], marketingConsent: { enabled: true, label: 'Send me offers' } })
    samples['admin.settings.updatePayments'] = docSample('/admin/settings/payments', { methods: [{ type: 'cod', enabled: true, label: 'Cash', sortOrder: 0 }] })
    samples['admin.content.updateHome'] = docSample('/admin/content/home', { announcement: { text: 'Sale' }, notices: [], heroSlides: [], promo: { enabled: false }, editorial: { enabled: false }, footer: { about: '' } })
    samples['admin.menus.update'] = { prepare: async () => signedIn('owner'), act: ({ b }) => b.call('PUT', '/admin/menus/main', { body: { items: [{ label: 'New', href: '/new' }], version: 0 } }) }
    const page = { title: 'About', slug: 'about', bodyMd: 'Hi', status: 'active' }
    samples['admin.pages.create'] = { prepare: async () => signedIn('owner'), act: ({ b }) => b.call('POST', '/admin/pages', { body: page }) }
    const withPage = async () => {
      const s = await signedIn('owner')
      const r = await s.b.call('POST', '/admin/pages', { body: page })
      await t.migrate.db.delete(auditLog)
      return { ...s, id: r.body.id }
    }
    samples['admin.pages.update'] = { prepare: withPage, act: ({ b, id }) => b.call('PUT', `/admin/pages/${id}`, { body: { ...page, bodyMd: 'Changed', version: 1 } }) }
    samples['admin.pages.delete'] = { prepare: withPage, act: ({ b, id }) => b.call('DELETE', `/admin/pages/${id}`) }

    const method = { label: 'Standard', fee: { amount: 25000, currency: 'PKR' }, etaMinDays: 3, etaMaxDays: 5, codAllowed: true, enabled: true }
    const zoneBody = { name: 'Everywhere', cityIds: [], methods: [method] }
    const withZone = async () => {
      const s = await signedIn('owner')
      const r = await s.b.call('POST', '/admin/shipping/zones', { body: zoneBody })
      await t.migrate.db.delete(auditLog)
      return { ...s, id: r.body.id }
    }
    samples['admin.shipping.createZone'] = { prepare: async () => signedIn('owner'), act: ({ b }) => b.call('POST', '/admin/shipping/zones', { body: zoneBody }) }
    samples['admin.shipping.updateZone'] = { prepare: withZone, act: ({ b, id }) => b.call('PUT', `/admin/shipping/zones/${id}`, { body: { ...zoneBody, name: 'Renamed', version: 1 } }) }
    samples['admin.shipping.deleteZone'] = { prepare: withZone, act: ({ b, id }) => b.call('DELETE', `/admin/shipping/zones/${id}`) }
    samples['admin.shipping.createCity'] = { prepare: async () => signedIn('owner'), act: ({ b }) => b.call('POST', '/admin/shipping/cities', { body: { name: 'Newtown', province: 'Punjab' } }) }
    samples['admin.shipping.updateCity'] = {
      prepare: async () => {
        const s = await signedIn('owner')
        const r = await s.b.call('POST', '/admin/shipping/cities', { body: { name: 'Oldtown', province: 'Sindh' } })
        await t.migrate.db.delete(auditLog)
        return { ...s, id: r.body.id }
      },
      act: ({ b, id }) => b.call('PUT', `/admin/shipping/cities/${id}`, { body: { name: 'Oldtown City', province: 'Sindh' } }),
    }
    const withCustomer = async () => {
      const s = await signedIn('owner')
      const id = uuidv7()
      const at = new Date()
      await t.db.insert(customers).values({ id, phone: '+923001234567', name: 'Sana Malik', createdAt: at, updatedAt: at })
      return { ...s, id }
    }
    samples['admin.customers.update'] = { prepare: withCustomer, act: ({ b, id }) => b.call('PUT', `/admin/customers/${id}`, { body: { name: 'Sana Malik', noCod: true, noCodReason: 'Refused twice', vip: false, marketingConsent: false, version: 1 } }) }
    samples['admin.customers.addNote'] = { prepare: withCustomer, act: ({ b, id }) => b.call('POST', `/admin/customers/${id}/notes`, { body: { body: 'Call after 5pm' } }) }
    samples['admin.customers.anonymise'] = { prepare: withCustomer, act: ({ b, id }) => b.call('POST', `/admin/customers/${id}/anonymise`, { body: { confirm: '4567' } }) }
    const promoBody = { code: 'EID10', type: 'percent', percent: 10, scope: 'all', excludeSaleItems: true, firstOrderOnly: false, enabled: true }
    const withPromo = async () => {
      const s = await signedIn('owner')
      const r = await s.b.call('POST', '/admin/promos', { body: promoBody })
      await t.migrate.db.delete(auditLog)
      return { ...s, id: r.body.id }
    }
    samples['admin.promos.create'] = { prepare: async () => signedIn('owner'), act: ({ b }) => b.call('POST', '/admin/promos', { body: promoBody }) }
    samples['admin.promos.update'] = { prepare: withPromo, act: ({ b, id }) => b.call('PUT', `/admin/promos/${id}`, { body: { ...promoBody, percent: 15, version: 1 } }) }
    samples['admin.promos.delete'] = { prepare: withPromo, act: ({ b, id }) => b.call('DELETE', `/admin/promos/${id}`) }
    samples['admin.promos.bulk'] = { prepare: withPromo, act: ({ b, id }) => b.call('POST', '/admin/promos/bulk', { body: { ids: [id], action: 'disable' } }) }
    const courier = { name: 'BlueEx', trackingRequired: true, enabled: true }
    samples['admin.couriers.create'] = { prepare: async () => signedIn('owner'), act: ({ b }) => b.call('POST', '/admin/couriers', { body: courier }) }
    samples['admin.couriers.update'] = {
      prepare: async () => {
        const s = await signedIn('owner')
        const r = await s.b.call('POST', '/admin/couriers', { body: { ...courier, name: 'Swift' } })
        await t.migrate.db.delete(auditLog)
        return { ...s, id: r.body.id }
      },
      act: ({ b, id }) => b.call('PUT', `/admin/couriers/${id}`, { body: { ...courier, name: 'Swift', enabled: false } }),
    }

    // ---- catalog structure: each sample builds what it needs through the API, then clears the audit rows it caused ----
    /** @param {(b: any) => Promise<any>} build @param {(ctx: any) => Promise<{ status: number }>} act */
    const withSetup = (build, act) => ({
      prepare: async () => {
        const s = await signedIn('owner')
        const ctx = await build(s.b)
        await t.migrate.db.delete(auditLog)
        return { ...s, ...ctx }
      },
      act,
    })
    const cat = (/** @type {string} */ handle) => ({ name: handle, handle, visible: true, attributes: [] })
    const attr = (/** @type {string} */ code) => ({ code, label: code, type: 'enum', display: 'checkbox', filterable: true, values: [{ code: 'a', label: 'A' }, { code: 'b', label: 'B' }] })
    const chart = { title: 'Kameez', unit: 'in', tables: [{ id: 'k', title: 'K', columns: ['Bust'], rows: [{ label: 'S', values: [34] }] }] }
    const form = { title: 'Custom', allowNotes: false, fields: [{ key: 'bust', label: 'Bust', type: 'number', required: false }] }
    samples['admin.categories.create'] = withSetup(async () => ({}), ({ b }) => b.call('POST', '/admin/categories', { body: cat('women') }))
    samples['admin.categories.update'] = withSetup(async (b) => ({ id: (await b.call('POST', '/admin/categories', { body: cat('women') })).body.id }), ({ b, id }) => b.call('PUT', `/admin/categories/${id}`, { body: { ...cat('women2'), version: 1 } }))
    samples['admin.categories.reorder'] = withSetup(async (b) => ({ id: (await b.call('POST', '/admin/categories', { body: cat('women') })).body.id }), ({ b, id }) => b.call('POST', '/admin/categories/reorder', { body: { parentId: null, orderedIds: [id] } }))
    samples['admin.categories.delete'] = withSetup(async (b) => ({ id: (await b.call('POST', '/admin/categories', { body: cat('women') })).body.id }), ({ b, id }) => b.call('DELETE', `/admin/categories/${id}`))
    samples['admin.attributes.create'] = withSetup(async () => ({}), ({ b }) => b.call('POST', '/admin/attributes', { body: attr('fabric') }))
    samples['admin.attributes.update'] = withSetup(async (b) => ({ a: (await b.call('POST', '/admin/attributes', { body: attr('fabric') })).body }), ({ b, a }) => b.call('PUT', `/admin/attributes/${a.id}`, { body: { ...attr('fabric'), label: 'Material', values: a.values.map((/** @type {any} */ v) => ({ id: v.id, code: v.code, label: v.label })) } }))
    samples['admin.attributes.mergeValue'] = withSetup(async (b) => ({ a: (await b.call('POST', '/admin/attributes', { body: attr('fabric') })).body }), ({ b, a }) => b.call('POST', `/admin/attributes/${a.id}/values/${a.values[0].id}/merge`, { body: { intoValueId: a.values[1].id } }))
    samples['admin.attributes.delete'] = withSetup(async (b) => ({ a: (await b.call('POST', '/admin/attributes', { body: attr('fabric') })).body }), ({ b, a }) => b.call('DELETE', `/admin/attributes/${a.id}`))
    samples['admin.sizeSystems.create'] = withSetup(async () => ({}), ({ b }) => b.call('POST', '/admin/size-systems', { body: { name: 'Std', values: [{ label: 'S' }, { label: 'M' }] } }))
    samples['admin.sizeSystems.update'] = withSetup(async (b) => ({ id: (await b.call('POST', '/admin/size-systems', { body: { name: 'Std', values: [{ label: 'S' }] } })).body.id }), ({ b, id }) => b.call('PUT', `/admin/size-systems/${id}`, { body: { name: 'Std2', values: [{ label: 'S' }, { label: 'L' }] } }))
    samples['admin.sizeSystems.delete'] = withSetup(async (b) => ({ id: (await b.call('POST', '/admin/size-systems', { body: { name: 'Std', values: [{ label: 'S' }] } })).body.id }), ({ b, id }) => b.call('DELETE', `/admin/size-systems/${id}`))
    samples['admin.sizeCharts.create'] = withSetup(async () => ({}), ({ b }) => b.call('POST', '/admin/size-charts', { body: chart }))
    samples['admin.sizeCharts.update'] = withSetup(async (b) => ({ id: (await b.call('POST', '/admin/size-charts', { body: chart })).body.id }), ({ b, id }) => b.call('PUT', `/admin/size-charts/${id}`, { body: { ...chart, title: 'Kameez 2', version: 1 } }))
    samples['admin.sizeCharts.delete'] = withSetup(async (b) => ({ id: (await b.call('POST', '/admin/size-charts', { body: chart })).body.id }), ({ b, id }) => b.call('DELETE', `/admin/size-charts/${id}`))
    samples['admin.formSchemas.create'] = withSetup(async () => ({}), ({ b }) => b.call('POST', '/admin/form-schemas', { body: form }))
    samples['admin.formSchemas.update'] = withSetup(async (b) => ({ id: (await b.call('POST', '/admin/form-schemas', { body: form })).body.id }), ({ b, id }) => b.call('PUT', `/admin/form-schemas/${id}`, { body: { ...form, title: 'Custom 2', version: 1 } }))
    samples['admin.formSchemas.delete'] = withSetup(async (b) => ({ id: (await b.call('POST', '/admin/form-schemas', { body: form })).body.id }), ({ b, id }) => b.call('DELETE', `/admin/form-schemas/${id}`))

    // ---- products and collections ----
    const productBody = (/** @type {string} */ categoryId, /** @type {string} */ handle = 'lawn-suit') => ({
      handle, status: 'draft', kind: 'accessory', title: 'Lawn suit', primaryCategoryId: categoryId, categoryIds: [], attributes: [], media: [], options: [],
      variants: [{ key: 'v', sku: handle.toUpperCase(), optionValueKeys: [], price: { amount: 500000, currency: 'PKR' }, stockMode: 'counted', maxPerOrder: 10, enabled: true }],
    })
    const withProduct = async () => {
      const s = await signedIn('owner')
      const categoryId = uuidv7()
      await t.db.insert(categories).values({ id: categoryId, handle: 'women', name: 'Women', createdAt: new Date(), updatedAt: new Date() })
      const r = await s.b.call('POST', '/admin/products', { body: productBody(categoryId) })
      await t.migrate.db.delete(auditLog)
      return { ...s, categoryId, product: r.body }
    }
    // a review needs a product, an order and a line; the order and its line are made bare, with the keys not checked
    const withReview = async () => {
      const s = await withProduct() // the review's product must be real: deciding a review updates the product's rating
      const id = uuidv7()
      const mediaId = uuidv7()
      const [orderId, lineId, orderNo] = [uuidv7(), uuidv7(), Math.floor(Math.random() * 1e9)]
      const at = new Date()
      await t.db.insert(media).values({ id: mediaId, kind: 'image', status: 'ready', objectKey: `proofs/${mediaId}.jpg`, contentType: 'image/jpeg', bytes: 1, createdAt: at })
      const conn = await t.migrate.pool.getConnection()
      try {
        await conn.query('SET FOREIGN_KEY_CHECKS=0')
        await conn.query(
          'INSERT INTO orders (id, number, number_prefix, tracking_token_hash, status, customer_id, customer_name, customer_phone, ship_city_id, ship_city, ship_address, shipping_method_label, eta_min_days, eta_max_days, subtotal_minor, shipping_fee_minor, total_minor, payment_method, placed_at, status_changed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 2, 100, 0, 100, ?, ?, ?, ?, ?)',
          [orderId, orderNo, 'RB', orderId.replaceAll('-', '').padEnd(64, '0'), 'delivered', uuidv7(), 'Sana Malik', '+923001234567', uuidv7(), 'Lahore', 'House 12, Street 4', 'Standard', 'cod', at, at, at, at],
        )
        await conn.query('INSERT INTO order_lines (id, order_id, position, product_id, variant_id, kind, title, sku, quantity, unit_price_minor, line_subtotal_minor, stock_tracked) VALUES (?, ?, 1, ?, ?, ?, ?, ?, 1, 100, 100, 1)', [lineId, orderId, uuidv7(), uuidv7(), 'stitched', 'Lawn suit', 'SKU1'])
        await conn.query('INSERT INTO reviews (id, product_id, order_line_id, display_name, rating, body, status, locale, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, s.product.id, lineId, 'Sana M.', 5, 'Lovely fabric and neat embroidery.', 'pending', 'en', at, at])
        await conn.query('INSERT INTO review_photos (review_id, media_id, sort_order) VALUES (?, ?, 0)', [id, mediaId])
      } finally {
        await conn.query('SET FOREIGN_KEY_CHECKS=1')
        conn.release()
      }
      return { ...s, id, mediaId }
    }
    samples['admin.reviews.moderate'] = { prepare: withReview, act: ({ b, id }) => b.call('POST', `/admin/reviews/${id}/moderation`, { body: { status: 'rejected', reason: 'spam' } }) }
    samples['admin.reviews.reply'] = { prepare: withReview, act: ({ b, id }) => b.call('PUT', `/admin/reviews/${id}/reply`, { body: { body: 'Thank you!' } }) }
    samples['admin.reviews.removePhoto'] = { prepare: withReview, act: ({ b, id, mediaId }) => b.call('DELETE', `/admin/reviews/${id}/photos/${mediaId}`), rows: 2 } // the link, and the file
    samples['admin.reviews.bulk'] = { prepare: withReview, act: ({ b, id }) => b.call('POST', '/admin/reviews/bulk', { body: { ids: [id], action: 'approve' } }) }
    // a real order, made through the storefront, with a delivery city and a courier
    const S = createShop()
    const withOrder = async (/** @type {'new' | 'dispatched'} */ stage = 'new') => {
      await S.setup()
      await S.delivery()
      const courier = await S.owner.call('POST', '/admin/couriers', { body: { name: 'TCS', trackingRequired: false, enabled: true } })
      const p = await S.product({ price: 200000, stock: 5 })
      const token = (await add(undefined, p.variantId, 1)).body.cartToken
      const placed = await shop('POST', '/orders', {
        token, headers: { 'idempotency-key': uuidv7() },
        body: { customer: { name: 'Sana Malik', phone: '03001234567' }, shippingAddress: { cityId: S.cityId, address: 'House 12, Street 4, Gulberg III' }, shippingMethodId: S.methodId, paymentMethod: 'cod' },
      })
      if (placed.status !== 201) throw new Error(JSON.stringify(placed.body))
      const id = /** @type {string} */ ((await t.db.select().from(orders))[0]?.id)
      if (stage === 'dispatched') {
        await S.owner.call('POST', `/admin/orders/${id}/transitions`, { body: { version: 1, to: 'confirmed', via: 'call' } })
        await S.owner.call('POST', `/admin/orders/${id}/transitions`, { body: { version: 2, to: 'dispatched', courierId: courier.body.id } })
      }
      await t.migrate.db.delete(auditLog)
      return { b: S.owner, id, courierId: courier.body.id, variantId: p.variantId, cityId: S.cityId, methodId: S.methodId }
    }
    samples['admin.jobs.retry'] = {
      prepare: async () => {
        const s = await signedIn('owner')
        const id = uuidv7()
        const at = new Date()
        await t.db.insert(jobsDead).values({ id, type: 'notify.order', payload: {}, runAt: at, attempts: 8, maxAttempts: 8, lastError: 'connection refused', createdAt: at, diedAt: at })
        return { ...s, id }
      },
      act: ({ b, id }) => b.call('POST', `/admin/jobs/dead/${id}/retry`),
    }
    samples['admin.orders.transition'] = { prepare: withOrder, act: ({ b, id }) => b.call('POST', `/admin/orders/${id}/transitions`, { body: { version: 1, to: 'confirmed', via: 'call' } }) }
    samples['admin.orders.edit'] = { prepare: withOrder, act: ({ b, id, cityId }) => b.call('PUT', `/admin/orders/${id}`, { body: { version: 1, shippingAddress: { cityId, address: 'Another house, Street 9, DHA' } } }) }
    samples['admin.orders.addNote'] = { prepare: withOrder, act: ({ b, id }) => b.call('POST', `/admin/orders/${id}/notes`, { body: { body: 'Call after 5pm' } }) }
    samples['admin.orders.logAttempt'] = { prepare: withOrder, act: ({ b, id }) => b.call('POST', `/admin/orders/${id}/confirmation-attempts`, { body: { channel: 'call', outcome: 'busy' } }) }
    samples['admin.orders.recordPayment'] = { prepare: withOrder, act: ({ b, id }) => b.call('POST', `/admin/orders/${id}/payments`, { body: { kind: 'full', amount: { amount: 100000, currency: 'PKR' }, method: 'cash' }, headers: { 'idempotency-key': uuidv7() } }) }
    samples['admin.orders.updateTracking'] = { prepare: () => withOrder('dispatched'), act: ({ b, id, courierId }) => b.call('PUT', `/admin/orders/${id}/tracking`, { body: { courierId, trackingNumber: 'T-9', version: 3 } }) }
    samples['admin.orders.create'] = {
      prepare: withOrder,
      act: ({ b, variantId, cityId, methodId }) => b.call('POST', '/admin/orders', { body: { customer: { name: 'Hina Raza', phone: '03451112223' }, shippingAddress: { cityId, address: 'Flat 4, Block B, DHA Phase 5' }, shippingMethodId: methodId, paymentMethod: 'cod', lines: [{ variantId, quantity: 1 }] }, headers: { 'idempotency-key': uuidv7() } }),
    }
    samples['admin.orders.bulk'] = { prepare: withOrder, act: ({ b, id }) => b.call('POST', '/admin/orders/bulk', { body: { ids: [id], action: 'confirm', params: { via: 'call' } } }) }
    samples['admin.orders.export'] = { prepare: withOrder, act: ({ b }) => b.call('POST', '/admin/orders/exports', { body: { from: new Date(Date.now() - 86_400_000).toISOString(), to: new Date(Date.now() + 86_400_000).toISOString() } }) }
    samples['admin.customers.export'] = { prepare: withCustomer, act: ({ b }) => b.call('POST', '/admin/customers/exports', { body: {} }) }
    samples['admin.products.create'] = {
      prepare: async () => {
        const s = await signedIn('owner')
        const categoryId = uuidv7()
        await t.db.insert(categories).values({ id: categoryId, handle: 'women', name: 'Women', createdAt: new Date(), updatedAt: new Date() })
        return { ...s, categoryId }
      },
      act: ({ b, categoryId }) => b.call('POST', '/admin/products', { body: productBody(categoryId) }),
    }
    samples['admin.products.update'] = { prepare: withProduct, act: ({ b, product, categoryId }) => b.call('PUT', `/admin/products/${product.id}`, { body: { ...productBody(categoryId), title: 'Changed', variants: [{ ...productBody(categoryId).variants[0], id: product.variants[0].id }], version: 1 } }) }
    samples['admin.products.delete'] = { prepare: withProduct, act: ({ b, product }) => b.call('DELETE', `/admin/products/${product.id}`) }
    samples['admin.products.duplicate'] = { prepare: withProduct, act: ({ b, product }) => b.call('POST', `/admin/products/${product.id}/duplicate`) }
    samples['admin.products.bulk'] = { prepare: withProduct, act: ({ b, product }) => b.call('POST', '/admin/products/bulk', { body: { ids: [product.id], action: 'archive' } }) }
    samples['admin.inventory.adjust'] = {
      prepare: withProduct,
      act: ({ b, product }) => b.call('POST', '/admin/inventory/adjustments', { body: { variantId: product.variants[0].id, mode: 'add', quantity: 5, reason: 'restock' } }),
    }
    const collectionBody = { title: 'Eid drop', handle: 'eid-drop', status: 'draft', featured: false, productIds: [] }
    samples['admin.collections.create'] = { prepare: async () => signedIn('owner'), act: ({ b }) => b.call('POST', '/admin/collections', { body: collectionBody }) }
    const withCollection = async () => {
      const s = await signedIn('owner')
      const r = await s.b.call('POST', '/admin/collections', { body: collectionBody })
      await t.migrate.db.delete(auditLog)
      return { ...s, id: r.body.id }
    }
    samples['admin.collections.update'] = { prepare: withCollection, act: ({ b, id }) => b.call('PUT', `/admin/collections/${id}`, { body: { ...collectionBody, title: 'Eid', version: 1 } }) }
    samples['admin.collections.delete'] = { prepare: withCollection, act: ({ b, id }) => b.call('DELETE', `/admin/collections/${id}`) }

    /** Mutating routes that deliberately write no entry, each with the reason. */
    const exempt = {
      'admin.emails.preview': 'only shows what a message would say; nothing is stored',
      'admin.content.saveHomeDraft': 'writes its audit entry (content.draft_saved), which test/settings.int.test.js checks together with publish and discard',
      'admin.content.discardHomeDraft': 'writes its audit entry (content.draft_discarded), which test/settings.int.test.js checks together with save and publish',
      'admin.content.publishHome': 'writes its audit entries (content.updated and content.draft_published), which test/settings.int.test.js checks',
      'admin.content.homePreviewLink': 'only signs a link that expires in half an hour; it changes nothing, so there is nothing to audit',
      'admin.customers.removeAccount': 'needs a customer with an account; it writes its audit entry (customer.account_removed, security), which test/accounts.int.test.js checks',
      'admin.returns.update': 'needs a delivered order with a request; every status change writes its audit entry, which test/returns.int.test.js checks',
      'admin.delivery.people.create': 'needs a confirmed order and a delivery person; every step writes its audit entry, which test/delivery.int.test.js checks',
      'admin.delivery.people.update': 'needs a confirmed order and a delivery person; every step writes its audit entry, which test/delivery.int.test.js checks',
      'admin.delivery.assign': 'needs a confirmed order and a delivery person; every step writes its audit entry, which test/delivery.int.test.js checks',
      'admin.delivery.runs.sendOut': 'needs a confirmed order and a delivery person; every step writes its audit entry, which test/delivery.int.test.js checks',
      'admin.delivery.runs.close': 'needs a confirmed order and a delivery person; every step writes its audit entry, which test/delivery.int.test.js checks',
      'admin.delivery.assignments.deliver': 'needs a confirmed order and a delivery person; every step writes its audit entry, which test/delivery.int.test.js checks',
      'admin.delivery.assignments.fail': 'needs a confirmed order and a delivery person; every step writes its audit entry, which test/delivery.int.test.js checks',
      'admin.delivery.assignments.return': 'needs a confirmed order and a delivery person; every step writes its audit entry, which test/delivery.int.test.js checks',
      'admin.delivery.assignments.remove': 'needs a confirmed order and a delivery person; every step writes its audit entry, which test/delivery.int.test.js checks',
      'admin.delivery.ledger.deposit': 'needs a confirmed order and a delivery person; every step writes its audit entry, which test/delivery.int.test.js checks',
      'admin.delivery.ledger.payFee': 'needs a confirmed order and a delivery person; every step writes its audit entry, which test/delivery.int.test.js checks',
      'admin.delivery.ledger.adjust': 'needs a confirmed order and a delivery person; every step writes its audit entry, which test/delivery.int.test.js checks',
      'admin.delivery.receipts.void': 'needs a confirmed order and a delivery person; every step writes its audit entry, which test/delivery.int.test.js checks',
      'admin.categories.bulkDelete': 'each item goes through the single delete, which writes its own audit entry (test/bulk-delete.int.test.js counts them)',
      'admin.attributes.bulkDelete': 'each item goes through the single delete, which writes its own audit entry (test/bulk-delete.int.test.js counts them)',
      'admin.sizeCharts.bulkDelete': 'each item goes through the single delete, which writes its own audit entry (test/bulk-delete.int.test.js counts them)',
      'admin.products.bulkDelete': 'each item goes through the single delete, which writes its own audit entry (test/bulk-delete.int.test.js counts them)',
      'admin.collections.bulkDelete': 'each item goes through the single delete, which writes its own audit entry (test/bulk-delete.int.test.js counts them)',
      'admin.promos.bulkDelete': 'each item goes through the single delete, which writes its own audit entry (test/bulk-delete.int.test.js counts them)',
      'admin.pages.bulkDelete': 'each item goes through the single delete, which writes its own audit entry (test/bulk-delete.int.test.js counts them)',
      'admin.auth.requestPasswordReset': 'changes nothing until an email provider exists (DOC-12); only counted by the rate limiter',
      'admin.me.confirmPassword': 'refreshes the 15-minute step-up window of the current session; no data changes',
      'admin.media.createUpload': 'only reserves an upload slot that nobody can see or use; unconfirmed slots are purged after a day',
      'admin.media.confirm': 'starts the check of the own upload of the sender; the outcome is visible as the media status, and a kept file is audited when it is changed or deleted',
      'admin.shipping.zoneImpact': 'a read-only preview of a zone change; nothing is stored',
      'admin.shipping.matchCities': 'a read-only lookup of pasted city names; nothing is stored',
      'admin.products.checks': 'runs the publish checks on a document that may not be saved; nothing is stored',
      'admin.products.previewLink': 'signs a link that expires in 15 minutes; it changes no data',
      'admin.pages.preview': 'only renders text with the store tokens filled in; nothing is stored',
      'admin.orders.previewEdit': 'a read-only calculation of what an edit would do; nothing is stored',
      'admin.orders.quote': 'prices the lines of a staff-typed order in a cart that is dropped at once; no order is made',
      'admin.promos.preview': 'a read-only calculation on a code that is not saved; nothing is stored',
      'admin.me.twoFactor.begin': 'stores a pending secret that does nothing until `enable`, which is audited',
    }

    const mutations = Object.entries(routes).filter(([key, r]) => key.startsWith('admin.') && r.method !== 'GET').map(([key]) => key)

    it.each(Object.keys(samples))('%s', async (key) => {
      const sample = /** @type {Sample} */ (samples[key])
      const ctx = await sample.prepare()
      const before = await count()
      const res = await sample.act(ctx)
      expect(res.status, `${key} should succeed ${JSON.stringify(/** @type {any} */ (res).body)}`).toBeLessThan(400)
      expect((await count()) - before, `${key} audit rows`).toBe(sample.rows ?? 1)
    }, 90_000)

    it('every non-GET admin route in the contract has a sample or a written reason to be exempt', () => {
      const covered = new Set([...Object.keys(samples), ...Object.keys(exempt)])
      expect(mutations.filter((k) => !covered.has(k))).toEqual([])
      expect([...covered].filter((k) => !mutations.includes(k))).toEqual([]) // no stale entries
      for (const reason of Object.values(exempt)) expect(reason.length).toBeGreaterThan(20)
    })

    it('records the actor, role and address of the person who acted', async () => {
      const { b, user } = await signedIn('owner')
      await t.migrate.db.delete(auditLog)
      await b.call('POST', '/admin/staff', { body: { name: 'Fresh', email: email(), role: 'viewer' } })
      const [row] = await t.db.select().from(auditLog)
      expect(row).toMatchObject({ actorType: 'staff', actorId: user.id, actorRole: 'owner', ip: '10.0.0.1', action: 'staff.invited' })
      expect(row?.requestId).toMatch(/^[0-9a-f-]{36}$/)
    }, 60_000)
  })
})

