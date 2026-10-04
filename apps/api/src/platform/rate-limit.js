// Database-backed rate-limit buckets (login, checkout, tracking, notify) that must hold across API instances (DOC-09.1 section 2.6,
// DOC-11 section 5.4). Fixed windows, one statement per hit. Subjects that are personal data are hashed before they get here.
import { createHash } from 'node:crypto'
import { and, eq, lt, sql } from 'drizzle-orm'
import { rateLimitHits } from '../db/schema/platform.js'
import { now } from './clock.js'

/**
 * Stable, non-reversible subject for a phone, email or order number: the first 16 hex digits of its SHA-256.
 * @param {string} value
 */
export const subjectHash = (value) => createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0, 16)

/**
 * Counts one hit and says whether it is within the limit.
 * @param {import('./db.js').Executor} db
 * @param {{ bucket: string, subject: string, limit: number, windowMs: number }} args `subject` like `ip:1.2.3.4` or `phone:<subjectHash>`
 * @returns {Promise<{ allowed: boolean, count: number, retryAfterSeconds: number }>}
 */
export async function hit(db, { bucket, subject, limit, windowMs }) {
  const at = now().getTime()
  const windowStart = new Date(Math.floor(at / windowMs) * windowMs)
  await db
    .insert(rateLimitHits)
    .values({ bucket, subject, windowStart, count: 1 })
    .onDuplicateKeyUpdate({ set: { count: sql`${rateLimitHits.count} + 1` } })
  const [row] = await db
    .select({ count: rateLimitHits.count })
    .from(rateLimitHits)
    .where(and(eq(rateLimitHits.bucket, bucket), eq(rateLimitHits.subject, subject), eq(rateLimitHits.windowStart, windowStart)))
  const count = row?.count ?? 1
  return { allowed: count <= limit, count, retryAfterSeconds: Math.max(1, Math.ceil((windowStart.getTime() + windowMs - at) / 1000)) }
}

/** Deletes windows older than a day (part of job `idempotency.cleanup`). @param {import('./db.js').Executor} db */
export async function cleanupRateLimits(db) {
  await db.delete(rateLimitHits).where(lt(rateLimitHits.windowStart, new Date(now().getTime() - 86_400_000)))
}
