import { and, asc, count, eq, inArray, isNull, max } from 'drizzle-orm'
import { attributeValues, attributes, categories, categoryAttributes, formSchemas, handleRedirects, sizeCharts, sizeSystemValues, sizeSystems } from '../../db/schema/taxonomy.js'

/** @typedef {import('../../platform/db.js').Executor} Db */
/** @typedef {typeof categories.$inferSelect} CategoryRow */
/** @typedef {typeof attributes.$inferSelect} AttributeRow */
/** @typedef {typeof attributeValues.$inferSelect} ValueRow */
/** @typedef {typeof sizeCharts.$inferSelect} ChartRow */
/** @typedef {typeof formSchemas.$inferSelect} FormRow */

// ---- categories --------------------------------------------------------------------------------------------------------------

/** @param {Db} db */
export const allCategories = (db) => db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name))

/** @param {Db} db @param {string} id @returns {Promise<CategoryRow | undefined>} */
export const findCategory = async (db, id) => (await db.select().from(categories).where(eq(categories.id, id)))[0]

/** @param {Db} db @param {string} id @returns {Promise<CategoryRow | undefined>} */
export const lockCategory = async (db, id) => (await db.select().from(categories).where(eq(categories.id, id)).for('update'))[0]

/** @param {Db} db @param {typeof categories.$inferInsert} row */
export const insertCategory = (db, row) => db.insert(categories).values(row)

/** @param {Db} db @param {string} id @param {Partial<typeof categories.$inferInsert>} set */
export const updateCategory = (db, id, set) => db.update(categories).set(set).where(eq(categories.id, id))

/** @param {Db} db @param {string} id */
export const deleteCategory = (db, id) => db.delete(categories).where(eq(categories.id, id))

/** @param {Db} db @param {string | null} parentId */
export const childrenOf = (db, parentId) => db.select().from(categories).where(parentId ? eq(categories.parentId, parentId) : isNull(categories.parentId)).orderBy(asc(categories.sortOrder), asc(categories.name))

/** Next sort position among siblings. @param {Db} db @param {string | null} parentId */
export async function nextCategoryOrder(db, parentId) {
  const [row] = await db.select({ top: max(categories.sortOrder) }).from(categories).where(parentId ? eq(categories.parentId, parentId) : isNull(categories.parentId))
  return (row?.top ?? -1) + 1
}

/** @param {Db} db @param {string} id */
export const childCount = async (db, id) => (await db.select({ n: count() }).from(categories).where(eq(categories.parentId, id)))[0]?.n ?? 0

/** @param {Db} db @param {string} categoryId */
export const filtersOf = (db, categoryId) => db.select().from(categoryAttributes).where(eq(categoryAttributes.categoryId, categoryId)).orderBy(asc(categoryAttributes.sortOrder))

/** @param {Db} db */
export const allFilters = (db) => db.select().from(categoryAttributes).orderBy(asc(categoryAttributes.sortOrder))

/** @param {Db} db @param {string} categoryId @param {{ attributeId: string, seoIndexable: boolean, required: boolean }[]} rows */
export async function replaceFilters(db, categoryId, rows) {
  await db.delete(categoryAttributes).where(eq(categoryAttributes.categoryId, categoryId))
  if (rows.length) await db.insert(categoryAttributes).values(rows.map((r, i) => ({ categoryId, attributeId: r.attributeId, sortOrder: i, seoIndexable: r.seoIndexable, required: r.required })))
}

/** @param {Db} db @param {string} attributeId */
export const categoriesUsing = async (db, attributeId) => (await db.select({ n: count() }).from(categoryAttributes).where(eq(categoryAttributes.attributeId, attributeId)))[0]?.n ?? 0

// ---- redirects --------------------------------------------------------------------------------------------------------------

/** @param {Db} db @param {string} type @param {string} oldHandle @param {string} entityId @param {Date} at */
export const upsertRedirect = (db, type, oldHandle, entityId, at) =>
  db.insert(handleRedirects).values({ entityType: type, oldHandle, entityId, createdAt: at }).onDuplicateKeyUpdate({ set: { entityId } })

