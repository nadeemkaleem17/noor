// Money in and out of orders (plan/09-data-model/07-orders-payments.md sections 4 and 5, plan/12-integrations.md section 3). The order's own `paid_minor`, `refunded_minor`
// and `payment_status` are written only here, by `recompute`, from the payment rows. Every function runs in the caller's transaction (the order's).
import { DomainError } from '../../platform/errors.js'
import { transaction } from '../../platform/db.js'
import { now } from '../../platform/clock.js'
import { enqueue } from '../../platform/jobs.js'
import { uuidv7 } from '../../platform/ids.js'
import { createProviders } from './providers.js'
import * as repo from './repository.js'
import { holdMinutesFor, paymentStatusOf } from './status.js'

/**
 * @typedef {import('../../platform/db.js').Executor} Db
 * @typedef {{ id: string, totalMinor: number, depositDueMinor: number, paymentMethod: string, numberPrefix: string, number: number }} OrderForPayment
 */

const money = (/** @type {number} */ amount) => ({ amount, currency: /** @type {const} */ ('PKR') })
const issue = (/** @type {string} */ path, /** @type {'required' | 'invalid_format' | 'too_big' | 'too_small'} */ code) => new DomainError('validation_failed', { issues: [{ path, code }] })
/** What part of a line's money a number of its units is worth, after its share of the discount. @param {{ lineSubtotalMinor: number, discountMinor: number, quantity: number }} l @param {number} q */
const worth = (l, q) => Math.round(((l.lineSubtotalMinor - l.discountMinor) * q) / l.quantity)

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {ReturnType<typeof createProviders>} [deps.providers]
 */
