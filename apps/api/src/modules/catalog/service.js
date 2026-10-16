// The catalog: structure (categories, attributes, sizes, forms) and merchandise (products, collections).
import { createAttributes } from './attributes.js'
import { createCategories } from './categories.js'
import { createCollections } from './collections.js'
import { noStock } from './product-loader.js'
import { createProducts } from './products.js'
import { createSizes } from './sizes.js'
import { createSearch } from '../search/service.js'
import { createListing } from './public-listing.js'
import { createPublicCatalog } from './public.js'
import { createUsage } from './usage.js'

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {import('../../platform/config.js').Config} deps.config
 * @param {{ imagesFor: (ids: string[]) => Promise<Record<string, import('@noor/contract').Image>> }} deps.media
 * @param {import('./common.js').Usage} [deps.usage] who uses what; the default counts real products (tests pass stand-ins)
 * @param {import('./product-loader.js').Stock} [deps.stock] what stock says about variants; inventory supplies it (M1-10)
 * @param {ReturnType<typeof createSearch>} [deps.search]
 * @param {() => Promise<{ freeAboveFrom?: import('@noor/contract').Money, defaultEta?: { minDays: number, maxDays: number }, codAvailable?: boolean }>} [deps.deliveryFacts] from shipping
 * @param {() => Promise<boolean>} [deps.notifyEnabled] the back-in-stock feature switch of the store settings
 * @param {(input: { variantId: string, phone: string, locale?: 'en' | 'ur' }) => Promise<void>} [deps.subscribe] from inventory
 */
export function createCatalogService({ db, config, media, usage = createUsage(db), stock = noStock, search = createSearch({ db }), deliveryFacts = async () => ({}), notifyEnabled = async () => false, subscribe = async () => {} }) {
  const categories = createCategories({ db, usage, media })
  const products = createProducts({ db, config, media, stock, filtersOf: (id) => categories.effectiveFilters(id) })
  const listing = createListing({ db, media, search, filtersOf: (id) => categories.effectiveFilters(id), lowStock: () => stock.lowStockThreshold() })
  return {
    listing,
    public: createPublicCatalog({ db, media, stock, listing, verifyPreview: (token) => products.verifyPreview(token), deliveryFacts, notifyEnabled, subscribe }),
    categories,
    attributes: createAttributes({ db, usage }),
    sizes: createSizes({ db, usage, media }),
    products,
    collections: createCollections({ db, media, rowsOf: (x, ids) => products.rowsOf(x, ids) }),
  }
}
