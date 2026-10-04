// The jobs table as a queue (plan/08-backend-architecture.md section 9.1, ADR-0009). MySQL 8 `SKIP LOCKED` lets several workers
// claim without waiting for each other. Times come from the caller (the app clock), never from NOW().
import { and, eq, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { jobs, jobsDead } from '../db/schema/platform.js'
import { now as clockNow } from './clock.js'
import { transaction } from './db.js'
import { uuidv7 } from './ids.js'

export const LOCK_TIMEOUT_MS = 10 * 60_000
export const BATCH = 10

/**
 * Adds a job. A second job with the same `uniqueKey` is ignored, so relays and schedulers can enqueue twice safely.
 * Pass the caller's transaction as `db` to enqueue atomically with the change that needs it.
 * @param {import('./db.js').Executor} db
 * @param {{ type: string, payload: unknown, uniqueKey?: string, runAt?: Date, maxAttempts?: number }} job
 * @param {Date} [now]
 * @returns {Promise<string>} the new job's id
 */
export async function enqueue(db, { type, payload, uniqueKey, runAt, maxAttempts }, now = clockNow()) {
  const id = uuidv7()
  await db
    .insert(jobs)
    .values({ id, type, payload, uniqueKey: uniqueKey ?? null, runAt: runAt ?? now, maxAttempts: maxAttempts ?? 8, createdAt: now })
    .onDuplicateKeyUpdate({ set: { id: sql`id` } }) // no-op: keeps the existing row
  return id
}

/**
 * Locks up to `limit` due jobs for `workerId`. A lock older than `lockTimeoutMs` belongs to a crashed worker and is taken over.
 * @param {import('./db.js').Database['db']} db
 * @param {string} workerId
 * @param {{ now?: Date, limit?: number, lockTimeoutMs?: number }} [opts]
 */
export function claim(db, workerId, { now = clockNow(), limit = BATCH, lockTimeoutMs = LOCK_TIMEOUT_MS } = {}) {
  const stale = new Date(now.getTime() - lockTimeoutMs)
  return transaction(db, async (tx) => {
    const due = await tx
      .select({ id: jobs.id, type: jobs.type, payload: jobs.payload, attempts: jobs.attempts, maxAttempts: jobs.maxAttempts })
      .from(jobs)
      .where(and(lte(jobs.runAt, now), or(isNull(jobs.lockedAt), lt(jobs.lockedAt, stale))))
      .orderBy(jobs.runAt, jobs.id)
      .limit(limit)
      .for('update', { skipLocked: true })
    if (due.length === 0) return []
    await tx
      .update(jobs)
      .set({ lockedAt: now, lockedBy: workerId, attempts: sql`${jobs.attempts} + 1` })
      .where(inArray(jobs.id, due.map((j) => j.id)))
    return due.map((j) => ({ ...j, attempts: j.attempts + 1 }))
  }, { isolationLevel: 'read committed' }) // REPEATABLE READ would keep a lock on every row the scan passed, starving other workers
}

/** Success: the row is deleted. */
export const complete = (/** @type {import('./db.js').Executor} */ db, /** @type {string} */ id) => db.delete(jobs).where(eq(jobs.id, id))

/** Seconds to wait before attempt number `attempts + 1`: 2^attempts x 15 s, at most one hour. */
export const backoffMs = (/** @type {number} */ attempts) => Math.min(2 ** attempts * 15_000, 3_600_000)

/**
 * Failure: retry later with backoff, or move to `jobs_dead` when attempts are used up. Only the error message is stored.
 * @param {import('./db.js').Database['db']} db
 * @param {{ id: string, attempts: number, maxAttempts: number }} job
 * @param {unknown} error
 * @param {Date} [now]
 * @returns {Promise<'retry' | 'dead'>}
 */
export async function fail(db, job, error, now = clockNow()) {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 500)
  return transaction(db, async (tx) => {
    if (job.attempts < job.maxAttempts) {
      await tx.update(jobs).set({ runAt: new Date(now.getTime() + backoffMs(job.attempts)), lastError: message, lockedAt: null, lockedBy: null }).where(eq(jobs.id, job.id))
      return 'retry'
    }
    const [row] = await tx.select().from(jobs).where(eq(jobs.id, job.id)).for('update')
    if (row) {
      await tx.insert(jobsDead).values({
        id: row.id, type: row.type, payload: row.payload, uniqueKey: row.uniqueKey, runAt: row.runAt,
        attempts: row.attempts, maxAttempts: row.maxAttempts, lastError: message, createdAt: row.createdAt, diedAt: now,
      })
      await tx.delete(jobs).where(eq(jobs.id, job.id))
    }
    return 'dead'
  })
}
