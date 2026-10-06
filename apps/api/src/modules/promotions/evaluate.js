// What a promo does to a set of lines: the one implementation of plan/09-data-model/06-cart-promotions.md section 4 steps 3 to 5.
// Pure (no database, no clock): the cart price (M4-03), the admin preview and the order transaction all call it. Integer paisa only.
import { allocate, mulInt, percentOf } from '@noor/contract'

/**
 * @typedef {object} PromoRule
 * @property {'percent' | 'fixed' | 'free_shipping'} type
 * @property {number | null} valueBps
 * @property {number | null} valueMinor
 * @property {number | null} maxDiscountMinor
 * @property {number | null} minSpendMinor
 * @property {'all' | 'categories' | 'products'} scope
 * @property {ReadonlySet<string>} categoryIds the target categories and everything below them
 * @property {ReadonlySet<string>} productIds
 * @property {boolean} excludeSaleItems
 * @property {number | null} usageLimit
 * @property {number} usageCount redemptions not reversed
 * @property {Date | null} startsAt
 * @property {Date | null} endsAt
 * @property {boolean} enabled
 *
 * @typedef {object} PriceLine
 * @property {string} productId
 * @property {readonly string[]} categoryIds every category the product is in
 * @property {number} unitMinor
 * @property {number} quantity
 * @property {boolean} onSale the variant has a compare-at price
 *
 * @typedef {{ ok: true, eligibleSubtotal: number, discount: number, lineDiscounts: number[], freeShipping: boolean }
 *   | { ok: false, reason: 'promo_not_found' | 'promo_not_started' | 'promo_expired' | 'promo_usage_limit' | 'promo_not_applicable' | 'promo_min_spend', eligibleSubtotal: number }} Evaluation
 */

/** Stored text of a derived status: never kept in the database. @param {Pick<PromoRule, 'enabled' | 'startsAt' | 'endsAt' | 'usageLimit' | 'usageCount'>} p @param {Date} at */
export function promoStatus(p, at) {
  if (!p.enabled) return /** @type {const} */ ('disabled')
  if (p.startsAt && p.startsAt > at) return /** @type {const} */ ('scheduled')
  if ((p.endsAt && p.endsAt <= at) || (p.usageLimit !== null && p.usageCount >= p.usageLimit)) return /** @type {const} */ ('expired')
  return /** @type {const} */ ('active')
}

/** @param {PromoRule} p @param {PriceLine} line */
const matches = (p, line) => {
  if (p.excludeSaleItems && line.onSale) return false
  if (p.scope === 'categories') return line.categoryIds.some((c) => p.categoryIds.has(c))
  if (p.scope === 'products') return p.productIds.has(line.productId)
  return true
}

/**
 * The limits that need only the promo, checked in the order of the plan; the first failure wins. Per-customer limits are checked at order creation.
 * @param {PromoRule} p @param {Date} at
 */
export function promoWindowProblem(p, at) {
  if (!p.enabled) return /** @type {const} */ ('promo_not_found') // a disabled code is indistinguishable from one that does not exist
  if (p.startsAt && p.startsAt > at) return /** @type {const} */ ('promo_not_started')
  if (p.endsAt && p.endsAt <= at) return /** @type {const} */ ('promo_expired')
  if (p.usageLimit !== null && p.usageCount >= p.usageLimit) return /** @type {const} */ ('promo_usage_limit')
  return null
}

/**
 * @param {PromoRule} promo
 * @param {readonly PriceLine[]} lines
 * @param {Date} at
 * @returns {Evaluation}
 */
export function evaluatePromo(promo, lines, at) {
  const subtotals = lines.map((l) => mulInt(l.unitMinor, l.quantity))
  const eligible = lines.map((l) => matches(promo, l))
  const eligibleSubtotal = subtotals.reduce((sum, s, i) => (eligible[i] ? sum + s : sum), 0)

  const problem = promoWindowProblem(promo, at)
  if (problem) return { ok: false, reason: problem, eligibleSubtotal }
  if (eligibleSubtotal === 0) return { ok: false, reason: 'promo_not_applicable', eligibleSubtotal }
  if (promo.minSpendMinor !== null && eligibleSubtotal < promo.minSpendMinor) return { ok: false, reason: 'promo_min_spend', eligibleSubtotal }

  const lineDiscounts = lines.map(() => 0)
  const idx = eligible.flatMap((e, i) => (e ? [i] : []))
  if (promo.type === 'percent') {
    for (const i of idx) lineDiscounts[i] = percentOf(subtotals[i] ?? 0, promo.valueBps ?? 0)
    const sum = lineDiscounts.reduce((a, b) => a + b, 0)
    if (promo.maxDiscountMinor !== null && sum > promo.maxDiscountMinor) {
      // scale the lines to the cap in proportion to what each had, so the parts add up to the cap exactly
      const scaled = allocate(promo.maxDiscountMinor, idx.map((i) => lineDiscounts[i] ?? 0))
      idx.forEach((i, k) => (lineDiscounts[i] = scaled[k] ?? 0))
    }
  } else if (promo.type === 'fixed') {
    const total = Math.min(promo.valueMinor ?? 0, eligibleSubtotal)
    const parts = allocate(total, idx.map((i) => subtotals[i] ?? 0))
    idx.forEach((i, k) => (lineDiscounts[i] = parts[k] ?? 0))
  }
  const discount = lineDiscounts.reduce((a, b) => a + b, 0)
  return { ok: true, eligibleSubtotal, discount, lineDiscounts, freeShipping: promo.type === 'free_shipping' }
}
