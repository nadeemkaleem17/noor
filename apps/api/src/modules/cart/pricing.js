// The one pricing implementation (plan/09-data-model/06-cart-promotions.md section 4): what a cart costs, line by line.
// Pure: every fact it needs (variants, stock, promo, delivery options, payment settings) is handed in, so a quote, an order and a preview of
// the same cart cannot differ. Integer paisa only (ADR-0013); deposits round up (ADR-0014).
import { mulInt, sub } from '@noor/contract'
import { evaluatePromo } from '../promotions/evaluate.js'

/**
 * @typedef {{ methodId: string, label: string, fee: number, etaMinDays: number, etaMaxDays: number, codAllowed: boolean, freeAboveMinor: number | null }} PricedOption
 * @typedef {object} PricedLineInput
 * @property {string} id the cart line
 * @property {string} productId
 * @property {string} variantId
 * @property {string} handle
 * @property {string} title
 * @property {string} variantLabel
 * @property {import('@noor/contract').Image} [image]
 * @property {import('@noor/contract').ProductKind} kind
 * @property {number} quantity
 * @property {number} unitMinor the variant's price now
 * @property {number | null} compareAtMinor
 * @property {number} seenUnitMinor the price the customer last saw
 * @property {'counted' | 'made_to_order' | 'preorder'} stockMode
 * @property {number} available units that can still be bought (counted variants)
 * @property {boolean} sellable the variant is enabled and its product is active
 * @property {number} maxPerOrder
 * @property {import('@noor/contract').LineCustomization} [customization]
 * @property {string} [customizationSummary]
 * @property {{ leadMinDays: number, leadMaxDays: number, depositBps: number | null }} [madeToOrder]
 * @property {readonly string[]} categoryIds
 *
 * @typedef {object} DeliveryOption
 * @property {string} methodId
 * @property {string} label
 * @property {number} feeMinor
 * @property {number | null} freeAboveMinor
 * @property {number} etaMinDays
 * @property {number} etaMaxDays
 * @property {boolean} codAllowed
 *
 * @typedef {object} PricingInput
 * @property {readonly PricedLineInput[]} lines
 * @property {{ id: string, code: string, label: string, rule: import('../promotions/evaluate.js').PromoRule, blockedBy?: string } | undefined} promo `blockedBy`: a reason found outside the rule, such as the customer's own limit
 * @property {Date} at
 * @property {{ options: readonly DeliveryOption[], methodId?: string } | undefined} shipping present once the city is known
 * @property {{ methods: readonly { type: import('@noor/contract').PaymentMethod, label: string, description?: string }[], codLimitMinor?: number | null } | undefined} payments the methods that are on, in checkout order
 * @property {{ noCod: boolean } | undefined} customer
 */

const money = (/** @type {number} */ amount) => ({ amount, currency: /** @type {const} */ ('PKR') })

/** Integer division rounded up, in BigInt so a large price times a rate never loses precision. @param {number} amount @param {number} bps */
export function ceilBps(amount, bps) {
  const n = BigInt(amount) * BigInt(bps)
  return Number((n + 9999n) / 10000n)
}

/**
 * @param {PricingInput} input
 */
