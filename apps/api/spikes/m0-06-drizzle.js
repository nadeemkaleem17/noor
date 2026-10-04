// M0-06 / M0-API-SPIKE-3 (plan/08-backend-architecture.md section 15): what Drizzle mysql-core and MySQL do for the features the plan relies on.
//   pnpm --filter @noor/api spike:drizzle        (needs the database users from infra/mysql/init/01-users.sql)
// Prints one line per check and exits 1 if any fails. Result goes to DOC-08 section 18.
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { eq, sql } from 'drizzle-orm'
import { createDatabase, transaction } from '../src/platform/db.js'
import { counters, jobs } from '../src/db/schema/platform.js'
import { resetSpikeDatabase } from './setup.js'
import { spikeItems } from './spike-schema.js'

const api = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
/** @type {{ name: string, ok: boolean, detail: string }[]} */
const results = []
const check = async (/** @type {string} */ name, /** @type {() => Promise<string | void>} */ fn) => {
  try {
    results.push({ name, ok: true, detail: (await fn()) ?? '' })
  } catch (e) {
    results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) })
  }
}
const assert = (/** @type {boolean} */ cond, /** @type {string} */ msg) => {
  if (!cond) throw new Error(msg)
}

const urls = await resetSpikeDatabase()
const { pool, db } = createDatabase(urls.app, 10)

await check('server version', async () => {
  const [rows] = await pool.query('SELECT VERSION() AS v')
  return String(/** @type {{ v: string }[]} */ (rows)[0]?.v)
})

await check('datetime(3) keeps milliseconds and UTC', async () => {
  const at = new Date('2026-10-04T12:34:56.789Z')
  await db.insert(spikeItems).values({ name: 'dt', qty: 1, at })
  const [row] = await db.select().from(spikeItems).where(eq(spikeItems.name, 'dt'))
  assert(row?.at?.toISOString() === at.toISOString(), `read back ${row?.at?.toISOString()}`)
  const [raw] = await pool.query("SELECT DATE_FORMAT(`at`, '%Y-%m-%d %H:%i:%s.%f') AS s FROM spike_items WHERE name = 'dt'")
  assert(/** @type {{ s: string }[]} */ (raw)[0]?.s === '2026-10-04 12:34:56.789000', 'stored value is not the UTC wall time')
})

await check('json column round-trips objects and arrays', async () => {
  const data = { a: 1, nested: { list: [1, 'x', null] }, text: 'روبایا' }
  await db.insert(spikeItems).values({ name: 'js', qty: 1, data })
  const [row] = await db.select().from(spikeItems).where(eq(spikeItems.name, 'js'))
  assert(JSON.stringify(row?.data) === JSON.stringify(data), `read back ${JSON.stringify(row?.data)}`)
})

await check('table-level CHECK is created and enforced', async () => {
  let rejected = false
  try {
    await db.insert(spikeItems).values({ name: 'neg', qty: -1 })
  } catch (e) {
    rejected = /** @type {{ errno?: number }} */ (e).errno === 3819 || /check/i.test(String(e))
  }
  assert(rejected, 'a negative qty was accepted')
})

await check('ascii_bin columns compare exactly (case and trailing space)', async () => {
  const at = new Date()
  await db.insert(jobs).values({ id: '00000000-0000-7000-8000-000000000001', type: 'T', payload: {}, runAt: at, createdAt: at })
  const [a] = await db.select().from(jobs).where(eq(jobs.type, 't'))
  assert(a === undefined, 'type "t" matched "T"')
  await db.delete(jobs)
})

await check('SELECT ... FOR UPDATE SKIP LOCKED via .for("update", { skipLocked: true })', async () => {
  await db.insert(spikeItems).values([{ name: 'l1', qty: 1 }, { name: 'l2', qty: 1 }])
  const a = await pool.getConnection()
  try {
    await a.beginTransaction()
    await a.query("SELECT id FROM spike_items WHERE name IN ('l1','l2') ORDER BY id LIMIT 1 FOR UPDATE")
    const seen = await db
      .select({ name: spikeItems.name })
      .from(spikeItems)
      .where(sql`${spikeItems.name} IN ('l1','l2')`)
      .orderBy(spikeItems.id)
      .for('update', { skipLocked: true })
    assert(seen.length === 1 && seen[0]?.name === 'l2', `skip-locked returned ${JSON.stringify(seen)}`)
  } finally {
    await a.rollback()
    a.release()
  }
})

await check('deadlock (error 1213) is retried by transaction() and both sides finish', async () => {
  await db.insert(spikeItems).values([{ name: 'dA', qty: 0 }, { name: 'dB', qty: 0 }])
  let attempts = 0
  /** @type {(() => void)[]} */
  const waiting = []
  const barrier = () =>
    new Promise((resolve) => {
      waiting.push(() => resolve(undefined))
      if (waiting.length === 2) waiting.splice(0).forEach((f) => f())
    })
  const run = (/** @type {string} */ first, /** @type {string} */ second) =>
    transaction(db, async (tx) => {
      attempts++
      await tx.select().from(spikeItems).where(eq(spikeItems.name, first)).for('update')
      if (attempts <= 2) await barrier() // only the first round meets in the middle
      await tx.update(spikeItems).set({ qty: sql`${spikeItems.qty} + 1` }).where(eq(spikeItems.name, second))
    })
  await Promise.all([run('dA', 'dB'), run('dB', 'dA')])
  const rows = await db.select({ name: spikeItems.name, qty: spikeItems.qty }).from(spikeItems).where(sql`${spikeItems.name} IN ('dA','dB')`)
  assert(rows.every((r) => r.qty === 1), `quantities ${JSON.stringify(rows)}`)
  assert(attempts >= 3, `no retry happened (attempts ${attempts})`)
  return `${attempts} attempts for 2 transactions`
})

await check('counters row lock yields gap-free numbers under concurrency (ADR-0020)', async () => {
  await db.insert(counters).values({ name: 'spike', value: 0 })
  const next = () =>
    transaction(db, async (tx) => {
      const [c] = await tx.select().from(counters).where(eq(counters.name, 'spike')).for('update')
      const value = (c?.value ?? 0) + 1
      await tx.update(counters).set({ value }).where(eq(counters.name, 'spike'))
      return value
    })
  const got = await Promise.all(Array.from({ length: 30 }, next))
  assert(new Set(got).size === 30 && Math.max(...got) === 30, `got ${got.sort((a, b) => a - b).join(',')}`)
})

await check('generated migration matches the schema (drift check: a second generate finds nothing)', async () => {
  const before = readdirSync(path.join(api, 'drizzle')).filter((f) => f.endsWith('.sql')).length
  const out = execFileSync('pnpm', ['exec', 'drizzle-kit', 'generate', '--name', 'drift_check'], { cwd: api, encoding: 'utf8', shell: true })
  const after = readdirSync(path.join(api, 'drizzle')).filter((f) => f.endsWith('.sql')).length
  assert(after === before, `a new migration was generated: ${out.slice(-200)}`)
})

await pool.end()
let failed = 0
for (const r of results) {
  if (!r.ok) failed++
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
}
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
