// Return and exchange requests (plan/10-api/10-returns.md). The customer asks through the order's link; staff approve, decline, mark received and complete.
// This module writes its own tables only: the order, the stock and the money are changed by the order screens, after staff have decided.
import { and, count, desc, eq, inArray } from 'drizzle-orm'
import { returnNext } from '@noor/contract'
import { orderLines, orders } from '../../db/schema/orders.js'
import { returnRequestLines, returnRequests } from '../../db/schema/returns.js'
import { staffUsers } from '../../db/schema/auth.js'
import { now } from '../../platform/clock.js'
import { ensureCounter, nextValue } from '../../platform/counters.js'
import { transaction } from '../../platform/db.js'
import { DomainError } from '../../platform/errors.js'
import { uuidv7 } from '../../platform/ids.js'
import { record } from '../audit/index.js'
import { eligibleUntil, requestsOf, returnableOf, returnNumber } from './offer.js'

/**
 * @typedef {{ staffId: string, name: string, role: string }} Staff
 * @typedef {{ ip: string, userAgent: string, requestId: string }} RequestInfo
 * @typedef {import('../../platform/db.js').Executor} Db
 */

const money = (/** @type {number} */ amount) => ({ amount, currency: /** @type {const} */ ('PKR') })
const refuse = (/** @type {string} */ path, /** @type {'required' | 'invalid_format' | 'too_big'} */ code) => new DomainError('validation_failed', { issues: [{ path, code }] })
const orderNumberOf = (/** @type {{ numberPrefix: string, number: number }} */ o) => `${o.numberPrefix}-${o.number}`

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {{ orderByToken: (token: string) => Promise<{ id: string }> }} deps.orders the public order service: the link is the proof
 * @param {{ get: (key: 'store') => Promise<{ value: import('@noor/contract').StoreSettings }> }} deps.settings
 */
