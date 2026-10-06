// Builds every module's service and wires the few that need each other: stock and the catalog refresh each other's data, a file shown by a
// settings document cannot be deleted, a product page asks shipping for delivery facts. The API, the background process and the seed all start here.
import { createStorage } from '../platform/storage.js'
import { createAuditService } from './audit/index.js'
import { createAuthService } from './auth/index.js'
import { createCartService } from './cart/index.js'
import { createCatalogService } from './catalog/index.js'
import { createCustomersService } from './customers/index.js'
import { createInventory } from './inventory/index.js'
import { createMailer, createNotifications } from './notifications/index.js'
import { createMediaService } from './media/index.js'
import { createOrdersService, customerOrders } from './orders/index.js'
import { createPaymentsService, createProviders } from './payments/index.js'
import { createPromotionsService } from './promotions/index.js'
import { createSearch } from './search/index.js'
import { createSettingsService } from './settings/index.js'
import { createShippingService } from './shipping/index.js'

/**
 * @param {{ db: import('../platform/db.js').Database['db'], config: import('../platform/config.js').Config, storage?: import('../platform/storage.js').Storage, providers?: ReturnType<typeof createProviders>, mailer?: ReturnType<typeof createMailer> }} deps
 */
export function createServices({ db, config, storage = createStorage(config), providers = createProviders(), mailer = createMailer(config) }) {
  const auth = createAuthService({ db, config })
  const audit = createAuditService(db)
  const search = createSearch({ db })
  /** @type {ReturnType<typeof createSettingsService>} */
  let settings
  /** @type {ReturnType<typeof createCatalogService>} */
  let catalog
  const media = createMediaService({ db, config, storage, inUse: (id) => settings.mediaInUse(id) })
  const shipping = createShippingService({ db })
  const customers = createCustomersService({ db, orders: customerOrders })
  const promotions = createPromotionsService({ db })
  const inventory = createInventory({ db, lowStockThreshold: (x) => settings.lowStock(x), onChanged: (tx, ids) => catalog.products.recomputeMany(tx, ids) })
  catalog = createCatalogService({
    db, config, media, stock: inventory.stock, search,
    deliveryFacts: () => shipping.facts(),
    notifyEnabled: async () => (await settings.get('store')).value.features.notifyMe,
    subscribe: (s) => inventory.subscribe(s),
  })
  settings = createSettingsService({ db, config, media, shippingFacts: () => shipping.facts() })
  const cart = createCartService({ db, media, stock: inventory.stock, shipping, settings, promotions, customers })
  const payments = createPaymentsService({ db, providers })
  const orders = createOrdersService({ db, config, cart, inventory, promotions, customers, settings, shipping, payments, media })
  const notifications = createNotifications({ db, config, settings, mailer })
  return { notifications, payments, orders, auth, audit, storage, search, media, shipping, customers, promotions, cart, inventory, catalog, settings }
}