/** A handle taken by a live entity stops being a redirect. @param {Db} db @param {string} type @param {string} handle */
export const dropRedirect = (db, type, handle) => db.delete(handleRedirects).where(and(eq(handleRedirects.entityType, type), eq(handleRedirects.oldHandle, handle)))

/** @param {Db} db @param {string} type @param {string} entityId */
export const dropRedirectsOf = (db, type, entityId) => db.delete(handleRedirects).where(and(eq(handleRedirects.entityType, type), eq(handleRedirects.entityId, entityId)))

// ---- attributes -------------------------------------------------------------------------------------------------------------

/** @param {Db} db */
export const allAttributes = (db) => db.select().from(attributes).orderBy(asc(attributes.sortOrder), asc(attributes.label))

/** @param {Db} db @param {string[]} [ids] */
export const attributesByIds = (db, ids) => (ids && !ids.length ? Promise.resolve(/** @type {AttributeRow[]} */ ([])) : db.select().from(attributes).where(ids ? inArray(attributes.id, ids) : undefined))

/** @param {Db} db @param {string} id @returns {Promise<AttributeRow | undefined>} */
export const lockAttribute = async (db, id) => (await db.select().from(attributes).where(eq(attributes.id, id)).for('update'))[0]

/** @param {Db} db @param {string} id @returns {Promise<AttributeRow | undefined>} */
export const findAttribute = async (db, id) => (await db.select().from(attributes).where(eq(attributes.id, id)))[0]

/** @param {Db} db @param {typeof attributes.$inferInsert} row */
export const insertAttribute = (db, row) => db.insert(attributes).values(row)

/** @param {Db} db @param {string} id @param {Partial<typeof attributes.$inferInsert>} set */
export const updateAttribute = (db, id, set) => db.update(attributes).set(set).where(eq(attributes.id, id))

/** @param {Db} db @param {string} id */
export const deleteAttribute = (db, id) => db.delete(attributes).where(eq(attributes.id, id))

/** @param {Db} db @param {string[]} [attributeIds] @returns {Promise<ValueRow[]>} */
export const valuesOf = (db, attributeIds) =>
  attributeIds && !attributeIds.length
    ? Promise.resolve([])
    : db.select().from(attributeValues).where(attributeIds ? inArray(attributeValues.attributeId, attributeIds) : undefined).orderBy(asc(attributeValues.sortOrder), asc(attributeValues.label))

/** @param {Db} db @param {string} id @returns {Promise<ValueRow | undefined>} */
export const findValue = async (db, id) => (await db.select().from(attributeValues).where(eq(attributeValues.id, id)))[0]

/** @param {Db} db @param {typeof attributeValues.$inferInsert} row */
export const insertValue = (db, row) => db.insert(attributeValues).values(row)

/** @param {Db} db @param {string} id @param {Partial<typeof attributeValues.$inferInsert>} set */
export const updateValue = (db, id, set) => db.update(attributeValues).set(set).where(eq(attributeValues.id, id))

/** @param {Db} db @param {string[]} ids */
export const deleteValues = (db, ids) => (ids.length ? db.delete(attributeValues).where(inArray(attributeValues.id, ids)) : Promise.resolve())

// ---- size systems ------------------------------------------------------------------------------------------------------------

/** @param {Db} db */
export const allSizeSystems = (db) => db.select().from(sizeSystems).orderBy(asc(sizeSystems.name))

/** @param {Db} db @param {string} id */
export const findSizeSystem = async (db, id) => (await db.select().from(sizeSystems).where(eq(sizeSystems.id, id)))[0]

/** @param {Db} db @param {string} id */
export const lockSizeSystem = async (db, id) => (await db.select().from(sizeSystems).where(eq(sizeSystems.id, id)).for('update'))[0]

