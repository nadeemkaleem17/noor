// Placing an order (ADR-0020, plan/08-backend-architecture.md section 7, plan/09-data-model/07-orders-payments.md): one transaction that prices the cart, holds the stock,
// redeems the promo, finds or makes the customer, takes the next number and writes the order with everything copied into it.
// Later (M4-05) the same module owns every change of status.
import { DomainError } from '../../platform/errors.js'
import { now } from '../../platform/clock.js'
import { ensureCounter, nextValue } from '../../platform/counters.js'
import { withIdempotency } from '../../platform/idempotency.js'
import { uuidv7 } from '../../platform/ids.js'
import { emit } from '../../platform/outbox.js'
import { sha256Hex } from '../auth/tokens.js'
import { fieldIssues } from '../cart/customization.js'
import { holdsOf } from './holds.js'
import { createChanges } from './changes.js'
import { createEdits } from './edit.js'
import * as repo from './repository.js'
import { allowedActions, riskMarkers } from './rules.js'
import { trackingHash, trackingToken } from './tracking.js'

/**
 * @typedef {import('../../platform/db.js').Executor} Db
 * @typedef {import('@noor/contract').CreateOrderBody} CreateOrderBody
 * @typedef {ReturnType<typeof import('../cart/service.js').createCartService>} CartService
 */

/** How long stock is held for an order that is not cash on delivery and is not paid (ADR-0020). */
const HOLD_MS = 30 * 60_000
const money = (/** @type {number} */ amount) => ({ amount, currency: /** @type {const} */ ('PKR') })

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {import('../../platform/config.js').Config} deps.config
 * @param {CartService} deps.cart
 * @param {{ reserve: (tx: Db, order: { orderId: string, lines: { orderLineId: string, variantId: string, quantity: number }[], expiresAt?: Date | null }) => Promise<unknown>, commit: (tx: Db, orderId: string) => Promise<unknown>, release: (tx: Db, orderId: string) => Promise<unknown>, restock: (tx: Db, orderId: string, lines: { variantId: string, quantity: number, restock: boolean }[]) => Promise<unknown>, editReserved: (tx: Db, change: { orderId: string, lines: { orderLineId: string, variantId: string, quantity: number }[] }) => Promise<unknown>, keepReservation: (tx: Db, orderId: string) => Promise<void> }} deps.inventory
 * @param {{ redeem: (tx: Db, r: { promoId: string, orderId: string, customer: { id: string, ordersCount: number }, discountMinor: number, shippingWaivedMinor?: number }) => Promise<void>, reverse: (tx: Db, orderId: string) => Promise<void>, findRule: (x: Db, code: string) => Promise<{ id: string, code: string, label: string, rule: import('../promotions/evaluate.js').PromoRule } | undefined>, updateRedemption: (tx: Db, orderId: string, a: { discountMinor: number, shippingWaivedMinor: number }) => Promise<void> }} deps.promotions
 * @param {{ upsertByPhone: (tx: Db, c: { phone: string, name: string, email?: string, city?: string }) => Promise<{ id: string, ordersCount: number }>, recordConsent: (tx: Db, id: string, note: string) => Promise<void>, applyOrderChange: (tx: Db, id: string, change: { orders?: number, delivered?: number, refused?: number, cancelled?: number, spentMinor?: number, orderedAt?: Date }) => Promise<void>, noCod: (x: Db, id: string) => Promise<boolean>, counters: (x: Db, id: string) => Promise<{ ordersCount: number, deliveredCount: number, refusedCount: number, noCod: boolean, vip: boolean } | undefined> }} deps.customers
 * @param {{ value: (key: 'store' | 'checkout' | 'payments', x: Db) => Promise<{ value: any }> }} deps.settings
 * @param {{ cityName: (x: Db, id: string) => Promise<string | undefined>, deliveryOptions: (x: Db, cityId: string) => Promise<import('../cart/pricing.js').DeliveryOption[]>, courierById: (x: Db, id: string) => Promise<{ id: string, name: string, enabled: boolean, trackingRequired: boolean } | undefined> }} deps.shipping
 */
