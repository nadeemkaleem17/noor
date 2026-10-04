// Assembles the handlers of every module. Each module exports its handlers; this is the only place that lists modules.
import { auditHandlers } from './audit/index.js'
import { authHandlers } from './auth/index.js'
import { platformSchedule } from '../platform/scheduler.js'
import { createStorage } from '../platform/storage.js'
import { createMediaService, mediaHandlers, mediaJobs } from './media/index.js'
import { settingsHandlers } from './settings/routes.js'
import { shippingHandlers } from './shipping/routes.js'

// ponytail: admin.system.info grows with the job queue numbers (M1-01 added the tables).
/**
 * @param {import('../platform/config.js').Config} config
 * @param {{ auth: ReturnType<import('./auth/index.js').createAuthService>, audit: ReturnType<import('./audit/index.js').createAuditService>, media: ReturnType<import('./media/index.js').createMediaService>, settings: ReturnType<import('./settings/index.js').createSettingsService>, shipping: ReturnType<import('./shipping/index.js').createShippingService> }} deps
 * @returns {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>}
 */
export const appHandlers = (config, { auth, audit, media, settings, shipping }) => ({
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (authHandlers(auth, config))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (auditHandlers(audit))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (mediaHandlers(media))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (settingsHandlers(settings))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (shippingHandlers(shipping))),
  'admin.system.info': async () => ({ environment: config.APP_ENV, version: config.APP_VERSION, queue: { pending: 0, dead: 0 } }),
})

/**
 * What the background process runs: job handlers and scheduled jobs of every module. The API (with DEV_INLINE_WORKER) and src/worker.js both start from this.
 * @param {{ db: import('../platform/db.js').Database['db'], config: import('../platform/config.js').Config, storage?: import('../platform/storage.js').Storage }} deps
 */
export function backgroundOf({ db, config, storage = createStorage(config) }) {
  return {
    handlers: { ...mediaJobs(createMediaService({ db, config, storage })) },
    schedule: [...platformSchedule, { type: 'media.cleanup', cron: '0 22 * * *' }], // daily, 03:00 PKT
  }
}
