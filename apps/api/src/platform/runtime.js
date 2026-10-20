// Starts the background side of the API: the outbox relay (every second), the scheduler (checks every 10 s, enqueues once a minute)
// and the job worker. Runs inside the API process when DEV_INLINE_WORKER is on (local), otherwise in `src/worker.js` (DOC-08 section 3).
import { eq } from 'drizzle-orm'
import { enqueue } from './jobs.js'
import { workerHeartbeats } from '../db/schema/platform.js'
import { now } from './clock.js'
import { cleanupIdempotency } from './idempotency.js'
import { cleanupOutbox, relayOnce } from './outbox.js'
import { beat, BEAT_MS, forgetOldBeats } from './queue-status.js'
import { cleanupRateLimits } from './rate-limit.js'
import { enqueueDue, platformSchedule } from './scheduler.js'
import { createWorker } from './worker.js'

/**
 * Handlers for the platform's own scheduled jobs.
 * @param {import('./db.js').Database['db']} db
 * @returns {import('./worker.js').JobHandlers}
 */
export const platformHandlers = (db) => ({
  'outbox.cleanup': async () => cleanupOutbox(db),
  'idempotency.cleanup': async () => {
    await cleanupIdempotency(db)
    await cleanupRateLimits(db)
  },
})

/**
 * @param {object} opts
 * @param {import('./db.js').Database['db']} opts.db
 * @param {import('./worker.js').JobHandlers} opts.handlers module handlers; the platform's are added
 * @param {import('./outbox.js').EventHandlers} opts.eventHandlers
 * @param {import('./scheduler.js').ScheduledJob[]} [opts.schedule]
 * @param {Parameters<typeof createWorker>[0]['onDead']} [opts.onDead]
 * @param {{ error: (o: object, msg: string) => void }} [opts.log]
 * @param {number} [opts.relayMs]
 * @param {string[]} [opts.startup] job types queued once when the process starts (at most one for each ten minutes, however many processes start): a self-check after a stop
 * @param {'inline' | 'separate'} [opts.mode] where this runs: inside the API process or in `src/worker.js`; shown in the heartbeat
 */
export function startBackground({ db, handlers, eventHandlers, schedule = platformSchedule, onDead, log, relayMs = 1000, mode = 'separate', startup = [] }) {
  const worker = createWorker({ db, handlers: { ...platformHandlers(db), ...handlers }, onDead, log })
  worker.start()

  const guard = (/** @type {string} */ what, /** @type {() => Promise<unknown>} */ fn) => async () => {
    try {
      await fn()
    } catch (error) {
      log?.error({ err: error instanceof Error ? error.message : String(error) }, `${what} failed`)
    }
  }
  const relay = guard('outbox relay', async () => {
    if ((await relayOnce(db, eventHandlers)) > 0) worker.nudge()
  })
  const tick = guard('scheduler', async () => {
    if ((await enqueueDue(db, schedule, now())).length > 0) worker.nudge()
  })
  const startedAt = now()
  // a row that says "I am here" every few seconds: the admin reads it to warn when nobody is working the queue
  const pulse = guard('heartbeat', async () => {
    await beat(db, { workerId: worker.workerId, mode, startedAt, ...worker.stats }, now())
  })
  const relayTimer = setInterval(relay, relayMs)
  const schedulerTimer = setInterval(tick, 10_000)
  const beatTimer = setInterval(pulse, BEAT_MS)
  void pulse()
  for (const type of startup) {
    void guard(`startup job ${type}`, () => enqueue(db, { type, payload: {}, uniqueKey: `${type}:startup:${Math.floor(now().getTime() / 600_000)}` }, now()))()
  }
  void guard('heartbeat cleanup', () => forgetOldBeats(db, now()))()
  void tick()

  return {
    worker,
    async stop() {
      clearInterval(relayTimer)
      clearInterval(schedulerTimer)
      clearInterval(beatTimer)
      await worker.stop()
      // a stopped process says so at once, instead of leaving the admin to wait out the thirty seconds
      await guard('heartbeat removal', async () => {
        await db.delete(workerHeartbeats).where(eq(workerHeartbeats.workerId, worker.workerId))
      })()
    },
  }
}
