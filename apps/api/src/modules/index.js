// Assembles the handlers of every module. Each module exports its handlers; this is the only place that lists modules.
import { auditHandlers } from './audit/index.js'
import { authHandlers } from './auth/index.js'
import { platformSchedule } from '../platform/scheduler.js'
import { catalogHandlers } from './catalog/routes.js'
import { inventoryHandlers } from './inventory/index.js'
import { mediaHandlers, mediaJobs } from './media/index.js'
import { searchEvents, searchHandlers, searchJobs } from './search/index.js'
import { createServices } from './services.js'
import { settingsHandlers } from './settings/routes.js'
import { cartHandlers } from './cart/routes.js'
import { customersHandlers } from './customers/routes.js'
import { visitsHandlers } from './visits/routes.js'
import { ordersHandlers } from './orders/routes.js'
import { notificationEvents, notificationJobs } from './notifications/index.js'
import { paymentJobs } from './payments/jobs.js'
import { promotionsHandlers } from './promotions/routes.js'
import { reportingHandlers, reportingJobs } from './reporting/index.js'
import { reviewsHandlers } from './reviews/index.js'
import { shippingHandlers } from './shipping/routes.js'

// ponytail: admin.system.info grows with the job queue numbers (M1-01 added the tables).
/**
 * @param {import('../platform/config.js').Config} config
 * @param {{ auth: ReturnType<import('./auth/index.js').createAuthService>, audit: ReturnType<import('./audit/index.js').createAuditService>, media: ReturnType<import('./media/index.js').createMediaService>, settings: ReturnType<import('./settings/index.js').createSettingsService>, shipping: ReturnType<import('./shipping/index.js').createShippingService>, customers: ReturnType<import('./customers/index.js').createCustomersService>, promotions: ReturnType<import('./promotions/index.js').createPromotionsService>, cart: ReturnType<import('./cart/index.js').createCartService>, orders: ReturnType<import('./orders/index.js').createOrdersService>, adminOrders: ReturnType<import('./orders/admin.js').createAdminOrders>, reporting: ReturnType<import('./reporting/index.js').createReporting>, reviews: ReturnType<import('./reviews/index.js').createReviewsService>, catalog: ReturnType<import('./catalog/index.js').createCatalogService>, inventory: ReturnType<import('./inventory/index.js').createInventory>, search: ReturnType<import('./search/index.js').createSearch>, visits: ReturnType<import('./visits/index.js').createVisitsService> }} deps
 * @returns {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>}
 */
export const appHandlers = (config, { auth, audit, media, settings, shipping, customers, promotions, cart, orders, adminOrders, reporting, reviews, catalog, inventory, search, visits }) => ({
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (authHandlers(auth, config))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (auditHandlers(audit))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (mediaHandlers(media))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (settingsHandlers(settings))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (shippingHandlers(shipping))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (customersHandlers(customers))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (visitsHandlers(visits))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (promotionsHandlers(promotions))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (cartHandlers(cart))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (ordersHandlers(orders, adminOrders))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (reviewsHandlers(reviews))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (reportingHandlers(reporting))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (catalogHandlers(catalog))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (inventoryHandlers(inventory))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (searchHandlers(search))),
  'admin.system.info': async () => reporting.systemInfo(),
})

/** Which jobs the outbox starts for each event type; the relay of every background process uses it. */
export const eventHandlers = { ...searchEvents, ...notificationEvents }

/**
 * What the background process runs: job handlers and scheduled jobs of every module. The API (with DEV_INLINE_WORKER) and src/worker.js both start from this.
 * @param {{ db: import('../platform/db.js').Database['db'], config: import('../platform/config.js').Config, storage?: import('../platform/storage.js').Storage, log?: { error: (o: object, msg: string) => void } }} deps
 */
export function backgroundOf({ db, config, storage, log }) {
  const { media, search, inventory, catalog, cart, orders, notifications, reporting } = createServices({ db, config, ...(storage ? { storage } : {}) })
  return {
    handlers: {
      ...mediaJobs(media),
      ...searchJobs(search),
      'catalog.publish_scheduled': async () => void (await catalog.products.publishDue()),
      'inventory.expire_reservations': async () => void (await inventory.expireReservations()),
      'inventory.verify': async () => {
        const problems = await inventory.verify()
        for (const p of problems) log?.error(p, 'stock does not add up') // reported, never repaired (DOC-09.4 section 2.3)
      },
      'inventory.cleanup_subscriptions': async () => inventory.cleanupSubscriptions(),
      'cart.cleanup': async () => cart.cleanup(),
      ...paymentJobs(orders),
      ...notificationJobs(notifications),
      ...reportingJobs(reporting),
    },
    startup: ['search.reconcile'],
    schedule: [...platformSchedule, { type: 'media.cleanup', cron: '0 22 * * *' }, { type: 'search.reconcile', cron: '*/10 * * * *' }, { type: 'catalog.publish_scheduled', cron: '* * * * *' }, { type: 'inventory.expire_reservations', cron: '*/5 * * * *' }, { type: 'inventory.verify', cron: '0 21 * * *' }, { type: 'inventory.cleanup_subscriptions', cron: '15 21 * * *' }, { type: 'search.cleanup_misses', cron: '30 21 * * *' }, { type: 'cart.cleanup', cron: '45 21 * * *' }, { type: 'orders.expire_unpaid', cron: '*/5 * * * *' }, { type: 'notifications.cleanup', cron: '30 21 * * *' }, { type: 'reporting.sales_counts', cron: '0 20 * * *' }, { type: 'reporting.cleanup', cron: '45 21 * * *' }], // carts idle 30 days 02:45 PKT, media 03:00 PKT, scheduled products every minute, reservations every 5 minutes, stock check 02:00 PKT, subscriptions 02:15 PKT
  }
}
