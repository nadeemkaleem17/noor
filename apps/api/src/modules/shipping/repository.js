import { and, asc, count, eq, inArray, isNull, like, or, sql } from 'drizzle-orm'
import { cities, couriers, shippingMethods, shippingZoneCities, shippingZones } from '../../db/schema/shipping.js'

/** @typedef {import('../../platform/db.js').Executor} Db */
/** @typedef {typeof cities.$inferSelect} CityRow */
/** @typedef {typeof shippingMethods.$inferSelect} MethodRow */

// ---- zones ------------------------------------------------------------------------------------------------------------------

/** @param {Db} db */
export const allZones = (db) => db.select().from(shippingZones).orderBy(asc(shippingZones.sortOrder), asc(shippingZones.name))

/** @param {Db} db @param {string} id */
export const lockZone = async (db, id) => (await db.select().from(shippingZones).where(eq(shippingZones.id, id)).for('update'))[0]

/** @param {Db} db @param {string} id */
export const findZone = async (db, id) => (await db.select().from(shippingZones).where(eq(shippingZones.id, id)))[0]

/** @param {Db} db @param {typeof shippingZones.$inferInsert} row */
export const insertZone = (db, row) => db.insert(shippingZones).values(row)

/** @param {Db} db @param {string} id @param {Partial<typeof shippingZones.$inferInsert>} set */
export const updateZone = (db, id, set) => db.update(shippingZones).set(set).where(eq(shippingZones.id, id))

/** @param {Db} db @param {string} id */
export const deleteZone = (db, id) => db.delete(shippingZones).where(eq(shippingZones.id, id))

/** @param {Db} db */
export const zoneCount = async (db) => (await db.select({ n: count() }).from(shippingZones))[0]?.n ?? 0

// ---- methods ----------------------------------------------------------------------------------------------------------------

/** @param {Db} db @param {string[]} [zoneIds] @returns {Promise<MethodRow[]>} */
export const methodsOf = (db, zoneIds) =>
  zoneIds && !zoneIds.length
    ? Promise.resolve([])
    : db.select().from(shippingMethods).where(zoneIds ? inArray(shippingMethods.zoneId, zoneIds) : undefined).orderBy(asc(shippingMethods.sortOrder), asc(shippingMethods.id))

/** @param {Db} db @param {typeof shippingMethods.$inferInsert} row */
export const insertMethod = (db, row) => db.insert(shippingMethods).values(row)

/** @param {Db} db @param {string} id @param {Partial<typeof shippingMethods.$inferInsert>} set */
export const updateMethod = (db, id, set) => db.update(shippingMethods).set(set).where(eq(shippingMethods.id, id))

/** @param {Db} db @param {string[]} ids */
export const deleteMethods = (db, ids) => (ids.length ? db.delete(shippingMethods).where(inArray(shippingMethods.id, ids)) : Promise.resolve())

// ---- cities in zones ---------------------------------------------------------------------------------------------------------

/** Every assignment with the city name, by name. @param {Db} db */
export const assignments = (db) =>
  db
    .select({ cityId: shippingZoneCities.cityId, zoneId: shippingZoneCities.zoneId, name: cities.name })
    .from(shippingZoneCities)
    .innerJoin(cities, eq(cities.id, shippingZoneCities.cityId))
    .orderBy(asc(cities.name))

/** A city leaves its zone when another claims it. @param {Db} db @param {string[]} cityIds */
export const unassign = (db, cityIds) => (cityIds.length ? db.delete(shippingZoneCities).where(inArray(shippingZoneCities.cityId, cityIds)) : Promise.resolve())

/** @param {Db} db @param {string} zoneId */
export const unassignZone = (db, zoneId) => db.delete(shippingZoneCities).where(eq(shippingZoneCities.zoneId, zoneId))

/** @param {Db} db @param {string} zoneId @param {string[]} cityIds */
export const assign = (db, zoneId, cityIds) => (cityIds.length ? db.insert(shippingZoneCities).values(cityIds.map((cityId) => ({ cityId, zoneId }))) : Promise.resolve())

/** Cities that sit in a zone with at least one enabled method. @param {Db} db */
export async function deliverableCount(db) {
  const [row] = await db
    .select({ n: sql`count(distinct ${shippingZoneCities.cityId})`.mapWith(Number) })
    .from(shippingZoneCities)
    .innerJoin(shippingMethods, and(eq(shippingMethods.zoneId, shippingZoneCities.zoneId), eq(shippingMethods.enabled, true)))
  return row?.n ?? 0
}