export function priceCart({ lines, promo, at, shipping, payments, customer }) {
  // ---- steps 1 and 2: the lines
  const priced = lines.map((l) => {
    const counted = l.stockMode === 'counted'
    /** @type {('price_changed' | 'low_stock' | 'sold_out' | 'unavailable')[]} */
    const issues = []
    if (!l.sellable) issues.push('unavailable')
    else if (counted && l.available <= 0) issues.push('sold_out')
    else if (counted && l.available < l.quantity) issues.push('low_stock') // the quantity is never changed on the customer's behalf
    if (l.unitMinor !== l.seenUnitMinor) issues.push('price_changed')
    return { l, issues, subtotal: mulInt(l.unitMinor, l.quantity) }
  })
  const subtotal = priced.reduce((s, p) => s + p.subtotal, 0)

  // ---- steps 3 to 5: the promo
  let discount = 0
  let lineDiscounts = priced.map(() => 0)
  let freeShippingPromo = false
  /** @type {string | undefined} */
  let promoProblem
  /** @type {{ code: string, label: string, discount: number } | undefined} */
  let promoShown
  if (promo?.blockedBy) promoProblem = promo.blockedBy
  else if (promo) {
    const r = evaluatePromo(promo.rule, lines.map((l) => ({ productId: l.productId, categoryIds: l.categoryIds, unitMinor: l.unitMinor, quantity: l.quantity, onSale: l.compareAtMinor !== null })), at)
    if (r.ok) {
      discount = r.discount
      lineDiscounts = r.lineDiscounts
      freeShippingPromo = r.freeShipping
      promoShown = { code: promo.code, label: promo.label, discount }
    } else {
      promoProblem = r.reason
    }
  }
  /** The discount of the line at this index: there is one per line by construction. @param {number} i */
  const discountOf = (i) => /** @type {number} */ (lineDiscounts[i])
  const net = sub(subtotal, discount)

  // ---- step 6: shipping
  /** @type {PricedOption[] | undefined} */
  let options
  /** @type {PricedOption | undefined} */
  let chosen
  /** @type {{ code: 'free_shipping_remaining' | 'free_shipping_applied', amount?: { amount: number, currency: 'PKR' } }[]} */
  const messages = []
  if (shipping) {
    options = shipping.options.map((o) => ({
      methodId: o.methodId,
      label: o.label,
      fee: freeShippingPromo || (o.freeAboveMinor !== null && net >= o.freeAboveMinor) ? 0 : o.feeMinor,
      etaMinDays: o.etaMinDays,
      etaMaxDays: o.etaMaxDays,
      codAllowed: o.codAllowed,
      freeAboveMinor: o.freeAboveMinor,
    }))
    chosen = options.find((o) => o.methodId === shipping.methodId) ?? options.reduce((best, o) => (best && best.fee <= o.fee ? best : o), /** @type {(typeof options)[number] | undefined} */ (undefined))
    if (chosen) {
      if (freeShippingPromo) messages.push({ code: 'free_shipping_applied' })
      else if (chosen.freeAboveMinor !== null) {
        if (net >= chosen.freeAboveMinor) messages.push({ code: 'free_shipping_applied' })
        else messages.push({ code: 'free_shipping_remaining', amount: money(chosen.freeAboveMinor - net) })
      }
    }
  }

  // ---- step 7: total
  const shippingFee = chosen?.fee ?? 0
  const total = net + shippingFee

  // ---- step 8: deposits on made-to-order lines
  const depositDue = priced.reduce((s, p, i) => {
    const bps = p.l.madeToOrder?.depositBps
    return bps ? s + ceilBps(sub(p.subtotal, discountOf(i)), bps) : s
  }, 0)

  // ---- step 9: payment options (once the delivery is known, because the total and the method decide)
  const paymentOptions =
    shipping && payments
      ? payments.methods.map((m) => {
          /** @type {'cod_limit_exceeded' | 'cod_not_available' | 'deposit_requires_prepayment' | undefined} */
          let reason
          if (m.type === 'cod') {
            if (customer?.noCod || (chosen && !chosen.codAllowed)) reason = 'cod_not_available'
            else if (payments.codLimitMinor != null && total > payments.codLimitMinor) reason = 'cod_limit_exceeded'
            else if (depositDue > 0 && payments.methods.some((x) => x.type !== 'cod')) reason = 'deposit_requires_prepayment'
          }
          return { method: m.type, label: m.label, ...(m.description ? { description: m.description } : {}), allowed: reason === undefined, ...(reason ? { reason } : {}) }
        })
      : undefined

  const cartLines = priced.map((p, i) => {
    const l = p.l
    const counted = l.stockMode === 'counted'
    return {
      id: l.id,
      productId: l.productId,
      variantId: l.variantId,
      handle: l.handle,
      title: l.title,
      variantLabel: l.variantLabel,
      ...(l.image ? { image: l.image } : {}),
      kind: l.kind,
      quantity: l.quantity,
      unitPrice: money(l.unitMinor),
      ...(l.compareAtMinor !== null ? { compareAt: money(l.compareAtMinor) } : {}),
      lineSubtotal: money(p.subtotal),
      lineDiscount: money(discountOf(i)),
      ...(counted ? { available: Math.max(0, l.available) } : {}),
      maxPerOrder: l.maxPerOrder,
      ...(l.customization ? { customization: { ...l.customization, ...(l.customizationSummary ? { summary: l.customizationSummary } : {}) } } : {}),
      ...(l.madeToOrder ? { madeToOrder: { leadMinDays: l.madeToOrder.leadMinDays, leadMaxDays: l.madeToOrder.leadMaxDays, ...(l.madeToOrder.depositBps ? { depositPercent: l.madeToOrder.depositBps / 100 } : {}) } } : {}),
      issues: p.issues,
      ...(p.issues.includes('price_changed') ? { previousUnitPrice: money(l.seenUnitMinor) } : {}),
    }
  })

  return {
    cart: {
      lines: cartLines,
      count: lines.reduce((s, l) => s + l.quantity, 0),
      ...(promoShown ? { promo: { code: promoShown.code, label: promoShown.label, discount: money(promoShown.discount) } } : {}),
      ...(promoProblem ? { promoProblem } : {}),
      subtotal: money(subtotal),
      discount: money(discount),
      ...(chosen ? { shipping: { methodId: chosen.methodId, label: chosen.label, fee: money(chosen.fee), etaMinDays: chosen.etaMinDays, etaMaxDays: chosen.etaMaxDays } } : {}),
      total: money(total),
      ...(depositDue > 0 ? { depositDue: money(depositDue), dueOnDelivery: money(total - depositDue) } : {}),
      ...(options ? { shippingOptions: options.map((o) => ({ methodId: o.methodId, label: o.label, fee: money(o.fee), etaMinDays: o.etaMinDays, etaMaxDays: o.etaMaxDays, codAllowed: o.codAllowed })) } : {}),
      ...(paymentOptions ? { paymentOptions } : {}),
      messages,
      hasBlockingIssues: priced.some((p) => p.issues.includes('sold_out') || p.issues.includes('unavailable')),
    },
    /** For the writer: the lines whose seen price should now become the current one. */
    seenUpdates: priced.filter((p) => p.l.unitMinor !== p.l.seenUnitMinor).map((p) => ({ lineId: p.l.id, unitMinor: p.l.unitMinor })),
    /** What an order stores per line. */
    lineDiscounts,
    promoId: promoShown && promo ? promo.id : undefined,
    freeShippingPromo,
  }
}