export function createReturnsService({ db, orders: publicOrders, settings }) {
  /** @param {Staff} a @param {RequestInfo} req */
  const audit = (a, req) => ({ actor: { type: /** @type {const} */ ('staff'), id: a.staffId, label: a.name, role: a.role }, ip: req.ip, userAgent: req.userAgent, requestId: req.requestId })

  /** @param {Db} x @param {{ status?: string, orderId?: string, id?: string }} q @param {{ limit: number, offset: number } | null} paging */
  async function rows(x, q, paging) {
    const where = and(q.status ? eq(returnRequests.status, /** @type {never} */ (q.status)) : undefined, q.orderId ? eq(returnRequests.orderId, q.orderId) : undefined, q.id ? eq(returnRequests.id, q.id) : undefined)
    const base = x
      .select({ r: returnRequests, num: orders.number, prefix: orders.numberPrefix, name: orders.customerName, phone: orders.customerPhone, total: orders.totalMinor, by: staffUsers.name })
      .from(returnRequests)
      .innerJoin(orders, eq(orders.id, returnRequests.orderId))
      .leftJoin(staffUsers, eq(staffUsers.id, returnRequests.decidedBy))
      .where(where)
      .orderBy(desc(returnRequests.requestedAt))
    const found = paging ? await base.limit(paging.limit).offset(paging.offset) : await base
    const lines = found.length
      ? await x
          .select({ requestId: returnRequestLines.requestId, quantity: returnRequestLines.quantity, title: orderLines.title, variantLabel: orderLines.variantLabel, unit: orderLines.unitPriceMinor })
          .from(returnRequestLines)
          .innerJoin(orderLines, eq(orderLines.id, returnRequestLines.orderLineId))
          .where(inArray(returnRequestLines.requestId, found.map((f) => f.r.id)))
      : []
    return found.map(({ r, num, prefix, name, phone, total, by }) => ({
      id: r.id, number: returnNumber(r.number), kind: r.kind, status: r.status, reason: r.reason,
      ...(r.note ? { note: r.note } : {}), ...(r.exchangeNote ? { exchangeNote: r.exchangeNote } : {}),
      requestedAt: r.requestedAt.toISOString(), ...(r.decidedAt ? { decidedAt: r.decidedAt.toISOString() } : {}), ...(by ? { decidedBy: by } : {}),
      ...(r.decisionNote ? { decisionNote: r.decisionNote } : {}), ...(r.pickupOn ? { pickupOn: r.pickupOn } : {}), ...(r.refundMinor != null ? { refund: money(r.refundMinor) } : {}),
      orderId: r.orderId, orderNumber: orderNumberOf({ numberPrefix: prefix, number: num }), customerName: name, customerPhone: phone,
      lines: lines.filter((l) => l.requestId === r.id).map((l) => ({ title: l.title, variantLabel: l.variantLabel, quantity: l.quantity, lineTotal: money(l.unit * l.quantity) })),
      orderTotal: money(total),
      next: [...returnNext[r.status]],
    }))
  }

  return {
    /**
     * The customer's request. Checked again here, under the order's lock: the window, that every line is theirs, and that nothing is asked twice
     * (what an earlier request or an earlier return already took is not offered again).
     * @param {string} token @param {import('@noor/contract').CreateReturnBody} body
     */
    async create(token, body) {
      const found = await publicOrders.orderByToken(token)
      const windowDays = (await settings.get('store')).value.policies.returnsDays ?? 0
      const duplicate = body.lines.findIndex((l, i) => body.lines.findIndex((m) => m.lineId === l.lineId) !== i)
      if (duplicate >= 0) throw refuse(`lines.${duplicate}.lineId`, 'invalid_format')
      return transaction(db, async (tx) => {
        const [o] = await tx.select().from(orders).where(eq(orders.id, found.id)).for('update')
        if (!o) throw new DomainError('not_found')
        if (!eligibleUntil(o, windowDays, now())) throw new DomainError('action_not_allowed')
        const lines = await tx.select().from(orderLines).where(eq(orderLines.orderId, o.id))
        const { requests, lines: asked } = await requestsOf(tx, o.id)
        const live = new Set(requests.filter((r) => r.status !== 'declined').map((r) => r.id))
        body.lines.forEach((want, i) => {
          const line = lines.find((l) => l.id === want.lineId)
          if (!line) throw refuse(`lines.${i}.lineId`, 'invalid_format')
          const taken = asked.filter((a) => a.orderLineId === line.id && live.has(a.requestId)).reduce((n, a) => n + a.quantity, 0)
          if (want.quantity > returnableOf(line, taken)) throw refuse(`lines.${i}.quantity`, 'too_big')
        })
        await ensureCounter(tx, 'return_request', 0)
        const number = await nextValue(tx, 'return_request')
        const id = uuidv7()
        const at = now()
        await tx.insert(returnRequests).values({
          id, number, orderId: o.id, kind: body.kind, reason: body.reason, note: body.note || null, exchangeNote: body.kind === 'exchange' ? body.exchangeNote || null : null, requestedAt: at, updatedAt: at,
        })
        await tx.insert(returnRequestLines).values(body.lines.map((l) => ({ requestId: id, orderLineId: l.lineId, quantity: l.quantity })))
        return { number: returnNumber(number) }
      })
    },

    /** @param {{ status?: import('@noor/contract').ReturnRow['status'], orderId?: string, page: number, size: number }} q */
    async list(q) {
      const where = and(q.status ? eq(returnRequests.status, q.status) : undefined, q.orderId ? eq(returnRequests.orderId, q.orderId) : undefined)
      const [items, total, byStatus] = await Promise.all([
        rows(db, q, { limit: q.size, offset: (q.page - 1) * q.size }),
        db.select({ n: count() }).from(returnRequests).where(where),
        db.select({ status: returnRequests.status, n: count() }).from(returnRequests).groupBy(returnRequests.status),
      ])
      const counts = { requested: 0, approved: 0, declined: 0, received: 0, completed: 0 }
      for (const c of byStatus) counts[c.status] = c.n
      return { items, total: total[0]?.n ?? 0, page: q.page, size: q.size, counts }
    },

    /** @param {Staff} actor @param {string} id @param {import('@noor/contract').ReturnUpdateBody} input @param {RequestInfo} req */
    async update(actor, id, input, req) {
      await transaction(db, async (tx) => {
        const [r] = await tx.select().from(returnRequests).where(eq(returnRequests.id, id)).for('update')
        if (!r) throw new DomainError('not_found')
        if (!returnNext[r.status].includes(/** @type {never} */ (input.status))) throw new DomainError('action_not_allowed')
        if (input.status === 'declined' && !input.decisionNote) throw refuse('decisionNote', 'required')
        if (input.pickupOn && input.status !== 'approved' && input.status !== 'received') throw refuse('pickupOn', 'invalid_format')
        if (input.refund != null) {
          const [o] = await tx.select({ total: orders.totalMinor }).from(orders).where(eq(orders.id, r.orderId))
          if (input.status === 'declined') throw refuse('refund', 'invalid_format')
          if (input.refund > (o?.total ?? 0)) throw refuse('refund', 'too_big')
        }
        const at = now()
        await tx
          .update(returnRequests)
          .set({
            status: input.status,
            ...(input.decisionNote !== undefined ? { decisionNote: input.decisionNote || null } : {}),
            ...(input.pickupOn ? { pickupOn: input.pickupOn } : {}),
            ...(input.refund != null ? { refundMinor: input.refund } : {}),
            ...(r.status === 'requested' ? { decidedAt: at, decidedBy: actor.staffId } : {}),
            updatedAt: at,
          })
          .where(eq(returnRequests.id, id))
        await record(tx, {
          ...audit(actor, req), action: `return_request.${input.status}`, entityType: 'return_request', entityId: id, entityLabel: returnNumber(r.number),
          diff: { status: [r.status, input.status], ...(input.refund != null ? { refundMinor: [r.refundMinor, input.refund] } : {}) },
          ...(input.decisionNote ? { reason: input.decisionNote } : {}), ...(input.refund != null ? { category: /** @type {const} */ ('money') } : {}),
        })
      })
      const [row] = await rows(db, { id }, null)
      if (!row) throw new DomainError('not_found')
      return row
    },
  }
}
