// The job runner (DOC-08 section 9.1): claims due jobs, runs each handler with a time limit, deletes on success, backs off on failure,
// dead-letters when attempts run out. Polls every second while there is work and every 5 s when idle. Stops gracefully.
import { claim, complete, fail } from './jobs.js'
import { now } from './clock.js'

export const HANDLER_TIMEOUT_MS = 60_000

/**
 * @typedef {object} JobContext
 * @property {{ id: string, type: string, payload: any, attempts: number, maxAttempts: number }} job
 * @property {AbortSignal} signal aborted when the handler runs past its time limit
 */

/** @typedef {Record<string, (ctx: JobContext) => Promise<void>>} JobHandlers */

/**
 * @param {object} opts
 * @param {import('./db.js').Database['db']} opts.db
 * @param {JobHandlers} opts.handlers job type -> handler. Handlers must tolerate running twice.
 * @param {string} [opts.workerId] shown in `jobs.locked_by`
 * @param {number} [opts.concurrency] jobs at a time
 * @param {number} [opts.busyMs] poll interval while there is work
 * @param {number} [opts.idleMs] poll interval when idle
 * @param {number} [opts.lockTimeoutMs] age after which another worker may take a locked job
 * @param {Record<string, number>} [opts.timeoutsMs] per job type handler limit (default 60 s; exports 10 min)
 * @param {(job: { id: string, type: string }, error: unknown) => void | Promise<void>} [opts.onDead] called after a job moved to jobs_dead (audit entry `job_failed`)
 * @param {{ error: (o: object, msg: string) => void }} [opts.log]
 */
export function createWorker({ db, handlers, workerId = `worker:${process.pid}`, concurrency = 5, busyMs = 1000, idleMs = 5000, lockTimeoutMs, timeoutsMs = {}, onDead, log }) {
  let stopping = false
  let running = 0
  /** @type {Promise<void> | null} */
  let loop = null
  /** @type {(() => void) | null} */
  let wake = null
  /** @type {Set<Promise<void>>} */
  const inFlight = new Set()

  /** @param {{ id: string, type: string, payload: any, attempts: number, maxAttempts: number }} job */
  async function run(job) {
    const handler = handlers[job.type]
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutsMs[job.type] ?? HANDLER_TIMEOUT_MS)
    try {
      if (!handler) throw new Error(`no handler for job type "${job.type}"`)
      await Promise.race([
        handler({ job, signal: controller.signal }),
        new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('handler timed out')))),
      ])
      await complete(db, job.id)
    } catch (error) {
      log?.error({ jobId: job.id, type: job.type, attempts: job.attempts, err: error instanceof Error ? error.message : String(error) }, 'job failed')
      const outcome = await fail(db, job, error, now())
      if (outcome === 'dead') await onDead?.({ id: job.id, type: job.type }, error)
    } finally {
      clearTimeout(timer)
    }
  }

  /** @param {number} ms */
  const sleep = (ms) =>
    new Promise((resolve) => {
      const t = setTimeout(resolve, ms)
      wake = () => {
        clearTimeout(t)
        resolve(undefined)
      }
    })

  async function main() {
    while (!stopping) {
      let took = 0
      if (running < concurrency) {
        try {
          const batch = await claim(db, workerId, { limit: concurrency - running, ...(lockTimeoutMs ? { lockTimeoutMs } : {}), now: now() })
          took = batch.length
          for (const job of batch) {
            running++
            const p = run(job).finally(() => {
              running--
              inFlight.delete(p)
              wake?.()
            })
            inFlight.add(p)
          }
        } catch (error) {
          log?.error({ err: error instanceof Error ? error.message : String(error) }, 'job claim failed')
        }
      }
      if (!stopping) await sleep(took > 0 ? 0 : running > 0 ? busyMs : idleMs)
    }
  }

  return {
    workerId,
    start() {
      loop ??= main()
    },
    /** Looks for work now instead of at the next poll (used right after something enqueued a job in this process). */
    nudge() {
      wake?.()
    },
    /**
     * Stops claiming and waits for running jobs, up to `graceMs`. Jobs still running after that keep their lock and are taken over later.
     * @param {number} [graceMs]
     */
    async stop(graceMs = 30_000) {
      stopping = true
      wake?.()
      await loop
      await Promise.race([Promise.allSettled([...inFlight]), new Promise((r) => setTimeout(r, graceMs))])
    },
    get running() {
      return running
    },
  }
}
