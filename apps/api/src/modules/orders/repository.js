import { eq } from 'drizzle-orm'
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
/** @param {Db} db @param {string} orderId */
export const linesOf = (db, orderId) => db.select().from(orderLines).where(eq(orderLines.orderId, orderId)).orderBy(orderLines.position)
