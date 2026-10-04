// The only file of the auth module that touches Drizzle tables (plan/08-backend-architecture.md section 5.1).
import { and, asc, count, desc, eq, gt, inArray, isNull, like, lt, ne, or } from 'drizzle-orm'
import { authTokens, loginAttempts, recoveryCodes, sessions, staffUsers } from '../../db/schema/auth.js'

/** @typedef {import('../../platform/db.js').Executor} Executor */
/** @typedef {typeof staffUsers.$inferSelect} UserRow */
/** @typedef {typeof sessions.$inferSelect} SessionRow */

// ---- staff users
export const findUserByEmail = (/** @type {Executor} */ db, /** @type {string} */ email) => db.select().from(staffUsers).where(eq(staffUsers.email, email)).then((r) => r[0])
export const findUserById = (/** @type {Executor} */ db, /** @type {string} */ id) => db.select().from(staffUsers).where(eq(staffUsers.id, id)).then((r) => r[0])
/** Same read, but takes a row lock for the rest of the transaction. */
export const lockUserById = (/** @type {Executor} */ db, /** @type {string} */ id) => db.select().from(staffUsers).where(eq(staffUsers.id, id)).for('update').then((r) => r[0])

export const insertUser = (/** @type {Executor} */ db, /** @type {typeof staffUsers.$inferInsert} */ row) => db.insert(staffUsers).values(row)

/**
 * @param {Executor} db
 * @param {string} id
 * @param {Partial<typeof staffUsers.$inferInsert>} patch
 */
export const updateUser = (db, id, patch) => db.update(staffUsers).set(patch).where(eq(staffUsers.id, id))

/** Locks every active owner row (in id order) so two transactions cannot both remove "the last owner". @param {Executor} db */
export const lockActiveOwners = (db) =>
  db.select({ id: staffUsers.id }).from(staffUsers).where(and(eq(staffUsers.role, 'owner'), eq(staffUsers.status, 'active'))).orderBy(asc(staffUsers.id)).for('update')

const sorts = /** @type {const} */ ({ name: asc(staffUsers.name), '-name': desc(staffUsers.name), lastSeenAt: asc(staffUsers.lastSeenAt), '-lastSeenAt': desc(staffUsers.lastSeenAt) })

/**
 * @param {Executor} db
 * @param {{ q?: string, role?: string, status?: string, sort?: string, page: number, size: number }} f
 */
export async function listUsers(db, { q, role, status, sort, page, size }) {
  const escape = (/** @type {string} */ s) => s.replace(/[\\%_]/g, '\\$&')
  const where = and(
    q ? or(like(staffUsers.name, `%${escape(q)}%`), like(staffUsers.email, `%${escape(q.toLowerCase())}%`)) : undefined,
    role ? eq(staffUsers.role, role) : undefined,
    status ? eq(staffUsers.status, status) : undefined,
  )
  const order = sorts[/** @type {keyof typeof sorts} */ (sort ?? 'name')] ?? sorts.name
  const items = await db.select().from(staffUsers).where(where).orderBy(order, asc(staffUsers.id)).limit(size).offset((page - 1) * size)
  const [total] = await db.select({ n: count() }).from(staffUsers).where(where)
  return { items, total: total?.n ?? 0 }
}

// ---- sessions
export const insertSession = (/** @type {Executor} */ db, /** @type {typeof sessions.$inferInsert} */ row) => db.insert(sessions).values(row)
export const findSession = (/** @type {Executor} */ db, /** @type {string} */ idHash) => db.select().from(sessions).where(eq(sessions.idHash, idHash)).then((r) => r[0])
export const touchSession = (/** @type {Executor} */ db, /** @type {string} */ idHash, /** @type {{ lastSeenAt: Date, expiresAt: Date }} */ patch) => db.update(sessions).set(patch).where(eq(sessions.idHash, idHash))
export const markSessionAuth = (/** @type {Executor} */ db, /** @type {string} */ idHash, /** @type {Date} */ at) => db.update(sessions).set({ lastAuthAt: at }).where(eq(sessions.idHash, idHash))
export const setSessionKind = (/** @type {Executor} */ db, /** @type {string} */ idHash, /** @type {Partial<typeof sessions.$inferInsert>} */ patch) => db.update(sessions).set(patch).where(eq(sessions.idHash, idHash))
export const deleteSession = (/** @type {Executor} */ db, /** @type {string} */ idHash) => db.delete(sessions).where(eq(sessions.idHash, idHash))
/** Ends all of a user's sessions, optionally keeping one. */
export const deleteUserSessions = (/** @type {Executor} */ db, /** @type {string} */ userId, /** @type {string} */ exceptHash = '') =>
  db.delete(sessions).where(and(eq(sessions.staffUserId, userId), exceptHash ? ne(sessions.idHash, exceptHash) : undefined))
