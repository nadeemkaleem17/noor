// Staff sign-in, two-factor, passwords, sessions and staff management (plan/11-security-auth.md sections 3-4, plan/10-api/04).
// Every state change and its audit entry happen in one transaction.
import { and, count, eq } from 'drizzle-orm'
import { accessProfiles, staffUsers } from '../../db/schema/auth.js'
import { now } from '../../platform/clock.js'
import { transaction } from '../../platform/db.js'
import { DomainError } from '../../platform/errors.js'
import { uuidv7 } from '../../platform/ids.js'
import { hit } from '../../platform/rate-limit.js'
import { record } from '../audit/index.js'
import { dummyHash, hashPassword, needsRehash, passwordProblem, verifyPassword } from './password.js'
import { createRecoveryCodes, matchRecoveryCode } from './recovery.js'
import * as repo from './repository.js'
import { effectivePermissions, mayManage, permissionsOf, requiresTwoFactor, roleList } from './roles.js'
import { createSealer } from './secrets.js'
import { createSession, publicSessionId, STEP_UP_MS } from './sessions.js'
import { randomToken, sha256Hex } from './tokens.js'
import { newTotpSecret, totpUri, verifyTotp } from './totp.js'

const WINDOW_MS = 15 * 60_000
const EMAIL_LIMIT = 5
const IP_LIMIT = 20
const LOCK_CAP_MS = 24 * 3_600_000
const INVITE_TTL_MS = 7 * 86_400_000
const RESET_TTL_MS = 60 * 60_000
const PENDING_CODE_ATTEMPTS = 5

/**
 * @typedef {object} RequestInfo
 * @property {string} ip
 * @property {string} userAgent
 * @property {string} [requestId]
 */

/**
 * The signed-in person for one request.
 * @typedef {object} StaffActor
 * @property {string} staffId
 * @property {string} name
 * @property {string} email
 * @property {import('@noor/contract').StaffRole} role
 * @property {ReadonlySet<import('@noor/contract').Permission>} permissions
 * @property {{ idHash: string, kind: import('./sessions.js').SessionKind, csrfToken: string, lastAuthAt: Date, twoFactor: boolean }} session
 */

/** @typedef {typeof staffUsers.$inferSelect} UserRow */

/** @param {number} ms */
const tooMany = (ms) => new DomainError('too_many_attempts', { retryAfter: Math.max(1, Math.ceil(ms / 1000)) })

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {import('../../platform/config.js').Config} deps.config
 */
