// The catalog's structure side: categories, attributes, sizes and forms. Products, collections and inventory join in M1-09 and M1-10.
import { noUsage } from './common.js'
import { createAttributes } from './attributes.js'
import { createCategories } from './categories.js'
import { createSizes } from './sizes.js'

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {{ imagesFor: (ids: string[]) => Promise<Record<string, import('@noor/contract').Image>> }} deps.media
 * @param {import('./common.js').Usage} [deps.usage] counts of products, variants and options that use an item; zero until products exist
 */
export function createCatalogService({ db, media, usage = noUsage }) {
  return {
    categories: createCategories({ db, usage, media }),
    attributes: createAttributes({ db, usage }),
    sizes: createSizes({ db, usage, media }),
  }
}
