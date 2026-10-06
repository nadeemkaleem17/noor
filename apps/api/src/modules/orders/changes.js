// Everything that changes an order after it is placed, except an edit of its contents (edit.js): the only code that writes `orders.status`
// (plan/09-data-model/07-orders-payments.md section 5.1). Each change locks the order, checks its version, follows an edge of the table,
// does its effects in the same transaction, and leaves an event, an audit entry and (where someone must hear of it) an outbox event.
import { enums } from '@noor/contract'
import { DomainError } from '../../platform/errors.js'
import { now } from '../../platform/clock.js'
import { ensureCounter, nextValue } from '../../platform/counters.js'
import { uuidv7 } from '../../platform/ids.js'
import { emit } from '../../platform/outbox.js'
import { record } from '../audit/index.js'
import * as repo from './repository.js'
import { confirmable, invoiceNumberOf } from './rules.js'
import { assertTransition } from './transitions.js'

/**
 * Who is changing the order: a staff member, the system (a job), or the customer through the link of their order.
 * @typedef {{ type: 'staff', id: string, label: string, role: string } | { type: 'system', label: string } | { type: 'storefront' }} OrderActor
 * @typedef {import('../../platform/db.js').Executor} Db
 * @typedef {{ ip?: string, userAgent?: string, requestId?: string }} RequestInfo
 *
 * What a change asks for. `version` is the one the person saw.
 * @typedef {{ version: number } & (
 *   | { to: 'confirmed', via?: 'call' | 'whatsapp' | 'customer_message', note?: string, codOverrideReason?: string }
 *   | { to: 'pending_confirmation', reason?: string }
 *   | { to: 'dispatched', courierId: string, trackingNumber?: string, dispatchedAt?: string }
 *   | { to: 'delivered', deliveredAt?: string, cashReceived?: boolean }
 *   | { to: 'cancelled', reason: import('@noor/contract').EnumValue<'cancelReason'>, note?: string, refundAcknowledged?: boolean }
 *   | { to: 'returned', returnType: import('@noor/contract').EnumValue<'returnType'>, lines: { lineId: string, quantity: number, restock: boolean }[], note?: string }
 * )} Change
 */

const issue = (/** @type {string} */ path, /** @type {'required' | 'invalid_format' | 'too_big' | 'too_small'} */ code) => new DomainError('validation_failed', { issues: [{ path, code }] })

/** Who is acting, as the order's event and the audit trail record it. @param {OrderActor} a */
const who = (a) => ({ actorType: a.type, actorId: a.type === 'staff' ? a.id : null, actorLabel: a.type === 'storefront' ? null : a.label })
/** @param {OrderActor} a @param {RequestInfo} req */
const auditActor = (a, req) => ({
  actor: a.type === 'staff' ? { type: /** @type {const} */ ('staff'), id: a.id, label: a.label, role: a.role } : a.type === 'system' ? { type: /** @type {const} */ ('system'), label: a.label } : { type: /** @type {const} */ ('storefront'), label: 'customer' },
  ...(req.ip ? { ip: req.ip } : {}), ...(req.userAgent ? { userAgent: req.userAgent } : {}), ...(req.requestId ? { requestId: req.requestId } : {}),
})
/** @param {{ numberPrefix: string, number: number }} o */
export const numberOf = (o) => `${o.numberPrefix}-${o.number}`

/** The stock a returned line puts back: a bundle's chosen children, or its own variant; made-to-order lines held none. @param {{ variantId: string, stockTracked: boolean, customization: unknown, quantity: number }} line @param {number} quantity */
function stockOf(line, quantity) {
  const bundle = /** @type {{ bundle?: { variantId: string }[] } | null} */ (line.customization)?.bundle
  if (bundle?.length) return bundle.map((b) => ({ variantId: b.variantId, quantity }))
  return line.stockTracked ? [{ variantId: line.variantId, quantity }] : []
}

