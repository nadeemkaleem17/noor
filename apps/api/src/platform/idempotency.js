// Idempotency for commands a client may retry (ADR-0020, DOC-09.1 section 2.5, DOC-10.0 section 8).
// The key row is written in its own short transaction BEFORE the command, so a rolled-back command is still remembered as attempted.
import { createHash } from 'node:crypto'
import { and, eq, lt } from 'drizzle-orm'
import { idempotencyKeys } from '../db/schema/platform.js'
import { now } from './clock.js'
import { transaction } from './db.js'
import { DomainError } from './errors.js'
import { errorStatus } from '@noor/contract'

export const KEY_TTL_MS = 24 * 3_600_000
export const IN_PROGRESS_MS = 30_000

/** JSON with sorted keys, so the same body hashes the same whatever the client's key order. @param {unknown} value @returns {string} */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const o = /** @type {Record<string, unknown>} */ (value)
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/** @param {unknown} body */
export const hashRequest = (body) => createHash('sha256').update(canonicalJson(body)).digest('hex')

/** @param {unknown} e */
const isDuplicateKey = (e) => {
  const x = /** @type {{ errno?: number, cause?: { errno?: number } } | null} */ (e)
  return x?.errno === 1062 || x?.cause?.errno === 1062
}

/**
 * Runs `command` at most once per (scope, key) within 24 hours.
 *  - first call: runs the command, stores its response (success or a domain error) and returns it
 *  - same key and same body again: replays the stored response without running anything
 *  - same key, different body: 422 `idempotency_mismatch`
 *  - same key while the first call is still running (under 30 s): 409 `request_in_progress`; older: the first call is treated as crashed and this one takes over
 * `command(tx)` runs in a transaction and must return `{ status, body }`; its response is saved in the same transaction.
 * @template T
 * @param {import('./db.js').Database['db']} db
 * @param {{ scope: string, key: string, body: unknown, command: (tx: import('./db.js').Executor) => Promise<{ status: number, body: T }> }} args
 * @returns {Promise<{ status: number, body: T, replayed: boolean }>}
 */
export async function withIdempotency(db, { scope, key, body, command }) {
  const requestHash = hashRequest(body)
  const at = now()
  try {
    await db.insert(idempotencyKeys).values({ scope, key, requestHash, status: 'in_progress', createdAt: at, expiresAt: new Date(at.getTime() + KEY_TTL_MS) })
  } catch (e) {
    if (!isDuplicateKey(e)) throw e
    const [row] = await db.select().from(idempotencyKeys).where(and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key)))
    if (!row) throw e // deleted between the insert and the read: let the client retry
    if (row.requestHash !== requestHash) throw new DomainError('idempotency_mismatch')
    if (row.status === 'done') {
      const stored = /** @type {{ error?: { code: import('@noor/contract').ErrorCode, details: Record<string, unknown> } } | null} */ (row.responseBody)
      if (stored?.error) throw new DomainError(stored.error.code, stored.error.details) // a stored domain error is replayed as the same error
      return { status: row.responseStatus ?? 200, body: /** @type {T} */ (row.responseBody), replayed: true }
    }
    if (at.getTime() - row.createdAt.getTime() < IN_PROGRESS_MS) throw new DomainError('request_in_progress')
    // crashed first attempt: take over by refreshing the claim; only one taker wins this conditional update
    const [res] = /** @type {[{ affectedRows: number }, unknown]} */ (/** @type {unknown} */ (await db.update(idempotencyKeys).set({ createdAt: at }).where(and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key), eq(idempotencyKeys.createdAt, row.createdAt), eq(idempotencyKeys.status, 'in_progress')))))
    if (res.affectedRows === 0) throw new DomainError('request_in_progress')
  }
  try {
    return await transaction(db, async (tx) => {
      const result = await command(tx)
      await tx
        .update(idempotencyKeys)
        .set({ status: 'done', responseStatus: result.status, responseBody: result.body })
        .where(and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key)))
      return { ...result, replayed: false }
    })
  } catch (e) {
    const where = and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key))
    if (e instanceof DomainError) {
      // the command rolled back; remember the refusal so a retry gets the same answer
      await db.update(idempotencyKeys).set({ status: 'done', responseStatus: errorStatus[e.code], responseBody: { error: { code: e.code, details: e.details } } }).where(where)
    } else {
      await db.delete(idempotencyKeys).where(where) // an unexpected failure is not an answer: let the client try again
    }
    throw e
  }
}

/** Deletes keys past their 24 h life (job `idempotency.cleanup`, hourly). @param {import('./db.js').Database['db']} db */
export async function cleanupIdempotency(db) {
  await db.delete(idempotencyKeys).where(lt(idempotencyKeys.expiresAt, now()))
}
