import { and, asc, count, desc, eq, inArray, isNull, like, sql } from 'drizzle-orm'
import { categories } from '../../db/schema/taxonomy.js'
import { productCategories, products, variants } from '../../db/schema/products.js'
import { promoRedemptions, promoTargets, promos } from '../../db/schema/promotions.js'

/** @typedef {import('../../platform/db.js').Executor} Db */
/** @typedef {typeof promos.$inferSelect} PromoRow */

const sorts = /** @type {const} */ ({ code: promos.code, createdAt: promos.createdAt, usageCount: promos.usageCount })

/** `%` and `_` typed by a person are text, not wildcards. @param {string} s */
const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

/**
 * The status is derived, so it is filtered by the same rules in SQL (see `promoStatus`).
 * @param {'active' | 'scheduled' | 'expired' | 'disabled'} status @param {Date} at
 */
const statusWhere = (status, at) => {
  const limitReached = sql`(${promos.usageLimit} is not null and ${promos.usageCount} >= ${promos.usageLimit})`
  const ended = sql`(${promos.endsAt} is not null and ${promos.endsAt} <= ${at})`
  const notStarted = sql`(${promos.startsAt} is not null and ${promos.startsAt} > ${at})`
  if (status === 'disabled') return eq(promos.enabled, false)
  if (status === 'scheduled') return and(eq(promos.enabled, true), notStarted)
  if (status === 'expired') return and(eq(promos.enabled, true), sql`not ${notStarted}`, sql`(${ended} or ${limitReached})`)
  return and(eq(promos.enabled, true), sql`not ${notStarted}`, sql`not ${ended}`, sql`not ${limitReached}`)
}

/** @param {Db} db @param {{ q?: string, status?: 'active' | 'scheduled' | 'expired' | 'disabled', type?: string, sort?: string, page: number, size: number }} f @param {Date} at */
export async function listPromos(db, { q, status, type, sort, page, size }, at) {
  const where = and(q ? like(promos.code, `%${escapeLike(q.toUpperCase())}%`) : undefined, status ? statusWhere(status, at) : undefined, type ? eq(promos.type, type) : undefined)
  const key = /** @type {keyof typeof sorts} */ ((sort ?? '-createdAt').replace(/^-/, ''))
  const column = sorts[key] ?? sorts.createdAt
  const order = (sort ?? '-createdAt').startsWith('-') ? desc(column) : asc(column)
  const [rows, total] = await Promise.all([
    db.select().from(promos).where(where).orderBy(order, asc(promos.id)).limit(size).offset((page - 1) * size),
    db.select({ n: count() }).from(promos).where(where),
  ])
  return { rows, total: total[0]?.n ?? 0 }
}

/** @param {Db} db @param {string} id */
export const findById = async (db, id) => (await db.select().from(promos).where(eq(promos.id, id)))[0]
/** @param {Db} db @param {string} id */
export const lockById = async (db, id) => (await db.select().from(promos).where(eq(promos.id, id)).for('update'))[0]
/** @param {Db} db @param {string} code */
export const findByCode = async (db, code) => (await db.select().from(promos).where(eq(promos.code, code)))[0]
/** @param {Db} db @param {string} code */
export const lockByCode = async (db, code) => (await db.select().from(promos).where(eq(promos.code, code)).for('update'))[0]
/** @param {Db} db @param {typeof promos.$inferInsert} row */
export const insert = (db, row) => db.insert(promos).values(row)
/** @param {Db} db @param {string} id @param {Partial<typeof promos.$inferInsert>} set */
export const update = (db, id, set) => db.update(promos).set(set).where(eq(promos.id, id))
/** @param {Db} db @param {string} id */
export const remove = (db, id) => db.delete(promos).where(eq(promos.id, id))

// ---- targets and labels

/** @param {Db} db @param {string[]} promoIds */
export const targetsOf = (db, promoIds) => (promoIds.length ? db.select().from(promoTargets).where(inArray(promoTargets.promoId, promoIds)) : Promise.resolve([]))
/** @param {Db} db @param {string} promoId @param {{ targetType: string, targetId: string }[]} rows */
export async function replaceTargets(db, promoId, rows) {
  await db.delete(promoTargets).where(eq(promoTargets.promoId, promoId))
  if (rows.length) await db.insert(promoTargets).values(rows.map((r) => ({ promoId, ...r })))
}
/** @param {Db} db @param {string[]} ids */
export const categoryNames = (db, ids) => (ids.length ? db.select({ id: categories.id, name: categories.name }).from(categories).where(inArray(categories.id, ids)) : Promise.resolve([]))
/** @param {Db} db @param {string[]} ids */
export const productTitles = (db, ids) => (ids.length ? db.select({ id: products.id, title: products.title }).from(products).where(inArray(products.id, ids)) : Promise.resolve([]))
/** @param {Db} db */
export const allCategories = (db) => db.select({ id: categories.id, parentId: categories.parentId }).from(categories)

/** The lines of a preview: price, sale flag, product and every category of it. @param {Db} db @param {string[]} variantIds */
export async function variantFacts(db, variantIds) {
  if (!variantIds.length) return []
  const rows = await db
    .select({ id: variants.id, productId: variants.productId, priceMinor: variants.priceMinor, compareAtMinor: variants.compareAtMinor })
    .from(variants)
    .where(inArray(variants.id, variantIds))
  const cats = rows.length ? await db.select().from(productCategories).where(inArray(productCategories.productId, [...new Set(rows.map((r) => r.productId))])) : []
  return rows.map((r) => ({ ...r, categoryIds: cats.filter((c) => c.productId === r.productId).map((c) => c.categoryId) }))
}

// ---- redemptions

/** @param {Db} db @param {string} promoId */
export const redemptionCount = async (db, promoId) => (await db.select({ n: count() }).from(promoRedemptions).where(eq(promoRedemptions.promoId, promoId)))[0]?.n ?? 0
/** @param {Db} db @param {string[]} promoIds */
export const usedIds = async (db, promoIds) =>
  promoIds.length ? new Set((await db.select({ id: promoRedemptions.promoId }).from(promoRedemptions).where(inArray(promoRedemptions.promoId, promoIds)).groupBy(promoRedemptions.promoId)).map((r) => r.id)) : new Set()
/** Live redemptions of one customer for one promo. A locking read, so it sees what other orders have just committed, not an older snapshot. @param {Db} db @param {string} promoId @param {string} customerId */
export const customerUses = async (db, promoId, customerId) =>
  (await db.select({ id: promoRedemptions.id }).from(promoRedemptions).where(and(eq(promoRedemptions.promoId, promoId), eq(promoRedemptions.customerId, customerId), isNull(promoRedemptions.reversedAt))).for('update')).length
/** @param {Db} db @param {typeof promoRedemptions.$inferInsert} row */
export const insertRedemption = (db, row) => db.insert(promoRedemptions).values(row)
/** @param {Db} db @param {string} orderId */
export const redemptionOfOrder = async (db, orderId) => (await db.select().from(promoRedemptions).where(eq(promoRedemptions.orderId, orderId)))[0]
/** @param {Db} db @param {string} id @param {Date} at */
export const reverseRedemption = (db, id, at) => db.update(promoRedemptions).set({ reversedAt: at }).where(eq(promoRedemptions.id, id))
