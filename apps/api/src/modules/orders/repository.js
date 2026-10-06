import { and, desc, eq, gte, inArray, lte, ne } from 'drizzle-orm'
import { orderEvents, orderLines, orders } from '../../db/schema/orders.js'

/** @typedef {import('../../platform/db.js').Executor} Db */

/** @param {Db} db @param {typeof orders.$inferInsert} row */
export const insertOrder = (db, row) => db.insert(orders).values(row)
/** @param {Db} db @param {(typeof orderLines.$inferInsert)[]} rows */
export const insertLines = (db, rows) => db.insert(orderLines).values(rows)
/** @param {Db} db @param {typeof orderEvents.$inferInsert} row */
export const insertEvent = (db, row) => db.insert(orderEvents).values(row)
/** @param {Db} db @param {string} id */
export const orderById = async (db, id) => (await db.select().from(orders).where(eq(orders.id, id)))[0]
/** By the hash of the customer's token (unique index). @param {Db} db @param {string} hash */
export const orderByTokenHash = async (db, hash) => (await db.select().from(orders).where(eq(orders.trackingTokenHash, hash)))[0]
/** By the number alone (unique index); the prefix is the caller's to compare. @param {Db} db @param {number} number */
export const orderByNumber = async (db, number) => (await db.select().from(orders).where(eq(orders.number, number)))[0]
/** @param {Db} db @param {string} orderId */
export const linesOf = (db, orderId) => db.select().from(orderLines).where(eq(orderLines.orderId, orderId)).orderBy(orderLines.position)

/** The order, locked until the transaction ends: every change of status or money starts here. @param {Db} db @param {string} id */
export const lockOrder = async (db, id) => (await db.select().from(orders).where(eq(orders.id, id)).for('update'))[0]
/** @param {Db} db @param {string} id @param {Partial<typeof orders.$inferInsert>} set */
export const updateOrder = (db, id, set) => db.update(orders).set(set).where(eq(orders.id, id))
/** @param {Db} db @param {string} id @param {Partial<typeof orderLines.$inferInsert>} set */
export const updateLine = (db, id, set) => db.update(orderLines).set(set).where(eq(orderLines.id, id))
/** @param {Db} db @param {string[]} ids */
export const deleteLines = (db, ids) => (ids.length ? db.delete(orderLines).where(inArray(orderLines.id, ids)) : Promise.resolve())
/** Newest first. @param {Db} db @param {string} orderId */
export const eventsOf = (db, orderId) => db.select().from(orderEvents).where(eq(orderEvents.orderId, orderId)).orderBy(desc(orderEvents.id))
/** Another order of this phone number in the 24 hours before this one that is not cancelled. @param {Db} db @param {{ id: string, customerPhone: string, placedAt: Date }} o */
export async function duplicateOf(db, o) {
  const since = new Date(o.placedAt.getTime() - 24 * 3_600_000)
  const [row] = await db
    .select({ id: orders.id, number: orders.number, prefix: orders.numberPrefix })
    .from(orders)
    .where(and(eq(orders.customerPhone, o.customerPhone), ne(orders.id, o.id), ne(orders.status, 'cancelled'), gte(orders.placedAt, since), lte(orders.placedAt, o.placedAt)))
    .orderBy(desc(orders.placedAt))
    .limit(1)
  return row ? { id: row.id, orderNumber: `${row.prefix}-${row.number}` } : undefined
}