export function createAuthService({ db, config }) {
  const sealer = createSealer(config.DATA_ENCRYPTION_KEY)
  /** Whether this role must use two-step sign-in in this process (TWO_FACTOR_REQUIRED=0 is allowed only in local development and CI). @param {import('@noor/contract').StaffRole} role */
  const needsTwoFactor = (role) => config.TWO_FACTOR_REQUIRED && requiresTwoFactor(role)
  /** The password rules; `RELAXED_PASSWORDS=1` (local development only) keeps just a short minimum. @param {string} password @param {string} email */
  const weakness = (password, email) => passwordProblem(password, { email, relaxed: config.RELAXED_PASSWORDS })
  const adminUrl = (/** @type {string} */ path) => `${config.ADMIN_ORIGIN.replace(/\/$/, '')}${path}`

  /** @param {StaffActor | { staffId: string, name: string, role: string }} a @param {RequestInfo} req */
  const actorOf = (a, req) => ({ actor: { type: /** @type {const} */ ('staff'), id: a.staffId, label: a.name, role: a.role }, ip: req.ip, userAgent: req.userAgent, ...(req.requestId ? { requestId: req.requestId } : {}) })

  /** A permission list read from its json column: always an array of strings. @param {unknown} v @returns {string[]} */
  const listOf = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])

  /** @param {UserRow} u */
  const toStaffUser = (u, inviteExpiresAt = /** @type {Date | undefined} */ (undefined)) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: /** @type {import('@noor/contract').StaffRole} */ (u.role),
    status: /** @type {import('@noor/contract').StaffStatus} */ (u.status),
    twoFactorEnabled: u.totpEnabledAt !== null,
    ...(u.lockedUntil && u.lockedUntil > now() ? { lockedUntil: u.lockedUntil.toISOString() } : {}),
    ...(u.lastSeenAt ? { lastSeenAt: u.lastSeenAt.toISOString() } : {}),
    ...(inviteExpiresAt ? { inviteExpiresAt: inviteExpiresAt.toISOString() } : {}),
    version: u.version,
    createdAt: u.createdAt.toISOString(),
    // what was added to or taken from the role for this person, and what they may do in the end
    ...(u.profileId ? { profileId: u.profileId } : {}),
    grants: /** @type {import('@noor/contract').Permission[]} */ (listOf(u.grantedPermissions)),
    revokes: /** @type {import('@noor/contract').Permission[]} */ (listOf(u.revokedPermissions)),
    permissions: /** @type {import('@noor/contract').Permission[]} */ ([...effectivePermissions(/** @type {import('@noor/contract').StaffRole} */ (u.role), listOf(u.grantedPermissions), listOf(u.revokedPermissions))]),
  })

  /** What a freshly authenticated person must do next, and the session that goes with it. */
  async function startSession(/** @type {import('../../platform/db.js').Executor} */ tx, /** @type {UserRow} */ user, /** @type {RequestInfo} */ req) {
    const role = /** @type {import('@noor/contract').StaffRole} */ (user.role)
    if (user.totpEnabledAt) return { next: /** @type {const} */ ('two_factor'), ...(await createSession(tx, { userId: user.id, kind: 'pending_2fa', ip: req.ip, userAgent: req.userAgent })) }
    if (needsTwoFactor(role)) return { next: /** @type {const} */ ('enrol_two_factor'), ...(await createSession(tx, { userId: user.id, kind: 'enrol_2fa', ip: req.ip, userAgent: req.userAgent })) }
    return { next: /** @type {const} */ ('ok'), ...(await createSession(tx, { userId: user.id, kind: 'full', ip: req.ip, userAgent: req.userAgent })) }
  }

  /** Throws too_many_attempts when the email or the IP has used up its failed attempts. */
  async function assertNotThrottled(/** @type {UserRow | undefined} */ user, /** @type {string} */ emailHash, /** @type {string} */ ip) {
    const at = now()
    const since = new Date(at.getTime() - WINDOW_MS)
    if (user?.lockedUntil && user.lockedUntil > at) throw tooMany(user.lockedUntil.getTime() - at.getTime())
    if ((await repo.countFailures(db, { ip, since })) >= IP_LIMIT) {
      const oldest = await repo.oldestFailure(db, { ip, since })
      throw tooMany((oldest ? oldest.getTime() + WINDOW_MS : at.getTime() + WINDOW_MS) - at.getTime())
    }
    // after a lock has ended, only failures since it count
    const from = user?.lockedUntil && user.lockedUntil > since ? user.lockedUntil : since
    if ((await repo.countFailures(db, { emailHash, since: from })) >= EMAIL_LIMIT) {
      if (!user) {
        const oldest = await repo.oldestFailure(db, { emailHash, since })
        throw tooMany((oldest ? oldest.getTime() + WINDOW_MS : at.getTime() + WINDOW_MS) - at.getTime())
      }
      const lockCount = user.lockCount + 1
      const wait = Math.min(WINDOW_MS * 2 ** (lockCount - 1), LOCK_CAP_MS)
      await transaction(db, async (tx) => {
        await repo.updateUser(tx, user.id, { lockCount, lockedUntil: new Date(at.getTime() + wait), updatedAt: at })
        await record(tx, { actor: { type: 'system', label: 'sign-in throttle' }, action: 'auth.locked', entityType: 'staff', entityId: user.id, entityLabel: user.email, category: 'security', ip })
      })
      throw tooMany(wait)
    }
  }

  return {
    toStaffUser,

    // ------------------------------------------------------------------ sign-in
    /**
     * @param {{ email: string, password: string }} body
     * @param {RequestInfo} req
     */
    async login({ email, password }, req) {
      const emailHash = sha256Hex(email)
      const user = await repo.findUserByEmail(db, email)
      await assertNotThrottled(user, emailHash, req.ip)

      // always run one Argon2 verification, so the answer takes as long whether or not the email exists
      const usable = user && user.status === 'active' && user.passwordHash
      const ok = usable ? await verifyPassword(/** @type {string} */ (user.passwordHash), password) : (await verifyPassword(await dummyHash(), password), false)
      const at = now()
      if (!ok || !user) {
        await transaction(db, async (tx) => {
          await repo.insertAttempt(tx, { id: uuidv7(), emailHash, ip: req.ip, succeeded: false, createdAt: at })
          await record(tx, { actor: { type: 'system', label: 'sign-in' }, action: 'auth.login_failed', entityType: 'staff', entityLabel: email.slice(0, 200), ...(user ? { entityId: user.id } : {}), category: 'security', ip: req.ip, userAgent: req.userAgent, ...(req.requestId ? { requestId: req.requestId } : {}) })
        })
        throw new DomainError('invalid_credentials')
      }
      const rehash = needsRehash(/** @type {string} */ (user.passwordHash)) ? await hashPassword(password) : null
      return transaction(db, async (tx) => {
        await repo.insertAttempt(tx, { id: uuidv7(), emailHash, ip: req.ip, succeeded: true, createdAt: at })
        await repo.updateUser(tx, user.id, { lockCount: 0, lockedUntil: null, lastLoginAt: at, updatedAt: at, ...(rehash ? { passwordHash: rehash } : {}) })
        const started = await startSession(tx, user, req)
        await record(tx, { ...actorOf({ staffId: user.id, name: user.name, role: user.role }, req), action: 'auth.login', entityType: 'staff', entityId: user.id, entityLabel: user.email, category: 'security' })
        return started
      })
    },

    /**
     * Second step. `actor` is the pending session's owner.
     * @param {StaffActor} actor
     * @param {{ code: string } | { recoveryCode: string }} body
     * @param {RequestInfo} req
     */
    async verifyTwoFactor(actor, body, req) {
      const user = await repo.findUserById(db, actor.staffId)
      if (!user?.totpSecretEnc) throw new DomainError('unauthenticated')
      const emailHash = sha256Hex(user.email)
      const at = now()
      const failed = await repo.countFailures(db, { emailHash, since: actor.session.lastAuthAt })
      if (failed >= PENDING_CODE_ATTEMPTS) {
        await repo.deleteSession(db, actor.session.idHash)
        throw new DomainError('unauthenticated')
      }

      let good = false
      /** @type {number | null} */
      let step = null
      /** @type {string | null} */
      let usedRecovery = null
      if ('code' in body) {
        const r = verifyTotp({ secret: sealer.open(user.totpSecretEnc), code: body.code, afterStep: user.totpLastStep, nowMs: at.getTime() })
        if (r.ok) {
          good = true
          step = r.step
        }
      } else {
        const rows = await repo.unusedRecoveryCodes(db, user.id)
        const i = await matchRecoveryCode(body.recoveryCode, rows.map((r) => r.codeHash))
        if (i >= 0) {
          good = true
          usedRecovery = /** @type {NonNullable<(typeof rows)[number]>} */ (rows[i]).id
        }
      }
      if (!good) {
        await repo.insertAttempt(db, { id: uuidv7(), emailHash, ip: req.ip, succeeded: false, createdAt: at })
        await record(db, { ...actorOf({ staffId: user.id, name: user.name, role: user.role }, req), action: 'auth.2fa_failed', entityType: 'staff', entityId: user.id, entityLabel: user.email, category: 'security' })
        throw new DomainError('invalid_code')
      }
      return transaction(db, async (tx) => {
        if (step !== null) await repo.updateUser(tx, user.id, { totpLastStep: step, updatedAt: at })
        if (usedRecovery) await repo.markRecoveryUsed(tx, usedRecovery, at)
        await repo.deleteSession(tx, actor.session.idHash)
        const session = await createSession(tx, { userId: user.id, kind: 'full', ip: req.ip, userAgent: req.userAgent, twoFactor: true })
        await record(tx, { ...actorOf({ staffId: user.id, name: user.name, role: user.role }, req), action: usedRecovery ? 'auth.login_recovery_code' : 'auth.login_2fa', entityType: 'staff', entityId: user.id, entityLabel: user.email, category: 'security' })
        return { next: /** @type {const} */ ('ok'), ...session }
      })
    },

    /** @param {StaffActor} actor @param {RequestInfo} req */
    async logout(actor, req) {
      await transaction(db, async (tx) => {
        await repo.deleteSession(tx, actor.session.idHash)
        await record(tx, { ...actorOf(actor, req), action: 'auth.logout', entityType: 'staff', entityId: actor.staffId, entityLabel: actor.email, category: 'security' })
      })
    },

    // ------------------------------------------------------------------ passwords, invites
    /** Asks for a reset link. Always looks the same from outside. No email provider exists yet (DOC-12), so nothing is sent. @param {string} _email @param {RequestInfo} req */
    async requestPasswordReset(_email, req) {
      // ponytail: counted so the endpoint cannot be used to hammer the database; delivery arrives with the email provider (DOC-12)
      await hit(db, { bucket: 'reset', subject: `ip:${req.ip}`, limit: 5, windowMs: WINDOW_MS })
    },

    /**
     * @param {'invite' | 'password_reset'} type
     * @param {string} token
     */
    async _findUsableToken(type, token) {
      const row = await repo.findToken(db, sha256Hex(token))
      if (!row || row.type !== type || row.usedAt || row.expiresAt <= now()) throw new DomainError('token_expired')
      const user = await repo.findUserById(db, row.staffUserId)
      if (!user) throw new DomainError('token_expired')
      return { row, user }
    },

    /** @param {string} token */
    async getInvite(token) {
      const { user } = await this._findUsableToken('invite', token)
      if (user.status !== 'invited') throw new DomainError('token_expired')
      const role = /** @type {import('@noor/contract').StaffRole} */ (user.role)
      return { name: user.name, email: user.email, role, requiresTwoFactor: needsTwoFactor(role) }
    },

    /** @param {string} token @param {string} password @param {RequestInfo} req */
    async acceptInvite(token, password, req) {
      const { row, user } = await this._findUsableToken('invite', token)
      if (user.status !== 'invited') throw new DomainError('token_expired')
      const problem = weakness(password, user.email)
      if (problem) throw new DomainError('password_too_weak', { reason: problem })
      const passwordHash = await hashPassword(password)
      const at = now()
      return transaction(db, async (tx) => {
        const [res] = /** @type {[{ affectedRows: number }, unknown]} */ (/** @type {unknown} */ (await tx.update(staffUsers).set({ passwordHash, status: 'active', updatedAt: at, lastLoginAt: at, version: user.version + 1 }).where(and(eq(staffUsers.id, user.id), eq(staffUsers.status, 'invited')))))
        if (res.affectedRows === 0) throw new DomainError('token_expired') // someone else used the invite first
        await repo.markTokenUsed(tx, row.tokenHash, at)
        const active = { ...user, status: 'active' }
        const started = await startSession(tx, active, req)
        await record(tx, { ...actorOf({ staffId: user.id, name: user.name, role: user.role }, req), action: 'staff.invite_accepted', entityType: 'staff', entityId: user.id, entityLabel: user.email, category: 'security' })
        return started
      })
    },

    /** @param {string} token @param {string} password @param {RequestInfo} req */
    async resetPassword(token, password, req) {
      const { row, user } = await this._findUsableToken('password_reset', token)
      if (user.status !== 'active') throw new DomainError('token_expired')
      const problem = weakness(password, user.email)
      if (problem) throw new DomainError('password_too_weak', { reason: problem })
      const passwordHash = await hashPassword(password)
      const at = now()
      await transaction(db, async (tx) => {
        await repo.updateUser(tx, user.id, { passwordHash, lockCount: 0, lockedUntil: null, updatedAt: at, version: user.version + 1 })
        await repo.markTokenUsed(tx, row.tokenHash, at)
        await repo.deleteUserSessions(tx, user.id)
        await record(tx, { ...actorOf({ staffId: user.id, name: user.name, role: user.role }, req), action: 'auth.password_reset', entityType: 'staff', entityId: user.id, entityLabel: user.email, category: 'security' })
      })
    },

    // ------------------------------------------------------------------ the current user
    /** @param {StaffActor} actor */
    me(actor) {
      return this._meOf(actor, null)
    },

    /** @param {StaffActor} actor @param {UserRow | null} fresh */
    async _meOf(actor, fresh) {
      const user = fresh ?? (await repo.findUserById(db, actor.staffId))
      if (!user) throw new DomainError('unauthenticated')
      const until = new Date(actor.session.lastAuthAt.getTime() + STEP_UP_MS)
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: actor.role,
        permissions: [...actor.permissions],
        twoFactorEnabled: user.totpEnabledAt !== null,
        twoFactorRequired: needsTwoFactor(actor.role),
        csrfToken: actor.session.csrfToken,
        environment: config.APP_ENV,
        ...(until > now() ? { stepUpValidUntil: until.toISOString() } : {}),
      }
    },

    /** @param {StaffActor} actor @param {{ name: string }} body @param {RequestInfo} req */
    async updateMe(actor, { name }, req) {
      const at = now()
      await transaction(db, async (tx) => {
        await repo.updateUser(tx, actor.staffId, { name, updatedAt: at })
        await record(tx, { ...actorOf(actor, req), action: 'staff.profile_updated', entityType: 'staff', entityId: actor.staffId, entityLabel: actor.email, diff: { name: [actor.name, name] } })
      })
      return this._meOf({ ...actor, name }, null)
    },

    /** @param {StaffActor} actor @param {string} password */
    async _checkPassword(actor, password) {
      const user = await repo.findUserById(db, actor.staffId)
      if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, password))) throw new DomainError('invalid_credentials')
      return user
    },

    /** Ends the other sessions and replaces this one: the new cookie value is returned. @param {StaffActor} actor @param {{ currentPassword: string, newPassword: string }} body @param {RequestInfo} req */
    async changePassword(actor, { currentPassword, newPassword }, req) {
      const user = await this._checkPassword(actor, currentPassword)
      const problem = weakness(newPassword, user.email)
      if (problem) throw new DomainError('password_too_weak', { reason: problem })
      const passwordHash = await hashPassword(newPassword)
      const at = now()
      return transaction(db, async (tx) => {
        await repo.updateUser(tx, user.id, { passwordHash, updatedAt: at, version: user.version + 1 })
        await repo.deleteUserSessions(tx, user.id)
        const session = await createSession(tx, { userId: user.id, kind: 'full', ip: req.ip, userAgent: req.userAgent, twoFactor: actor.session.twoFactor })
        await record(tx, { ...actorOf(actor, req), action: 'auth.password_changed', entityType: 'staff', entityId: user.id, entityLabel: user.email, category: 'security' })
        return session
      })
    },

    /** Refreshes the step-up window. @param {StaffActor} actor @param {string} password */
    async confirmPassword(actor, password) {
      await this._checkPassword(actor, password)
      await repo.markSessionAuth(db, actor.session.idHash, now())
    },

    // ------------------------------------------------------------------ two-factor management
    /** @param {StaffActor} actor */
    async beginTwoFactor(actor) {
      const user = await repo.findUserById(db, actor.staffId)
      if (!user) throw new DomainError('unauthenticated')
      if (user.totpEnabledAt) throw new DomainError('action_not_allowed', {}, 'Two-factor is already on; turn it off first.')
      const secret = newTotpSecret()
      await repo.updateUser(db, user.id, { totpSecretEnc: sealer.seal(secret), totpLastStep: null, updatedAt: now() })
      return { otpauthUri: totpUri({ secret, email: user.email }), secret }
    },

    /** Confirms the first code, switches 2FA on and returns the recovery codes once. An enrolment session becomes a full one. @param {StaffActor} actor @param {string} code @param {RequestInfo} req */
    async enableTwoFactor(actor, code, req) {
      const user = await repo.findUserById(db, actor.staffId)
      if (!user?.totpSecretEnc || user.totpEnabledAt) throw new DomainError('action_not_allowed', {}, 'Start enrolment first.')
      const at = now()
      const r = verifyTotp({ secret: sealer.open(user.totpSecretEnc), code, nowMs: at.getTime() })
      if (!r.ok) throw new DomainError('invalid_code')
      const { codes, hashes } = await createRecoveryCodes()
      return transaction(db, async (tx) => {
        await repo.updateUser(tx, user.id, { totpEnabledAt: at, totpLastStep: r.step, updatedAt: at, version: user.version + 1 })
        await repo.deleteRecoveryCodes(tx, user.id)
        await repo.insertRecoveryCodes(tx, hashes.map((codeHash) => ({ id: uuidv7(), staffUserId: user.id, codeHash, createdAt: at })))
        /** @type {{ cookie: string, csrfToken: string } | null} */
        let session = null
        if (actor.session.kind === 'enrol_2fa') {
          await repo.deleteSession(tx, actor.session.idHash)
          session = await createSession(tx, { userId: user.id, kind: 'full', ip: req.ip, userAgent: req.userAgent, twoFactor: true })
        } else {
          await repo.setSessionKind(tx, actor.session.idHash, { twoFactor: true })
        }
        await record(tx, { ...actorOf(actor, req), action: 'auth.2fa_enabled', entityType: 'staff', entityId: user.id, entityLabel: user.email, category: 'security' })
        return { recoveryCodes: codes, session }
      })
    },

    /** @param {StaffActor} actor @param {RequestInfo} req */
    async regenerateRecoveryCodes(actor, req) {
      const user = await repo.findUserById(db, actor.staffId)
      if (!user?.totpEnabledAt) throw new DomainError('action_not_allowed', {}, 'Two-factor is not on.')
      const { codes, hashes } = await createRecoveryCodes()
      const at = now()
      await transaction(db, async (tx) => {
        await repo.deleteRecoveryCodes(tx, user.id)
        await repo.insertRecoveryCodes(tx, hashes.map((codeHash) => ({ id: uuidv7(), staffUserId: user.id, codeHash, createdAt: at })))
        await record(tx, { ...actorOf(actor, req), action: 'auth.recovery_codes_regenerated', entityType: 'staff', entityId: user.id, entityLabel: user.email, category: 'security' })
      })
      return { recoveryCodes: codes }
    },

    /** @param {StaffActor} actor @param {RequestInfo} req */
    async disableTwoFactor(actor, req) {
      if (needsTwoFactor(actor.role)) throw new DomainError('forbidden', {}, 'Your role requires two-factor authentication.')
      await transaction(db, async (tx) => {
        await repo.updateUser(tx, actor.staffId, { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, updatedAt: now() })
        await repo.deleteRecoveryCodes(tx, actor.staffId)
        await record(tx, { ...actorOf(actor, req), action: 'auth.2fa_disabled', entityType: 'staff', entityId: actor.staffId, entityLabel: actor.email, category: 'security' })
      })
    },

    // ------------------------------------------------------------------ own sessions
    /** @param {string} userId @param {string} currentHash */
    async _sessionInfos(userId, currentHash) {
      const rows = await repo.listUserSessions(db, userId, now())
      return rows.map((s) => ({ id: publicSessionId(s.idHash), current: s.idHash === currentHash, createdAt: s.createdAt.toISOString(), lastSeenAt: s.lastSeenAt.toISOString(), ip: s.ip, userAgent: s.userAgent }))
    },

    /** @param {StaffActor} actor */
    async listSessions(actor) {
      return { items: await this._sessionInfos(actor.staffId, actor.session.idHash) }
    },

    /** @param {StaffActor} actor @param {string} publicId @param {RequestInfo} req */
    async revokeSession(actor, publicId, req) {
      await transaction(db, async (tx) => {
        const [res] = /** @type {[{ affectedRows: number }, unknown]} */ (/** @type {unknown} */ (await repo.deleteSessionByPublicId(tx, actor.staffId, publicId)))
        if (res.affectedRows === 0) throw new DomainError('not_found')
        await record(tx, { ...actorOf(actor, req), action: 'auth.session_revoked', entityType: 'staff', entityId: actor.staffId, entityLabel: actor.email, category: 'security' })
      })
    },

    /** @param {StaffActor} actor @param {RequestInfo} req */
    async revokeOtherSessions(actor, req) {
      await transaction(db, async (tx) => {
        await repo.deleteUserSessions(tx, actor.staffId, actor.session.idHash)
        await record(tx, { ...actorOf(actor, req), action: 'auth.sessions_revoked', entityType: 'staff', entityId: actor.staffId, entityLabel: actor.email, category: 'security' })
      })
    },

    // ------------------------------------------------------------------ staff management
    roles: () => ({ items: roleList(config.TWO_FACTOR_REQUIRED) }),

    /** @param {{ q?: string, role?: string, status?: string, sort?: string, page: number, size: number }} query */
    async listStaff(query) {
      const { items, total } = await repo.listUsers(db, query)
      const invites = await repo.latestInvite(db, items.filter((u) => u.status === 'invited').map((u) => u.id))
      return { items: items.map((u) => toStaffUser(u, invites.find((i) => i.staffUserId === u.id)?.expiresAt)), total, page: query.page, size: query.size }
    },

    /** @param {StaffActor} actor @param {string} id */
    async getStaff(actor, id) {
      const user = await repo.findUserById(db, id)
      if (!user) throw new DomainError('not_found')
      const invites = user.status === 'invited' ? await repo.latestInvite(db, [user.id]) : []
      const sessions = await this._sessionInfos(user.id, actor.session.idHash)
      return { ...toStaffUser(user, invites[0]?.expiresAt), sessions }
    },

    /** Issues an invite token and returns the link (returned once; no email provider yet). @param {import('../../platform/db.js').Executor} tx @param {string} userId @param {string} byId */
    async _issueToken(tx, userId, byId, /** @type {'invite' | 'password_reset'} */ type) {
      const token = randomToken()
      const at = now()
      await repo.deleteUnusedTokens(tx, userId, type)
      await repo.insertToken(tx, { tokenHash: sha256Hex(token), type, staffUserId: userId, expiresAt: new Date(at.getTime() + (type === 'invite' ? INVITE_TTL_MS : RESET_TTL_MS)), createdBy: byId, createdAt: at })
      return adminUrl(type === 'invite' ? `/accept-invite/${token}` : `/reset-password/${token}`)
    },

    /** @param {StaffActor} actor @param {{ name: string, email: string, role: import('@noor/contract').StaffRole }} body @param {RequestInfo} req */
    async inviteStaff(actor, { name, email, role }, req) {
      if (!mayManage(/** @type {import('@noor/contract').StaffRole} */ (actor.role), role)) throw new DomainError('forbidden')
      if (await repo.findUserByEmail(db, email)) throw new DomainError('email_taken')
      const at = now()
      const id = uuidv7()
      return transaction(db, async (tx) => {
        await repo.insertUser(tx, { id, email, name, role, status: 'invited', createdAt: at, updatedAt: at, createdBy: actor.staffId })
        const inviteLink = await this._issueToken(tx, id, actor.staffId, 'invite')
        await record(tx, { ...actorOf(actor, req), action: 'staff.invited', entityType: 'staff', entityId: id, entityLabel: email, category: 'security', diff: { role: [null, role] } })
        const user = /** @type {UserRow} */ (await repo.findUserById(tx, id))
        return { ...toStaffUser(user, new Date(at.getTime() + INVITE_TTL_MS)), inviteLink }
      })
    },

    /** Refuses to leave the shop without an active owner. @param {import('../../platform/db.js').Executor} tx @param {UserRow} target @param {{ role?: string, status?: string }} after */
    async _assertOwnerRemains(tx, target, after) {
      const staysOwner = (after.role ?? target.role) === 'owner' && (after.status ?? target.status) === 'active'
      if (target.role !== 'owner' || target.status !== 'active' || staysOwner) return
      const owners = await repo.lockActiveOwners(tx)
      if (owners.filter((o) => o.id !== target.id).length === 0) throw new DomainError('last_owner')
    },

    /** @param {StaffActor} actor @param {string} id */
    async _targetOf(actor, id, { allowSelf = false } = {}) {
      const target = await repo.findUserById(db, id)
      if (!target) throw new DomainError('not_found')
      if (!allowSelf && target.id === actor.staffId) throw new DomainError('forbidden', {}, 'You cannot do this to your own account.')
      if (!mayManage(actor.role, /** @type {import('@noor/contract').StaffRole} */ (target.role))) throw new DomainError('forbidden')
      return target
    },

    /**
     * Gives a person more than their role, or less: module by module, in the end permission by permission (plan/17-owner-requests-2026-10.md item 11). Only what the role does not
     * already say is kept, nobody changes their own, nobody gives what they do not hold themselves, and an owner cannot be reduced.
     * @param {StaffActor} actor @param {string} id @param {{ grants: import('@noor/contract').Permission[], revokes: import('@noor/contract').Permission[], version: number }} body @param {RequestInfo} req
     */
    async setPermissions(actor, id, { grants, revokes, version }, req) {
      const target = await this._targetOf(actor, id)
      if (target.id === actor.staffId) throw new DomainError('forbidden')
      const role = /** @type {import('@noor/contract').StaffRole} */ (target.role)
      if (role === 'owner' && revokes.length) throw new DomainError('validation_failed', { issues: [{ path: 'revokes', code: 'invalid_format' }] })
      const base = permissionsOf(role)
      const newGrants = [...new Set(grants)].filter((p) => !base.has(p)).toSorted()
      const newRevokes = [...new Set(revokes)].filter((p) => base.has(p)).toSorted()
      // nobody hands out what they do not have themselves
      for (const p of newGrants) if (!actor.permissions.has(p)) throw new DomainError('forbidden')
      return transaction(db, async (tx) => {
        const locked = await repo.lockUserById(tx, id)
        if (!locked) throw new DomainError('not_found')
        if (locked.version !== version) throw new DomainError('stale_write', { currentVersion: locked.version })
        const was = { grants: listOf(locked.grantedPermissions), revokes: listOf(locked.revokedPermissions) }
        await repo.updateUser(tx, id, { grantedPermissions: newGrants.length ? newGrants : null, revokedPermissions: newRevokes.length ? newRevokes : null, profileId: null, updatedAt: now(), version: locked.version + 1 }) // changed by hand: no longer the profile's
        await record(tx, {
          ...actorOf(actor, req), action: 'staff.permissions_changed', entityType: 'staff', entityId: id, entityLabel: locked.email, category: 'security',
          diff: { grants: [was.grants.join(', ') || null, newGrants.join(', ') || null], revokes: [was.revokes.join(', ') || null, newRevokes.join(', ') || null] },
        })
        return toStaffUser(/** @type {UserRow} */ (await repo.findUserById(tx, id)))
      })
    },

    // ---- custom named roles (plan/17-owner-requests-2026-10.md item 11) ---------------------------------------------------------

    /** The view of a profile row with how many people have it. @param {typeof accessProfiles.$inferSelect} p @param {number} members */
    _profileView(p, members) {
      const role = /** @type {import('@noor/contract').StaffRole} */ (p.baseRole)
      const grants = /** @type {import('@noor/contract').Permission[]} */ (listOf(p.grantedPermissions))
      const revokes = /** @type {import('@noor/contract').Permission[]} */ (listOf(p.revokedPermissions))
      return {
        id: p.id, name: p.name, ...(p.summary ? { summary: p.summary } : {}), baseRole: /** @type {'manager' | 'catalog' | 'fulfilment' | 'support' | 'viewer'} */ (role), grants, revokes,
        permissions: /** @type {import('@noor/contract').Permission[]} */ ([...effectivePermissions(role, grants, revokes)]), members, version: p.version, updatedAt: p.updatedAt.toISOString(),
      }
    },

    /**
     * What a profile keeps of the input: only additions the base role does not have and removals it does, and only what the person making it may give (nobody hands out what they do not
     * hold, and nobody makes a role above their own).
     * @param {StaffActor} actor @param {{ baseRole: import('@noor/contract').StaffRole, grants: import('@noor/contract').Permission[], revokes: import('@noor/contract').Permission[] }} input
     */
    _shapeOf(actor, { baseRole, grants, revokes }) {
      if (!mayManage(actor.role, baseRole)) throw new DomainError('forbidden')
      const base = permissionsOf(baseRole)
      const kept = { grants: [...new Set(grants)].filter((p) => !base.has(p)).toSorted(), revokes: [...new Set(revokes)].filter((p) => base.has(p)).toSorted() }
      for (const p of kept.grants) if (!actor.permissions.has(p)) throw new DomainError('forbidden')
      return kept
    },

    async listProfiles() {
      const [rows, counts] = await Promise.all([
        db.select().from(accessProfiles).orderBy(accessProfiles.name),
        db.select({ id: staffUsers.profileId, n: count() }).from(staffUsers).where(eq(staffUsers.status, 'active')).groupBy(staffUsers.profileId),
      ])
      const members = new Map(counts.map((c) => [c.id, c.n]))
      return { items: rows.map((p) => this._profileView(p, members.get(p.id) ?? 0)) }
    },

    /** @param {StaffActor} actor @param {import('@noor/contract').z.infer<typeof import('@noor/contract').AccessProfileInput>} input @param {RequestInfo} req */
    async createProfile(actor, input, req) {
      const kept = this._shapeOf(actor, input)
      const id = uuidv7()
      const at = now()
      try {
        await transaction(db, async (tx) => {
          await tx.insert(accessProfiles).values({ id, name: input.name, summary: input.summary || null, baseRole: input.baseRole, grantedPermissions: kept.grants.length ? kept.grants : null, revokedPermissions: kept.revokes.length ? kept.revokes : null, createdAt: at, updatedAt: at })
          await record(tx, { ...actorOf(actor, req), action: 'access_profile.created', entityType: 'access_profile', entityId: id, entityLabel: input.name, category: 'security' })
        })
      } catch (e) {
        if (/** @type {{ cause?: { errno?: number }, errno?: number }} */ (e).cause?.errno === 1062) throw new DomainError('validation_failed', { issues: [{ path: 'name', code: 'invalid_format' }] })
        throw e
      }
      return this._profileView(/** @type {typeof accessProfiles.$inferSelect} */ ((await db.select().from(accessProfiles).where(eq(accessProfiles.id, id)))[0]), 0)
    },

    /**
     * Changing a profile changes everyone who has it, at once: their role, additions and removals become the profile's. Nobody edits the profile that gives themselves their access.
     * @param {StaffActor} actor @param {string} id @param {import('@noor/contract').z.infer<typeof import('@noor/contract').AccessProfileInput> & { version: number }} input @param {RequestInfo} req
     */
    async updateProfile(actor, id, input, req) {
      const kept = this._shapeOf(actor, input)
      const [mine] = await db.select({ profileId: staffUsers.profileId }).from(staffUsers).where(eq(staffUsers.id, actor.staffId))
      if (mine?.profileId === id) throw new DomainError('forbidden', {}, 'You cannot change the role that gives you your own access.')
      let members = 0
      try {
        await transaction(db, async (tx) => {
          const [locked] = await tx.select().from(accessProfiles).where(eq(accessProfiles.id, id)).for('update')
          if (!locked) throw new DomainError('not_found')
          if (locked.version !== input.version) throw new DomainError('stale_write', { currentVersion: locked.version })
          const at = now()
          await tx.update(accessProfiles).set({ name: input.name, summary: input.summary || null, baseRole: input.baseRole, grantedPermissions: kept.grants.length ? kept.grants : null, revokedPermissions: kept.revokes.length ? kept.revokes : null, updatedAt: at, version: locked.version + 1 }).where(eq(accessProfiles.id, id))
          const people = await tx.select().from(staffUsers).where(eq(staffUsers.profileId, id)).for('update')
          members = people.length
          for (const p of people) {
            await tx.update(staffUsers).set({ role: input.baseRole, grantedPermissions: kept.grants.length ? kept.grants : null, revokedPermissions: kept.revokes.length ? kept.revokes : null, updatedAt: at, version: p.version + 1 }).where(eq(staffUsers.id, p.id))
            if (p.role !== input.baseRole) await repo.deleteUserSessions(tx, p.id) // a different base role ends that person's sessions, like any role change
          }
          await record(tx, {
            ...actorOf(actor, req), action: 'access_profile.updated', entityType: 'access_profile', entityId: id, entityLabel: input.name, category: 'security',
            diff: { baseRole: [locked.baseRole, input.baseRole], grants: [listOf(locked.grantedPermissions).join(', ') || null, kept.grants.join(', ') || null], revokes: [listOf(locked.revokedPermissions).join(', ') || null, kept.revokes.join(', ') || null], people: [null, String(members)] },
          })
        })
      } catch (e) {
        if (/** @type {{ cause?: { errno?: number }, errno?: number }} */ (e).cause?.errno === 1062) throw new DomainError('validation_failed', { issues: [{ path: 'name', code: 'invalid_format' }] })
        throw e
      }
      return this._profileView(/** @type {typeof accessProfiles.$inferSelect} */ ((await db.select().from(accessProfiles).where(eq(accessProfiles.id, id)))[0]), members)
    },

    /** People who had it keep the access they have; it is simply theirs alone from now on. @param {StaffActor} actor @param {string} id @param {RequestInfo} req */
    async deleteProfile(actor, id, req) {
      const [mine] = await db.select({ profileId: staffUsers.profileId }).from(staffUsers).where(eq(staffUsers.id, actor.staffId))
      if (mine?.profileId === id) throw new DomainError('forbidden', {}, 'You cannot delete the role that gives you your own access.')
      await transaction(db, async (tx) => {
        const [locked] = await tx.select().from(accessProfiles).where(eq(accessProfiles.id, id)).for('update')
        if (!locked) throw new DomainError('not_found')
        if (!mayManage(actor.role, /** @type {import('@noor/contract').StaffRole} */ (locked.baseRole))) throw new DomainError('forbidden')
        await tx.update(staffUsers).set({ profileId: null }).where(eq(staffUsers.profileId, id))
        await tx.delete(accessProfiles).where(eq(accessProfiles.id, id))
        await record(tx, { ...actorOf(actor, req), action: 'access_profile.deleted', entityType: 'access_profile', entityId: id, entityLabel: locked.name, category: 'security' })
      })
    },

    /**
     * Gives a person a custom role (their role and additions become the profile's), or lets go of it (`profileId` null: they keep the access they have, now theirs alone).
     * @param {StaffActor} actor @param {string} id @param {{ profileId: string | null, version: number }} body @param {RequestInfo} req
     */
    async applyProfile(actor, id, { profileId, version }, req) {
      const target = await this._targetOf(actor, id)
      if (target.role === 'owner') throw new DomainError('forbidden')
      return transaction(db, async (tx) => {
        const locked = await repo.lockUserById(tx, id)
        if (!locked) throw new DomainError('not_found')
        if (locked.version !== version) throw new DomainError('stale_write', { currentVersion: locked.version })
        /** @type {Partial<typeof staffUsers.$inferInsert>} */
        let patch = { profileId: null }
        let named = '(none)'
        if (profileId) {
          const [p] = await tx.select().from(accessProfiles).where(eq(accessProfiles.id, profileId))
          if (!p) throw new DomainError('not_found')
          const role = /** @type {import('@noor/contract').StaffRole} */ (p.baseRole)
          const kept = this._shapeOf(actor, { baseRole: role, grants: /** @type {never} */ (listOf(p.grantedPermissions)), revokes: /** @type {never} */ (listOf(p.revokedPermissions)) })
          patch = { profileId, role, grantedPermissions: kept.grants.length ? kept.grants : null, revokedPermissions: kept.revokes.length ? kept.revokes : null }
          named = p.name
          if (locked.role !== role) await repo.deleteUserSessions(tx, id)
        }
        await repo.updateUser(tx, id, { ...patch, updatedAt: now(), version: locked.version + 1 })
        await record(tx, { ...actorOf(actor, req), action: profileId ? 'staff.profile_applied' : 'staff.profile_removed', entityType: 'staff', entityId: id, entityLabel: locked.email, category: 'security', diff: { profile: [locked.profileId ?? null, named] } })
        return toStaffUser(/** @type {UserRow} */ (await repo.findUserById(tx, id)))
      })
    },

    /** @param {StaffActor} actor @param {string} id @param {{ name: string, role: import('@noor/contract').StaffRole, version: number }} body @param {RequestInfo} req */
    async updateStaff(actor, id, { name, role, version }, req) {
      const target = await this._targetOf(actor, id)
      if (role !== target.role && !mayManage(actor.role, role)) throw new DomainError('forbidden')
      const at = now()
      return transaction(db, async (tx) => {
        const locked = await repo.lockUserById(tx, id)
        if (!locked) throw new DomainError('not_found')
        if (locked.version !== version) throw new DomainError('stale_write', { currentVersion: locked.version })
        await this._assertOwnerRemains(tx, locked, { role })
        await repo.updateUser(tx, id, { name, role, ...(role !== locked.role ? { profileId: null } : {}), updatedAt: at, version: locked.version + 1 })
        const roleChanged = role !== locked.role
        if (roleChanged) await repo.deleteUserSessions(tx, id) // a role change ends that person's sessions
        /** @type {Record<string, [unknown, unknown]>} */
        const diff = {}
        if (name !== locked.name) diff.name = [locked.name, name]
        if (roleChanged) diff.role = [locked.role, role]
        await record(tx, { ...actorOf(actor, req), action: roleChanged ? 'staff.role_changed' : 'staff.updated', entityType: 'staff', entityId: id, entityLabel: locked.email, diff, category: roleChanged ? 'security' : 'general' })
        return toStaffUser(/** @type {UserRow} */ (await repo.findUserById(tx, id)))
      })
    },

    /** @param {StaffActor} actor @param {string} id @param {RequestInfo} req */
    async resendInvite(actor, id, req) {
      const target = await this._targetOf(actor, id)
      if (target.status !== 'invited') throw new DomainError('action_not_allowed')
      return transaction(db, async (tx) => {
        const inviteLink = await this._issueToken(tx, id, actor.staffId, 'invite')
        await record(tx, { ...actorOf(actor, req), action: 'staff.invite_resent', entityType: 'staff', entityId: id, entityLabel: target.email, category: 'security' })
        return { inviteLink }
      })
    },

    /** @param {StaffActor} actor @param {string} id @param {RequestInfo} req */
    async createResetLink(actor, id, req) {
      const target = await this._targetOf(actor, id)
      if (target.status !== 'active') throw new DomainError('action_not_allowed')
      return transaction(db, async (tx) => {
        const resetLink = await this._issueToken(tx, id, actor.staffId, 'password_reset')
        await record(tx, { ...actorOf(actor, req), action: 'staff.password_reset_issued', entityType: 'staff', entityId: id, entityLabel: target.email, category: 'security' })
        return { resetLink }
      })
    },

    /** @param {StaffActor} actor @param {string} id @param {RequestInfo} req */
    async resetStaffTwoFactor(actor, id, req) {
      const target = await this._targetOf(actor, id, { allowSelf: false })
      await transaction(db, async (tx) => {
        await repo.updateUser(tx, id, { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, updatedAt: now() })
        await repo.deleteRecoveryCodes(tx, id)
        await repo.deleteUserSessions(tx, id)
        await record(tx, { ...actorOf(actor, req), action: 'staff.2fa_reset', entityType: 'staff', entityId: id, entityLabel: target.email, category: 'security' })
      })
    },

    /** @param {StaffActor} actor @param {string} id @param {RequestInfo} req */
    async revokeStaffSessions(actor, id, req) {
      const target = await this._targetOf(actor, id, { allowSelf: true })
      await transaction(db, async (tx) => {
        await repo.deleteUserSessions(tx, id)
        await record(tx, { ...actorOf(actor, req), action: 'staff.sessions_revoked', entityType: 'staff', entityId: id, entityLabel: target.email, category: 'security' })
      })
    },

    /** @param {StaffActor} actor @param {string} id @param {RequestInfo} req */
    async clearLock(actor, id, req) {
      const target = await this._targetOf(actor, id, { allowSelf: true })
      await transaction(db, async (tx) => {
        await repo.updateUser(tx, id, { lockCount: 0, lockedUntil: null, updatedAt: now() })
        await repo.deleteAttemptsForEmail(tx, sha256Hex(target.email))
        await record(tx, { ...actorOf(actor, req), action: 'staff.unlocked', entityType: 'staff', entityId: id, entityLabel: target.email, category: 'security' })
      })
    },

    /** @param {StaffActor} actor @param {string} id @param {RequestInfo} req */
    async deactivate(actor, id, req) {
      const target = await this._targetOf(actor, id)
      return transaction(db, async (tx) => {
        const locked = await repo.lockUserById(tx, id)
        if (!locked) throw new DomainError('not_found')
        await this._assertOwnerRemains(tx, locked, { status: 'deactivated' })
        await repo.updateUser(tx, id, { status: 'deactivated', updatedAt: now(), version: locked.version + 1 })
        await repo.deleteUserSessions(tx, id)
        await record(tx, { ...actorOf(actor, req), action: 'staff.deactivated', entityType: 'staff', entityId: id, entityLabel: target.email, category: 'security', diff: { status: [locked.status, 'deactivated'] } })
        return toStaffUser(/** @type {UserRow} */ (await repo.findUserById(tx, id)))
      })
    },

    /** @param {StaffActor} actor @param {string} id @param {RequestInfo} req */
    async reactivate(actor, id, req) {
      const target = await this._targetOf(actor, id)
      if (target.status !== 'deactivated') throw new DomainError('action_not_allowed')
      return transaction(db, async (tx) => {
        // someone who never set a password goes back to "invited", the rest to "active"
        const status = target.passwordHash ? 'active' : 'invited'
        await repo.updateUser(tx, id, { status, updatedAt: now(), version: target.version + 1 })
        await record(tx, { ...actorOf(actor, req), action: 'staff.reactivated', entityType: 'staff', entityId: id, entityLabel: target.email, category: 'security', diff: { status: ['deactivated', status] } })
        return toStaffUser(/** @type {UserRow} */ (await repo.findUserById(tx, id)))
      })
    },

    // ------------------------------------------------------------------ bootstrap (CLI owner:create)
    /** Creates the first owner, active, with a password and no 2FA yet (the first sign-in enrols it). @param {{ email: string, name: string, password: string }} input */
    async createOwner({ email, name, password }) {
      const problem = weakness(password, email)
      if (problem) throw new DomainError('password_too_weak', { reason: problem })
      if (await repo.findUserByEmail(db, email)) throw new DomainError('email_taken')
      const at = now()
      const id = uuidv7()
      const passwordHash = await hashPassword(password)
      await transaction(db, async (tx) => {
        await repo.insertUser(tx, { id, email, name, role: 'owner', status: 'active', passwordHash, createdAt: at, updatedAt: at })
        await record(tx, { actor: { type: 'system', label: 'owner:create' }, action: 'staff.owner_created', entityType: 'staff', entityId: id, entityLabel: email, category: 'security' })
      })
      return id
    },

    /** Builds the actor for a loaded session. @param {import('./repository.js').UserRow} user @param {import('./repository.js').SessionRow} session @returns {StaffActor} */
    actorFor(user, session) {
      const role = /** @type {import('@noor/contract').StaffRole} */ (user.role)
      return {
        staffId: user.id,
        name: user.name,
        email: user.email,
        role,
        permissions: effectivePermissions(role, listOf(user.grantedPermissions), listOf(user.revokedPermissions)),
        session: { idHash: session.idHash, kind: /** @type {import('./sessions.js').SessionKind} */ (session.kind), csrfToken: session.csrfToken, lastAuthAt: session.lastAuthAt, twoFactor: session.twoFactor },
      }
    },
  }
}

