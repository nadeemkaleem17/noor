// Server-side sessions (plan/11-security-auth.md section 3.4): a random cookie value, only its SHA-256 in the database,
// 8 h idle timeout, 14 d absolute timeout, 5 min for the half-finished kinds, step-up after 15 min.
import { now } from '../../platform/clock.js'
import * as repo from './repository.js'
import { randomToken, sha256Hex } from './tokens.js'

export const IDLE_MS = 8 * 3_600_000
export const ABSOLUTE_MS = 14 * 86_400_000
export const PENDING_MS = 5 * 60_000
export const STEP_UP_MS = 15 * 60_000
export const TOUCH_EVERY_MS = 60_000

/** @typedef {'pending_2fa' | 'enrol_2fa' | 'full'} SessionKind */

/** When a session of this kind expires, given when it started and was last used. */
export const expiryFor = (/** @type {SessionKind} */ kind, /** @type {Date} */ createdAt, /** @type {Date} */ lastSeenAt) =>
  kind === 'full' ? new Date(Math.min(createdAt.getTime() + ABSOLUTE_MS, lastSeenAt.getTime() + IDLE_MS)) : new Date(createdAt.getTime() + PENDING_MS)

/**
 * Creates a session and returns the cookie value (shown to the browser once) with the CSRF token.
 * @param {import('../../platform/db.js').Executor} db
 * @param {{ userId: string, kind: SessionKind, ip: string, userAgent: string, twoFactor?: boolean, lastAuthAt?: Date }} s
 */
export async function createSession(db, { userId, kind, ip, userAgent, twoFactor = false, lastAuthAt }) {
  const at = now()
  const cookie = randomToken()
  const csrfToken = randomToken()
  await repo.insertSession(db, {
    idHash: sha256Hex(cookie),
    staffUserId: userId,
    kind,
    csrfToken,
    twoFactor,
    createdAt: at,
    lastSeenAt: at,
    lastAuthAt: lastAuthAt ?? at,
    expiresAt: expiryFor(kind, at, at),
    ip: ip.slice(0, 45),
    userAgent: userAgent.slice(0, 300),
  })
  return { cookie, csrfToken }
}

/**
 * Finds the session for a cookie value. Returns null for none, expired (and removes it) or a deactivated user.
 * Slides the idle timeout, writing at most once a minute.
 * @param {import('../../platform/db.js').Executor} db
 * @param {string | undefined} cookie
 */
export async function loadSession(db, cookie) {
  if (!cookie || cookie.length > 100) return null
  const idHash = sha256Hex(cookie)
  const session = await repo.findSession(db, idHash)
  if (!session) return null
  const at = now()
  if (session.expiresAt <= at) {
    await repo.deleteSession(db, idHash)
    return null
  }
  const user = await repo.findUserById(db, session.staffUserId)
  if (!user || user.status !== 'active') {
    await repo.deleteSession(db, idHash)
    return null
  }
  if (session.kind === 'full' && at.getTime() - session.lastSeenAt.getTime() >= TOUCH_EVERY_MS) {
    const expiresAt = expiryFor('full', session.createdAt, at)
    await repo.touchSession(db, idHash, { lastSeenAt: at, expiresAt })
    await repo.updateUser(db, user.id, { lastSeenAt: at })
    session.lastSeenAt = at
    session.expiresAt = expiresAt
  }
  return { session, user }
}

/** The id shown to a person for their own session: the first 16 hex characters of the stored hash. Not usable as a credential. */
export const publicSessionId = (/** @type {string} */ idHash) => idHash.slice(0, 16)
