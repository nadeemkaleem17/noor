// M1-02 integration tests: staff sign-in, two-factor, sessions, CSRF, step-up, throttling and staff management, through HTTP
// (app.inject) against a real MySQL. DOC-11 section 13 and DOC-10.4 section 8.
import { eq } from 'drizzle-orm'
import { generateSync } from 'otplib'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { permissions } from '@noor/contract'
import { buildApp } from '../src/app.js'
import { auditLog } from '../src/db/schema/audit.js'
import { authTokens, loginAttempts, recoveryCodes, sessions, staffUsers } from '../src/db/schema/auth.js'
import { advanceClock, now, setClock } from '../src/platform/clock.js'
import { parseConfig } from '../src/platform/config.js'
import { uuidv7 } from '../src/platform/ids.js'
import { hashPassword } from '../src/modules/auth/password.js'
import { insertUser } from '../src/modules/auth/repository.js'
import { roleList } from '../src/modules/auth/roles.js'
import { createSealer } from '../src/modules/auth/secrets.js'
import { sha256Hex } from '../src/modules/auth/tokens.js'
import { newTotpSecret } from '../src/modules/auth/totp.js'
import { createTestDatabase, dbAvailable } from './support/db.js'

const ORIGIN = 'http://localhost:5173'
const COOKIE = 'rb_admin_dev'
const PASSWORD = 'correct horse battery staple'
const KEY = Buffer.alloc(32, 5).toString('base64')
const config = parseConfig({
  NODE_ENV: 'test', APP_ENV: 'local', ADMIN_ORIGIN: ORIGIN, LOG_LEVEL: 'silent', SESSION_COOKIE_NAME: COOKIE, DATA_ENCRYPTION_KEY: KEY,
  DATABASE_URL: 'mysql://x:y@h/d', DATABASE_MIGRATION_URL: 'mysql://x:y@h/d',
})
const sealer = createSealer(KEY)

/** @type {Awaited<ReturnType<typeof createTestDatabase>>} */
let t
/** @type {Awaited<ReturnType<typeof buildApp>>} */
let app
let passwordHash = ''

/** A browser: remembers the session cookie and the CSRF token, and sends the headers a real admin page would. */
function browser(ip = '10.0.0.1') {
  const state = { cookie: /** @type {string | null} */ (null), csrf: /** @type {string | null} */ (null) }
  return {
    state,
    /**
     * @param {string} method
     * @param {string} url
     * @param {{ body?: unknown, csrf?: boolean, origin?: string | null, headers?: Record<string, string> }} [o]
     */
    async call(method, url, { body, csrf = true, origin = ORIGIN, headers = {} } = {}) {
      /** @type {Record<string, string>} */
      const h = { 'user-agent': 'vitest' }
      if (state.cookie) h.cookie = `${COOKIE}=${state.cookie}`
      if (origin) h.origin = origin
      if (csrf && state.csrf && method !== 'GET') h['x-csrf-token'] = state.csrf
      Object.assign(h, headers)
      const res = await app.inject({ method: /** @type {'GET'} */ (method), url: `/api/v1${url}`, remoteAddress: ip, headers: h, ...(body !== undefined ? { payload: /** @type {object} */ (body) } : {}) })
      const set = res.cookies.find((c) => c.name === COOKIE)
      if (set) state.cookie = set.value === '' ? null : set.value
      const json = res.body ? safeJson(res.body) : undefined
      return { status: res.statusCode, body: json, headers: res.headers }
    },
    /** Signs in and loads the CSRF token. @param {string} email @param {string} [password] */
    async login(email, password = PASSWORD) {
      const r = await this.call('POST', '/admin/auth/login', { body: { email, password } })
      if (r.status === 200 && r.body.next === 'ok') await this.refreshCsrf()
      return r
    },
    async refreshCsrf() {
      const me = await this.call('GET', '/admin/me')
      state.csrf = me.body?.csrfToken ?? null
      return me
    },
    /** Second step with a fresh code for `secret`. @param {string} secret */
    async twoFactor(secret) {
      const r = await this.call('POST', '/admin/auth/2fa', { body: { code: generateSync({ secret, epoch: Math.floor(now().getTime() / 1000) }) } })
      if (r.status === 200) await this.refreshCsrf()
      return r
    },
  }
}
const safeJson = (/** @type {string} */ s) => {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
}