/**
 * @param {object} deps
 * @param {{ commit: (tx: Db, orderId: string) => Promise<unknown>, release: (tx: Db, orderId: string) => Promise<unknown>, restock: (tx: Db, orderId: string, lines: { variantId: string, quantity: number, restock: boolean }[]) => Promise<unknown>, keepReservation: (tx: Db, orderId: string) => Promise<void> }} deps.inventory
 * @param {{ reverse: (tx: Db, orderId: string) => Promise<void> }} deps.promotions
 * @param {{ applyOrderChange: (tx: Db, id: string, change: { orders?: number, delivered?: number, refused?: number, cancelled?: number, spentMinor?: number }) => Promise<void> }} deps.customers
 * @param {{ courierById: (x: Db, id: string) => Promise<{ id: string, name: string, enabled: boolean, trackingRequired: boolean } | undefined> }} deps.shipping
 * @param {{ value: (key: 'payments', x: Db) => Promise<{ value: { methods: { type: string, enabled: boolean }[], codLimitMinor?: number } }> }} deps.settings
 * @param {{ noCod: (tx: Db, customerId: string) => Promise<boolean> }} deps.people
 * @param {{ onDelivered: (tx: Db, orderId: string, o: { cashReceived: boolean }) => Promise<unknown>, onClosed: (tx: Db, orderId: string) => Promise<unknown>, recompute: (tx: Db, orderId: string) => Promise<unknown>, switchToCod: (tx: Db, order: { id: string, totalMinor: number, depositDueMinor: number, paymentMethod: string, numberPrefix: string, number: number }) => Promise<void> }} deps.payments the order's money follows what happens to it
 */
