// Small helpers shared by the catalog services.
import { emit } from '../../platform/outbox.js'

/**
 * @typedef {{ staffId: string, name: string, role: string }} Staff
 * @typedef {{ ip: string, userAgent: string, requestId: string }} RequestInfo
 * What the catalog needs to know from the rest of the shop before it lets something go. Products, variants and orders do not exist
 * yet, so every count is zero until the product module hands in the real ones (the foreign keys then protect the data as well).
 * @typedef {object} Usage
 * @property {(categoryId: string) => Promise<number>} categoryPrimary products whose primary category is this
 * @property {(categoryIds: string[]) => Promise<Map<string, number>>} categoryProducts products shown under each category (descendants included)
 * @property {(attributeId: string) => Promise<number>} attributeProducts
 * @property {(valueId: string) => Promise<number>} valueProducts
 * @property {(db: import('../../platform/db.js').Executor, fromValueId: string, intoValueId: string) => Promise<void>} moveValue re-points products from one value to another
 * @property {(sizeValueId: string) => Promise<number>} sizeValueVariants variants using this size
 * @property {(sizeSystemId: string) => Promise<number>} sizeSystemOptions product options built on this system
 * @property {(chartId: string) => Promise<number>} sizeChartProducts
 * @property {(formId: string) => Promise<number>} formSchemaProducts
 */

/** @type {Usage} */
export const noUsage = {
  categoryPrimary: async () => 0,
  categoryProducts: async (ids) => new Map(ids.map((id) => [id, 0])),
  attributeProducts: async () => 0,
  valueProducts: async () => 0,
  moveValue: async () => {},
  sizeValueVariants: async () => 0,
  sizeSystemOptions: async () => 0,
  sizeChartProducts: async () => 0,
  formSchemaProducts: async () => 0,
}

/** @param {unknown} e */
const cause = (e) => /** @type {{ cause?: { errno?: number, sqlMessage?: string }, errno?: number, sqlMessage?: string }} */ (e)

/** The unique key a duplicate-entry error names (`categories_handle_uq`), or null for any other error. @param {unknown} e */
export function duplicateKey(e) {
  const c = cause(e).cause ?? cause(e)
  if (c.errno !== 1062) return null
  return /for key '(?:[^']*\.)?([^']+)'/.exec(c.sqlMessage ?? '')?.[1] ?? ''
}

/** A foreign key refused a delete or update (MySQL 1451). @param {unknown} e */
export const isReferenced = (e) => (cause(e).cause?.errno ?? cause(e).errno) === 1451

/** @param {Staff} a @param {RequestInfo} req */
export const actorOf = (a, req) => ({ actor: { type: /** @type {const} */ ('staff'), id: a.staffId, label: a.name, role: a.role }, ip: req.ip, userAgent: req.userAgent, requestId: req.requestId })

/** Tells the storefront which cached pages to drop. @param {import('../../platform/db.js').Executor} tx @param {string[]} tags @param {string} requestId */
export const purge = (tx, tags, requestId) => emit(tx, { type: 'catalog.updated', payload: { tags }, ...(requestId ? { requestId } : {}) })
