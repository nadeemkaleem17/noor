// How healthy the background side is, from what the database already knows: who has reported in lately and what has been waiting too long.
// The admin shows it as a banner when pictures, search updates or emails are waiting for nobody to do them. Reads only, safe to call every few seconds.
import { and, count, gt, isNull, lt, lte, min, or } from 'drizzle-orm'
import { jobs, jobsDead, workerHeartbeats } from '../db/schema/platform.js'
import { now as clockNow } from './clock.js'

/** A process that has not written a beat for this long is gone (it beats every `BEAT_MS`). */
export const ALIVE_MS = 30_000
export const BEAT_MS = 5_000
/** A job this far past its time is "overdue" (a fresh one is only waiting its turn). */
export const OVERDUE_MS = 60_000

/**
 * @typedef {object} QueueStatus
 * @property {'ok' | 'idle' | 'stalled' | 'down'} state
 *   ok: someone is working and nothing is late; idle: nobody has reported in but nothing is waiting; stalled: someone is working but a job has been
 *   waiting too long; down: nobody is working and something is waiting.
 * @property {number} workers processes that beat within the last 30 seconds
 * @property {number} waiting jobs not yet done (running ones included)
 * @property {number} overdue due for more than a minute and not held by a live process
 * @property {number} oldestOverdueSeconds
 * @property {number} dead jobs that gave up (jobs_dead)
 * @property {string[]} waitingTypes the kinds of work that are waiting, for the sentence ("pictures", "search")
 */

/**
 * @param {import('./db.js').Executor} db
 * @param {Date} [at]
 * @returns {Promise<QueueStatus>}
 */
export async function queueStatus(db, at = clockNow()) {
  const alive = new Date(at.getTime() - ALIVE_MS)
  const late = new Date(at.getTime() - OVERDUE_MS)
  const stale = new Date(at.getTime() - 10 * 60_000)
  const [[beats], [waiting], [overdue], [dead], types] = await Promise.all([
    db.select({ n: count() }).from(workerHeartbeats).where(gt(workerHeartbeats.beatAt, alive)),
    db.select({ n: count() }).from(jobs),
    db.select({ n: count(), oldest: min(jobs.runAt) }).from(jobs).where(and(lte(jobs.runAt, late), or(isNull(jobs.lockedAt), lt(jobs.lockedAt, stale)))),
    db.select({ n: count() }).from(jobsDead),
    db.select({ type: jobs.type }).from(jobs).groupBy(jobs.type).limit(20),
  ])
  const workers = beats?.n ?? 0
  const lateCount = overdue?.n ?? 0
  const waitingCount = waiting?.n ?? 0
  const oldest = overdue?.oldest ? Math.max(0, Math.round((at.getTime() - new Date(overdue.oldest).getTime()) / 1000)) : 0
  /** @type {QueueStatus['state']} */
  const state = workers === 0 ? (waitingCount > 0 ? 'down' : 'idle') : lateCount > 0 ? 'stalled' : 'ok'
  return { state, workers, waiting: waitingCount, overdue: lateCount, oldestOverdueSeconds: oldest, dead: dead?.n ?? 0, waitingTypes: types.map((t) => t.type) }
}

/**
 * Writes (or refreshes) this process's row. `done` and `failed` are the worker's running totals.
 * @param {import('./db.js').Executor} db
 * @param {{ workerId: string, mode: 'inline' | 'separate', startedAt: Date, done: number, failed: number }} beat
 * @param {Date} [at]
 */
export async function beat(db, { workerId, mode, startedAt, done, failed }, at = clockNow()) {
  await db
    .insert(workerHeartbeats)
    .values({ workerId, mode, startedAt, beatAt: at, jobsDone: done, jobsFailed: failed })
    .onDuplicateKeyUpdate({ set: { beatAt: at, jobsDone: done, jobsFailed: failed, mode, startedAt } })
}

/** Old rows of processes that stopped long ago are removed so the table stays small. @param {import('./db.js').Executor} db @param {Date} [at] */
export async function forgetOldBeats(db, at = clockNow()) {
  await db.delete(workerHeartbeats).where(lt(workerHeartbeats.beatAt, new Date(at.getTime() - 24 * 3_600_000)))
}

