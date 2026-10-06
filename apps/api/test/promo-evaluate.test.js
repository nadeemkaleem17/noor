// M4-02: what a promo does to a set of lines. Pure, so no database: the numbers are the ones in plan/09-data-model/06-cart-promotions.md section 6.
import { describe, expect, it } from 'vitest'
import { evaluatePromo, promoStatus } from '../src/modules/promotions/evaluate.js'

const at = new Date('2026-10-05T10:00:00.000Z')
/** @param {object} [over] */
const promo = (over = {}) => ({
  type: /** @type {const} */ ('percent'), valueBps: 1000, valueMinor: null, maxDiscountMinor: null, minSpendMinor: null,
  scope: /** @type {const} */ ('all'), categoryIds: new Set(/** @type {string[]} */ ([])), productIds: new Set(/** @type {string[]} */ ([])),
  excludeSaleItems: true, usageLimit: null, usageCount: 0, startsAt: null, endsAt: null, enabled: true, ...over,
})
/** @param {number} unit @param {object} [over] */
const line = (unit, over = {}) => ({ productId: 'p1', categoryIds: ['c1'], unitMinor: unit, quantity: 1, onSale: false, ...over })

describe('discount amounts', () => {
  it('10% off lines of Rs. 6,990.00 and Rs. 1,234.56 is 69900 and 12346 paisa, total 82246 (rounded per line, half away from zero)', () => {
    const r = evaluatePromo(promo(), [line(699000), line(123456, { productId: 'p2' })], at)
    expect(r).toMatchObject({ ok: true, lineDiscounts: [69900, 12346], discount: 82246, eligibleSubtotal: 822456 })
  })

  it('a fixed Rs. 500 code over three lines sums to exactly 50000 paisa, in proportion to the lines', () => {
    const r = evaluatePromo(promo({ type: 'fixed', valueBps: null, valueMinor: 50000 }), [line(333333), line(333333, { productId: 'p2' }), line(333334, { productId: 'p3' })], at)
    expect(r.ok && r.discount).toBe(50000)
    expect(r.ok && r.lineDiscounts).toEqual([16667, 16666, 16667]) // exact shares 16666.65, 16666.65, 16667: the spare paisa goes to the earlier of the two largest remainders
  })

  it('a fixed code is never more than the eligible subtotal', () => {
    const r = evaluatePromo(promo({ type: 'fixed', valueBps: null, valueMinor: 900000 }), [line(250000)], at)
    expect(r).toMatchObject({ ok: true, discount: 250000, lineDiscounts: [250000] })
  })

  it('a cap scales the line discounts so they sum to the cap exactly', () => {
    const r = evaluatePromo(promo({ valueBps: 5000, maxDiscountMinor: 100000 }), [line(400000), line(200000, { productId: 'p2' }), line(100000, { productId: 'p3' })], at)
    expect(r.ok && r.lineDiscounts.reduce((a, b) => a + b, 0)).toBe(100000)
    expect(r.ok && r.lineDiscounts).toEqual([57143, 28571, 14286]) // 200000 : 100000 : 50000 of 100000, largest remainder
  })

  it('quantity multiplies before the percentage', () => {
    const r = evaluatePromo(promo(), [line(100005, { quantity: 3 })], at) // 300015 * 10% = 30001.5 -> 30002
    expect(r).toMatchObject({ ok: true, discount: 30002 })
  })

  it('free shipping gives no discount and says so', () => {
    const r = evaluatePromo(promo({ type: 'free_shipping', valueBps: null }), [line(500000)], at)
    expect(r).toMatchObject({ ok: true, discount: 0, freeShipping: true })
  })
})

describe('which lines count', () => {
  it('sale items are left out when asked, and do not count toward the minimum spend', () => {
    const lines = [line(300000, { onSale: true }), line(200000, { productId: 'p2' })]
    expect(evaluatePromo(promo(), lines, at)).toMatchObject({ ok: true, eligibleSubtotal: 200000, lineDiscounts: [0, 20000] })
    expect(evaluatePromo(promo({ minSpendMinor: 300000 }), lines, at)).toMatchObject({ ok: false, reason: 'promo_min_spend', eligibleSubtotal: 200000 })
    expect(evaluatePromo(promo({ excludeSaleItems: false }), lines, at)).toMatchObject({ ok: true, eligibleSubtotal: 500000 })
  })

  it('a categories scope matches any category of the product; a products scope matches the product', () => {
    const lines = [line(100000, { categoryIds: ['c1', 'c9'] }), line(100000, { productId: 'p2', categoryIds: ['c2'] })]
    expect(evaluatePromo(promo({ scope: 'categories', categoryIds: new Set(['c9']) }), lines, at)).toMatchObject({ ok: true, lineDiscounts: [10000, 0] })
    expect(evaluatePromo(promo({ scope: 'products', productIds: new Set(['p2']) }), lines, at)).toMatchObject({ ok: true, lineDiscounts: [0, 10000] })
    expect(evaluatePromo(promo({ scope: 'products', productIds: new Set(['nope']) }), lines, at)).toMatchObject({ ok: false, reason: 'promo_not_applicable' })
  })
})

describe('why a code does not apply, in the order of the plan', () => {
  const lines = [line(100000)]
  it.each([
    ['disabled', { enabled: false }, 'promo_not_found'],
    ['not started', { startsAt: new Date('2026-10-06T00:00:00.000Z') }, 'promo_not_started'],
    ['ended', { endsAt: new Date('2026-10-05T10:00:00.000Z') }, 'promo_expired'],
    ['used up', { usageLimit: 3, usageCount: 3 }, 'promo_usage_limit'],
    ['minimum spend', { minSpendMinor: 100001 }, 'promo_min_spend'],
  ])('%s', (_name, over, reason) => {
    expect(evaluatePromo(promo(over), lines, at)).toMatchObject({ ok: false, reason })
  })

  it('the first failure wins: a disabled code that has also expired is "not found"', () => {
    expect(evaluatePromo(promo({ enabled: false, endsAt: new Date('2020-01-01') }), lines, at)).toMatchObject({ reason: 'promo_not_found' })
  })
})

describe('derived status', () => {
  it.each([
    [{ enabled: false }, 'disabled'],
    [{ startsAt: new Date('2026-10-06T00:00:00.000Z') }, 'scheduled'],
    [{ endsAt: new Date('2026-10-04T00:00:00.000Z') }, 'expired'],
    [{ usageLimit: 2, usageCount: 2 }, 'expired'],
    [{}, 'active'],
  ])('%j is %s', (over, status) => {
    expect(promoStatus(promo(over), at)).toBe(status)
  })
})