/** @param {Db} db */
export const deliverableCities = (db) =>
  db
    .select({ id: cities.id, name: cities.name, province: cities.province, aliases: cities.aliases, isMajor: cities.isMajor })
    .from(cities)
    .innerJoin(shippingZoneCities, eq(shippingZoneCities.cityId, cities.id))
    .innerJoin(shippingMethods, and(eq(shippingMethods.zoneId, shippingZoneCities.zoneId), eq(shippingMethods.enabled, true)))
    .groupBy(cities.id) // a city with two enabled methods is still one city

/** The zone a city belongs to, with its enabled methods, cheapest first. @param {Db} db @param {string} cityId */
export async function zoneOfCity(db, cityId) {
  const [row] = await db.select({ zoneId: shippingZoneCities.zoneId }).from(shippingZoneCities).where(eq(shippingZoneCities.cityId, cityId))
  if (!row) return null
  const methods = await db
    .select()
    .from(shippingMethods)
    .where(and(eq(shippingMethods.zoneId, row.zoneId), eq(shippingMethods.enabled, true)))
    .orderBy(asc(shippingMethods.feeMinor), asc(shippingMethods.sortOrder))
  return { zoneId: row.zoneId, methods }
}

// ---- cities -----------------------------------------------------------------------------------------------------------------

/** @param {Db} db @param {string[]} [ids] */
export const citiesByIds = (db, ids) => db.select().from(cities).where(ids ? inArray(cities.id, ids) : undefined).orderBy(asc(cities.name))

/** @param {Db} db @param {string} id @returns {Promise<CityRow | undefined>} */
export const findCity = async (db, id) => (await db.select().from(cities).where(eq(cities.id, id)))[0]

/** @param {Db} db @param {typeof cities.$inferInsert} row */
export const insertCity = (db, row) => db.insert(cities).values(row)

/** @param {Db} db @param {typeof cities.$inferInsert[]} rows */
export const insertCities = (db, rows) => db.insert(cities).values(rows)

/** @param {Db} db @param {string} id @param {Partial<typeof cities.$inferInsert>} set */
export const updateCity = (db, id, set) => db.update(cities).set(set).where(eq(cities.id, id))

/** @param {Db} db @param {{ q?: string, province?: string, unassigned?: boolean, page: number, size: number }} f */
export async function listCities(db, { q, province, unassigned, page, size }) {
  const where = and(
    province ? eq(cities.province, province) : undefined,
    q ? or(like(cities.name, `%${q}%`), sql`json_search(lower(${cities.aliases}), 'one', ${`%${q.toLowerCase()}%`}) is not null`) : undefined,
    unassigned ? isNull(shippingZoneCities.cityId) : undefined,
  )
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(cities).leftJoin(shippingZoneCities, eq(shippingZoneCities.cityId, cities.id)).where(where)
  const rows = await db
    .select({ city: cities, zoneId: shippingZoneCities.zoneId })
    .from(cities)
    .leftJoin(shippingZoneCities, eq(shippingZoneCities.cityId, cities.id))
    .where(where)
    .orderBy(asc(cities.name))
    .limit(size)
    .offset((page - 1) * size)
  return { rows, total: n }
}

/** @param {Db} db */
export const unassignedCount = async (db) =>
  (await db.select({ n: count() }).from(cities).leftJoin(shippingZoneCities, eq(shippingZoneCities.cityId, cities.id)).where(isNull(shippingZoneCities.cityId)))[0]?.n ?? 0

// ---- couriers ---------------------------------------------------------------------------------------------------------------

/** @param {Db} db */
export const allCouriers = (db) => db.select().from(couriers).orderBy(asc(couriers.sortOrder), asc(couriers.name))

/** @param {Db} db @param {string} id */
export const findCourier = async (db, id) => (await db.select().from(couriers).where(eq(couriers.id, id)))[0]

/** @param {Db} db @param {typeof couriers.$inferInsert} row */
export const insertCourier = (db, row) => db.insert(couriers).values(row)

/** @param {Db} db @param {string} id @param {Partial<typeof couriers.$inferInsert>} set */
export const updateCourier = (db, id, set) => db.update(couriers).set(set).where(eq(couriers.id, id))

/** @param {Db} db */
export const courierNames = async (db) => new Set((await db.select({ name: couriers.name }).from(couriers)).map((c) => c.name))

/** @param {Db} db @param {typeof couriers.$inferInsert[]} rows */
export const insertCouriers = (db, rows) => db.insert(couriers).values(rows)

/** Lower-cased names of every city, for the seed. @param {Db} db */
export const cityNames = async (db) => new Set((await db.select({ name: cities.name }).from(cities)).map((c) => c.name.toLowerCase()))
