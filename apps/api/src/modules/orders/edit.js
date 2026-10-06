// Editing an order before it leaves (plan/09-data-model/07-orders-payments.md section 6): the server prices it again, adjusts the stock held, and writes the new money.
// In `pending_confirmation` anything may change (address, city, delivery method, lines); in `confirmed` only the address text and notes.
// Existing lines keep their price from the day of the order; a line added now takes today's price.
import { DomainError } from '../../platform/errors.js'
import { now } from '../../platform/clock.js'
import { uuidv7 } from '../../platform/ids.js'
import { record } from '../audit/index.js'
import { priceCart } from '../cart/pricing.js'
import { numberOf } from './changes.js'
import { holdsOf } from './holds.js'
import * as repo from './repository.js'

/**
 * @typedef {import('../../platform/db.js').Executor} Db
 * @typedef {import('./changes.js').OrderActor} OrderActor
 * @typedef {object} OrderEdit what the person changed; `version` is the one they saw
 * @property {number} version
 * @property {{ cityId: string, address: string, landmark?: string, notes?: string }} [shippingAddress]
 * @property {string} [shippingMethodId]
 * @property {{ name: string, email?: string }} [customer]
 * @property {{ lineId?: string, variantId?: string, quantity: number, customization?: import('@noor/contract').LineCustomization }[]} [lines] the full list that should remain
 */

const issue = (/** @type {string} */ path, /** @type {'required' | 'invalid_format' | 'too_big' | 'too_small'} */ code) => new DomainError('validation_failed', { issues: [{ path, code }] })
const money = (/** @type {number} */ amount) => ({ amount, currency: /** @type {const} */ ('PKR') })

/**
 * @param {object} deps
 * @param {{ factsOf: (x: Db, wanted: { id: string, variantId: string, quantity: number, customization?: import('@noor/contract').LineCustomization }[]) => Promise<import('../cart/pricing.js').PricedLineInput[]>, snapshotCustomization: (x: Db, c: import('@noor/contract').LineCustomization | undefined) => Promise<import('@noor/contract').LineCustomization | undefined> }} deps.cart
 * @param {{ deliveryOptions: (x: Db, cityId: string) => Promise<import('../cart/pricing.js').DeliveryOption[]>, cityName: (x: Db, id: string) => Promise<string | undefined> }} deps.shipping
 * @param {{ findRule: (x: Db, code: string) => Promise<{ id: string, code: string, label: string, rule: import('../promotions/evaluate.js').PromoRule } | undefined>, updateRedemption: (tx: Db, orderId: string, a: { discountMinor: number, shippingWaivedMinor: number }) => Promise<void>, reverse: (tx: Db, orderId: string) => Promise<void> }} deps.promotions
 * @param {{ editReserved: (tx: Db, change: { orderId: string, lines: { orderLineId: string, variantId: string, quantity: number }[] }) => Promise<unknown> }} deps.inventory
 */
