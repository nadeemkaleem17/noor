import { and, asc, count, desc, eq, exists, gte, inArray, like, lte, or, sql } from 'drizzle-orm'
import { staffUsers } from '../../db/schema/auth.js'
import { likePrefix, phonePrefix } from '../../platform/search-text.js'
import { customerNotes, customers } from '../../db/schema/customers.js'
import { customerAccounts } from '../../db/schema/accounts.js'
import { customerHighlightRules, visitors, visits } from '../../db/schema/visits.js'

/** @typedef {import('../../platform/db.js').Executor} Db */
/** @typedef {typeof customers.$inferSelect} CustomerRow */

const sorts = /** @type {const} */ ({
  name: customers.name,
  city: customers.city,
  ordersCount: customers.ordersCount,
  refusedCount: customers.refusedCount,
  spent: customers.spentMinor,
  lastOrderAt: customers.lastOrderAt,
  visitsCount: customers.visitsCount,
  createdAt: customers.createdAt,
})

/**
 * @param {Db} db
 * @param {{ q?: string, cityName?: string, flag?: 'no_cod' | 'vip' | 'consent', minOrders?: number, hasRefusals?: boolean, minVisits?: number, registered?: boolean, rule?: string, sort?: string, page: number, size: number }} f
 */
export async function listCustomers(db, { q, cityName, flag, minOrders, hasRefusals, minVisits, registered, rule, sort, page, size }) {
  const phone = q ? phonePrefix(q) : undefined
  // "the customers this rule colours": the rule's own range on the count it is about (a rule that is off or gone matches nobody)
  const ruleRow = rule ? (await db.select().from(customerHighlightRules).where(eq(customerHighlightRules.id, rule)))[0] : undefined
  const column = ruleRow?.kind === 'visits' ? customers.visitsCount : customers.ordersCount
  const where = and(
    // the start of a name or a phone number, or a whole e-mail address: each is an index
    q ? or(like(customers.name, likePrefix(q)), eq(customers.email, q), phone ? like(customers.phone, phone) : undefined) : undefined,
    cityName ? eq(customers.city, cityName) : undefined,
    flag === 'no_cod' ? eq(customers.noCod, true) : flag === 'vip' ? eq(customers.vip, true) : flag === 'consent' ? eq(customers.marketingConsent, true) : undefined,
    minOrders ? gte(customers.ordersCount, minOrders) : undefined,
    hasRefusals ? gte(customers.refusedCount, 1) : undefined,
    minVisits ? gte(customers.visitsCount, minVisits) : undefined,
    registered ? exists(db.select({ one: sql`1` }).from(customerAccounts).where(eq(customerAccounts.customerId, customers.id))) : undefined,
    rule ? (ruleRow?.enabled ? and(gte(column, ruleRow.minCount), ruleRow.maxCount === null ? undefined : lte(column, ruleRow.maxCount)) : sql`false`) : undefined,
  )
  const key = /** @type {keyof typeof sorts} */ ((sort ?? '-lastOrderAt').replace(/^-/, ''))
  const sortColumn = sorts[key] ?? sorts.lastOrderAt
  const order = (sort ?? '-lastOrderAt').startsWith('-') ? desc(sortColumn) : asc(sortColumn)
  const [rows, total] = await Promise.all([
    db.select().from(customers).where(where).orderBy(order, asc(customers.id)).limit(size).offset((page - 1) * size),
    db.select({ n: count() }).from(customers).where(where),
  ])
  return { rows, total: total[0]?.n ?? 0 }
}

/** When each of these customers registered an account, and signed in last. @param {Db} db @param {string[]} ids */
export async function accountsOf(db, ids) {
  if (!ids.length) return new Map()
  const rows = await db.select({ id: customerAccounts.customerId, registeredAt: customerAccounts.registeredAt, lastLoginAt: customerAccounts.lastLoginAt }).from(customerAccounts).where(inArray(customerAccounts.customerId, ids))
  return new Map(rows.map((a) => [a.id, a]))
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

/** @param {Db} db @param {string} id @param {number} added @param {Date} at */
export const bumpVisits = (db, id, added, at) =>
  db
    .update(customers)
    .set({ visitsCount: sql`${customers.visitsCount} + ${added}`, lastVisitAt: sql`greatest(coalesce(${customers.lastVisitAt}, ${at}), ${at})`, updatedAt: at })
    .where(eq(customers.id, id))

/** The latest visits of every browser linked to the customer, and how many browsers that is. @param {Db} db @param {string} customerId */
export async function visitsOf(db, customerId) {
  const [recent, devices] = await Promise.all([
    db
      .select({ startedAt: visits.startedAt, landingPath: visits.landingPath })
      .from(visits)
      .innerJoin(visitors, eq(visitors.id, visits.visitorId))
      .where(eq(visitors.customerId, customerId))
      .orderBy(desc(visits.startedAt), desc(visits.id))
      .limit(10),
    db.select({ n: count() }).from(visitors).where(eq(visitors.customerId, customerId)),
  ])
  return { recent, devices: devices[0]?.n ?? 0 }
}

/** The browsers of an anonymised customer are forgotten, with their visits (they cascade). @param {Db} db @param {string} customerId */
export const forgetVisitors = (db, customerId) => db.delete(visitors).where(eq(visitors.customerId, customerId))

/** @param {Db} db */
export const allRules = (db) => db.select().from(customerHighlightRules).orderBy(asc(customerHighlightRules.kind), asc(customerHighlightRules.minCount), asc(customerHighlightRules.id))

/** @param {Db} db @param {typeof customerHighlightRules.$inferInsert} row */
export const insertRule = (db, row) => db.insert(customerHighlightRules).values(row)

/** @param {Db} db @param {string} id @param {Partial<typeof customerHighlightRules.$inferInsert>} set */
export const updateRule = (db, id, set) => db.update(customerHighlightRules).set(set).where(eq(customerHighlightRules.id, id))

/** @param {Db} db @param {string[]} ids */
export const deleteRules = (db, ids) => (ids.length ? db.delete(customerHighlightRules).where(inArray(customerHighlightRules.id, ids)) : Promise.resolve())
