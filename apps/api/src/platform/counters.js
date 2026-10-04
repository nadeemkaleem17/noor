// Gap-free numbers (order numbers, invoice numbers) from the `counters` table (ADR-0020 section 6, DOC-09.1 section 2.4).
// The increment is a row update inside the caller's transaction, so a rolled-back order gives its number back, and two orders can
// never get the same one. Take counters LAST in the lock order (variants first).
import { sql } from 'drizzle-orm'
import { counters } from '../db/schema/platform.js'

/**
 * Creates the counter row if it does not exist (for example a new year's invoice counter).
 * @param {import('./db.js').Executor} tx
 * @param {string} name
 * @param {number} [initial] the "last issued" value to start from
 */
export async function ensureCounter(tx, name, initial = 0) {
  await tx.insert(counters).values({ name, value: initial }).onDuplicateKeyUpdate({ set: { value: sql`${counters.value}` } })
}

/**
 * The next number. Must run inside a transaction (`tx`), and the counter row must exist (`ensureCounter`).
 * @param {import('./db.js').Transaction} tx a transaction, not the pool: LAST_INSERT_ID() is per connection
 * @param {string} name
 * @returns {Promise<number>}
 */
export async function nextValue(tx, name) {
  const [res] = /** @type {[{ affectedRows: number }, unknown]} */ (/** @type {unknown} */ (await tx.execute(sql`UPDATE counters SET value = LAST_INSERT_ID(value + 1) WHERE name = ${name}`)))
  if (res.affectedRows !== 1) throw new Error(`counter "${name}" does not exist`)
  const [rows] = /** @type {[{ n: string | number }[], unknown]} */ (/** @type {unknown} */ (await tx.execute(sql`SELECT LAST_INSERT_ID() AS n`)))
  return Number(rows[0]?.n)
}
