// Starts the background side of the API: the outbox relay (every second), the scheduler (checks every 10 s, enqueues once a minute)
// and the job worker. Runs inside the API process when DEV_INLINE_WORKER is on (local), otherwise in `src/worker.js` (DOC-08 section 3).
import { now } from './clock.js'
import { cleanupIdempotency } from './idempotency.js'
import { cleanupOutbox, relayOnce } from './outbox.js'
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
 */
export function startBackground({ db, handlers, eventHandlers, schedule = platformSchedule, onDead, log, relayMs = 1000 }) {
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
  const relayTimer = setInterval(relay, relayMs)
  const schedulerTimer = setInterval(tick, 10_000)
  void tick()

  return {
    worker,
    async stop() {
      clearInterval(relayTimer)
      clearInterval(schedulerTimer)
      await worker.stop()
    },
  }
}