export const listUserSessions = (/** @type {Executor} */ db, /** @type {string} */ userId, /** @type {Date} */ at) =>
  db.select().from(sessions).where(and(eq(sessions.staffUserId, userId), eq(sessions.kind, 'full'), gt(sessions.expiresAt, at))).orderBy(desc(sessions.lastSeenAt))
/** Deletes by the public id: the first 16 hex of the stored hash, scoped to the owner so nobody can reach another user's session. */
export const deleteSessionByPublicId = (/** @type {Executor} */ db, /** @type {string} */ userId, /** @type {string} */ publicId) =>
  db.delete(sessions).where(and(eq(sessions.staffUserId, userId), like(sessions.idHash, `${publicId}%`)))
export const deleteExpiredSessions = (/** @type {Executor} */ db, /** @type {Date} */ at) => db.delete(sessions).where(lt(sessions.expiresAt, at))

// ---- invite and reset tokens
export const insertToken = (/** @type {Executor} */ db, /** @type {typeof authTokens.$inferInsert} */ row) => db.insert(authTokens).values(row)
export const findToken = (/** @type {Executor} */ db, /** @type {string} */ tokenHash) => db.select().from(authTokens).where(eq(authTokens.tokenHash, tokenHash)).then((r) => r[0])
export const markTokenUsed = (/** @type {Executor} */ db, /** @type {string} */ tokenHash, /** @type {Date} */ at) => db.update(authTokens).set({ usedAt: at }).where(and(eq(authTokens.tokenHash, tokenHash), isNull(authTokens.usedAt)))
/** Issuing a new token of a type removes that user's earlier unused ones. */
export const deleteUnusedTokens = (/** @type {Executor} */ db, /** @type {string} */ userId, /** @type {string} */ type) =>
  db.delete(authTokens).where(and(eq(authTokens.staffUserId, userId), eq(authTokens.type, type), isNull(authTokens.usedAt)))
export const latestInvite = (/** @type {Executor} */ db, /** @type {string[]} */ userIds) =>
  userIds.length === 0 ? Promise.resolve([]) : db.select().from(authTokens).where(and(inArray(authTokens.staffUserId, userIds), eq(authTokens.type, 'invite'), isNull(authTokens.usedAt)))

// ---- recovery codes
export const unusedRecoveryCodes = (/** @type {Executor} */ db, /** @type {string} */ userId) => db.select().from(recoveryCodes).where(and(eq(recoveryCodes.staffUserId, userId), isNull(recoveryCodes.usedAt)))
export const markRecoveryUsed = (/** @type {Executor} */ db, /** @type {string} */ id, /** @type {Date} */ at) => db.update(recoveryCodes).set({ usedAt: at }).where(and(eq(recoveryCodes.id, id), isNull(recoveryCodes.usedAt)))
export const deleteRecoveryCodes = (/** @type {Executor} */ db, /** @type {string} */ userId) => db.delete(recoveryCodes).where(eq(recoveryCodes.staffUserId, userId))
export const insertRecoveryCodes = (/** @type {Executor} */ db, /** @type {(typeof recoveryCodes.$inferInsert)[]} */ rows) => db.insert(recoveryCodes).values(rows)

// ---- login attempts
export const insertAttempt = (/** @type {Executor} */ db, /** @type {typeof loginAttempts.$inferInsert} */ row) => db.insert(loginAttempts).values(row)
/** Failed attempts for an email (hash) or an IP since `since`. */
export async function countFailures(/** @type {Executor} */ db, /** @type {{ emailHash?: string, ip?: string, since: Date }} */ { emailHash, ip, since }) {
  const [row] = await db
    .select({ n: count() })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.succeeded, false), gt(loginAttempts.createdAt, since), emailHash ? eq(loginAttempts.emailHash, emailHash) : undefined, ip ? eq(loginAttempts.ip, ip) : undefined))
  return row?.n ?? 0
}
/** Oldest failed attempt in the window: when it falls out, the block lifts. */
export const oldestFailure = (/** @type {Executor} */ db, /** @type {{ emailHash?: string, ip?: string, since: Date }} */ { emailHash, ip, since }) =>
  db
    .select({ at: loginAttempts.createdAt })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.succeeded, false), gt(loginAttempts.createdAt, since), emailHash ? eq(loginAttempts.emailHash, emailHash) : undefined, ip ? eq(loginAttempts.ip, ip) : undefined))
    .orderBy(asc(loginAttempts.createdAt))
    .limit(1)
    .then((r) => r[0]?.at)
/** Forgets the failed attempts for an email: an owner clearing a lock gives that person a clean slate. */
export const deleteAttemptsForEmail = (/** @type {Executor} */ db, /** @type {string} */ emailHash) => db.delete(loginAttempts).where(eq(loginAttempts.emailHash, emailHash))
export const deleteOldAttempts = (/** @type {Executor} */ db, /** @type {Date} */ before) => db.delete(loginAttempts).where(lt(loginAttempts.createdAt, before))