export function createPaymentsService({ db, providers = createProviders() }) {
  /** @param {Db} tx @param {string} orderId */
  async function totals(tx, orderId) {
    const rows = await repo.ofOrder(tx, orderId)
    const captured = rows.filter((r) => r.state === 'captured')
    return {
      rows,
      inMinor: captured.filter((r) => r.kind !== 'refund').reduce((s, r) => s + r.amountMinor, 0),
      outMinor: captured.filter((r) => r.kind === 'refund').reduce((s, r) => s + r.amountMinor, 0),
    }
  }

  /**
   * Works out the order's paid amount, refunded amount and payment status again from its payments. Call it after anything that touches a payment or the goods.
   * @param {Db} tx @param {string} orderId
   */
  async function recompute(tx, orderId) {
    const order = await repo.orderRow(tx, orderId)
    if (!order) throw new DomainError('not_found')
    const { inMinor, outMinor } = await totals(tx, orderId)
    const lines = await repo.linesOf(tx, orderId)
    const goodsBack = lines.reduce((s, l) => s + worth(l, l.returnedQuantity), 0)
    const owedBack = order.status === 'cancelled' ? inMinor : Math.min(inMinor, goodsBack)
    const paymentStatus = paymentStatusOf({ inMinor, outMinor, owedBack, totalMinor: order.totalMinor, depositDueMinor: order.depositDueMinor })
    await repo.setOrderMoney(tx, orderId, { paidMinor: inMinor - outMinor, refundedMinor: outMinor, paymentStatus })
    return { paidMinor: inMinor - outMinor, refundedMinor: outMinor, paymentStatus }
  }

  /**
   * The payment row an order starts with. Cash on delivery: what is left after any deposit, waiting for the cash. A prepaid method: the whole total (or the deposit) to be paid within the hold time.
     * @param {Db} tx @param {OrderForPayment} order @param {{ bank?: { accountTitle: string, bank: string, accountNumber: string, instructions?: string } }} [o]
     * @returns {Promise<{ instructions?: string, redirectUrl?: string, expiresAt: Date | null }>}
     */
  async function createInitial(tx, order, { bank } = {}) {
      const at = now()
      const id = uuidv7()
      if (order.paymentMethod === 'cod') {
        const amount = order.totalMinor - order.depositDueMinor
        if (amount > 0) await repo.insert(tx, { id, orderId: order.id, kind: order.depositDueMinor > 0 ? 'balance' : 'full', method: 'cod', provider: 'cod', state: 'pending_confirmation', amountMinor: amount, createdAt: at, updatedAt: at })
        await recompute(tx, order.id)
        return { expiresAt: null }
      }
      const provider = providers.get(order.paymentMethod)
      if (!provider || !provider.configured) throw new DomainError('payment_method_not_allowed', { reason: 'not_enabled' })
      const amount = order.depositDueMinor > 0 ? order.depositDueMinor : order.totalMinor
      const session = await provider.createSession({ paymentId: id, orderNumber: `${order.numberPrefix}-${order.number}`, amount: money(amount), ...(bank ? { bank } : {}) })
      const expiresAt = session.kind === 'redirect' ? session.expiresAt : new Date(at.getTime() + holdMinutesFor(order.paymentMethod) * 60_000)
      await repo.insert(tx, {
        id, orderId: order.id, kind: order.depositDueMinor > 0 ? 'deposit' : 'full', method: order.paymentMethod, provider: provider.id, state: 'initiated', amountMinor: amount,
        ...(session.kind === 'redirect' && session.providerRef ? { providerRef: session.providerRef } : {}), expiresAt, createdAt: at, updatedAt: at,
      })
      await recompute(tx, order.id)
      return { ...(session.kind === 'instructions' ? { instructions: session.text } : {}), ...(session.kind === 'redirect' ? { redirectUrl: session.url } : {}), expiresAt }
  }

  return {
    recompute,
    createInitial,

    /**
     * Money staff received outside the system, or a refund they paid by hand. A payment may not exceed what is still owed, nor a refund what was paid.
     * Where the order has an open row of the same kind (the transfer it was waiting for) that row is the one captured, so nothing is counted twice.
     * @param {Db} tx @param {string} orderId @param {{ kind: 'deposit' | 'balance' | 'full' | 'refund', amount: number, method: string, reference?: string, paidAt?: Date, proofMediaId?: string }} input @param {string | null} staffId
     */
    async record(tx, orderId, input, staffId) {
      const order = await repo.orderRow(tx, orderId)
      if (!order) throw new DomainError('not_found')
      if (!Number.isInteger(input.amount) || input.amount < 1) throw issue('amount', 'too_small')
      const { rows, inMinor, outMinor } = await totals(tx, orderId)
      if (input.kind === 'refund') {
        if (inMinor === 0 || input.amount > inMinor - outMinor) throw issue('amount', 'too_big')
      } else {
        if (order.status === 'cancelled' || order.status === 'returned') throw new DomainError('action_not_allowed')
        if (input.kind === 'deposit' && order.depositDueMinor === 0) throw issue('kind', 'invalid_format')
        if (input.amount > order.totalMinor - (inMinor - outMinor)) throw issue('amount', 'too_big')
      }
      const at = now()
      const when = input.paidAt && input.paidAt <= at ? input.paidAt : at
      const open = input.kind === 'refund' ? undefined : rows.find((r) => r.state === 'initiated' && r.kind === input.kind)
      let id = open?.id
      if (open) await repo.update(tx, open.id, { state: 'captured', amountMinor: input.amount, method: input.method, ...(input.reference ? { reference: input.reference } : {}), ...(input.proofMediaId ? { proofMediaId: input.proofMediaId } : {}), recordedBy: staffId, updatedAt: at })
      else {
        id = uuidv7()
        await repo.insert(tx, { id, orderId, kind: input.kind, method: input.method, provider: 'manual', state: 'captured', amountMinor: input.amount, ...(input.reference ? { reference: input.reference } : {}), ...(input.proofMediaId ? { proofMediaId: input.proofMediaId } : {}), recordedBy: staffId, createdAt: when, updatedAt: at })
      }
      return { paymentId: /** @type {string} */ (id), ...(await recompute(tx, orderId)) }
    },

    /**
     * The order was delivered. Cash on delivery: the cash that was waiting is now captured (what is left after anything already paid); without cash it stays owed.
     * @param {Db} tx @param {string} orderId @param {{ cashReceived: boolean }} o
     */
    async onDelivered(tx, orderId, { cashReceived }) {
      const order = await repo.orderRow(tx, orderId)
      if (!order) throw new DomainError('not_found')
      const { rows, inMinor, outMinor } = await totals(tx, orderId)
      const cod = rows.find((r) => r.provider === 'cod' && r.state === 'pending_confirmation')
      const remaining = order.totalMinor - (inMinor - outMinor)
      if (cod && remaining <= 0) await repo.update(tx, cod.id, { state: 'expired', updatedAt: now() }) // nothing is left to collect
      else if (cod && cashReceived) await repo.update(tx, cod.id, { state: 'captured', amountMinor: remaining, updatedAt: now() })
      return recompute(tx, orderId)
    },

    /** The order will not be paid: it was cancelled, or the parcel came back refused. What was waiting is closed. @param {Db} tx @param {string} orderId */
    async onClosed(tx, orderId) {
      const at = now()
      for (const r of await repo.ofOrder(tx, orderId)) {
        if (r.state === 'pending_confirmation') await repo.update(tx, r.id, { state: 'failed', updatedAt: at })
        else if (r.state === 'initiated') await repo.update(tx, r.id, { state: 'expired', updatedAt: at })
      }
      return recompute(tx, orderId)
    },

    /** An unpaid prepaid order becomes cash on delivery: the old way to pay is closed, a new row waits for the cash. @param {Db} tx @param {OrderForPayment} order */
    async switchToCod(tx, order) {
      const at = now()
      for (const r of await repo.ofOrder(tx, order.id)) if (r.state === 'initiated') await repo.update(tx, r.id, { state: 'expired', updatedAt: at })
      await createInitial(tx, { ...order, paymentMethod: 'cod' })
    },

    /**
     * A provider's callback. The signature is checked over the raw body first; a bad one stores nothing. An event we already have is a no-op.
     * What the event means is applied by a job, so the provider gets its answer fast.
     * @param {string} providerId @param {Buffer} rawBody @param {Record<string, string | string[] | undefined>} headers
     */
    async receiveWebhook(providerId, rawBody, headers) {
      const provider = providers.get(providerId)
      if (!provider || !provider.configured || !provider.parseWebhook) throw new DomainError('not_found')
      const event = provider.parseWebhook(rawBody, headers) // throws on a wrong signature
      return transaction(db, async (tx) => {
        const id = uuidv7()
        try {
          await repo.insertEvent(tx, { id, provider: provider.id, providerEventId: event.providerEventId, paymentId: event.paymentId, payload: event, receivedAt: now() })
        } catch (e) {
          const code = /** @type {{ errno?: number, cause?: { errno?: number } }} */ (e)
          if (code.errno === 1062 || code.cause?.errno === 1062) return { duplicate: true }
          throw e
        }
        await enqueue(tx, { type: 'payments.apply_event', payload: { eventId: id }, uniqueKey: `payment-event:${id}` })
        return { duplicate: false }
      })
    },

    /**
     * What a stored event says happened to a payment. Only moves a payment forward; an amount that is not the amount asked for is never captured.
     * Returns the order that changed, if any, so the caller can confirm it.
     * @param {Db} tx @param {string} eventId
     * @returns {Promise<{ orderId: string, captured: boolean } | null>}
     */
    async applyEvent(tx, eventId) {
      const event = await repo.lockEvent(tx, eventId)
      if (!event || event.processedAt) return null
      const e = /** @type {{ paymentId: string, state: 'authorized' | 'captured' | 'failed' | 'expired', amount: { amount: number }, providerRef: string }} */ (event.payload)
      const payment = await repo.lockById(tx, e.paymentId)
      let result = null
      if (payment && (payment.state === 'initiated' || payment.state === 'authorized') && !(e.state === 'captured' && e.amount.amount !== payment.amountMinor)) {
        await repo.update(tx, payment.id, { state: e.state, providerRef: e.providerRef, updatedAt: now() })
        await recompute(tx, payment.orderId)
        result = { orderId: payment.orderId, captured: e.state === 'captured' }
      }
      await repo.markProcessed(tx, eventId, now())
      return result
    },

    /** The order's money changed (an edit): the rows still waiting for money follow the new total. @param {Db} tx @param {string} orderId */
    async onEdited(tx, orderId) {
      const order = await repo.orderRow(tx, orderId)
      if (!order) throw new DomainError('not_found')
      const at = now()
      for (const r of await repo.ofOrder(tx, orderId)) {
        if (r.state === 'pending_confirmation' && r.provider === 'cod') {
          const amount = order.totalMinor - order.depositDueMinor
          if (amount > 0) await repo.update(tx, r.id, { amountMinor: amount, kind: order.depositDueMinor > 0 ? 'balance' : 'full', updatedAt: at })
          else await repo.update(tx, r.id, { state: 'expired', updatedAt: at })
        } else if (r.state === 'initiated') await repo.update(tx, r.id, { amountMinor: order.depositDueMinor > 0 ? order.depositDueMinor : order.totalMinor, updatedAt: at })
      }
      return recompute(tx, orderId)
    },

    /** Orders that were waiting for money after their time was up. @param {Db} x */
    unpaidPastDeadline: (x) => repo.expiredUnpaid(x, now()),

    /** @param {Db} x @param {string} orderId */
    paymentsOf: (x, orderId) => repo.ofOrder(x, orderId),
  }
}
