// Visits: how often each browser comes back, kept by a random number in the shop's own cookie, and what that adds up to
// (plan/17-owner-requests-2026-10.md section 6). A browser belongs to a customer only after that browser placed an order, because that is the one moment a person
// names themselves; until then it is counted without a name, and never guessed at. Nothing here stores an address or a browser name.
import { and, count, countDistinct, eq, gte, isNotNull, lt, sql } from 'drizzle-orm'
import { visitors, visits } from '../../db/schema/visits.js'
import { DomainError } from '../../platform/errors.js'
import { transaction } from '../../platform/db.js'
import { now } from '../../platform/clock.js'
import { uuidv7 } from '../../platform/ids.js'

/** A new visit starts when someone comes back after this long without opening a page. */
export const VISIT_GAP_MS = 30 * 60_000

/** Pakistan is five hours ahead of UTC all year. */
const PKT_HOURS = 5
const DAY = 86_400_000
/** @param {string} day */
const dayStart = (day) => new Date(`${day}T00:00:00+05:00`)
/** @param {string} day @param {number} n */
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10)

/** Only the address of the page, no query and no fragment (they can hold a search or an order link). @param {string} path */
export function cleanPath(path) {
  const bare = path.split(/[?#]/)[0] ?? ''
  return (bare.startsWith('/') ? bare : `/${bare}`).slice(0, 120)
}

/** @param {unknown} e */
const isDuplicate = (e) => /** @type {{ cause?: { errno?: number }, errno?: number }} */ (e).cause?.errno === 1062 || /** @type {{ errno?: number }} */ (e).errno === 1062

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {{ addVisits: (tx: import('../../platform/db.js').Executor, customerId: string, added: number, at: Date) => Promise<void> }} deps.customers
 * @param {{ orderByToken: (token: string) => Promise<{ customerId: string }> }} deps.orders
 * @param {() => Promise<boolean>} deps.enabled is visit counting switched on in the store settings
 */
export function createVisitsService({ db, customers, orders, enabled }) {
  /** @param {import('../../platform/db.js').Executor} tx @param {string} id @param {string} path @param {Date} at */
  async function touch(tx, id, path, at) {
    const [row] = await tx.select().from(visitors).where(eq(visitors.id, id)).for('update')
    if (!row) {
      await tx.insert(visitors).values({ id, firstSeenAt: at, lastVisitAt: at, visitsCount: 1 })
      await tx.insert(visits).values({ id: uuidv7(), visitorId: id, startedAt: at, landingPath: path })
      return
    }
    const fresh = at.getTime() - row.lastVisitAt.getTime() > VISIT_GAP_MS
    if (!fresh) {
      // still the same stay: only the time of the last page moves, so a long stay is one visit
      await tx.update(visitors).set({ lastVisitAt: at }).where(eq(visitors.id, id))
      return
    }
    await tx.update(visitors).set({ lastVisitAt: at, visitsCount: sql`${visitors.visitsCount} + 1` }).where(eq(visitors.id, id))
    await tx.insert(visits).values({ id: uuidv7(), visitorId: id, startedAt: at, landingPath: path })
    if (row.customerId) await customers.addVisits(tx, row.customerId, 1, at)
  }

  return {
    /** A page was opened in this browser. @param {{ visitor: string, path: string }} input */
    async record({ visitor, path }) {
      if (!(await enabled())) return
      const at = now()
      const clean = cleanPath(path)
      try {
        await transaction(db, (tx) => touch(tx, visitor, clean, at))
      } catch (e) {
        if (!isDuplicate(e)) throw e
        // two first pages of one new browser at the same moment: the second finds the first one's row
        await transaction(db, (tx) => touch(tx, visitor, clean, at))
      }
    },

    /**
     * This browser placed this order, so its visits (those so far and those to come) are the customer's. A browser stays with the first customer who ordered from it:
     * two people on one computer are not told apart.
     * @param {{ visitor: string, order: string }} input
     */
    async link({ visitor, order }) {
      const { customerId } = await orders.orderByToken(order)
      await transaction(db, async (tx) => {
        const [row] = await tx.select().from(visitors).where(eq(visitors.id, visitor)).for('update')
        if (!row || row.customerId) return
        await tx.update(visitors).set({ customerId }).where(eq(visitors.id, visitor))
        await customers.addVisits(tx, customerId, row.visitsCount, row.lastVisitAt)
      })
    },

    /** Totals and visits per day over whole days in Pakistan, without any name: this is the anonymous side. @param {string} from @param {string} to */
    async summary(from, to) {
      const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY + 1
      if (!(days >= 1) || days > 366) throw new DomainError('validation_failed', { issues: [{ path: 'to', code: days < 1 || Number.isNaN(days) ? 'invalid_format' : 'too_big' }] })
      const start = dayStart(from)
      const end = dayStart(addDays(to, 1))
      const inPeriod = and(gte(visits.startedAt, start), lt(visits.startedAt, end))
      const dayExpr = sql`date(date_add(${visits.startedAt}, interval ${sql.raw(String(PKT_HOURS))} hour))`
      const [totals, perDay, fresh, identified] = await Promise.all([
        db.select({ visits: count(), visitors: countDistinct(visits.visitorId) }).from(visits).where(inPeriod),
        db.select({ day: sql`${dayExpr}`.mapWith(String), visits: count(), visitors: countDistinct(visits.visitorId) }).from(visits).where(inPeriod).groupBy(dayExpr).orderBy(dayExpr),
        db.select({ n: count() }).from(visitors).where(and(gte(visitors.firstSeenAt, start), lt(visitors.firstSeenAt, end))),
        db.select({ n: countDistinct(visits.visitorId) }).from(visits).innerJoin(visitors, eq(visitors.id, visits.visitorId)).where(and(inPeriod, isNotNull(visitors.customerId))),
      ])
      const seen = totals[0]?.visitors ?? 0
      const newVisitors = fresh[0]?.n ?? 0
      return {
        visits: totals[0]?.visits ?? 0,
        visitors: seen,
        newVisitors,
        returningVisitors: Math.max(0, seen - newVisitors),
        identifiedVisitors: identified[0]?.n ?? 0,
        days: perDay.map((d) => ({ day: String(d.day).slice(0, 10), visits: d.visits, visitors: d.visitors })),
      }
    },
  }
}
