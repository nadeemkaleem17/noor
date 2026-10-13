// The order as its customer meets it (plan/10-api/03-cart-orders-public.md section 4, plan/06-storefront/06-orders-tracking.md): found by the token in their link or by
// order number plus phone, shown masked, and with the two things they may do themselves: cancel before it is confirmed, and ask for cash on delivery.
import { inArray } from 'drizzle-orm'
import { maskPkMobile, normalizePkMobile } from '@noor/contract'
import { now } from '../../platform/clock.js'
import { transaction } from '../../platform/db.js'
import { DomainError } from '../../platform/errors.js'
import { reviews } from '../../db/schema/reviews.js'
import { safeEqual } from '../auth/tokens.js'
import { reviewState } from '../reviews/window.js'
import * as repo from './repository.js'
import { isFinal } from './transitions.js'
import { trackingHash, trackingToken } from './tracking.js'

/**
 * @typedef {import('../../platform/db.js').Executor} Db
 * @typedef {typeof import('../../db/schema/orders.js').orders.$inferSelect} OrderRow
 * @typedef {{ ip?: string, userAgent?: string, requestId?: string }} RequestInfo
 */

const money = (/** @type {number} */ amount) => ({ amount, currency: /** @type {const} */ ('PKR') })
/** `2026-10-09`, `days` after `from`. */
const dayAfter = (/** @type {Date} */ from, /** @type {number} */ days) => new Date(from.getTime() + days * 86_400_000).toISOString().slice(0, 10)

/** "Ayesha Khan" -> "Ayesha K.". @param {string} name */
export const shortName = (name) => {
  const parts = name.trim().split(/\s+/)
  const last = parts.length > 1 ? parts.at(-1) : undefined
  return last ? `${parts[0]} ${[...last][0]}.` : (parts[0] ?? '')
}
/** The first 12 characters are kept: enough to recognise it, not enough to find the house. @param {string} address */
const maskAddress = (address) => (address.length > 12 ? `${[...address].slice(0, 12).join('')}•••` : address)

/** What the customer sees of the choices made on a line, from the snapshot kept on it. @param {unknown} snapshot */
export function summaryOf(snapshot) {
  const c = /** @type {{ measurements?: Record<string, unknown>, bundle?: { title?: string, label?: string }[] } | null} */ (snapshot)
  if (!c) return undefined
  const measurements = Object.entries(c.measurements ?? {}).map(([k, v]) => `${k} ${v}`).join(', ')
  const bundle = (c.bundle ?? []).map((b) => (b.label ? `${b.title} (${b.label})` : b.title)).filter(Boolean).join(', ')
  return [measurements, bundle].filter(Boolean).join('; ') || undefined
}

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {import('../../platform/config.js').Config} deps.config
 * @param {ReturnType<typeof import('./changes.js').createChanges>} deps.changes
 * @param {{ value: (key: 'store' | 'payments', x: Db) => Promise<{ value: any }> }} deps.settings
 * @param {{ courierById: (x: Db, id: string) => Promise<{ name: string, trackingUrlPattern: string | null } | undefined> }} deps.shipping
 * @param {{ imagesFor: (ids: string[]) => Promise<Record<string, import('@noor/contract').Image>> }} deps.media
 */
