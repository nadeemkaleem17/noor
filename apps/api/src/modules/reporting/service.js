// What staff look at to run the shop (plan/10-api/08-admin-dashboard-ops.md, plan/07-admin/02-dashboard.md section 4) and what the browsers tell us about speed.
// Every figure is worked out in SQL here, over days in Pakistan, and every section is left out for a person without the permission to read what it counts.
import { and, asc, count, desc, eq, gte, inArray, like, lt, or, sql } from 'drizzle-orm'
import { maskPkMobile } from '@noor/contract'
import { customers } from '../../db/schema/customers.js'
import { jobs, jobsDead } from '../../db/schema/platform.js'
import { orderLines, orders } from '../../db/schema/orders.js'
import { productMedia, products, variants } from '../../db/schema/products.js'
import { reviews } from '../../db/schema/reviews.js'
import { webVitalsDaily } from '../../db/schema/reporting.js'
import { searchMisses } from '../../db/schema/search.js'
import { now } from '../../platform/clock.js'
import { likePrefix, phonePrefix } from '../../platform/search-text.js'
import { transaction } from '../../platform/db.js'
import { DomainError } from '../../platform/errors.js'
import { enqueue } from '../../platform/jobs.js'
import { record } from '../audit/index.js'
import { shortName } from '../orders/public.js'

/**
 * @typedef {import('../../platform/db.js').Executor} Db
 * @typedef {import('../../platform/http/route-registrar.js').Actor} Actor
 */

const money = (/** @type {number} */ amount) => ({ amount, currency: /** @type {const} */ ('PKR') })
const may = (/** @type {Actor} */ actor, /** @type {string} */ permission) => actor.permissions.has(/** @type {never} */ (permission))
const DAY = 86_400_000
/** Pakistan is five hours ahead of UTC all year. */
const PKT_HOURS = 5

/** The moment a Pakistani day begins. @param {string} day */
const dayStart = (day) => new Date(`${day}T00:00:00+05:00`)
/** @param {string} day @param {number} n */
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10)

/** A period of whole days, as the instants it starts and ends (the end excluded). Refuses a backwards or a too long one. @param {string} from @param {string} to */
function period(from, to) {
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY + 1
  if (!(days >= 1) || days > 366) throw new DomainError('validation_failed', { issues: [{ path: 'to', code: days < 1 || Number.isNaN(days) ? 'invalid_format' : 'too_big' }] })
  return { from, to, days, start: dayStart(from), end: dayStart(addDays(to, 1)) }
}

/** The routes whose speed is kept apart; anything else is `other`. */
const VITAL_ROUTES = new Set(['home', 'category', 'product', 'cart', 'checkout', 'order', 'page'])
const bucketOf = (/** @type {string} */ metric, /** @type {number} */ value) => Math.min(100, Math.floor(metric === 'CLS' ? value / 0.01 : value / 100))
const bucketSize = (/** @type {string} */ metric) => (metric === 'CLS' ? 0.01 : 100)

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {import('../../platform/config.js').Config} deps.config
 * @param {{ value: (key: 'payments' | 'store', x: Db) => Promise<{ value: any }> }} deps.settings
 * @param {{ imagesFor: (ids: string[]) => Promise<Record<string, import('@noor/contract').Image>> }} deps.media
 */
