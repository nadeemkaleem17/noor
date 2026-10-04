// Shared by the HTTP-level integration tests: an app on a scratch database, a browser that keeps the session cookie and CSRF token,
// and helpers that create and sign in staff. Used by auth.int.test.js and audit.int.test.js.
import { generateSync } from 'otplib'
import { buildApp } from '../../src/app.js'
import { now } from '../../src/platform/clock.js'
import { parseConfig } from '../../src/platform/config.js'
import { uuidv7 } from '../../src/platform/ids.js'
import { hashPassword } from '../../src/modules/auth/password.js'
import { insertUser } from '../../src/modules/auth/repository.js'
import { createSealer } from '../../src/modules/auth/secrets.js'
import { newTotpSecret } from '../../src/modules/auth/totp.js'
import { createTestDatabase } from './db.js'

/** @type {Awaited<ReturnType<typeof createTestDatabase>>} */
export let t
/** @type {Awaited<ReturnType<typeof buildApp>>} */
export let app
let passwordHash = ''

export const ORIGIN = 'http://localhost:5173'
export const COOKIE = 'rb_admin_dev'
export const PASSWORD = 'correct horse battery staple'
const KEY = Buffer.alloc(32, 5).toString('base64')
export const config = parseConfig({
  NODE_ENV: 'test', APP_ENV: 'local', ADMIN_ORIGIN: ORIGIN, LOG_LEVEL: 'silent', SESSION_COOKIE_NAME: COOKIE, DATA_ENCRYPTION_KEY: KEY,
  DATABASE_URL: 'mysql://x:y@h/d', DATABASE_MIGRATION_URL: 'mysql://x:y@h/d',
})
export const sealer = createSealer(KEY)


/** A browser: remembers the session cookie and the CSRF token, and sends the headers a real admin page would. */
export function browser(ip = '10.0.0.1') {
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
export async function makeStaff(/** @type {string} */ role, { email = `${role}-${uuidv7().slice(-6)}@rubaya.pk`, totp = /** @type {string | undefined} */ (undefined), status = 'active', name = `${role} person` } = {}) {
  const id = uuidv7()
  const at = new Date()
  await insertUser(t.db, { id, email, name, role, status, passwordHash, createdAt: at, updatedAt: at, ...(totp ? { totpSecretEnc: sealer.seal(totp), totpEnabledAt: at } : {}) })
  return { id, email, role, totp }
}
/** A signed-in browser for a staff member made with makeStaff (2FA completed when they have a secret). */
export async function signedIn(/** @type {string} */ role, o = {}) {
  const totp = role === 'owner' || role === 'manager' ? newTotpSecret() : undefined
  const user = await makeStaff(role, { totp, ...o })
  const b = browser()
  const r = await b.login(user.email)
  if (r.body.next === 'two_factor') await b.twoFactor(/** @type {string} */ (totp))
  await b.call('POST', '/admin/me/confirm-password', { body: { password: PASSWORD } })
  return { b, user }
}


/** Creates the scratch database and the app on it. Call `closeHarness()` when done. */
export async function createHarness() {
  t = await createTestDatabase()
  app = await buildApp({ config, db: t.db })
  passwordHash = await hashPassword(PASSWORD)
}
export async function closeHarness() {
  await app?.close()
  await t?.drop()
}