export function createChanges({ inventory, promotions, customers, shipping, settings, people, payments }) {
  /** A line of the order's history. @param {Db} tx @param {string} orderId @param {Omit<typeof import('../../db/schema/orders.js').orderEvents.$inferInsert, 'id' | 'orderId' | 'createdAt'>} e */
  const event = (tx, orderId, e) => repo.insertEvent(tx, { id: uuidv7(), orderId, createdAt: now(), ...e })

  /**
   * The order locked and at the version the person saw, or an error: not found, or somebody else changed it first.
   * @param {Db} tx @param {string} orderId @param {number} version
   */
  async function open(tx, orderId, version) {
    const order = await repo.lockOrder(tx, orderId)
    if (!order) throw new DomainError('not_found')
    if (order.version !== version) throw new DomainError('stale_write', { currentVersion: order.version })
    return order
  }

  /** The invoice number is made once, at the first dispatch, from the counter of the year. @param {Db} tx */
  async function nextInvoice(tx) {
    const year = now().getUTCFullYear()
    await ensureCounter(tx, `invoice_${year}`, 0)
    return invoiceNumberOf(year, await nextValue(/** @type {never} */ (tx), `invoice_${year}`))
  }

  return {
    /**
     * Moves an order along one edge of the table with the guards and effects of that edge. A partial return of a delivered order keeps it `delivered`.
     * @param {Db} tx @param {string} orderId @param {Change} input @param {OrderActor} actor @param {RequestInfo} [req]
     */
    async transition(tx, orderId, input, actor, req = {}) {
      const order = await open(tx, orderId, input.version)
      const from = /** @type {import('./transitions.js').OrderStatus} */ (order.status)
      const to = input.to
      const at = now()
      const lines = await repo.linesOf(tx, orderId)
      /** @type {Partial<typeof order>} */
      let patch = {}
      /** @type {Record<string, unknown>} */
      let data = {}
      /** @type {Parameters<typeof customers.applyOrderChange>[2]} */
      let counters = {}
      /** @type {string | undefined} */
      let outbox
      let stays = false // a partial return: the status does not move
      let eventType = 'status_changed'
      const customerId = order.customerId

      // a partial return is a "returned" request that does not cover everything: it is not an edge of the table
      const returnLines = input.to === 'returned' ? input.lines : []
      const coversAll = lines.every((l) => (returnLines.find((r) => r.lineId === l.id)?.quantity ?? 0) === l.quantity - l.returnedQuantity)
      if (input.to === 'returned' && from === 'delivered' && !coversAll) stays = true
      else assertTransition(from, to)

      switch (input.to) {
        case 'confirmed': {
          if (from === 'pending_confirmation' && !input.via) throw issue('via', 'required')
          if (!confirmable(/** @type {never} */ ({ status: from, paidMinor: order.paidMinor, totalMinor: order.totalMinor, depositDueMinor: order.depositDueMinor }))) throw new DomainError('deposit_unpaid', { depositDue: { amount: order.depositDueMinor, currency: 'PKR' }, paid: { amount: order.paidMinor, currency: 'PKR' } })
          if (order.paymentMethod === 'cod' && (await people.noCod(tx, customerId)) && !input.codOverrideReason?.trim()) throw issue('codOverrideReason', 'required')
          patch = { confirmedAt: at }
          data = { ...(input.via ? { via: input.via } : {}), ...(input.note ? { note: input.note } : {}), ...(input.codOverrideReason ? { codOverrideReason: input.codOverrideReason } : {}) }
          await inventory.keepReservation(tx, orderId)
          outbox = 'order.confirmed'
          break
        }
        case 'pending_confirmation': {
          if (from === 'confirmed') {
            if (!input.reason?.trim()) throw issue('reason', 'required')
            patch = { confirmedAt: null }
            data = { reason: input.reason }
          } else {
            // an unpaid prepaid order goes to cash on delivery: only if cash on delivery would have been allowed for it
            const cod = (await settings.value('payments', tx)).value
            const method = cod.methods.find((m) => m.type === 'cod')
            const blocked = !method?.enabled || (cod.codLimitMinor != null && order.totalMinor > cod.codLimitMinor) || (await people.noCod(tx, customerId))
            if (blocked) throw new DomainError('payment_method_not_allowed', { reason: 'cod_not_available' })
            patch = { paymentMethod: 'cod' }
            data = { switchedFrom: order.paymentMethod }
            await inventory.keepReservation(tx, orderId)
            await payments.switchToCod(tx, order)
          }
          break
        }
        case 'dispatched': {
          const courier = input.courierId ? await shipping.courierById(tx, input.courierId) : undefined
          if (!courier || !courier.enabled) throw issue('courierId', input.courierId ? 'invalid_format' : 'required')
          const tracking = input.trackingNumber?.trim()
          if (courier.trackingRequired && !tracking) throw issue('trackingNumber', 'required')
          await inventory.commit(tx, orderId) // the goods leave: on hand and reserved go down together
          patch = { dispatchedAt: input.dispatchedAt ? new Date(input.dispatchedAt) : at, courierId: courier.id, courierName: courier.name, trackingNumber: tracking ?? null, invoiceNumber: order.invoiceNumber ?? (await nextInvoice(tx)) }
          data = { courier: courier.name, ...(tracking ? { trackingNumber: tracking } : {}) }
          outbox = 'order.dispatched'
          break
        }
        case 'delivered': {
          patch = { deliveredAt: input.deliveredAt ? new Date(input.deliveredAt) : at }
          data = { cashReceived: Boolean(input.cashReceived) }
          counters = { delivered: 1, spentMinor: order.totalMinor }
          outbox = 'order.delivered'
          break
        }
        case 'cancelled': {
          if (!(/** @type {readonly string[]} */ (enums.cancelReason).includes(input.reason))) throw issue('reason', 'invalid_format')
          if (order.paidMinor > 0 && !input.refundAcknowledged) throw issue('refundAcknowledged', 'required')
          await inventory.release(tx, orderId)
          await promotions.reverse(tx, orderId)
          patch = { cancelReason: input.reason, closedAt: at }
          data = { reason: input.reason, ...(input.note ? { note: input.note } : {}), ...(order.paidMinor > 0 ? { refundDue: order.paidMinor - order.refundedMinor } : {}) }
          counters = { orders: -1, cancelled: 1 }
          outbox = 'order.cancelled'
          break
        }
        case 'returned': {
          const type = input.returnType
          if (!(/** @type {readonly string[]} */ (enums.returnType).includes(type))) throw issue('returnType', 'invalid_format')
          if (from === 'dispatched' && type === 'customer_return') throw issue('returnType', 'invalid_format') // a customer return needs a delivery first
          if (from === 'delivered' && type !== 'customer_return') throw issue('returnType', 'invalid_format')
          if (!returnLines.length) throw issue('lines', 'required')
          if (from === 'dispatched' && !coversAll) throw issue('lines', 'required') // a parcel comes back whole
          const seen = new Set()
          for (const [i, r] of returnLines.entries()) {
            const line = lines.find((l) => l.id === r.lineId)
            if (!line || seen.has(r.lineId)) throw issue(`lines.${i}.lineId`, 'invalid_format')
            seen.add(r.lineId)
            if (r.quantity < 1) throw issue(`lines.${i}.quantity`, 'too_small')
            if (r.quantity > line.quantity - line.returnedQuantity) throw issue(`lines.${i}.quantity`, 'too_big')
          }
          // goods come back to the shelf or are written off, line by line (a bundle through its chosen children)
          await inventory.restock(tx, orderId, returnLines.flatMap((r) => stockOf(/** @type {NonNullable<(typeof lines)[number]>} */ (lines.find((l) => l.id === r.lineId)), r.quantity).map((s) => ({ ...s, restock: r.restock }))))
          // what earlier partial returns already took off the customer's total spent
          const worth = (/** @type {NonNullable<(typeof lines)[number]>} */ l, /** @type {number} */ q) => Math.round(((l.lineSubtotalMinor - l.discountMinor) * q) / l.quantity)
          const earlier = lines.reduce((sum, l) => sum + worth(l, l.returnedQuantity), 0)
          let value = 0
          for (const r of returnLines) {
            const line = /** @type {NonNullable<(typeof lines)[number]>} */ (lines.find((l) => l.id === r.lineId))
            await repo.updateLine(tx, line.id, { returnedQuantity: line.returnedQuantity + r.quantity })
            value += worth(line, r.quantity)
          }
          data = { returnType: type, lines: returnLines, ...(input.note ? { note: input.note } : {}) }
          if (stays) {
            eventType = 'partial_return'
            counters = { spentMinor: -value }
          } else {
            patch = { closedAt: at }
            counters = from === 'dispatched' ? { refused: 1 } : { delivered: -1, spentMinor: -(order.totalMinor - earlier) }
            outbox = 'order.returned'
          }
          break
        }
        default:
          break
      }

      const nextVersion = order.version + 1
      await repo.updateOrder(tx, orderId, { ...patch, ...(stays ? {} : { status: to, statusChangedAt: at }), version: nextVersion, updatedAt: at })
      await event(tx, orderId, { type: eventType, ...(stays ? {} : { fromStatus: from, toStatus: to }), ...who(actor), data, public: eventType === 'status_changed' })
      if (Object.keys(counters).length) await customers.applyOrderChange(tx, customerId, counters)
      // the money follows the order: cash taken at the door, what will never be paid closed, what must be paid back worked out
      if (to === 'delivered' && !stays) await payments.onDelivered(tx, orderId, { cashReceived: input.to === 'delivered' && Boolean(input.cashReceived) })
      else if (to === 'cancelled' || (to === 'returned' && from === 'dispatched')) await payments.onClosed(tx, orderId)
      else if (to === 'returned') await payments.recompute(tx, orderId)
      await record(tx, { ...auditActor(actor, req), action: stays ? 'order.partial_return' : `order.${to}`, entityType: 'order', entityId: orderId, entityLabel: numberOf(order), category: 'money', diff: stays ? {} : { status: [from, to] }, ...(typeof data.reason === 'string' ? { reason: data.reason } : {}) })
      if (outbox) await emit(tx, { type: outbox, payload: { orderId, number: numberOf(order) }, ...(req.requestId ? { requestId: req.requestId } : {}) })
      return { id: orderId, status: stays ? from : to, version: nextVersion }
    },

    /** A note for staff: never shown to the customer. @param {Db} tx @param {string} orderId @param {string} body @param {OrderActor} actor */
    async addNote(tx, orderId, body, actor) {
      const order = await repo.orderById(tx, orderId)
      if (!order) throw new DomainError('not_found')
      const id = uuidv7()
      const at = now()
      await repo.insertEvent(tx, { id, orderId, type: 'note', ...who(actor), data: { body }, public: false, createdAt: at })
      return { id, type: 'note', actorType: actor.type, actorLabel: actor.type === 'storefront' ? undefined : actor.label, data: { body }, createdAt: at.toISOString() }
    },

    /**
     * A try at reaching the customer to confirm a cash on delivery order. Counted, and after three on two different days the screen suggests cancelling (never automatic).
     * @param {Db} tx @param {string} orderId @param {{ channel: 'call' | 'whatsapp', outcome: import('@noor/contract').EnumValue<'attemptOutcome'>, note?: string }} attempt @param {OrderActor} actor
     */
    async logAttempt(tx, orderId, attempt, actor) {
      const order = await repo.orderById(tx, orderId)
      if (!order) throw new DomainError('not_found')
      if (order.status !== 'pending_confirmation') throw new DomainError('action_not_allowed')
      const id = uuidv7()
      const at = now()
      const data = { channel: attempt.channel, outcome: attempt.outcome, ...(attempt.note ? { note: attempt.note } : {}) }
      await repo.insertEvent(tx, { id, orderId, type: 'confirmation_attempt', ...who(actor), data, public: false, createdAt: at })
      return { id, type: 'confirmation_attempt', actorType: actor.type, actorLabel: actor.type === 'storefront' ? undefined : actor.label, data, createdAt: at.toISOString() }
    },

    /**
     * The courier or tracking number of a parcel that is already on its way was wrong or came late.
     * @param {Db} tx @param {string} orderId @param {{ courierId: string, trackingNumber?: string, version: number }} input @param {OrderActor} actor @param {RequestInfo} [req]
     */
    async updateTracking(tx, orderId, input, actor, req = {}) {
      const order = await open(tx, orderId, input.version)
      if (order.status !== 'dispatched') throw new DomainError('action_not_allowed')
      const courier = await shipping.courierById(tx, input.courierId)
      if (!courier || !courier.enabled) throw issue('courierId', 'invalid_format')
      const tracking = input.trackingNumber?.trim()
      if (courier.trackingRequired && !tracking) throw issue('trackingNumber', 'required')
      const at = now()
      await repo.updateOrder(tx, orderId, { courierId: courier.id, courierName: courier.name, trackingNumber: tracking ?? null, version: order.version + 1, updatedAt: at })
      await event(tx, orderId, { type: 'tracking_updated', ...who(actor), data: { courier: courier.name, ...(tracking ? { trackingNumber: tracking } : {}), before: { courier: order.courierName, trackingNumber: order.trackingNumber } }, public: false })
      await record(tx, { ...auditActor(actor, req), action: 'order.tracking_updated', entityType: 'order', entityId: orderId, entityLabel: numberOf(order), category: 'money', diff: { trackingNumber: [order.trackingNumber, tracking ?? null], courier: [order.courierName, courier.name] } })
      return { id: orderId, version: order.version + 1 }
    },
  }
}
