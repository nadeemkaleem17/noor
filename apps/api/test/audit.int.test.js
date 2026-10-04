// M1-03: the audit trail is append-only at the database, readable through the API with masking, and every admin mutation writes to it.
import { eq } from 'drizzle-orm'
import { generateSync } from 'otplib'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { routes } from '@noor/contract'
import { auditLog } from '../src/db/schema/audit.js'
import { loginAttempts, staffUsers } from '../src/db/schema/auth.js'
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
    samples['admin.media.delete'] = { prepare: slot, act: ({ b, id }) => b.call('DELETE', `/admin/media/${id}`) }

    /** Mutating routes that deliberately write no entry, each with the reason. */
    const exempt = {
      'admin.auth.requestPasswordReset': 'changes nothing until an email provider exists (DOC-12); only counted by the rate limiter',
      'admin.me.confirmPassword': 'refreshes the 15-minute step-up window of the current session; no data changes',
      'admin.media.createUpload': 'only reserves an upload slot that nobody can see or use; unconfirmed slots are purged after a day',
      'admin.media.confirm': 'starts the check of the own upload of the sender; the outcome is visible as the media status, and a kept file is audited when it is changed or deleted',
      'admin.me.twoFactor.begin': 'stores a pending secret that does nothing until `enable`, which is audited',
    }

    const mutations = Object.entries(routes).filter(([key, r]) => key.startsWith('admin.') && r.method !== 'GET').map(([key]) => key)

    it.each(Object.keys(samples))('%s', async (key) => {
      const sample = /** @type {Sample} */ (samples[key])
      const ctx = await sample.prepare()
      const before = await count()
      const res = await sample.act(ctx)
      expect(res.status, `${key} should succeed`).toBeLessThan(400)
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

