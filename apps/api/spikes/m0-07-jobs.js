// M0-07 / M0-API-SPIKE-2 (plan/08-backend-architecture.md sections 9 and 15): the jobs table as a queue.
//   pnpm --filter @noor/api spike:jobs
// 1,000 jobs, two worker processes, none runs twice; a crashed worker's jobs are taken over; a duplicate unique_key leaves one row.
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import { createDatabase } from '../src/platform/db.js'
import { enqueue } from '../src/platform/jobs.js'
import { jobs } from '../src/db/schema/platform.js'
import { resetSpikeDatabase } from './setup.js'
import { spikeRuns } from './spike-schema.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const worker = (/** @type {string[]} */ args, /** @type {Record<string, string>} */ env = {}) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, ['--env-file-if-exists=.env', path.join(here, 'jobs-worker.js'), ...args], { cwd: path.resolve(here, '..'), env: { ...process.env, ...env }, stdio: ['ignore', 'inherit', 'inherit'] })
    child.on('exit', (code) => resolve(code))
  })

const urls = await resetSpikeDatabase()
const { pool, db } = createDatabase(urls.app, 5)
const count = async (/** @type {import('drizzle-orm/mysql-core').AnyMySqlTable} */ table) => {
  const [row] = await db.select({ n: sql`COUNT(*)`.mapWith(Number) }).from(table)
  return row?.n ?? 0
}
/** @type {string[]} */
const lines = []
let failed = false
const report = (/** @type {string} */ name, /** @type {boolean} */ ok, /** @type {string} */ detail = '') => {
  failed ||= !ok
  lines.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

// 1. dedupe on unique_key
await enqueue(db, { type: 'x', payload: {}, uniqueKey: 'same' })
await enqueue(db, { type: 'x', payload: {}, uniqueKey: 'same' })
report('two jobs with one unique_key leave one row', (await count(jobs)) === 1)
await db.delete(jobs)

// 2. 1,000 jobs, two workers
const started = Date.now()
for (let i = 0; i < 1000; i += 100) await Promise.all(Array.from({ length: 100 }, (_, j) => enqueue(db, { type: 'spike', payload: { n: i + j }, uniqueKey: `job-${i + j}` })))
report('1,000 jobs enqueued', (await count(jobs)) === 1000)
const codes = await Promise.all([worker(['A']), worker(['B'])])
const ran = await count(spikeRuns)
const left = await count(jobs)
const perWorker = await db.select({ worker: spikeRuns.worker, n: sql`COUNT(*)`.mapWith(Number) }).from(spikeRuns).groupBy(spikeRuns.worker)
report('both workers exited cleanly (a double run would have violated the primary key)', codes.every((c) => c === 0), `exit codes ${codes.join(',')}`)
report('every job ran exactly once and the queue is empty', ran === 1000 && left === 0, `ran ${ran}, left ${left}, ${perWorker.map((p) => `${p.worker}=${p.n}`).join(' ')}, ${Date.now() - started} ms`)

// 3. crash recovery: a worker claims 10 jobs and dies; after the lock timeout another worker takes them over
await db.delete(spikeRuns)
for (let i = 0; i < 25; i++) await enqueue(db, { type: 'spike', payload: { n: i }, uniqueKey: `crash-${i}` })
await worker(['C', '--crash-after-claim'])
const [lockedRow] = await db.select({ locked: sql`COUNT(*)`.mapWith(Number) }).from(jobs).where(sql`${jobs.lockedAt} IS NOT NULL`)
const locked = lockedRow?.locked ?? 0
report('a crashed worker leaves its jobs locked', locked === 10, `${locked} locked`)
await worker(['D'], { SPIKE_LOCK_TIMEOUT_MS: '600000' })
const stuck = await count(jobs)
report('before the timeout the locked jobs are not taken over', stuck === 10, `${stuck} still in the table`)
await new Promise((r) => setTimeout(r, 2500))
await worker(['E'], { SPIKE_LOCK_TIMEOUT_MS: '2000' })
report('after the timeout another worker runs them, none twice', (await count(jobs)) === 0 && (await count(spikeRuns)) === 25, `ran ${await count(spikeRuns)} of 25`)

await pool.end()
console.log(lines.join('\n'))
process.exit(failed ? 1 : 0)