export function createOrdersService({ db, config, cart, inventory, promotions, customers, settings, shipping }) {
  /**
   * Everything in one transaction. The caller wraps it in the idempotency protocol; a refusal rolls all of it back.
   * @param {Db} tx @param {string | undefined} token @param {CreateOrderBody} body
   */
  async function place(tx, token, body) {
    const cartRow = await cart.lockCartOf(tx, token)
    if (!cartRow) throw new DomainError('cart_empty')
    const priced = await cart.price(tx, cartRow, { cityId: body.shippingAddress.cityId, methodId: body.shippingMethodId, phone: body.customer.phone, images: false })
    const c = priced.cart
    if (!c.lines.length) throw new DomainError('cart_empty')

    /** A refusal that carries the cart as it is now, priced for the same city and method (plan/10-api/03 section 3). @param {import('@noor/contract').ErrorCode} code @param {Record<string, unknown>} [extra] */
    const refuse = (code, extra = {}) => new DomainError(code, { ...extra, cart: c })
    if (c.hasBlockingIssues) throw refuse('cart_has_issues')
    if (c.lines.some((l) => l.issues.includes('price_changed')) || (body.expectedTotal && body.expectedTotal.amount !== c.total.amount)) throw refuse('price_changed')
    if (c.promoProblem) throw refuse('promo_invalid', { reason: c.promoProblem })
    const option = c.paymentOptions?.find((o) => o.method === body.paymentMethod)
    if (!option || !option.allowed) throw refuse('payment_method_not_allowed', { reason: option?.reason ?? 'not_enabled' })

    const [store, checkout, payments] = await Promise.all([settings.value('store', tx), settings.value('checkout', tx), settings.value('payments', tx)])
    const issues = fieldIssues(checkout.value.extraFields, body.customFields ?? {}, 'customFields')
    if (issues.length) throw new DomainError('validation_failed', { issues })

    const orderId = uuidv7()
    const at = now()
    const lines = c.lines.map((l) => ({ id: uuidv7(), line: l, fact: /** @type {NonNullable<(typeof priced.facts)[number]>} */ (priced.facts.find((f) => f.id === l.id)) }))

    const holds = holdsOf(lines.map(({ id, line, fact }) => ({ id, quantity: line.quantity, variantId: line.variantId, kind: fact.kind, stockMode: fact.stockMode, ...(fact.customization ? { customization: fact.customization } : {}) })))
    try {
      await inventory.reserve(tx, { orderId, lines: holds, expiresAt: body.paymentMethod === 'cod' ? null : new Date(at.getTime() + HOLD_MS) })
    } catch (e) {
      if (e instanceof DomainError && e.code === 'insufficient_stock') throw refuse('insufficient_stock', e.details)
      throw e
    }

    const cityName = (await shipping.cityName(tx, body.shippingAddress.cityId)) ?? ''
    const customer = await customers.upsertByPhone(tx, { phone: body.customer.phone, name: body.customer.name, ...(body.customer.email ? { email: body.customer.email } : {}), city: cityName })
    if (body.marketingConsent && checkout.value.marketingConsent.enabled) await customers.recordConsent(tx, customer.id, 'Ticked at checkout')
    if (priced.promoId) {
      try {
        await promotions.redeem(tx, { promoId: priced.promoId, orderId, customer, discountMinor: c.discount.amount, shippingWaivedMinor: priced.shippingWaivedMinor })
      } catch (e) {
        if (e instanceof DomainError && e.code.startsWith('promo_')) throw refuse('promo_invalid', { reason: e.code })
        throw e
      }
    }
    await customers.applyOrderChange(tx, customer.id, { orders: 1, orderedAt: at }) // after the promo, whose first-order rule looks at the orders made before this one

    // the number comes last: the counter row is held until commit, so everything that can fail goes before it
    await ensureCounter(tx, 'order_number', 10_000)
    const number = await nextValue(/** @type {never} */ (tx), 'order_number')
    const prefix = store.value.orderNumberPrefix
    const token2 = trackingToken(config, orderId)
    const status = body.paymentMethod === 'cod' ? /** @type {const} */ ('pending_confirmation') : /** @type {const} */ ('pending')
    const ship = /** @type {NonNullable<typeof c.shipping>} */ (c.shipping)

    await repo.insertOrder(tx, {
      id: orderId, number, numberPrefix: prefix, trackingTokenHash: trackingHash(token2), status, channel: 'storefront', locale: body.locale ?? 'en',
      customerId: customer.id, customerName: body.customer.name, customerPhone: body.customer.phone, customerEmail: body.customer.email ?? null,
      shipCityId: body.shippingAddress.cityId, shipCity: cityName, shipAddress: body.shippingAddress.address, shipLandmark: body.shippingAddress.landmark ?? null, shipNotes: body.shippingAddress.notes ?? null,
      customFields: body.customFields && Object.keys(body.customFields).length ? body.customFields : null,
      shippingMethodId: ship.methodId, shippingMethodLabel: ship.label, etaMinDays: ship.etaMinDays, etaMaxDays: ship.etaMaxDays,
      subtotalMinor: c.subtotal.amount, discountMinor: c.discount.amount, shippingFeeMinor: ship.fee.amount, totalMinor: c.total.amount, depositDueMinor: c.depositDue?.amount ?? 0,
      promoCode: c.promo?.code ?? null, paymentMethod: body.paymentMethod, paymentStatus: 'unpaid',
      placedAt: at, statusChangedAt: at, createdAt: at, updatedAt: at,
    })
    await repo.insertLines(
      tx,
      await Promise.all(
        lines.map(async ({ id, line, fact }, i) => ({
          id, orderId, position: i + 1, productId: line.productId, variantId: line.variantId, kind: line.kind, title: line.title, variantLabel: line.variantLabel, sku: fact.sku ?? '',
          imageMediaId: fact.imageMediaId ?? null, quantity: line.quantity, unitPriceMinor: line.unitPrice.amount, lineSubtotalMinor: line.lineSubtotal.amount,
          discountMinor: line.lineDiscount.amount, depositMinor: priced.lineDeposits[i] ?? 0, customization: (await cart.snapshotCustomization(tx, fact.customization)) ?? null,
          stockTracked: fact.stockMode === 'counted' || fact.kind === 'bundle', leadMinDays: line.madeToOrder?.leadMinDays ?? null, leadMaxDays: line.madeToOrder?.leadMaxDays ?? null,
        })),
      ),
    )
    await repo.insertEvent(tx, { id: uuidv7(), orderId, type: 'placed', toStatus: status, actorType: 'storefront', data: { paymentMethod: body.paymentMethod }, public: true, createdAt: at })
    await emit(tx, { type: 'order.placed', payload: { orderId, number: `${prefix}-${number}` } })
    await cart.deleteCart(tx, cartRow.id)

    const bank = payments.value.bankTransfer
    return {
      orderNumber: `${prefix}-${number}`,
      trackingToken: token2,
      status,
      total: money(c.total.amount),
      ...(body.paymentMethod === 'bank_transfer' && bank ? { payment: { instructions: `Send Rs. ${((c.depositDue?.amount ?? c.total.amount) / 100).toLocaleString('en-PK')} to ${bank.accountTitle}, ${bank.bank}, ${bank.accountNumber}.${bank.instructions ? ` ${bank.instructions}` : ''}` } } : {}),
    }
  }

  const changes = createChanges({ inventory, promotions, customers, shipping, settings, people: customers })
  const edits = createEdits({ cart, shipping, promotions, inventory })

  return {
    ...changes,
    edit: edits.edit,
    previewEdit: edits.preview,

    /**
     * What the screens need beside the row: the actions the order allows now, the risks to look at, and the other order of this phone number it may duplicate.
     * @param {Db} x @param {string} orderId
     */
    async describe(x, orderId) {
      const order = await repo.orderById(x, orderId)
      if (!order) throw new DomainError('not_found')
      const [lines, customer, store] = await Promise.all([repo.linesOf(x, orderId), customers.counters(x, order.customerId), settings.value('store', x)])
      const duplicateOf = await repo.duplicateOf(x, order)
      return {
        allowedActions: allowedActions({ status: /** @type {never} */ (order.status), paymentMethod: order.paymentMethod, totalMinor: order.totalMinor, paidMinor: order.paidMinor, refundedMinor: order.refundedMinor, depositDueMinor: order.depositDueMinor, lines }),
        riskMarkers: riskMarkers({ paymentMethod: order.paymentMethod, totalMinor: order.totalMinor, customer: customer ?? { deliveredCount: 0, refusedCount: 0, noCod: false }, duplicateOf, highValueMinor: store.value.thresholds.highValueCodMinor }),
        ...(duplicateOf ? { duplicateOf } : {}),
      }
    },

    /**
     * `orders.create`: at most once per Idempotency-Key. The same key and body again gives the first answer; the same key with another body is refused.
     * @param {string | undefined} token the cart token @param {CreateOrderBody} body @param {string} idempotencyKey
     */
    async create(token, body, idempotencyKey) {
      try {
        return await run(token, body, idempotencyKey)
      } catch (e) {
        // a refusal carries the cart as it stands; the pictures are added here, after the transaction that made it has ended
        if (e instanceof DomainError && e.details.cart) throw new DomainError(e.code, { ...e.details, cart: await cart.withImages(/** @type {never} */ (e.details.cart)) })
        throw e
      }
    },
  }

  /** @param {string | undefined} token @param {CreateOrderBody} body @param {string} idempotencyKey */
  async function run(token, body, idempotencyKey) {
    const r = await withIdempotency(db, {
      scope: 'orders.create',
      key: idempotencyKey,
      body: { cart: token ? sha256Hex(token) : null, order: body },
      command: async (tx) => ({ status: 201, body: await place(tx, token, body) }),
    })
    return r.body
  }
}
