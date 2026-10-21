// Builds every module's service and wires the few that need each other: stock and the catalog refresh each other's data, a file shown by a
// settings document cannot be deleted, a product page asks shipping for delivery facts. The API, the background process and the seed all start here.
import { createStorage } from '../platform/storage.js'
import { createAuditService } from './audit/index.js'
import { createAuthService } from './auth/index.js'
import { createCartService } from './cart/index.js'
import { createCatalogService } from './catalog/index.js'
import { createCustomersService } from './customers/index.js'
import { createInventory } from './inventory/index.js'
import { createGateway, createMailer, createNotifications } from './notifications/index.js'
import { createMediaService } from './media/index.js'
import { createAdminOrders } from './orders/admin.js'
import { createOrdersService, customerOrders } from './orders/index.js'
import { createPaymentsService, createProviders } from './payments/index.js'
import { createPromotionsService } from './promotions/index.js'
import { createReporting } from './reporting/index.js'
import { createReviewsService } from './reviews/index.js'
import { createReturnsService } from './returns/index.js'
import { createSearch } from './search/index.js'
import { createSettingsService } from './settings/index.js'
import { createShippingService } from './shipping/index.js'
import { createDeliveryService } from './delivery/index.js'
import { createVisitsService } from './visits/index.js'
import { createAccountsService } from './accounts/index.js'
import { createTrash } from './trash/index.js'
import { AttributeInput, CategoryInput, CollectionInput, PageInput, ProductInput, PromoInput } from '@noor/contract'

/** A kept copy without the ids its parts had: the parts get new ones when the record is made again (options, values and variants are matched by their keys). @param {any} value @returns {any} */
function stripIds(value) {
  if (Array.isArray(value)) return value.map(stripIds)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k]) => k !== 'id').map(([k, v]) => [k, stripIds(v)]))
  return value
}

/**
 * @param {{ db: import('../platform/db.js').Database['db'], config: import('../platform/config.js').Config, storage?: import('../platform/storage.js').Storage, providers?: ReturnType<typeof createProviders>, mailer?: ReturnType<typeof createMailer>, gateway?: ReturnType<typeof createGateway> }} deps
 */
export function createServices({ db, config, storage = createStorage(config), providers = createProviders(), mailer = createMailer(config), gateway = createGateway(config) }) {
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
    showEmptyCategories: async () => (await settings.get('store')).value.navigation?.showEmptyCategories ?? true,
    subscribe: (s) => inventory.subscribe(s),
  })
  settings = createSettingsService({ db, config, media, shippingFacts: () => shipping.facts() })
  const cart = createCartService({ db, media, stock: inventory.stock, shipping, settings, promotions, customers })
  const payments = createPaymentsService({ db, providers })
  const orders = createOrdersService({ db, config, cart, inventory, promotions, customers, settings, shipping, payments, media })
  const visits = createVisitsService({ db, customers, orders, enabled: async () => (await settings.get('store')).value.features.visitTracking !== false })
  const accounts = createAccountsService({ db, orders, visits, config })

  // The trash (plan/17 item 6): each delete of these six kinds keeps a copy of what the record was made from for 30 days, and a restore makes it again through the same create.
  const trash = createTrash({
    db,
    kinds: {
      product: {
        input: ProductInput,
        label: (/** @type {any} */ p) => `${p.title} (${p.handle})`,
        write: 'products:write', remove: 'products:delete',
        // put back as a draft, never live by itself (a product with stock history or orders cannot be deleted at all, so there is no stock to bring back)
        prepare: (/** @type {any} */ _view, /** @type {any} */ input) => ({ ...stripIds(input), status: 'draft', publishAt: undefined }),
        create: (actor, input, req) => catalog.products.save({ ...actor, canPublish: actor.permissions.has('products:publish') }, null, input, req),
      },
      category: { input: CategoryInput, label: (/** @type {any} */ c) => c.name, write: 'catalog:write', remove: 'catalog:delete', create: (actor, input, req) => catalog.categories.create(actor, input, req) },
      attribute: { input: AttributeInput, label: (/** @type {any} */ a) => a.label, write: 'catalog:write', remove: 'catalog:delete', prepare: (/** @type {any} */ _v, /** @type {any} */ input) => stripIds(input), create: (actor, input, req) => catalog.attributes.create(actor, input, req) },
      collection: { input: CollectionInput, label: (/** @type {any} */ c) => c.title, write: 'catalog:write', remove: 'catalog:delete', create: (actor, input, req) => catalog.collections.create(actor, input, req) },
      promo: { input: PromoInput, label: (/** @type {any} */ p) => p.code, write: 'promos:write', remove: 'promos:delete', create: (actor, input, req) => promotions.create(actor, input, req) },
      page: { input: PageInput, label: (/** @type {any} */ p) => p.title, write: 'content:write', remove: 'content:delete', create: (actor, input, req) => settings.createPage(actor, input, req) },
    },
  })
  trash.guard(catalog.products, 'remove', 'product', (id) => catalog.products.get(id))
  trash.guard(catalog.categories, 'remove', 'category', async (id) => (await catalog.categories.list()).items.find((c) => c.id === id))
  trash.guard(catalog.attributes, 'remove', 'attribute', async (id) => (await catalog.attributes.list()).items.find((a) => a.id === id))
  trash.guard(catalog.collections, 'remove', 'collection', (id) => catalog.collections.get(id))
  trash.guard(promotions, 'delete', 'promo', (id) => promotions.get(id))
  trash.guard(settings, 'deletePage', 'page', (id) => settings.getPage(id))
  const delivery = createDeliveryService({ db, orders, settings })
  const returns = createReturnsService({ db, orders, settings })
  const reviews = createReviewsService({ db, settings, media, orders, recomputeRating: catalog.products.recomputeRating })
  const notifications = createNotifications({ db, config, settings, mailer, gateway })
  const adminOrders = createAdminOrders({ db, config, orders, cart, payments, notifications, settings, media, shipping })
  const reporting = createReporting({ db, config, settings, media })
  return { trash, accounts, returns, delivery, visits, reporting, adminOrders, reviews, notifications, payments, orders, auth, audit, storage, search, media, shipping, customers, promotions, cart, inventory, catalog, settings }
}
