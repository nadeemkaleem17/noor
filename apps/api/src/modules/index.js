// Assembles the handlers of every module. Each module exports its handlers; this is the only place that lists modules.
import { auditHandlers } from './audit/index.js'
import { authHandlers } from './auth/index.js'
import { platformSchedule } from '../platform/scheduler.js'
import { createStorage } from '../platform/storage.js'
import { catalogHandlers } from './catalog/routes.js'
import { createInventory, inventoryHandlers } from './inventory/index.js'
import { createCatalogService } from './catalog/index.js'
import { createMediaService, mediaHandlers, mediaJobs } from './media/index.js'
import { createSettingsService } from './settings/index.js'
import { settingsHandlers } from './settings/routes.js'
import { shippingHandlers } from './shipping/routes.js'

// ponytail: admin.system.info grows with the job queue numbers (M1-01 added the tables).
/**
 * @param {import('../platform/config.js').Config} config
 * @param {{ auth: ReturnType<import('./auth/index.js').createAuthService>, audit: ReturnType<import('./audit/index.js').createAuditService>, media: ReturnType<import('./media/index.js').createMediaService>, settings: ReturnType<import('./settings/index.js').createSettingsService>, shipping: ReturnType<import('./shipping/index.js').createShippingService>, catalog: ReturnType<import('./catalog/index.js').createCatalogService>, inventory: ReturnType<import('./inventory/index.js').createInventory> }} deps
 * @returns {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>}
 */
export const appHandlers = (config, { auth, audit, media, settings, shipping, catalog, inventory }) => ({
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (authHandlers(auth, config))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (auditHandlers(audit))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (mediaHandlers(media))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (settingsHandlers(settings))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (shippingHandlers(shipping))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (catalogHandlers(catalog))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (inventoryHandlers(inventory))),
  'admin.system.info': async () => ({ environment: config.APP_ENV, version: config.APP_VERSION, queue: { pending: 0, dead: 0 } }),
})

/**
 * What the background process runs: job handlers and scheduled jobs of every module. The API (with DEV_INLINE_WORKER) and src/worker.js both start from this.
 * @param {{ db: import('../platform/db.js').Database['db'], config: import('../platform/config.js').Config, storage?: import('../platform/storage.js').Storage, log?: { error: (o: object, msg: string) => void } }} deps
 */
export function backgroundOf({ db, config, storage = createStorage(config), log }) {
  const media = createMediaService({ db, config, storage })
  const settings = createSettingsService({ db, config, media })
  /** @type {ReturnType<typeof createCatalogService>} */
  let catalog
  const inventory = createInventory({ db, lowStockThreshold: () => settings.lowStock(), onChanged: (tx, ids) => catalog.products.recomputeMany(tx, ids) })
  catalog = createCatalogService({ db, config, media, stock: inventory.stock })
  return {
    handlers: {
      ...mediaJobs(media),
      'catalog.publish_scheduled': async () => void (await catalog.products.publishDue()),
      'inventory.expire_reservations': async () => void (await inventory.expireReservations()),
      'inventory.verify': async () => {
        const problems = await inventory.verify()
        for (const p of problems) log?.error(p, 'stock does not add up') // reported, never repaired (DOC-09.4 section 2.3)
      },
      'inventory.cleanup_subscriptions': async () => inventory.cleanupSubscriptions(),
    },
    schedule: [...platformSchedule, { type: 'media.cleanup', cron: '0 22 * * *' }, { type: 'catalog.publish_scheduled', cron: '* * * * *' }, { type: 'inventory.expire_reservations', cron: '*/5 * * * *' }, { type: 'inventory.verify', cron: '0 21 * * *' }, { type: 'inventory.cleanup_subscriptions', cron: '15 21 * * *' }], // media 03:00 PKT, scheduled products every minute, reservations every 5 minutes, stock check 02:00 PKT, subscriptions 02:15 PKT
  }
}