export function createReporting({ db, config, settings, media }) {
  /** The figures of the orders placed in a period: the definitions of plan/07-admin/02-dashboard.md section 4. @param {{ start: Date, end: Date }} p */
  async function kpis(p) {
    const inPeriod = and(gte(orders.placedAt, p.start), lt(orders.placedAt, p.end))
    const [r] = await db
      .select({
        net: sql`coalesce(sum(case when ${orders.status} not in ('cancelled', 'returned') then ${orders.totalMinor} else 0 end), 0)`.mapWith(Number),
        placed: sql`coalesce(sum(case when ${orders.status} <> 'cancelled' then 1 else 0 end), 0)`.mapWith(Number),
        delivered: sql`coalesce(sum(case when ${orders.status} = 'delivered' then 1 else 0 end), 0)`.mapWith(Number),
        cancelled: sql`coalesce(sum(case when ${orders.status} = 'cancelled' then 1 else 0 end), 0)`.mapWith(Number),
        returned: sql`coalesce(sum(case when ${orders.status} = 'returned' then 1 else 0 end), 0)`.mapWith(Number),
      })
      .from(orders)
      .where(inPeriod)
    const net = r?.net ?? 0
    const placed = r?.placed ?? 0
    const finals = (r?.delivered ?? 0) + (r?.cancelled ?? 0) + (r?.returned ?? 0)
    /** @type {Record<string, number>} */
    const byReason = {}
    if (r?.cancelled) for (const x of await db.select({ reason: orders.cancelReason, n: count() }).from(orders).where(and(inPeriod, eq(orders.status, 'cancelled'))).groupBy(orders.cancelReason)) byReason[x.reason ?? 'other'] = x.n
    if (r?.returned) {
      const kinds = await db.execute(sql`select json_unquote(json_extract(e.data, '$.returnType')) as kind, count(*) as n from order_events e join orders o on o.id = e.order_id where e.type = 'status_changed' and e.to_status = 'returned' and o.placed_at >= ${p.start} and o.placed_at < ${p.end} group by kind`)
      for (const x of /** @type {{ kind: string | null, n: number | string }[]} */ (/** @type {unknown} */ (kinds[0]))) byReason[x.kind ?? 'other'] = Number(x.n)
    }
    return {
      netSales: money(net),
      orders: placed,
      ...(placed ? { averageOrder: money(Math.floor((2 * net + placed) / (2 * placed))) } : {}), // rounded half up
      // too few finished orders say nothing about the rate
      ...(finals >= 20 ? { deliveredRate: (r?.delivered ?? 0) / finals, cancelledRate: ((r?.cancelled ?? 0) + (r?.returned ?? 0)) / finals } : {}),
      ...(Object.keys(byReason).length ? { cancelledByReason: byReason } : {}),
    }
  }

  /** @param {Actor} actor */
  function needOrders(actor) {
    if (!may(actor, 'orders:read')) throw new DomainError('forbidden')
  }

  return {
    // ---------------------------------------------------------------- menu and to-do
    /** @param {Actor} actor */
    async navCounts(actor) {
      /** @type {{ ordersNeedingAction?: number, reviewsPending?: number }} */
      const out = {}
      if (may(actor, 'orders:read')) out.ordersNeedingAction = (await db.select({ n: count() }).from(orders).where(inArray(orders.status, ['pending_confirmation', 'confirmed'])))[0]?.n ?? 0
      // with reviews switched off in the store settings the menu has no Reviews: the count is left out
      if (may(actor, 'reviews:read') && (await settings.value('store', db)).value.features.reviews) out.reviewsPending = (await db.select({ n: count() }).from(reviews).where(eq(reviews.status, 'pending')))[0]?.n ?? 0
      return out
    },

    /** @param {Actor} actor */
    async todo(actor) {
      /** @type {import('@noor/contract').z.infer<typeof import('@noor/contract').TodoCounts>} */
      const out = {}
      if (may(actor, 'orders:read')) {
        const [toConfirm] = await db.select({ n: count(), oldest: sql`min(${orders.statusChangedAt})`.mapWith((v) => (v ? new Date(v) : undefined)) }).from(orders).where(eq(orders.status, 'pending_confirmation'))
        out.toConfirm = { count: toConfirm?.n ?? 0, ...(toConfirm?.oldest ? { oldestAt: toConfirm.oldest.toISOString() } : {}) }
        // a made-to-order piece is not late while its making time has not begun to run out: it waits until its shortest lead time has passed
        const waiting = and(
          eq(orders.status, 'confirmed'),
          sql`not exists (select 1 from ${orderLines} l where l.order_id = ${orders.id} and l.lead_min_days is not null and date_add(${orders.confirmedAt}, interval l.lead_min_days day) > ${now()})`,
        )
        const [toDispatch] = await db.select({ n: count(), oldest: sql`min(${orders.confirmedAt})`.mapWith((v) => (v ? new Date(v) : undefined)) }).from(orders).where(waiting)
        out.toDispatch = { count: toDispatch?.n ?? 0, ...(toDispatch?.oldest ? { oldestAt: toDispatch.oldest.toISOString() } : {}) }
        const methods = /** @type {{ type: string, enabled: boolean }[]} */ ((await settings.value('payments', db)).value.methods)
        if (methods.some((m) => m.type !== 'cod' && m.enabled)) out.awaitingPayment = { count: (await db.select({ n: count() }).from(orders).where(eq(orders.status, 'pending')))[0]?.n ?? 0 }
      }
      if (may(actor, 'products:read')) {
        const rows = await db.select({ status: products.stockStatus, n: count() }).from(products).where(eq(products.status, 'active')).groupBy(products.stockStatus)
        out.lowStock = { count: rows.find((r) => r.status === 'low_stock')?.n ?? 0 }
        out.soldOut = { count: rows.find((r) => r.status === 'sold_out')?.n ?? 0 }
      }
      if (may(actor, 'reviews:read')) out.reviewsPending = { count: (await db.select({ n: count() }).from(reviews).where(eq(reviews.status, 'pending')))[0]?.n ?? 0 }
      if (may(actor, 'audit:read')) out.failedJobs = { count: (await db.select({ n: count() }).from(jobsDead))[0]?.n ?? 0 }
      return out
    },

    // ---------------------------------------------------------------- sales
    /** @param {Actor} actor @param {{ from: string, to: string }} q */
    async summary(actor, q) {
      needOrders(actor)
      const p = period(q.from, q.to)
      const before = { start: dayStart(addDays(q.from, -p.days)), end: p.start }
      const [current, previous] = await Promise.all([kpis(p), kpis(before)])

      // a long range is shown by the week (Monday to Sunday), a short one by the day
      const weekly = p.days > 31
      const dayOf = sql`date(date_add(${orders.placedAt}, interval ${sql.raw(String(PKT_HOURS))} hour))`
      const first = weekly ? sql`date_sub(${dayOf}, interval weekday(${dayOf}) day)` : dayOf
      const keyOf = sql`date_format(${first}, '%Y-%m-%d')` // the same text in the list and in the grouping, as the database wants
      const rows = await db
        .select({
          key: sql`${keyOf}`.mapWith(String),
          sales: sql`coalesce(sum(case when ${orders.status} not in ('cancelled', 'returned') then ${orders.totalMinor} else 0 end), 0)`.mapWith(Number),
          n: sql`coalesce(sum(case when ${orders.status} <> 'cancelled' then 1 else 0 end), 0)`.mapWith(Number),
        })
        .from(orders)
        .where(and(gte(orders.placedAt, p.start), lt(orders.placedAt, p.end)))
        .groupBy(keyOf)
      const byDay = []
      const begin = weekly ? addDays(q.from, -((new Date(`${q.from}T00:00:00Z`).getUTCDay() + 6) % 7)) : q.from
      for (let d = begin; d <= q.to; d = addDays(d, weekly ? 7 : 1)) {
        const r = rows.find((x) => x.key === d)
        byDay.push({ day: d, sales: money(r?.sales ?? 0), orders: r?.n ?? 0 })
      }
      return { current, previous, byDay, bucket: /** @type {'week' | 'day'} */ (weekly ? 'week' : 'day') }
    },

    /** The products that sold most in the period by net sales: delivered or not, never cancelled or returned. @param {Actor} actor @param {{ from: string, to: string, limit: number }} q */
    async topProducts(actor, q) {
      needOrders(actor)
      const p = period(q.from, q.to)
      const rows = await db
        .select({
          productId: orderLines.productId,
          units: sql`sum(${orderLines.quantity})`.mapWith(Number),
          sales: sql`sum(${orderLines.lineSubtotalMinor} - ${orderLines.discountMinor})`.mapWith(Number),
          image: sql`max(${orderLines.imageMediaId})`.mapWith(String),
        })
        .from(orderLines)
        .innerJoin(orders, eq(orders.id, orderLines.orderId))
        .where(and(gte(orders.placedAt, p.start), lt(orders.placedAt, p.end), sql`${orders.status} not in ('cancelled', 'returned')`))
        .groupBy(orderLines.productId)
        .orderBy(desc(sql`sum(${orderLines.lineSubtotalMinor} - ${orderLines.discountMinor})`), asc(orderLines.productId))
        .limit(q.limit)
      if (!rows.length) return { items: [] }
      const [titles, images] = await Promise.all([
        db.select({ id: products.id, title: products.title }).from(products).where(inArray(products.id, rows.map((r) => r.productId))),
        media.imagesFor(rows.flatMap((r) => (r.image && r.image !== 'null' ? [r.image] : []))),
      ])
      return { items: rows.map((r) => ({ productId: r.productId, title: titles.find((t) => t.id === r.productId)?.title ?? '', ...(images[r.image] ? { image: images[r.image] } : {}), units: r.units, sales: money(r.sales) })) }
    },

    /** What the shop's own search could not answer, most asked first. @param {{ from: string, to: string, limit: number }} q */
    async zeroSearches(q) {
      period(q.from, q.to)
      const rows = await db
        .select({ query: searchMisses.query, n: sql`sum(${searchMisses.count})`.mapWith(Number) })
        .from(searchMisses)
        .where(and(gte(searchMisses.day, q.from), sql`${searchMisses.day} <= ${q.to}`))
        .groupBy(searchMisses.query)
        .orderBy(desc(sql`sum(${searchMisses.count})`), asc(searchMisses.query))
        .limit(q.limit)
      return { items: rows.map((r) => ({ query: r.query, count: r.n })) }
    },

    // ---------------------------------------------------------------- the search box
    /** Orders, products and customers by the ways a person looks for them: each section only for those who may see it, five at most. @param {Actor} actor @param {string} q */
    async search(actor, q) {
      const seeCustomers = may(actor, 'customers:read')
      const phone = phonePrefix(q)
      const prefix = likePrefix(q)

      const orderRows = may(actor, 'orders:read')
        ? await (async () => {
            const num = /^(?:[A-Za-z]{1,4}-?)?(\d{1,12})$/.exec(q.replace(/\s+/g, ''))
            const where = or(
              num ? eq(orders.number, Number(num[1])) : undefined,
              eq(orders.trackingNumber, q),
              // a name or a phone is only a way in for those who may read customers: finding is seeing
              seeCustomers ? like(orders.customerName, prefix) : undefined,
              seeCustomers && phone ? like(orders.customerPhone, phone) : undefined,
            )
            return db.select().from(orders).where(where).orderBy(desc(orders.placedAt)).limit(5)
          })()
        : []

      const productRows = may(actor, 'products:read')
        ? await (async () => {
            const bySku = await db.select({ id: variants.productId, sku: variants.sku }).from(variants).where(eq(variants.sku, q)).limit(5)
            const found = await db
              .select()
              .from(products)
              .where(or(like(products.title, prefix), like(products.handle, prefix), bySku.length ? inArray(products.id, bySku.map((s) => s.id)) : undefined))
              .orderBy(asc(products.title))
              .limit(5)
            const first = found.length ? await db.select({ productId: productMedia.productId, mediaId: productMedia.mediaId }).from(productMedia).where(inArray(productMedia.productId, found.map((f) => f.id))).orderBy(asc(productMedia.sortOrder)) : []
            const images = await media.imagesFor(first.map((m) => m.mediaId))
            return found.map((f) => ({ ...f, sku: bySku.find((s) => s.id === f.id)?.sku, image: images[first.find((m) => m.productId === f.id)?.mediaId ?? ''] }))
          })()
        : []

      const customerRows = seeCustomers
        ? await db.select().from(customers).where(or(like(customers.name, prefix), phone ? like(customers.phone, phone) : undefined)).orderBy(desc(customers.lastOrderAt)).limit(5)
        : []

      return {
        orders: orderRows.map((o) => ({ id: o.id, orderNumber: `${o.numberPrefix}-${o.number}`, status: /** @type {never} */ (o.status), customerName: seeCustomers ? o.customerName : shortName(o.customerName), total: money(o.totalMinor) })),
        products: productRows.map((p) => ({ id: p.id, title: p.title, ...(p.sku ? { sku: p.sku } : {}), status: /** @type {never} */ (p.status), stockStatus: /** @type {never} */ (p.stockStatus), ...(p.image ? { image: p.image } : {}) })),
        customers: customerRows.map((c) => ({ id: c.id, name: c.name, phone: seeCustomers ? c.phone : maskPkMobile(c.phone), ...(c.city ? { city: c.city } : {}), ordersCount: c.ordersCount })),
      }
    },

    // ---------------------------------------------------------------- jobs and the system
    /** @param {{ type?: string | undefined, page: number, size: number }} q */
    async deadJobs({ type, page, size }) {
      const where = type ? eq(jobsDead.type, type) : undefined
      const [rows, total] = await Promise.all([
        db.select().from(jobsDead).where(where).orderBy(desc(jobsDead.diedAt), desc(jobsDead.id)).limit(size).offset((page - 1) * size),
        db.select({ n: count() }).from(jobsDead).where(where),
      ])
      return { items: rows.map((j) => ({ id: j.id, type: j.type, attempts: j.attempts, ...(j.lastError ? { lastError: j.lastError } : {}), diedAt: j.diedAt.toISOString() })), total: total[0]?.n ?? 0, page, size }
    },

    /** A failed job goes back to the queue, to be tried again from the start. @param {{ staffId: string, name?: string, role: string }} actor @param {string} id @param {{ ip?: string, userAgent?: string, requestId?: string }} req */
    async retryJob(actor, id, req) {
      await transaction(db, async (tx) => {
        const [j] = await tx.select().from(jobsDead).where(eq(jobsDead.id, id)).for('update')
        if (!j) throw new DomainError('not_found')
        await tx.delete(jobsDead).where(eq(jobsDead.id, id))
        await enqueue(tx, { type: j.type, payload: j.payload, ...(j.uniqueKey ? { uniqueKey: j.uniqueKey } : {}), maxAttempts: j.maxAttempts })
        await record(tx, { actor: { type: 'staff', id: actor.staffId, label: actor.name ?? 'Staff', role: actor.role }, action: 'job.retried', entityType: 'job', entityId: id, entityLabel: j.type, ...req })
      })
    },

    async systemInfo() {
      const [pending, dead, oldest] = await Promise.all([
        db.select({ n: count() }).from(jobs),
        db.select({ n: count() }).from(jobsDead),
        db.select({ at: sql`min(${jobs.runAt})`.mapWith((v) => (v ? new Date(v) : undefined)) }).from(jobs).where(sql`${jobs.lockedAt} is null and ${jobs.runAt} <= ${now()}`),
      ])
      const age = oldest[0]?.at ? Math.max(0, Math.floor((now().getTime() - oldest[0].at.getTime()) / 1000)) : undefined
      return { environment: config.APP_ENV, version: config.APP_VERSION, queue: { pending: pending[0]?.n ?? 0, dead: dead[0]?.n ?? 0, ...(age !== undefined ? { oldestPendingAgeSec: age } : {}) } }
    },

    // ---------------------------------------------------------------- nightly
    /** Units sold in delivered orders of the last 90 days, per product: what the `bestselling` order uses. */
    async salesCounts() {
      const since = new Date(now().getTime() - 90 * DAY)
      await db.execute(sql`update products p left join (select l.product_id, sum(l.quantity - l.returned_quantity) as units from order_lines l join orders o on o.id = l.order_id where o.status = 'delivered' and o.delivered_at >= ${since} group by l.product_id) s on s.product_id = p.id set p.sales_count = coalesce(s.units, 0)`)
    },

    // ---------------------------------------------------------------- what browsers report
    /** One more page view of this speed, counted by day, page and size, nothing about who. @param {{ name: 'LCP' | 'INP' | 'CLS', value: number, route: string }} v */
    async recordVital({ name, value, route }) {
      const r = route.toLowerCase().trim()
      const day = new Date(now().getTime() + PKT_HOURS * 3_600_000).toISOString().slice(0, 10)
      await db
        .insert(webVitalsDaily)
        .values({ day, route: VITAL_ROUTES.has(r) ? r : 'other', metric: name, bucket: bucketOf(name, value), count: 1 })
        .onDuplicateKeyUpdate({ set: { count: sql`${webVitalsDaily.count} + 1` } })
    },

    /** The speed that three of four visits beat: the top of the size bucket where the running count passes 75%. @param {string} route @param {'LCP' | 'INP' | 'CLS'} metric @param {number} [days] */
    async p75(route, metric, days = 28) {
      const since = new Date(now().getTime() + PKT_HOURS * 3_600_000 - days * DAY).toISOString().slice(0, 10)
      const rows = await db
        .select({ bucket: webVitalsDaily.bucket, n: sql`sum(${webVitalsDaily.count})`.mapWith(Number) })
        .from(webVitalsDaily)
        .where(and(eq(webVitalsDaily.route, route), eq(webVitalsDaily.metric, metric), gte(webVitalsDaily.day, since)))
        .groupBy(webVitalsDaily.bucket)
        .orderBy(asc(webVitalsDaily.bucket))
      const samples = rows.reduce((s, r) => s + r.n, 0)
      if (!samples) return { samples: 0 }
      let seen = 0
      for (const r of rows) {
        seen += r.n
        if (seen / samples >= 0.75) return { samples, p75: Math.round((r.bucket + 1) * bucketSize(metric) * 100) / 100 }
      }
      return { samples }
    },

    /** Counts older than 180 days are not needed. */
    async cleanup() {
      const before = new Date(now().getTime() + PKT_HOURS * 3_600_000 - 180 * DAY).toISOString().slice(0, 10)
      await db.delete(webVitalsDaily).where(sql`${webVitalsDaily.day} < ${before}`)
    },
  }
}

