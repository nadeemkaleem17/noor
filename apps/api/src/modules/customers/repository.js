import { and, asc, count, desc, eq, gte, like, or, sql } from 'drizzle-orm'
import { staffUsers } from '../../db/schema/auth.js'
import { likePrefix, phonePrefix } from '../../platform/search-text.js'
import { customerNotes, customers } from '../../db/schema/customers.js'

/** @typedef {import('../../platform/db.js').Executor} Db */
/** @typedef {typeof customers.$inferSelect} CustomerRow */

const sorts = /** @type {const} */ ({
  name: customers.name,
  city: customers.city,
  ordersCount: customers.ordersCount,
  refusedCount: customers.refusedCount,
  spent: customers.spentMinor,
  lastOrderAt: customers.lastOrderAt,
})

/**
 * @param {Db} db
 * @param {{ q?: string, cityName?: string, flag?: 'no_cod' | 'vip' | 'consent', minOrders?: number, hasRefusals?: boolean, sort?: string, page: number, size: number }} f
 */
export async function listCustomers(db, { q, cityName, flag, minOrders, hasRefusals, sort, page, size }) {
  const phone = q ? phonePrefix(q) : undefined
  const where = and(
    // the start of a name or a phone number, or a whole e-mail address: each is an index
    q ? or(like(customers.name, likePrefix(q)), eq(customers.email, q), phone ? like(customers.phone, phone) : undefined) : undefined,
    cityName ? eq(customers.city, cityName) : undefined,
    flag === 'no_cod' ? eq(customers.noCod, true) : flag === 'vip' ? eq(customers.vip, true) : flag === 'consent' ? eq(customers.marketingConsent, true) : undefined,
    minOrders ? gte(customers.ordersCount, minOrders) : undefined,
    hasRefusals ? gte(customers.refusedCount, 1) : undefined,
  )
  const key = /** @type {keyof typeof sorts} */ ((sort ?? '-lastOrderAt').replace(/^-/, ''))
  const column = sorts[key] ?? sorts.lastOrderAt
  const order = (sort ?? '-lastOrderAt').startsWith('-') ? desc(column) : asc(column)
  const [rows, total] = await Promise.all([
    db.select().from(customers).where(where).orderBy(order, asc(customers.id)).limit(size).offset((page - 1) * size),
    db.select({ n: count() }).from(customers).where(where),
  ])
  return { rows, total: total[0]?.n ?? 0 }
}

/** @param {Db} db @param {string} id */
export const findById = async (db, id) => (await db.select().from(customers).where(eq(customers.id, id)))[0]

/** @param {Db} db @param {string} id */
export const lockById = async (db, id) => (await db.select().from(customers).where(eq(customers.id, id)).for('update'))[0]

/** @param {Db} db @param {string} phone */
export const findByPhone = async (db, phone) => (await db.select().from(customers).where(eq(customers.phone, phone)))[0]

/** @param {Db} db @param {string} phone */
export const lockByPhone = async (db, phone) => (await db.select().from(customers).where(eq(customers.phone, phone)).for('update'))[0]

/** @param {Db} db @param {typeof customers.$inferInsert} row */
export const insert = (db, row) => db.insert(customers).values(row)

/** @param {Db} db @param {string} id @param {Partial<typeof customers.$inferInsert>} set */
export const update = (db, id, set) => db.update(customers).set(set).where(eq(customers.id, id))

/**
 * Adds to the derived counters in one statement, so two order changes at once never lose an update.
 * @param {Db} db @param {string} id
 * @param {{ orders: number, delivered: number, refused: number, cancelled: number, spentMinor: number }} d
 * @param {Date | undefined} orderedAt a new order: sets the first and last order times
 * @param {Date} at
 */
export const bump = (db, id, d, orderedAt, at) =>
  db
    .update(customers)
    .set({
      ordersCount: sql`${customers.ordersCount} + ${d.orders}`,
      deliveredCount: sql`${customers.deliveredCount} + ${d.delivered}`,
      refusedCount: sql`${customers.refusedCount} + ${d.refused}`,
      cancelledCount: sql`${customers.cancelledCount} + ${d.cancelled}`,
      spentMinor: sql`${customers.spentMinor} + ${d.spentMinor}`,
      ...(orderedAt ? { firstOrderAt: sql`least(coalesce(${customers.firstOrderAt}, ${orderedAt}), ${orderedAt})`, lastOrderAt: sql`greatest(coalesce(${customers.lastOrderAt}, ${orderedAt}), ${orderedAt})` } : {}),
      updatedAt: at,
    })
    .where(eq(customers.id, id))

/** @param {Db} db @param {string} customerId */
export const notesOf = (db, customerId) =>
  db
    .select({ id: customerNotes.id, body: customerNotes.body, createdAt: customerNotes.createdAt, staffName: staffUsers.name })
    .from(customerNotes)
    .leftJoin(staffUsers, eq(staffUsers.id, customerNotes.staffUserId))
    .where(eq(customerNotes.customerId, customerId))
    .orderBy(desc(customerNotes.createdAt), desc(customerNotes.id))

/** @param {Db} db @param {typeof customerNotes.$inferInsert} row */
export const insertNote = (db, row) => db.insert(customerNotes).values(row)

/** @param {Db} db @param {string} customerId */
export const deleteNotes = (db, customerId) => db.delete(customerNotes).where(eq(customerNotes.customerId, customerId))
