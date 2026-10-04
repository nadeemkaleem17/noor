// A worker process for the M0-07 spike. Claims jobs, "runs" them by writing one row to spike_runs, deletes them.
//   node jobs-worker.js <name> [--crash-after-claim]
import { spikeUrls } from './setup.js'
import { claim, complete } from '../src/platform/jobs.js'
import { createDatabase } from '../src/platform/db.js'
import { spikeRuns } from './spike-schema.js'

const name = process.argv[2] ?? 'worker'
const crash = process.argv.includes('--crash-after-claim')
const lockTimeoutMs = Number(process.env.SPIKE_LOCK_TIMEOUT_MS ?? 600_000)
const { pool, db } = createDatabase(spikeUrls().app, 5)
const workerId = `${name}:${process.pid}`

let handled = 0
for (;;) {
  const batch = await claim(db, workerId, { lockTimeoutMs })
  if (batch.length === 0) break
  if (crash) {
    console.log(`${workerId} claimed ${batch.length} jobs and died`)
    process.exit(1) // locks stay in the table, as after a real crash
  }
  for (const job of batch) {
    await db.insert(spikeRuns).values({ jobId: job.id, worker: name }) // a second run of the same job violates the primary key
    await complete(db, job.id)
    handled++
  }
}
await pool.end()
console.log(`${workerId} done, ran ${handled}`)