/** @param {Db} db @param {typeof sizeSystems.$inferInsert} row */
export const insertSizeSystem = (db, row) => db.insert(sizeSystems).values(row)

/** @param {Db} db @param {string} id @param {Partial<typeof sizeSystems.$inferInsert>} set */
export const updateSizeSystem = (db, id, set) => db.update(sizeSystems).set(set).where(eq(sizeSystems.id, id))

/** @param {Db} db @param {string} id */
export const deleteSizeSystem = (db, id) => db.delete(sizeSystems).where(eq(sizeSystems.id, id))

/** @param {Db} db @param {string[]} [systemIds] */
export const sizeValuesOf = (db, systemIds) =>
  systemIds && !systemIds.length
    ? Promise.resolve(/** @type {(typeof sizeSystemValues.$inferSelect)[]} */ ([]))
    : db.select().from(sizeSystemValues).where(systemIds ? inArray(sizeSystemValues.sizeSystemId, systemIds) : undefined).orderBy(asc(sizeSystemValues.sortOrder))

/** @param {Db} db @param {typeof sizeSystemValues.$inferInsert} row */
export const insertSizeValue = (db, row) => db.insert(sizeSystemValues).values(row)

/** @param {Db} db @param {string} id @param {Partial<typeof sizeSystemValues.$inferInsert>} set */
export const updateSizeValue = (db, id, set) => db.update(sizeSystemValues).set(set).where(eq(sizeSystemValues.id, id))

/** @param {Db} db @param {string[]} ids */
export const deleteSizeValues = (db, ids) => (ids.length ? db.delete(sizeSystemValues).where(inArray(sizeSystemValues.id, ids)) : Promise.resolve())

// ---- size charts and forms ---------------------------------------------------------------------------------------------------

/** @param {Db} db */
export const allCharts = (db) => db.select().from(sizeCharts).orderBy(asc(sizeCharts.title))

/** @param {Db} db @param {string} id @returns {Promise<ChartRow | undefined>} */
export const lockChart = async (db, id) => (await db.select().from(sizeCharts).where(eq(sizeCharts.id, id)).for('update'))[0]

/** @param {Db} db @param {string} id @returns {Promise<ChartRow | undefined>} */
export const findChart = async (db, id) => (await db.select().from(sizeCharts).where(eq(sizeCharts.id, id)))[0]

/** @param {Db} db @param {typeof sizeCharts.$inferInsert} row */
export const insertChart = (db, row) => db.insert(sizeCharts).values(row)

/** @param {Db} db @param {string} id @param {Partial<typeof sizeCharts.$inferInsert>} set */
export const updateChart = (db, id, set) => db.update(sizeCharts).set(set).where(eq(sizeCharts.id, id))

/** @param {Db} db @param {string} id */
export const deleteChart = (db, id) => db.delete(sizeCharts).where(eq(sizeCharts.id, id))

/** @param {Db} db */
export const allForms = (db) => db.select().from(formSchemas).orderBy(asc(formSchemas.title))

/** @param {Db} db @param {string} id @returns {Promise<FormRow | undefined>} */
export const lockForm = async (db, id) => (await db.select().from(formSchemas).where(eq(formSchemas.id, id)).for('update'))[0]

/** @param {Db} db @param {string} id @returns {Promise<FormRow | undefined>} */
export const findForm = async (db, id) => (await db.select().from(formSchemas).where(eq(formSchemas.id, id)))[0]

/** @param {Db} db @param {typeof formSchemas.$inferInsert} row */
export const insertForm = (db, row) => db.insert(formSchemas).values(row)

/** @param {Db} db @param {string} id @param {Partial<typeof formSchemas.$inferInsert>} set */
export const updateForm = (db, id, set) => db.update(formSchemas).set(set).where(eq(formSchemas.id, id))

/** @param {Db} db @param {string} id */
export const deleteForm = (db, id) => db.delete(formSchemas).where(eq(formSchemas.id, id))

