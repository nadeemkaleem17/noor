// Database access: one pooled mysql2 connection set wrapped by Drizzle (plan/08-backend-architecture.md section 7, ADR-0008).
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'

/**
 * @typedef {ReturnType<typeof createDatabase>} Database
 */

/**
 * `datetime(3)` columns are UTC (ADR-0008), so the driver must not shift them into the server's zone.
 * @param {string} url
 * @param {number} poolSize
 */
export function createDatabase(url, poolSize) {
  const pool = mysql.createPool({ uri: url, connectionLimit: poolSize, timezone: 'Z', supportBigNumbers: true, bigNumberStrings: false, charset: 'utf8mb4' })
  return { pool, db: drizzle(pool, { mode: 'default' }) }
}

/**
 * @param {import('./config.js').Config} config
 */
export const createAppDatabase = (config) => createDatabase(config.DATABASE_URL, config.DB_POOL_SIZE)

/**
 * MySQL 1213 (deadlock) and 1205 (lock wait timeout): the whole transaction can be run again.
 * @param {unknown} error
 * @returns {boolean}
 */
export function isRetryable(error) {
  const e = /** @type {{ errno?: number; code?: string; cause?: unknown } | null} */ (error)
  // Drizzle wraps the driver error in a DrizzleQueryError and keeps the original as `cause`
  if (e?.cause && isRetryable(e.cause)) return true
  return e?.errno === 1213 || e?.errno === 1205 || e?.code === 'ER_LOCK_DEADLOCK' || e?.code === 'ER_LOCK_WAIT_TIMEOUT'
}

/**
 * @param {number} min
 * @param {number} max
 */
const jitter = (min, max) => min + Math.random() * (max - min)

/**
 * Runs `fn` again when MySQL aborts it for a deadlock or a lock timeout, up to `attempts` times with 20-100 ms of jitter.
 * `fn` must be safe to run twice: no external call inside (DOC-08 section 7).
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withRetry(fn, { attempts = 3, sleep = /** @param {number} ms */ (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt >= attempts || !isRetryable(error)) throw error
      await sleep(jitter(20, 100))
    }
  }
}

/**
 * A service opens a transaction with this, never with `db.transaction` directly.
 * @template T
 * @param {Database['db']} db
 * @param {Parameters<Database['db']['transaction']>[0] extends (tx: infer Tx) => Promise<infer _R> ? (tx: Tx) => Promise<T> : never} fn
 */
export const transaction = (db, fn) =>
  withRetry(() => db.transaction(fn))

/**
 * `/readyz`: the database answers a trivial query.
 * @param {Database['pool']} pool
 * @returns {import('../app.js').Readiness}
 */
export const databaseReadiness =
  (pool) =>
  async () => {
    try {
      await pool.query('SELECT 1')
      return []
    } catch {
      return ['database']
    }
  }