export function createPublicOrders({ db, config, changes, settings, shipping, media }) {
  /** @param {OrderRow} o */
  async function view(o) {
    const [lines, payments, store, courier] = await Promise.all([repo.linesOf(db, o.id), settings.value('payments', db), settings.value('store', db), o.courierId ? shipping.courierById(db, o.courierId) : undefined])
    const done = new Set(lines.length ? (await db.select({ id: reviews.orderLineId }).from(reviews).where(inArray(reviews.orderLineId, lines.map((l) => l.id)))).map((r) => r.id) : [])
    const reviewsOn = Boolean(store.value.features?.reviews)
    const images = await media.imagesFor(lines.flatMap((l) => (l.imageMediaId ? [l.imageMediaId] : [])))
    const status = /** @type {import('./transitions.js').OrderStatus} */ (o.status)
    const open = !isFinal(status)
    const arriving = open && status !== 'delivered' // a delivered order can still be returned, but there is no more waiting

    const steps = /** @type {const} */ ([['placed', o.placedAt], ['confirmed', o.confirmedAt], ['dispatched', o.dispatchedAt], ['delivered', o.deliveredAt]])
    const reached = steps.filter(([, at]) => at).length
    const timeline = steps.map(([step, at], i) => ({ step, ...(at ? { at: at.toISOString() } : {}), current: i === reached - 1 }))

    const base = o.dispatchedAt ?? o.confirmedAt ?? o.placedAt
    const method = /** @type {{ type: string, label: string }[]} */ (payments.value.methods).find((m) => m.type === o.paymentMethod)
    const bank = payments.value.bankTransfer
    const cash = o.paymentMethod === 'cod' && status !== 'delivered' && open
    const trackingUrl = courier?.trackingUrlPattern && o.trackingNumber ? courier.trackingUrlPattern.replace('{tracking}', encodeURIComponent(o.trackingNumber)) : undefined
    /** @type {import('@noor/contract').OrderPublic['allowedActions']} */
    const allowedActions = []
    if ((status === 'pending' || status === 'pending_confirmation') && o.paidMinor === 0) allowedActions.push('cancel')
    if (status === 'pending' && o.paymentMethod !== 'cod' && !(await changes.codBlocked(db, o))) allowedActions.push('switch_to_cod')

    return {
      orderNumber: `${o.numberPrefix}-${o.number}`,
      status,
      placedAt: o.placedAt.toISOString(),
      timeline,
      ...(!open ? { closed: { status: /** @type {'cancelled' | 'returned'} */ (status), at: (o.closedAt ?? o.statusChangedAt).toISOString(), ...(o.cancelReason ? { reason: /** @type {never} */ (o.cancelReason) } : {}) } } : {}),
      lines: lines.map((l) => {
        const summary = summaryOf(l.customization)
        const image = l.imageMediaId ? images[l.imageMediaId] : undefined
        return {
          id: l.id, title: l.title, variantLabel: l.variantLabel, ...(image ? { image } : {}), quantity: l.quantity, unitPrice: money(l.unitPriceMinor), lineTotal: money(l.lineSubtotalMinor),
          ...(summary ? { customizationSummary: summary } : {}),
          ...(reviewsOn && status === 'delivered' ? { review: { available: reviewState(o, l, now()) === 'ok' && !done.has(l.id), submitted: done.has(l.id) } } : {}),
          ...(l.leadMinDays != null && l.leadMaxDays != null ? { leadTime: { minDays: l.leadMinDays, maxDays: l.leadMaxDays } } : {}),
        }
      }),
      subtotal: money(o.subtotalMinor), discount: money(o.discountMinor), ...(o.promoCode ? { promoCode: o.promoCode } : {}), shippingFee: money(o.shippingFeeMinor), total: money(o.totalMinor),
      ...(o.depositDueMinor > 0 ? { depositDue: money(o.depositDueMinor) } : {}),
      paid: money(o.paidMinor), dueOnDelivery: money(cash ? Math.max(0, o.totalMinor - o.paidMinor) : 0),
      paymentMethod: /** @type {never} */ (o.paymentMethod), paymentLabel: method?.label ?? o.paymentMethod, paymentStatus: /** @type {never} */ (o.paymentStatus),
      ...(o.paymentMethod === 'bank_transfer' && status === 'pending' && bank ? { bankTransfer: bank } : {}),
      customer: { firstName: shortName(o.customerName), phoneMasked: maskPkMobile(o.customerPhone) },
      delivery: {
        city: o.shipCity, addressMasked: maskAddress(o.shipAddress), methodLabel: o.shippingMethodLabel,
        ...(arriving ? { eta: { from: dayAfter(base, o.etaMinDays), to: dayAfter(base, o.etaMaxDays) } } : {}),
        ...(o.courierName ? { courier: o.courierName } : {}), ...(o.trackingNumber ? { trackingNumber: o.trackingNumber } : {}), ...(trackingUrl ? { trackingUrl } : {}),
      },
      allowedActions,
      locale: /** @type {'en' | 'ur'} */ (o.locale),
    }
  }

  /** @param {string} token */
  const byToken = async (token) => {
    const o = await repo.orderByTokenHash(db, trackingHash(token))
    // the hash says the link was ours once; the derived value says it still is (a new TRACKING_KEY ends every old link)
    if (!o || !safeEqual(token, trackingToken(config, o.id))) throw new DomainError('not_found')
    return o
  }

  /**
   * One change by the customer: the order is locked, looked at again, and the change goes through the same code as staff's, as the `storefront` actor.
   * @param {string} token @param {(o: OrderRow) => import('./changes.js').Change} change @param {RequestInfo} req
   */
  async function act(token, change, req) {
    const found = await byToken(token)
    await transaction(db, async (tx) => {
      const o = await repo.lockOrder(tx, found.id)
      if (!o) throw new DomainError('not_found')
      await changes.transition(tx, o.id, change(o), { type: 'storefront' }, req)
    })
    return view(/** @type {OrderRow} */ (await repo.orderById(db, found.id)))
  }

  return {
    /** The order behind a link, for the other modules that work through it (reviews). @param {string} token */
    orderByToken: byToken,

    /** @param {string} token */
    async getByToken(token) {
      return view(await byToken(token))
    },

    /** Only before the order is confirmed, and only when nothing was paid (money back is for staff and WhatsApp). @param {string} token @param {string | undefined} reason @param {RequestInfo} req */
    cancelByToken(token, reason, req) {
      return act(
        token,
        (o) => {
          if ((o.status !== 'pending' && o.status !== 'pending_confirmation') || o.paidMinor > 0) throw new DomainError('action_not_allowed')
          return { version: o.version, to: 'cancelled', reason: 'customer_request', ...(reason ? { note: reason } : {}) }
        },
        req,
      )
    },

    /** An unpaid prepaid order becomes cash on delivery, if that is allowed for it. @param {string} token @param {RequestInfo} req */
    switchToCod(token, req) {
      return act(
        token,
        (o) => {
          if (o.status !== 'pending' || o.paymentMethod === 'cod') throw new DomainError('action_not_allowed')
          return { version: o.version, to: 'pending_confirmation' }
        },
        req,
      )
    },

    /**
     * Order number and phone are the proof, and every way of failing gives the same answer (ADR-0012).
     * "nc-10458", "10458" and "NC 10458" all mean the same order; the phone is compared as +92...
     * @param {{ orderNumber: string, phone: string }} input
     */
    async track({ orderNumber, phone }) {
      const notFound = new DomainError('order_not_found')
      const m = /^(?:([A-Z]{1,4})-?)?(\d{1,12})$/.exec(orderNumber.replace(/\s+/g, '').toUpperCase())
      const e164 = normalizePkMobile(phone)
      if (!m || !e164) throw notFound
      const o = await repo.orderByNumber(db, Number(m[2]))
      const prefix = m[1] ?? (await settings.value('store', db)).value.orderNumberPrefix
      if (!o || o.numberPrefix !== prefix || o.customerPhone !== e164) throw notFound
      return { trackingToken: trackingToken(config, o.id) }
    },
  }
}

