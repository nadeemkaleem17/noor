import { and, asc, eq, inArray, lt } from 'drizzle-orm'
import { cartLines, carts } from '../../db/schema/cart.js'
import { bundleItems, productCategories, productMedia, productOptionValues, productOptions, products, variantOptionValues, variants } from '../../db/schema/products.js'
import { formSchemas } from '../../db/schema/taxonomy.js'

/** @typedef {import('../../platform/db.js').Executor} Db */
/** @typedef {typeof carts.$inferSelect} CartRow */
/** @typedef {typeof cartLines.$inferSelect} LineRow */

/** @param {Db} db @param {string} tokenHash */
export const cartByToken = async (db, tokenHash) => (await db.select().from(carts).where(eq(carts.tokenHash, tokenHash)))[0]
/** Serialises changes to one cart: two taps on "add" at once are applied one after the other. @param {Db} db @param {string} tokenHash */
export const lockCartByToken = async (db, tokenHash) => (await db.select().from(carts).where(eq(carts.tokenHash, tokenHash)).for('update'))[0]
/** @param {Db} db @param {string} id */
export const cartById = async (db, id) => (await db.select().from(carts).where(eq(carts.id, id)))[0]
/** @param {Db} db @param {typeof carts.$inferInsert} row */
export const insertCart = (db, row) => db.insert(carts).values(row)
/** @param {Db} db @param {string} id @param {Partial<typeof carts.$inferInsert>} set */
export const updateCart = (db, id, set) => db.update(carts).set(set).where(eq(carts.id, id))
/** Carts nobody has touched since `cutoff`; their lines go with them. @param {Db} db @param {Date} cutoff */
export const deleteIdle = (db, cutoff) => db.delete(carts).where(lt(carts.updatedAt, cutoff))

/** @param {Db} db @param {string} cartId */
export const linesOf = (db, cartId) => db.select().from(cartLines).where(eq(cartLines.cartId, cartId)).orderBy(asc(cartLines.createdAt), asc(cartLines.id))
/** @param {Db} db @param {string} cartId @param {string} lineId */
export const findLine = async (db, cartId, lineId) => (await db.select().from(cartLines).where(and(eq(cartLines.cartId, cartId), eq(cartLines.id, lineId))))[0]
/** @param {Db} db @param {typeof cartLines.$inferInsert} row */
export const insertLine = (db, row) => db.insert(cartLines).values(row)
/** @param {Db} db @param {string} id @param {Partial<typeof cartLines.$inferInsert>} set */
export const updateLine = (db, id, set) => db.update(cartLines).set(set).where(eq(cartLines.id, id))
/** @param {Db} db @param {string} id */
export const deleteLine = (db, id) => db.delete(cartLines).where(eq(cartLines.id, id))

/** Variants with what the cart needs of their product. @param {Db} db @param {string[]} ids */
export async function variantsWithProduct(db, ids) {
  if (!ids.length) return []
  return db
    .select({
      id: variants.id, productId: variants.productId, priceMinor: variants.priceMinor, compareAtMinor: variants.compareAtMinor, stockMode: variants.stockMode,
      maxPerOrder: variants.maxPerOrder, enabled: variants.enabled, optionKey: variants.optionKey,
      status: products.status, handle: products.handle, title: products.title, kind: products.kind, customSizeSchemaId: products.customSizeSchemaId,
      mtoLeadMinDays: products.mtoLeadMinDays, mtoLeadMaxDays: products.mtoLeadMaxDays, mtoDepositBps: products.mtoDepositBps,
    })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .where(inArray(variants.id, ids))
}

/** @param {Db} db @param {string[]} productIds */
export const categoriesOf = (db, productIds) => (productIds.length ? db.select().from(productCategories).where(inArray(productCategories.productId, productIds)) : Promise.resolve([]))

/** The option values of each variant, in the product's option order: "Red / M". @param {Db} db @param {string[]} variantIds */
export async function variantLabels(db, variantIds) {
  if (!variantIds.length) return new Map()
  const rows = await db
    .select({ variantId: variantOptionValues.variantId, label: productOptionValues.label, optionOrder: productOptions.sortOrder, valueOrder: productOptionValues.sortOrder, valueId: productOptionValues.id })
    .from(variantOptionValues)
    .innerJoin(productOptionValues, eq(productOptionValues.id, variantOptionValues.optionValueId))
    .innerJoin(productOptions, eq(productOptions.id, productOptionValues.optionId))
    .where(inArray(variantOptionValues.variantId, variantIds))
  /** @type {Map<string, string>} */
  const out = new Map()
  for (const id of variantIds) out.set(id, rows.filter((r) => r.variantId === id).sort((a, b) => a.optionOrder - b.optionOrder).map((r) => r.label).join(' / '))
  return out
}

/** The pictures of products, with the option value each one belongs to. @param {Db} db @param {string[]} productIds */
export const mediaOf = (db, productIds) =>
  productIds.length ? db.select().from(productMedia).where(inArray(productMedia.productId, productIds)).orderBy(asc(productMedia.sortOrder)) : Promise.resolve([])
/** @param {Db} db @param {string[]} variantIds */
export const optionValuesOf = (db, variantIds) => (variantIds.length ? db.select().from(variantOptionValues).where(inArray(variantOptionValues.variantId, variantIds)) : Promise.resolve([]))

/** @param {Db} db @param {string} id */
export const formSchemaById = async (db, id) => (await db.select().from(formSchemas).where(eq(formSchemas.id, id)))[0]
/** @param {Db} db @param {string} bundleProductId */
export const bundleChildren = async (db, bundleProductId) => (await db.select({ id: bundleItems.childProductId }).from(bundleItems).where(eq(bundleItems.bundleProductId, bundleProductId))).map((r) => r.id)