export function createEdits({ cart, shipping, promotions, inventory }) {
  /**
   * What the order would be after the edit, with nothing written. Throws what the edit would throw.
   * @param {Db} x @param {NonNullable<Awaited<ReturnType<typeof repo.orderById>>>} order @param {OrderEdit} body
   */
  async function plan(x, order, body) {
    if (order.status !== 'pending_confirmation' && order.status !== 'confirmed') throw new DomainError('action_not_allowed')
    const current = await repo.linesOf(x, order.id)
    const cityChanged = body.shippingAddress !== undefined && body.shippingAddress.cityId !== order.shipCityId
    if (order.status === 'confirmed' && (body.lines !== undefined || body.shippingMethodId !== undefined || cityChanged)) throw new DomainError('action_not_allowed')

    // the lines that remain: existing ones by id (at their old price), new ones by variant (at today's)
    /** @type {NonNullable<OrderEdit['lines']>} */
    const wanted = body.lines ?? current.map((l) => ({ lineId: l.id, quantity: l.quantity }))
    if (!wanted.length) throw issue('lines', 'required')
    const seen = new Set()
    const rows = wanted.map((w, i) => {
      if (w.quantity < 1 || w.quantity > 99) throw issue(`lines.${i}.quantity`, w.quantity < 1 ? 'too_small' : 'too_big')
      const old = w.lineId ? current.find((l) => l.id === w.lineId) : undefined
      if (w.lineId && !old) throw issue(`lines.${i}.lineId`, 'invalid_format')
      if (!old && !w.variantId) throw issue(`lines.${i}.variantId`, 'required')
      if (w.lineId && seen.has(w.lineId)) throw issue(`lines.${i}.lineId`, 'invalid_format')
      seen.add(w.lineId)
      return { id: old ? old.id : uuidv7(), old, variantId: old ? old.variantId : /** @type {string} */ (w.variantId), quantity: w.quantity, ...(old ? (old.customization ? { customization: /** @type {import('@noor/contract').LineCustomization} */ (old.customization) } : {}) : w.customization ? { customization: w.customization } : {}) }
    })
    const facts = await cart.factsOf(x, rows.map((r) => ({ id: r.id, variantId: r.variantId, quantity: r.quantity, ...(r.customization ? { customization: r.customization } : {}) })))
    const lines = rows.map((r) => {
      const f = /** @type {import('../cart/pricing.js').PricedLineInput | undefined} */ (facts.find((x2) => x2.id === r.id))
      if (!f || (!r.old && !f.sellable)) throw new DomainError('variant_unavailable', { variantId: r.variantId })
      // stock is checked where it is held (`editReserved`); the price of an old line is the day-of-order price
      return /** @type {import('../cart/pricing.js').PricedLineInput} */ ({ ...f, ...(r.old ? { unitMinor: r.old.unitPriceMinor, seenUnitMinor: r.old.unitPriceMinor, title: r.old.title, variantLabel: r.old.variantLabel } : { seenUnitMinor: f.unitMinor }), available: Number.MAX_SAFE_INTEGER, sellable: true })
    })

    // delivery: the same method when it still exists in the city, else the cheapest of the new city; a method that is named must exist there
    const cityId = body.shippingAddress?.cityId ?? order.shipCityId
    const options = await shipping.deliveryOptions(x, cityId)
    let methodId = body.shippingMethodId ?? order.shippingMethodId ?? undefined
    if (methodId && !options.some((o) => o.methodId === methodId)) {
      if (body.shippingMethodId) throw new DomainError('shipping_method_invalid')
      methodId = options.find((o) => o.label === order.shippingMethodLabel)?.methodId
    }

    // the code is checked again, as if this order had not used it yet
    const found = order.promoCode ? await promotions.findRule(x, order.promoCode) : undefined
    const priced = priceCart({
      lines,
      promo: found ? { id: found.id, code: found.code, label: found.label, rule: { ...found.rule, usageCount: Math.max(0, found.rule.usageCount - 1) } } : undefined,
      at: now(),
      shipping: { options, ...(methodId ? { methodId } : {}) },
      payments: undefined,
      customer: undefined,
    })
    const c = priced.cart
    const ship = /** @type {NonNullable<typeof c.shipping>} */ (c.shipping)
    return { rows, lines, priced, c, ship, cityId, current }
  }

  /** The numbers a person compares. @param {{ subtotalMinor: number, discountMinor: number, shippingFeeMinor: number, totalMinor: number, depositDueMinor: number }} o */
  const totalsOf = (o) => ({ subtotal: money(o.subtotalMinor), discount: money(o.discountMinor), shippingFee: money(o.shippingFeeMinor), total: money(o.totalMinor), depositDue: money(o.depositDueMinor) })

  return {
    /**
     * What an edit would do, for the screen to show old and new before saving. Writes nothing.
     * @param {Db} x @param {string} orderId @param {OrderEdit} body
     */
    async preview(x, orderId, body) {
      const order = await repo.orderById(x, orderId)
      if (!order) throw new DomainError('not_found')
      if (order.version !== body.version) throw new DomainError('stale_write', { currentVersion: order.version })
      const p = await plan(x, order, body)
      const issues = p.c.promoProblem ? [`promo_dropped:${p.c.promoProblem}`] : []
      return {
        before: totalsOf(order),
        after: totalsOf({ subtotalMinor: p.c.subtotal.amount, discountMinor: p.c.discount.amount, shippingFeeMinor: p.ship.fee.amount, totalMinor: p.c.total.amount, depositDueMinor: p.c.depositDue?.amount ?? 0 }),
        promoStillApplies: order.promoCode === null || !p.c.promoProblem,
        issues,
      }
    },

    /**
     * Applies an edit: new money, new lines, new hold on the stock, one event with before and after.
     * @param {Db} tx @param {string} orderId @param {OrderEdit} body @param {OrderActor} actor @param {{ ip?: string, userAgent?: string, requestId?: string }} [req]
     */
    async edit(tx, orderId, body, actor, req = {}) {
      const order = await repo.lockOrder(tx, orderId)
      if (!order) throw new DomainError('not_found')
      if (order.version !== body.version) throw new DomainError('stale_write', { currentVersion: order.version })
      const p = await plan(tx, order, body)
      const at = now()
      const { c, ship } = p
      const dropped = order.promoCode !== null && c.promoProblem !== undefined

      const before = { ...totalsOf(order), city: order.shipCity, address: order.shipAddress, landmark: order.shipLandmark, notes: order.shipNotes, method: order.shippingMethodLabel, lines: p.current.map((l) => `${l.sku} x${l.quantity}`).join(', ') }
      const cityName = body.shippingAddress ? ((await shipping.cityName(tx, p.cityId)) ?? order.shipCity) : order.shipCity
      /** @type {Parameters<typeof repo.updateOrder>[2]} */
      const set = {
        subtotalMinor: c.subtotal.amount, discountMinor: c.discount.amount, shippingFeeMinor: ship.fee.amount, totalMinor: c.total.amount, depositDueMinor: c.depositDue?.amount ?? 0,
        shippingMethodId: ship.methodId, shippingMethodLabel: ship.label, etaMinDays: ship.etaMinDays, etaMaxDays: ship.etaMaxDays,
        promoCode: dropped ? null : order.promoCode, version: order.version + 1, updatedAt: at,
      }
      if (body.shippingAddress) {
        Object.assign(set, { shipCityId: p.cityId, shipCity: cityName, shipAddress: body.shippingAddress.address, shipLandmark: body.shippingAddress.landmark ?? null, shipNotes: body.shippingAddress.notes ?? null })
      }
      if (body.customer) Object.assign(set, { customerName: body.customer.name, customerEmail: body.customer.email ?? null })
      await repo.updateOrder(tx, orderId, set)

      // lines: the old ones that stay are updated, the ones left out are removed, the new ones are written with their snapshot
      const keep = new Set(p.rows.flatMap((r) => (r.old ? [r.old.id] : [])))
      await repo.deleteLines(tx, p.current.filter((l) => !keep.has(l.id)).map((l) => l.id))
      for (const [i, r] of p.rows.entries()) {
        const l = /** @type {NonNullable<(typeof c.lines)[number]>} */ (c.lines[i])
        const amounts = { quantity: l.quantity, lineSubtotalMinor: l.lineSubtotal.amount, discountMinor: l.lineDiscount.amount, depositMinor: p.priced.lineDeposits[i] ?? 0 }
        if (r.old) await repo.updateLine(tx, r.old.id, amounts)
        else {
          const f = /** @type {import('../cart/pricing.js').PricedLineInput} */ (p.lines[i])
          await repo.insertLines(tx, [{
            id: r.id, orderId, position: i + 1, productId: f.productId, variantId: f.variantId, kind: f.kind, title: f.title, variantLabel: f.variantLabel, sku: f.sku ?? '', imageMediaId: f.imageMediaId ?? null,
            unitPriceMinor: l.unitPrice.amount, customization: (await cart.snapshotCustomization(tx, f.customization)) ?? null, stockTracked: f.stockMode === 'counted' || f.kind === 'bundle',
            leadMinDays: l.madeToOrder?.leadMinDays ?? null, leadMaxDays: l.madeToOrder?.leadMaxDays ?? null, ...amounts,
          }])
        }
      }
      for (const [i, r] of p.rows.entries()) if (r.old) await repo.updateLine(tx, r.old.id, { position: i + 1 })

      // stock: only an order that has not been confirmed can change what it holds
      if (body.lines !== undefined) {
        await inventory.editReserved(tx, { orderId, lines: holdsOf(p.lines.map((f, i) => ({ id: /** @type {NonNullable<(typeof p.rows)[number]>} */ (p.rows[i]).id, quantity: f.quantity, variantId: f.variantId, kind: f.kind, stockMode: f.stockMode, ...(f.customization ? { customization: f.customization } : {}) }))) })
      }

      // the code: its amounts follow the order, or it is given back when it no longer applies
      if (order.promoCode) {
        if (dropped) await promotions.reverse(tx, orderId)
        else await promotions.updateRedemption(tx, orderId, { discountMinor: c.discount.amount, shippingWaivedMinor: p.priced.shippingWaivedMinor })
      }

      const afterTotals = totalsOf({ subtotalMinor: c.subtotal.amount, discountMinor: c.discount.amount, shippingFeeMinor: ship.fee.amount, totalMinor: c.total.amount, depositDueMinor: c.depositDue?.amount ?? 0 })
      const after = { ...afterTotals, city: cityName, address: body.shippingAddress?.address ?? order.shipAddress, landmark: body.shippingAddress ? (body.shippingAddress.landmark ?? null) : order.shipLandmark, notes: body.shippingAddress ? (body.shippingAddress.notes ?? null) : order.shipNotes, method: ship.label, lines: c.lines.map((l, i) => `${/** @type {{ sku?: string }} */ (p.lines[i]).sku ?? ''} x${l.quantity}`).join(', ') }
      /** @type {Record<string, [unknown, unknown]>} */
      const changes = {}
      for (const [k, v] of Object.entries(after)) if (JSON.stringify(v) !== JSON.stringify(/** @type {Record<string, unknown>} */ (before)[k])) changes[k] = [/** @type {Record<string, unknown>} */ (before)[k], v]
      await repo.insertEvent(tx, {
        id: uuidv7(), orderId, type: 'edited', actorType: actor.type, actorId: actor.type === 'staff' ? actor.id : null, actorLabel: actor.type === 'storefront' ? null : actor.label,
        data: { changes, ...(dropped ? { promoDropped: c.promoProblem } : {}) }, public: false, createdAt: at,
      })
      await record(tx, {
        actor: actor.type === 'staff' ? { type: 'staff', id: actor.id, label: actor.label, role: actor.role } : actor.type === 'system' ? { type: 'system', label: actor.label } : { type: 'storefront', label: 'customer' },
        action: 'order.edited', entityType: 'order', entityId: orderId, entityLabel: numberOf(order), category: 'money', diff: Object.fromEntries(Object.entries(changes).filter(([k]) => !['address', 'landmark', 'notes'].includes(k))),
        ...(req.ip ? { ip: req.ip } : {}), ...(req.userAgent ? { userAgent: req.userAgent } : {}), ...(req.requestId ? { requestId: req.requestId } : {}),
      })
      return { id: orderId, version: order.version + 1, ...afterTotals, promoDropped: dropped ? c.promoProblem : undefined }
    },
  }
}
