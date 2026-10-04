import { and, eq, inArray, isNull, lt } from 'drizzle-orm'
import { media } from '../../db/schema/media.js'

/** @typedef {typeof media.$inferSelect} MediaRow */

/** @param {import('../../platform/db.js').Executor} db @param {typeof media.$inferInsert} row */
export const insert = (db, row) => db.insert(media).values(row)

/** @param {import('../../platform/db.js').Executor} db @param {string} id @returns {Promise<MediaRow | undefined>} */
export const find = async (db, id) => (await db.select().from(media).where(eq(media.id, id)).limit(1))[0]

/** Locks the row for the rest of the transaction. @param {import('../../platform/db.js').Executor} db @param {string} id @returns {Promise<MediaRow | undefined>} */
export const lock = async (db, id) => (await db.select().from(media).where(eq(media.id, id)).limit(1).for('update'))[0]

/** @param {import('../../platform/db.js').Executor} db @param {string} id @param {Partial<typeof media.$inferInsert>} set */
export const update = (db, id, set) => db.update(media).set(set).where(eq(media.id, id))

/** @param {import('../../platform/db.js').Executor} db @param {string} id */
export const remove = (db, id) => db.delete(media).where(eq(media.id, id))

/** Upload slots nobody confirmed in time. @param {import('../../platform/db.js').Executor} db @param {Date} before @param {number} limit */
export const staleTickets = (db, before, limit) =>
  db.select().from(media).where(and(eq(media.status, 'pending'), isNull(media.confirmedAt), lt(media.createdAt, before))).limit(limit)

/** Refused files, kept for a day so the screen can show why. @param {import('../../platform/db.js').Executor} db @param {Date} before @param {number} limit */
export const oldRejected = (db, before, limit) => db.select().from(media).where(and(eq(media.status, 'rejected'), lt(media.createdAt, before))).limit(limit)

/** @param {import('../../platform/db.js').Executor} db @param {string[]} ids */
export const findMany = (db, ids) => (ids.length ? db.select().from(media).where(inArray(media.id, ids)) : Promise.resolve([]))