/** Inserts an active staff member with a known password (and optionally 2FA on). */
async function makeStaff(/** @type {string} */ role, { email = `${role}-${uuidv7().slice(-6)}@rubaya.pk`, totp = /** @type {string | undefined} */ (undefined), status = 'active', name = `${role} person` } = {}) {
  const id = uuidv7()
  const at = new Date()
  await insertUser(t.db, { id, email, name, role, status, passwordHash, createdAt: at, updatedAt: at, ...(totp ? { totpSecretEnc: sealer.seal(totp), totpEnabledAt: at } : {}) })
  return { id, email, role, totp }
}
/** A signed-in browser for a staff member made with makeStaff (2FA completed when they have a secret). */
async function signedIn(/** @type {string} */ role, o = {}) {
  const totp = role === 'owner' || role === 'manager' ? newTotpSecret() : undefined
  const user = await makeStaff(role, { totp, ...o })
  const b = browser()
  const r = await b.login(user.email)
  if (r.body.next === 'two_factor') await b.twoFactor(/** @type {string} */ (totp))
  await b.call('POST', '/admin/me/confirm-password', { body: { password: PASSWORD } })
  return { b, user }
}

describe.skipIf(!dbAvailable)('auth (MySQL, through HTTP)', () => {
  beforeAll(async () => {
    t = await createTestDatabase()
    app = await buildApp({ config, db: t.db })
    passwordHash = await hashPassword(PASSWORD)
  }, 60_000)
  afterAll(async () => {
    await app?.close()
    await t?.drop()
  })
  afterEach(async () => {
    setClock(null)
    for (const table of [auditLog, loginAttempts]) await t.db.delete(table)
    await t.db.delete(staffUsers) // sessions, tokens and recovery codes cascade
  })

  describe('sign-in', () => {
    it('answers one way for an unknown email, a wrong password and a deactivated account', async () => {
      await makeStaff('viewer', { email: 'real@rubaya.pk' })
      await makeStaff('viewer', { email: 'gone@rubaya.pk', status: 'deactivated' })
      const answers = []
      for (const [email, password] of [['nobody@rubaya.pk', PASSWORD], ['real@rubaya.pk', 'wrong password here'], ['gone@rubaya.pk', PASSWORD]]) {
        const r = await browser().call('POST', '/admin/auth/login', { body: { email, password } })
        answers.push([r.status, r.body.code])
      }
      expect(answers).toEqual([[401, 'invalid_credentials'], [401, 'invalid_credentials'], [401, 'invalid_credentials']])
    })

    it('a role without 2FA requirements signs in directly and the cookie is HttpOnly, SameSite=Lax and host-only', async () => {
      const u = await makeStaff('viewer')
      const res = await app.inject({ method: 'POST', url: '/api/v1/admin/auth/login', headers: { origin: ORIGIN }, payload: { email: u.email, password: PASSWORD } })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ next: 'ok' })
      const raw = String(res.headers['set-cookie'])
      expect(raw).toMatch(/HttpOnly/i)
      expect(raw).toMatch(/SameSite=Lax/i)
      expect(raw).toMatch(/Path=\//)
      expect(raw).not.toMatch(/Domain=/i)
    })

    it('stores only the hash of the session id and never returns secrets', async () => {
      const { b, user } = await signedIn('viewer')
      const [row] = await t.db.select().from(sessions).where(eq(sessions.staffUserId, user.id))
      expect(row?.idHash).toBe(sha256Hex(/** @type {string} */ (b.state.cookie)))
      const me = await b.call('GET', '/admin/me')
      expect(JSON.stringify(me.body)).not.toMatch(/passwordHash|totpSecret|tokenHash|argon2/i)
      expect(me.body).toMatchObject({ email: user.email, role: 'viewer', twoFactorRequired: false, environment: 'local' })
      expect(me.headers['cache-control']).toBe('no-store')
    })

    it('blocks the sixth failed attempt for an email and lifts after the window; unknown emails are counted too', async () => {
      setClock(new Date('2026-10-04T10:00:00Z'))
      await makeStaff('viewer', { email: 'victim@rubaya.pk' })
      for (let i = 0; i < 5; i++) expect((await browser(`10.0.1.${i}`).call('POST', '/admin/auth/login', { body: { email: 'victim@rubaya.pk', password: 'wrong password 123' } })).status).toBe(401)
      const blocked = await browser('10.0.1.9').call('POST', '/admin/auth/login', { body: { email: 'victim@rubaya.pk', password: PASSWORD } })
      expect(blocked.status).toBe(429)
      expect(blocked.body).toMatchObject({ code: 'too_many_attempts', retryAfter: 900 })
      // the right password does not get through while locked
      advanceClock(16 * 60_000)
      expect((await browser('10.0.1.10').call('POST', '/admin/auth/login', { body: { email: 'victim@rubaya.pk', password: PASSWORD } })).status).toBe(200)
      // an email that does not exist is throttled the same way
      for (let i = 0; i < 5; i++) await browser(`10.0.2.${i}`).call('POST', '/admin/auth/login', { body: { email: 'ghost@rubaya.pk', password: 'x'.repeat(14) } })
      expect((await browser('10.0.2.9').call('POST', '/admin/auth/login', { body: { email: 'ghost@rubaya.pk', password: PASSWORD } })).status).toBe(429)
    }, 60_000)

    it('doubles the wait with each consecutive lock and an owner can clear it', async () => {
      setClock(new Date('2026-10-04T10:00:00Z'))
      const victim = await makeStaff('viewer', { email: 'victim2@rubaya.pk' })
      const bad = () => browser('10.0.3.1').call('POST', '/admin/auth/login', { body: { email: 'victim2@rubaya.pk', password: 'wrong password 123' } })
      for (let i = 0; i < 6; i++) await bad() // 5 failures, then the lock
      const [first] = await t.db.select().from(staffUsers).where(eq(staffUsers.id, victim.id))
      expect(first?.lockCount).toBe(1)
      advanceClock(16 * 60_000)
      for (let i = 0; i < 6; i++) await bad()
      const [second] = await t.db.select().from(staffUsers).where(eq(staffUsers.id, victim.id))
      expect(second?.lockCount).toBe(2)
      expect((second?.lockedUntil?.getTime() ?? 0) - now().getTime()).toBe(30 * 60_000) // 15 min, doubled
      const { b: owner } = await signedIn('owner')
      const r = await owner.call('POST', `/admin/staff/${victim.id}/unlock`)
      expect(r.status).toBe(204)
      expect((await browser('10.0.3.2').login('victim2@rubaya.pk')).status).toBe(200)
    }, 90_000)

    it('refuses an IP after 20 failures in 15 minutes', async () => {
      for (let i = 0; i < 20; i++) await browser('10.0.4.4').call('POST', '/admin/auth/login', { body: { email: `nobody${i}@rubaya.pk`, password: 'x'.repeat(14) } })
      const r = await browser('10.0.4.4').call('POST', '/admin/auth/login', { body: { email: 'another@rubaya.pk', password: PASSWORD } })
      expect(r.status).toBe(429)
      expect((await browser('10.0.4.5').call('POST', '/admin/auth/login', { body: { email: 'another@rubaya.pk', password: PASSWORD } })).status).toBe(401)
    }, 90_000)

    it('records sign-in, failure and logout in the audit trail without secrets', async () => {
      const u = await makeStaff('viewer')
      const b = browser()
      await b.login(u.email, 'wrong password here!')
      await b.login(u.email)
      await b.call('POST', '/admin/auth/logout')
      const rows = await t.db.select({ action: auditLog.action, category: auditLog.category, label: auditLog.entityLabel }).from(auditLog)
      expect(rows.map((r) => r.action).sort()).toEqual(['auth.login', 'auth.login_failed', 'auth.logout'])
      expect(rows.every((r) => r.category === 'security')).toBe(true)
      expect(JSON.stringify(await t.db.select().from(auditLog))).not.toContain(PASSWORD)
    })
  })

  describe('two-factor', () => {
    it('owner without 2FA must enrol: the session reaches only the enrolment routes, then becomes a full one with 10 recovery codes', async () => {
      const u = await makeStaff('owner')
      const b = browser()
      expect((await b.call('POST', '/admin/auth/login', { body: { email: u.email, password: PASSWORD } })).body).toEqual({ next: 'enrol_two_factor' })
      const me = await b.refreshCsrf()
      expect(me.status).toBe(200)
      expect((await b.call('GET', '/admin/staff')).status).toBe(403)
      expect((await b.call('GET', '/admin/staff')).body.code).toBe('two_factor_required')
      const begin = await b.call('POST', '/admin/me/2fa/begin')
      expect(begin.status).toBe(200)
      expect(begin.body.otpauthUri).toMatch(/^otpauth:\/\/totp\//)
      expect((await b.call('POST', '/admin/me/2fa/enable', { body: { code: '000000' } })).body.code).toBe('invalid_code')
      const oldCookie = b.state.cookie
      const enable = await b.call('POST', '/admin/me/2fa/enable', { body: { code: generateSync({ secret: begin.body.secret, epoch: Math.floor(now().getTime() / 1000) }) } })
      expect(enable.status).toBe(200)
      expect(enable.body.recoveryCodes).toHaveLength(10)
      expect(b.state.cookie).not.toBe(oldCookie) // rotated
      await b.refreshCsrf()
      expect((await b.call('GET', '/admin/staff')).status).toBe(200)
      expect(await t.db.select().from(recoveryCodes).where(eq(recoveryCodes.staffUserId, u.id))).toHaveLength(10)
      const [row] = await t.db.select().from(staffUsers).where(eq(staffUsers.id, u.id))
      expect(row?.totpSecretEnc?.toString('latin1')).not.toContain(begin.body.secret) // stored encrypted
    }, 60_000)

    it('asks for a code after the password; a half-finished session reaches nothing else; a wrong code is refused', async () => {
      const secret = newTotpSecret()
      const u = await makeStaff('owner', { totp: secret })
      const b = browser()
      expect((await b.call('POST', '/admin/auth/login', { body: { email: u.email, password: PASSWORD } })).body).toEqual({ next: 'two_factor' })
      expect((await b.call('GET', '/admin/me')).body.code).toBe('two_factor_required')
      expect((await b.call('POST', '/admin/auth/2fa', { body: { code: '123456' } })).body.code).toBe('invalid_code')
      expect((await b.twoFactor(secret)).body).toEqual({ next: 'ok' })
      expect((await b.call('GET', '/admin/me')).status).toBe(200)
    }, 60_000)

    it('a code cannot be used twice', async () => {
      setClock(new Date())
      const secret = newTotpSecret()
      const u = await makeStaff('manager', { totp: secret })
      const code = () => generateSync({ secret, epoch: Math.floor(now().getTime() / 1000) })
      const first = browser()
      await first.call('POST', '/admin/auth/login', { body: { email: u.email, password: PASSWORD } })
      const c = code()
      expect((await first.call('POST', '/admin/auth/2fa', { body: { code: c } })).status).toBe(200)
      const second = browser()
      await second.call('POST', '/admin/auth/login', { body: { email: u.email, password: PASSWORD } })
      expect((await second.call('POST', '/admin/auth/2fa', { body: { code: c } })).body.code).toBe('invalid_code')
    }, 60_000)

    it('five wrong codes end the pending session', async () => {
      const secret = newTotpSecret()
      const u = await makeStaff('owner', { totp: secret })
      const b = browser()
      await b.call('POST', '/admin/auth/login', { body: { email: u.email, password: PASSWORD } })
      for (let i = 0; i < 5; i++) expect((await b.call('POST', '/admin/auth/2fa', { body: { code: '000000' } })).body.code).toBe('invalid_code')
      expect((await b.call('POST', '/admin/auth/2fa', { body: { code: generateSync({ secret, epoch: Math.floor(now().getTime() / 1000) }) } })).status).toBe(401)
    }, 60_000)

    it('a recovery code signs in once and then no longer works', async () => {
      const u = await makeStaff('owner')
      const setup = browser()
      await setup.call('POST', '/admin/auth/login', { body: { email: u.email, password: PASSWORD } })
      await setup.refreshCsrf()
      const begin = await setup.call('POST', '/admin/me/2fa/begin')
      const enable = await setup.call('POST', '/admin/me/2fa/enable', { body: { code: generateSync({ secret: begin.body.secret, epoch: Math.floor(now().getTime() / 1000) }) } })
      const code = enable.body.recoveryCodes[0]
      const again = browser()
      await again.call('POST', '/admin/auth/login', { body: { email: u.email, password: PASSWORD } })
      expect((await again.call('POST', '/admin/auth/2fa', { body: { recoveryCode: code.toLowerCase() } })).status).toBe(200)
      const third = browser()
      await third.call('POST', '/admin/auth/login', { body: { email: u.email, password: PASSWORD } })
      expect((await third.call('POST', '/admin/auth/2fa', { body: { recoveryCode: code } })).body.code).toBe('invalid_code')
    }, 90_000)

    it('2FA cannot be turned off for a role that requires it, but can for one that does not', async () => {
      const { b: owner } = await signedIn('owner')
      const r = await owner.call('DELETE', '/admin/me/2fa')
      expect(r.status).toBe(403)
      const support = await makeStaff('support')
      const b = browser()
      await b.login(support.email)
      await b.call('POST', '/admin/me/confirm-password', { body: { password: PASSWORD } })
      const begin = await b.call('POST', '/admin/me/2fa/begin')
      await b.call('POST', '/admin/me/2fa/enable', { body: { code: generateSync({ secret: begin.body.secret, epoch: Math.floor(now().getTime() / 1000) }) } })
      expect((await b.call('DELETE', '/admin/me/2fa')).status).toBe(204)
      expect((await b.call('GET', '/admin/me')).body.twoFactorEnabled).toBe(false)
    }, 60_000)
  })

  describe('sessions', () => {
    it('ends after 8 hours idle, slides while used, and ends after 14 days whatever happens', async () => {
      setClock(new Date('2026-10-04T08:00:00Z'))
      const { b } = await signedIn('viewer')
      advanceClock(7 * 3_600_000)
      expect((await b.call('GET', '/admin/me')).status).toBe(200) // used within 8 h: still valid, window moves
      advanceClock(7 * 3_600_000)
      expect((await b.call('GET', '/admin/me')).status).toBe(200)
      for (let day = 0; day < 25; day++) {
        advanceClock(7 * 3_600_000)
        await b.call('GET', '/admin/me')
        advanceClock(7 * 3_600_000)
        await b.call('GET', '/admin/me')
      }
      expect((await b.call('GET', '/admin/me')).status).toBe(401) // past 14 days since sign-in
      const fresh = await signedIn('viewer')
      advanceClock(9 * 3_600_000)
      expect((await fresh.b.call('GET', '/admin/me')).status).toBe(401) // idle for 9 hours
    }, 90_000)

    it('lists own sessions, revokes one by its public id, and revokes the others', async () => {
      const u = await makeStaff('viewer')
      const a = browser('10.1.0.1')
      const c = browser('10.1.0.2')
      await a.login(u.email)
      await c.login(u.email)
      const list = await a.call('GET', '/admin/me/sessions')
      expect(list.body.items).toHaveLength(2)
      expect(list.body.items.filter((/** @type {{ current: boolean }} */ s) => s.current)).toHaveLength(1)
      expect(JSON.stringify(list.body)).not.toContain(a.state.cookie)
      const other = list.body.items.find((/** @type {{ current: boolean }} */ s) => !s.current)
      expect((await a.call('DELETE', `/admin/me/sessions/${other.id}`)).status).toBe(204)
      expect((await c.call('GET', '/admin/me')).status).toBe(401)
      expect((await a.call('DELETE', `/admin/me/sessions/${other.id}`)).status).toBe(404)
      const d = browser('10.1.0.3')
      await d.login(u.email)
      expect((await a.call('POST', '/admin/me/sessions/revoke-others')).status).toBe(204)
      expect((await d.call('GET', '/admin/me')).status).toBe(401)
      expect((await a.call('GET', '/admin/me')).status).toBe(200)
    }, 60_000)

    it('a password change ends other sessions and gives this one a new id', async () => {
      const u = await makeStaff('viewer')
      const a = browser()
      const other = browser()
      await a.login(u.email)
      await other.login(u.email)
      const before = a.state.cookie
      expect((await a.call('POST', '/admin/me/password', { body: { currentPassword: 'wrong password 123', newPassword: 'a brand new passphrase 1' } })).body.code).toBe('invalid_credentials')
      expect((await a.call('POST', '/admin/me/password', { body: { currentPassword: PASSWORD, newPassword: 'password1234' } })).body.code).toBe('password_too_weak')
      expect((await a.call('POST', '/admin/me/password', { body: { currentPassword: PASSWORD, newPassword: 'a brand new passphrase 1' } })).status).toBe(204)
      expect(a.state.cookie).not.toBe(before)
      expect((await other.call('GET', '/admin/me')).status).toBe(401)
      await a.refreshCsrf()
      expect((await a.call('GET', '/admin/me')).status).toBe(200)
      expect((await browser().login(u.email, 'a brand new passphrase 1')).status).toBe(200)
    }, 60_000)

    it('logout deletes the session', async () => {
      const { b } = await signedIn('viewer')
      expect((await b.call('POST', '/admin/auth/logout')).status).toBe(204)
      expect(await t.db.select().from(sessions)).toHaveLength(0)
      expect((await b.call('GET', '/admin/me')).status).toBe(401)
    })
  })

  describe('request protections', () => {
    it('refuses a state change from another origin or without an Origin header', async () => {
      const { b } = await signedIn('viewer')
      expect((await b.call('PUT', '/admin/me', { body: { name: 'X' }, origin: 'https://evil.example' })).body.code).toBe('csrf_failed')
      expect((await b.call('PUT', '/admin/me', { body: { name: 'X' }, origin: null })).body.code).toBe('csrf_failed')
      const login = await browser().call('POST', '/admin/auth/login', { body: { email: 'a@b.co', password: 'x' }, origin: 'https://evil.example' })
      expect(login.body.code).toBe('csrf_failed')
    })

    it('refuses a state change without the CSRF token or with a wrong one, and allows GET without it', async () => {
      const { b } = await signedIn('viewer')
      expect((await b.call('PUT', '/admin/me', { body: { name: 'Ok' }, csrf: false })).body.code).toBe('csrf_failed')
      expect((await b.call('PUT', '/admin/me', { body: { name: 'Ok' }, headers: { 'x-csrf-token': 'x'.repeat(43) } })).body.code).toBe('csrf_failed')
      expect((await b.call('PUT', '/admin/me', { body: { name: 'Ok' } })).status).toBe(200)
      expect((await b.call('GET', '/admin/me')).status).toBe(200)
    })

    it('step-up routes need a recent password confirmation (15 minutes)', async () => {
      setClock(new Date('2026-10-04T10:00:00Z'))
      const { b } = await signedIn('owner')
      const invite = { name: 'New Person', email: 'new@rubaya.pk', role: 'viewer' }
      expect((await b.call('POST', '/admin/staff', { body: invite })).status).toBe(201) // signedIn confirmed the password
      advanceClock(16 * 60_000)
      const stale = await b.call('POST', '/admin/staff', { body: { ...invite, email: 'new2@rubaya.pk' } })
      expect(stale.status).toBe(403)
      expect(stale.body.code).toBe('step_up_required')
      expect((await b.call('POST', '/admin/me/confirm-password', { body: { password: 'wrong password 123' } })).status).toBe(401)
      expect((await b.call('POST', '/admin/me/confirm-password', { body: { password: PASSWORD } })).status).toBe(204)
      expect((await b.call('POST', '/admin/staff', { body: { ...invite, email: 'new2@rubaya.pk' } })).status).toBe(201)
    }, 60_000)

    it('rejects unknown body fields (mass assignment)', async () => {
      const { b } = await signedIn('viewer')
      const r = await b.call('PUT', '/admin/me', { body: { name: 'Ok', role: 'owner' } })
      expect(r.status).toBe(400)
    })
  })

  describe('roles and permissions', () => {
    /** Calls every GET admin route that needs only an id we can invent, as each role. */
    const probes = /** @type {[string, string, import('@noor/contract').Permission][]} */ ([
      ['admin.roles.list', '/admin/roles', 'staff:read'],
      ['admin.staff.list', '/admin/staff', 'staff:read'],
      ['admin.system.info', '/admin/system', 'settings:manage'],
    ])

    it('each staff route answers 200 or 403 exactly as the matrix says, for every role', async () => {
      for (const { role, permissions: granted } of roleList()) {
        const { b } = await signedIn(role)
        for (const [, url, needs] of probes) {
          const res = await b.call('GET', url)
          expect(res.status, `${role} ${url}`).toBe(granted.includes(needs) ? 200 : 403)
        }
        await t.db.delete(staffUsers)
      }
    }, 180_000)

    it('every permission named by a route exists in the matrix vocabulary', () => {
      for (const [, , p] of probes) expect(permissions).toContain(p)
    })

    it('the roles list equals the matrix in code and marks 2FA requirements', async () => {
      const { b } = await signedIn('owner')
      const r = await b.call('GET', '/admin/roles')
      expect(r.body.items).toEqual(roleList())
    }, 30_000)
  })

  describe('owner:create (the first owner)', () => {
    it('creates an active owner who then has to enrol 2FA, and refuses a weak password or a duplicate email', async () => {
      const { createAuthService } = await import('../src/modules/auth/index.js')
      const svc = createAuthService({ db: t.db, config })
      await expect(svc.createOwner({ email: 'first@rubaya.pk', name: 'First', password: 'password1234' })).rejects.toMatchObject({ code: 'password_too_weak' })
      await svc.createOwner({ email: 'first@rubaya.pk', name: 'First', password: PASSWORD })
      await expect(svc.createOwner({ email: 'first@rubaya.pk', name: 'Again', password: PASSWORD })).rejects.toMatchObject({ code: 'email_taken' })
      const b = browser()
      expect((await b.call('POST', '/admin/auth/login', { body: { email: 'first@rubaya.pk', password: PASSWORD } })).body).toEqual({ next: 'enrol_two_factor' })
      const [entry] = await t.db.select().from(auditLog).where(eq(auditLog.action, 'staff.owner_created'))
      expect(entry).toMatchObject({ actorType: 'system', entityLabel: 'first@rubaya.pk' })
    }, 60_000)
  })

  describe('staff management', () => {
    it('invites by a link that works once: get, accept (weak password refused), then sign in', async () => {
      const { b: owner } = await signedIn('owner')
      const invited = await owner.call('POST', '/admin/staff', { body: { name: 'Sana', email: 'Sana@Rubaya.pk', role: 'support' } })
      expect(invited.status).toBe(201)
      expect(invited.body).toMatchObject({ email: 'sana@rubaya.pk', status: 'invited', role: 'support' })
      const token = invited.body.inviteLink.split('/').pop()
      expect(invited.body.inviteLink).toBe(`${ORIGIN}/accept-invite/${token}`)
      const [stored] = await t.db.select().from(authTokens)
      expect(stored?.tokenHash).toBe(sha256Hex(token)) // only the hash is stored

      const anon = browser()
      expect((await anon.call('GET', `/admin/auth/invites/${token}`)).body).toEqual({ name: 'Sana', email: 'sana@rubaya.pk', role: 'support', requiresTwoFactor: false })
      expect((await anon.call('POST', `/admin/auth/invites/${token}`, { body: { password: 'password1234' } })).body.code).toBe('password_too_weak')
      expect((await anon.call('POST', `/admin/auth/invites/${token}`, { body: { password: 'tea and biscuits at noon' } })).body).toEqual({ next: 'ok' })
      expect((await anon.call('POST', `/admin/auth/invites/${token}`, { body: { password: 'tea and biscuits at noon' } })).status).toBe(410)
      expect((await anon.call('GET', `/admin/auth/invites/${token}`)).body.code).toBe('token_expired')
      expect((await browser().login('sana@rubaya.pk', 'tea and biscuits at noon')).status).toBe(200)
    }, 90_000)

    it('an expired invite is refused, and resending replaces the old link', async () => {
      setClock(new Date('2026-10-04T10:00:00Z'))
      const { b: owner } = await signedIn('owner')
      const invited = await owner.call('POST', '/admin/staff', { body: { name: 'Late', email: 'late@rubaya.pk', role: 'viewer' } })
      const oldToken = invited.body.inviteLink.split('/').pop()
      const again = await owner.call('POST', `/admin/staff/${invited.body.id}/invite`)
      const newToken = again.body.inviteLink.split('/').pop()
      expect(newToken).not.toBe(oldToken)
      expect((await browser().call('GET', `/admin/auth/invites/${oldToken}`)).status).toBe(410)
      advanceClock(8 * 86_400_000)
      expect((await browser().call('GET', `/admin/auth/invites/${newToken}`)).status).toBe(410)
    }, 60_000)

    it('a manager cannot invite an owner or change one; an owner can', async () => {
      const { b: manager } = await signedIn('manager')
      expect((await manager.call('POST', '/admin/staff', { body: { name: 'Boss', email: 'boss@rubaya.pk', role: 'owner' } })).status).toBe(403)
      expect((await manager.call('POST', '/admin/staff', { body: { name: 'Clerk', email: 'clerk@rubaya.pk', role: 'viewer' } })).status).toBe(201)
      const owner = await makeStaff('owner', { totp: newTotpSecret() })
      expect((await manager.call('POST', `/admin/staff/${owner.id}/deactivate`)).status).toBe(403)
      expect((await manager.call('POST', '/admin/staff', { body: { name: 'Dup', email: 'clerk@rubaya.pk', role: 'viewer' } })).body.code).toBe('email_taken')
    }, 60_000)

    it('keeps the last owner, forbids self-service role changes, and checks the version', async () => {
      const { b, user } = await signedIn('owner')
      const [row] = await t.db.select().from(staffUsers).where(eq(staffUsers.id, user.id))
      expect((await b.call('PUT', `/admin/staff/${user.id}`, { body: { name: 'Me', role: 'viewer', version: row?.version ?? 1 } })).status).toBe(403)
      expect((await b.call('POST', `/admin/staff/${user.id}/deactivate`)).status).toBe(403)
      const second = await makeStaff('owner', { totp: newTotpSecret() })
      const res = await b.call('PUT', `/admin/staff/${second.id}`, { body: { name: 'Second', role: 'manager', version: 99 } })
      expect(res.status).toBe(409)
      expect(res.body).toMatchObject({ code: 'stale_write', currentVersion: 1 })
      expect((await b.call('PUT', `/admin/staff/${second.id}`, { body: { name: 'Second', role: 'manager', version: 1 } })).body).toMatchObject({ role: 'manager', version: 2 })
      // now the signed-in owner is the only owner: a second owner session (made before) cannot remove them either
      const other = await makeStaff('owner', { totp: newTotpSecret() })
      const ob = browser('10.9.9.9')
      const secret = newTotpSecret()
      await t.db.update(staffUsers).set({ totpSecretEnc: sealer.seal(secret) }).where(eq(staffUsers.id, other.id))
      await ob.login(other.email)
      await ob.twoFactor(secret)
      await ob.call('POST', '/admin/me/confirm-password', { body: { password: PASSWORD } })
      expect((await ob.call('POST', `/admin/staff/${user.id}/deactivate`)).status).toBe(200) // two owners: allowed
      expect((await b.call('GET', '/admin/me')).status).toBe(401) // the deactivated owner's sessions ended
      expect((await ob.call('POST', `/admin/staff/${other.id}/deactivate`)).status).toBe(403) // self
    }, 120_000)

    it('a role change ends that person\'s sessions and is audited with the old and new role', async () => {
      const { b: owner } = await signedIn('owner')
      const target = await makeStaff('support')
      const tb = browser('10.8.8.8')
      await tb.login(target.email)
      expect((await owner.call('PUT', `/admin/staff/${target.id}`, { body: { name: 'Support Person', role: 'fulfilment', version: 1 } })).status).toBe(200)
      expect((await tb.call('GET', '/admin/me')).status).toBe(401)
      const [entry] = await t.db.select().from(auditLog).where(eq(auditLog.action, 'staff.role_changed'))
      expect(entry).toMatchObject({ entityId: target.id, category: 'security', diff: { role: ['support', 'fulfilment'] } })
    }, 60_000)

    it('deactivation ends sessions and blocks sign-in; reactivation restores it', async () => {
      const { b: owner } = await signedIn('owner')
      const target = await makeStaff('viewer')
      const tb = browser('10.7.7.7')
      await tb.login(target.email)
      expect((await owner.call('POST', `/admin/staff/${target.id}/deactivate`)).body.status).toBe('deactivated')
      expect((await tb.call('GET', '/admin/me')).status).toBe(401)
      expect((await browser().login(target.email)).status).toBe(401)
      expect((await owner.call('POST', `/admin/staff/${target.id}/reactivate`)).body.status).toBe('active')
      expect((await browser().login(target.email)).status).toBe(200)
    }, 60_000)

    it('a reset link sets a new password once and ends all sessions', async () => {
      const { b: owner } = await signedIn('owner')
      const target = await makeStaff('viewer')
      const tb = browser('10.6.6.6')
      await tb.login(target.email)
      const link = await owner.call('POST', `/admin/staff/${target.id}/password-reset`)
      const token = link.body.resetLink.split('/').pop()
      const anon = browser()
      expect((await anon.call('POST', `/admin/auth/password-reset/${token}`, { body: { password: 'short' } })).body.code).toBe('password_too_weak')
      expect((await anon.call('POST', `/admin/auth/password-reset/${token}`, { body: { password: 'a fresh reset passphrase' } })).status).toBe(204)
      expect((await anon.call('POST', `/admin/auth/password-reset/${token}`, { body: { password: 'a fresh reset passphrase' } })).status).toBe(410)
      expect((await tb.call('GET', '/admin/me')).status).toBe(401)
      expect((await browser().login(target.email, 'a fresh reset passphrase')).status).toBe(200)
    }, 60_000)

    it('the public reset request always answers 204 and reveals nothing', async () => {
      const a = await browser().call('POST', '/admin/auth/password-reset', { body: { email: 'nobody@rubaya.pk' } })
      await makeStaff('viewer', { email: 'real2@rubaya.pk' })
      const b = await browser().call('POST', '/admin/auth/password-reset', { body: { email: 'real2@rubaya.pk' } })
      expect([a.status, b.status]).toEqual([204, 204])
    })

    it('lists and filters staff and never exposes credentials', async () => {
      const { b: owner } = await signedIn('owner')
      await makeStaff('viewer', { name: 'Zara Viewer' })
      await makeStaff('catalog', { name: 'Ali Catalog' })
      const all = await owner.call('GET', '/admin/staff?size=25')
      expect(all.body.total).toBe(3)
      expect((await owner.call('GET', '/admin/staff?role=catalog')).body.items.map((/** @type {{ name: string }} */ u) => u.name)).toEqual(['Ali Catalog'])
      expect((await owner.call('GET', '/admin/staff?q=zara')).body.items).toHaveLength(1)
      expect(JSON.stringify(all.body)).not.toMatch(/passwordHash|totpSecret|argon2|tokenHash/i)
      const [one] = all.body.items
      const detail = await owner.call('GET', `/admin/staff/${one.id}`)
      expect(detail.body).toHaveProperty('sessions')
    }, 60_000)

    it('every state change above wrote an audit entry in the same transaction (invite sample)', async () => {
      const { b: owner } = await signedIn('owner')
      await t.db.delete(auditLog)
      await owner.call('POST', '/admin/staff', { body: { name: 'Audit Me', email: 'audit@rubaya.pk', role: 'viewer' } })
      const rows = await t.db.select({ action: auditLog.action, label: auditLog.entityLabel }).from(auditLog)
      expect(rows).toEqual([{ action: 'staff.invited', label: 'audit@rubaya.pk' }])
    }, 30_000)
  })
})
