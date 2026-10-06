import { and, asc, eq, inArray, isNotNull, lte } from 'drizzle-orm'
import { orderLines, orders } from '../../db/schema/orders.js'
import { paymentEvents, payments } from '../../db/schema/payments.js'

/** @typedef {import('../../platform/db.js').Executor} Db */
/** @typedef {typeof payments.$inferSelect} PaymentRow */

/** @param {Db} db @param {typeof payments.$inferInsert} row */
export const insert = (db, row) => db.insert(payments).values(row)
/** @param {Db} db @param {string} id @param {Partial<typeof payments.$inferInsert>} set */
export const update = (db, id, set) => db.update(payments).set(set).where(eq(payments.id, id))
/** @param {Db} db @param {string} id */
export const lockById = async (db, id) => (await db.select().from(payments).where(eq(payments.id, id)).for('update'))[0]
/** @param {Db} db @param {string} orderId */
export const ofOrder = (db, orderId) => db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(asc(payments.createdAt), asc(payments.id))

/** The columns of an order that payments need. @param {Db} db @param {string} id */
export const orderRow = async (db, id) => (await db.select().from(orders).where(eq(orders.id, id)))[0]
/** @param {Db} db @param {string} id @param {{ paidMinor: number, refundedMinor: number, paymentStatus: string }} set */
export const setOrderMoney = (db, id, set) => db.update(orders).set(set).where(eq(orders.id, id))
/** @param {Db} db @param {string} orderId */
export const linesOf = (db, orderId) => db.select().from(orderLines).where(eq(orderLines.orderId, orderId))

/** @param {Db} db @param {typeof paymentEvents.$inferInsert} row */
export const insertEvent = (db, row) => db.insert(paymentEvents).values(row)
/** @param {Db} db @param {string} id */
export const lockEvent = async (db, id) => (await db.select().from(paymentEvents).where(eq(paymentEvents.id, id)).for('update'))[0]
/** @param {Db} db @param {string} id @param {Date} at */
export const markProcessed = (db, id, at) => db.update(paymentEvents).set({ processedAt: at }).where(eq(paymentEvents.id, id))

/** Orders still waiting for money whose payment window is over. @param {Db} db @param {Date} at */
export async function expiredUnpaid(db, at) {
  const rows = await db
    .select({ orderId: payments.orderId })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(and(eq(payments.state, 'initiated'), isNotNull(payments.expiresAt), lte(payments.expiresAt, at), inArray(orders.status, ['pending'])))
    .groupBy(payments.orderId)
  return rows.map((r) => r.orderId)
}
