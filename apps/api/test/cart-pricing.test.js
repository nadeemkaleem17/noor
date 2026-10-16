// M4-03: the one pricing implementation, with no database. Every branch of plan/09-data-model/06-cart-promotions.md section 4 is here (100% coverage of pricing.js).
import { describe, expect, it } from 'vitest'
import { ceilBps, priceCart } from '../src/modules/cart/pricing.js'

const at = new Date('2026-10-05T10:00:00.000Z')
const pkr = (/** @type {number} */ amount) => ({ amount, currency: 'PKR' })

/** @param {object} [over] */
const line = (over = {}) => ({
  id: 'l1', productId: 'p1', variantId: 'v1', handle: 'lawn-suit', title: 'Lawn suit', variantLabel: 'M', kind: /** @type {const} */ ('stitched'),
  quantity: 1, unitMinor: 500000, compareAtMinor: null, seenUnitMinor: 500000, stockMode: /** @type {const} */ ('counted'), available: 10,
  sellable: true, maxPerOrder: 10, categoryIds: ['c1'], ...over,
})
/** @param {object} [over] */
const rule = (over = {}) => ({
  type: /** @type {const} */ ('percent'), valueBps: 1000, valueMinor: null, maxDiscountMinor: null, minSpendMinor: null, scope: /** @type {const} */ ('all'),
  categoryIds: new Set(/** @type {string[]} */ ([])), productIds: new Set(/** @type {string[]} */ ([])), excludeSaleItems: true, usageLimit: null, usageCount: 0,
  startsAt: null, endsAt: null, enabled: true, ...over,
})
const promo = (/** @type {object} */ over = {}, /** @type {object} */ extra = {}) => ({ id: 'pr1', code: 'EID10', label: '10% off', rule: rule(over), ...extra })
const standard = { methodId: 'm1', label: 'Standard', feeMinor: 25000, freeAboveMinor: 500000, etaMinDays: 3, etaMaxDays: 5, codAllowed: true }
const express = { methodId: 'm2', label: 'Express', feeMinor: 45000, freeAboveMinor: null, etaMinDays: 1, etaMaxDays: 2, codAllowed: true }
const cod = { type: /** @type {const} */ ('cod'), label: 'Cash on delivery' }
const bank = { type: /** @type {const} */ ('bank_transfer'), label: 'Bank transfer', description: 'Send a screenshot' }
const price = (/** @type {object} */ over = {}) => priceCart({ lines: [line()], promo: undefined, at, shipping: undefined, payments: undefined, customer: undefined, ...over })

describe('lines and the subtotal', () => {
  it('multiplies price by quantity and adds the lines up; a bare cart has no shipping, no payment options, no promo', () => {
    const r = price({ lines: [line({ quantity: 2 }), line({ id: 'l2', variantId: 'v2', unitMinor: 123456, seenUnitMinor: 123456 })] })
    expect(r.cart).toMatchObject({ count: 3, subtotal: pkr(1123456), discount: pkr(0), total: pkr(1123456), messages: [], hasBlockingIssues: false })
    expect(r.cart.lines[0]).toMatchObject({ unitPrice: pkr(500000), lineSubtotal: pkr(1000000), lineDiscount: pkr(0), available: 10, issues: [] })
    expect(r.cart).not.toHaveProperty('shipping')
    expect(r.cart).not.toHaveProperty('shippingOptions')
    expect(r.cart).not.toHaveProperty('paymentOptions')
    expect(r.cart).not.toHaveProperty('promo')
    expect(r.cart).not.toHaveProperty('depositDue')
    expect(r.promoId).toBeUndefined()
  })

  it('an empty cart costs nothing', () => {
    expect(price({ lines: [] }).cart).toMatchObject({ count: 0, subtotal: pkr(0), total: pkr(0), lines: [] })
  })

  it('carries the picture, the compare-at price, the customisation with its summary, and made-to-order facts', () => {
    const image = { src: '/img/a.webp', srcset: '', width: 10, height: 10, alt: 'a' }
    const l = price({
      lines: [line({ image, compareAtMinor: 650000, customization: { measurements: { chest: 38 } }, customizationSummary: 'chest 38', madeToOrder: { leadMinDays: 10, leadMaxDays: 14, depositBps: 3000 }, stockMode: 'made_to_order' })],
    }).cart.lines[0]
    expect(l).toMatchObject({ image, compareAt: pkr(650000), customization: { measurements: { chest: 38 }, summary: 'chest 38' }, madeToOrder: { leadMinDays: 10, leadMaxDays: 14, depositPercent: 30 } })
    expect(l).not.toHaveProperty('available') // only counted stock has a count
  })

  it('a customisation without a summary, and a made-to-order line without a deposit, say only what they have', () => {
    const l = price({ lines: [line({ customization: { notes: 'hem short' }, madeToOrder: { leadMinDays: 5, leadMaxDays: 7, depositBps: null } })] }).cart.lines[0]
    expect(l?.customization).toEqual({ notes: 'hem short' })
    expect(l?.madeToOrder).toEqual({ leadMinDays: 5, leadMaxDays: 7 })
  })
})

describe('line issues', () => {
  it('a price that changed is flagged with the old price, and the line is listed for the seen price to be updated', () => {
    const r = price({ lines: [line({ unitMinor: 550000, seenUnitMinor: 500000 })] })
    expect(r.cart.lines[0]).toMatchObject({ issues: ['price_changed'], previousUnitPrice: pkr(500000), unitPrice: pkr(550000) })
    expect(r.seenUpdates).toEqual([{ lineId: 'l1', unitMinor: 550000 }])
    expect(r.cart.hasBlockingIssues).toBe(false)
  })

  it('less stock than the quantity is low_stock and the quantity is left alone; none at all is sold_out and blocks', () => {
    const low = price({ lines: [line({ quantity: 5, available: 3 })] })
    expect(low.cart.lines[0]).toMatchObject({ quantity: 5, available: 3, issues: ['low_stock'] })
    expect(low.cart.hasBlockingIssues).toBe(false)
    const out = price({ lines: [line({ available: 0 })] })
    expect(out.cart.lines[0]).toMatchObject({ available: 0, issues: ['sold_out'] })
    expect(out.cart.hasBlockingIssues).toBe(true)
    expect(price({ lines: [line({ available: -2 })] }).cart.lines[0]?.available).toBe(0) // never a negative count
  })

  it('a variant that can no longer be sold is unavailable and blocks, whatever the stock says', () => {
    const r = price({ lines: [line({ sellable: false, available: 0 })] })
    expect(r.cart.lines[0]?.issues).toEqual(['unavailable'])
    expect(r.cart.hasBlockingIssues).toBe(true)
  })

  it('made-to-order and pre-order variants never run out', () => {
    for (const stockMode of /** @type {const} */ (['made_to_order', 'preorder'])) expect(price({ lines: [line({ stockMode, available: 0 })] }).cart.lines[0]?.issues).toEqual([])
  })

  it('a price change and low stock together are both reported', () => {
    expect(price({ lines: [line({ quantity: 4, available: 2, unitMinor: 1, seenUnitMinor: 2 })] }).cart.lines[0]?.issues).toEqual(['low_stock', 'price_changed'])
  })
})

describe('the promo', () => {
  it('discounts per eligible line, shows the code, and total = subtotal - discount', () => {
    const r = price({ lines: [line({ unitMinor: 699000, seenUnitMinor: 699000 }), line({ id: 'l2', variantId: 'v2', productId: 'p2', unitMinor: 123456, seenUnitMinor: 123456 })], promo: promo() })
    expect(r.cart).toMatchObject({ discount: pkr(82246), total: pkr(822456 - 82246), promo: { code: 'EID10', label: '10% off', discount: pkr(82246) } })
    expect(r.cart.lines.map((l) => l.lineDiscount.amount)).toEqual([69900, 12346])
    expect(r.lineDiscounts).toEqual([69900, 12346])
    expect(r.promoId).toBe('pr1')
  })

  it('a code that stopped applying leaves the cart at full price and says why', () => {
    const r = price({ promo: promo({ endsAt: new Date('2026-10-01T00:00:00.000Z') }) })
    expect(r.cart).toMatchObject({ discount: pkr(0), total: pkr(500000), promoProblem: 'promo_expired' })
    expect(r.cart).not.toHaveProperty('promo')
    expect(r.promoId).toBeUndefined()
  })

  it('a reason found outside the rule (the customer\'s own limit) is the problem, and the rule is not used', () => {
    const r = price({ promo: promo({}, { blockedBy: 'promo_customer_limit' }) })
    expect(r.cart).toMatchObject({ discount: pkr(0), promoProblem: 'promo_customer_limit' })
  })

  it('a free-shipping code gives no discount and waives the delivery fee', () => {
    const r = price({ promo: promo({ type: 'free_shipping', valueBps: null }), shipping: { options: [express] }, payments: { methods: [cod] } })
    expect(r.cart).toMatchObject({ discount: pkr(0), shipping: { fee: pkr(0) }, total: pkr(500000), messages: [{ code: 'free_shipping_applied' }] })
    expect(r.freeShippingPromo).toBe(true)
    expect(r.shippingWaivedMinor).toBe(45000) // what the code saved
    // nothing is saved before there is a city to deliver to, or when the fee was already waived by the threshold
    expect(price({ promo: promo({ type: 'free_shipping', valueBps: null }) }).shippingWaivedMinor).toBe(0)
    expect(price({ lines: [line({ unitMinor: 600000, seenUnitMinor: 600000 })], promo: promo({ type: 'free_shipping', valueBps: null }), shipping: { options: [standard] } }).shippingWaivedMinor).toBe(0)
  })
})

describe('delivery', () => {
  it('lists the options with their fees, picks the cheapest, and adds its fee to the total', () => {
    const r = price({ lines: [line({ unitMinor: 100000, seenUnitMinor: 100000 })], shipping: { options: [standard, express] } })
    expect(r.cart.shipping).toEqual({ methodId: 'm1', label: 'Standard', fee: pkr(25000), etaMinDays: 3, etaMaxDays: 5 })
    expect(r.cart.shippingOptions?.map((o) => [o.methodId, o.fee.amount])).toEqual([['m1', 25000], ['m2', 45000]])
    expect(r.cart.total).toEqual(pkr(125000))
    expect(r.cart.messages).toEqual([{ code: 'free_shipping_remaining', amount: pkr(400000), percent: 20 }])
  })

  it('a bag with no city yet is measured against the lowest threshold of any zone, with the percent for the progress bar', () => {
    const bag = (/** @type {number} */ unitMinor, /** @type {object} */ extra = {}) => price({ lines: [line({ unitMinor, seenUnitMinor: unitMinor })], freeAboveFromMinor: 500000, ...extra }).cart.messages
    expect(bag(300000)).toEqual([{ code: 'free_shipping_remaining', amount: pkr(200000), percent: 60 }])
    expect(bag(499999)[0]).toMatchObject({ percent: 99 }) // never 100 before it is reached
    expect(bag(500000)).toEqual([{ code: 'free_shipping_applied' }])
    expect(price({ lines: [], freeAboveFromMinor: 500000 }).cart.messages, 'an empty bag says nothing').toEqual([])
    expect(bag(300000, { shipping: { options: [standard] } })[0], 'once a city is known its own method decides').toMatchObject({ amount: pkr(200000) })
  })

  it('takes the method the customer chose, even if it costs more; an unknown id falls back to the cheapest', () => {
    const pick = (/** @type {string} */ methodId) => price({ shipping: { options: [standard, express], methodId } }).cart.shipping?.methodId
    expect(pick('m2')).toBe('m2')
    expect(pick('nope')).toBe('m1')
  })

  it('picks the cheapest whatever order the options come in', () => {
    expect(price({ shipping: { options: [express, standard] } }).cart.shipping?.methodId).toBe('m1') // standard is free at 500000, express is not
    expect(price({ lines: [line({ unitMinor: 100000 })], shipping: { options: [express, standard] } }).cart.shipping?.methodId).toBe('m1') // 25000 against 45000
    expect(price({ lines: [line({ unitMinor: 100000 })], shipping: { options: [standard, express] } }).cart.shipping?.methodId).toBe('m1')
  })

  it('is free at or above the threshold of the method, counted after the discount', () => {
    const at500 = price({ lines: [line({ unitMinor: 500000 })], shipping: { options: [standard] } }).cart
    expect(at500).toMatchObject({ shipping: { fee: pkr(0) }, total: pkr(500000), messages: [{ code: 'free_shipping_applied' }] })
    const afterDiscount = price({ promo: promo(), shipping: { options: [standard] } }).cart // 500000 - 50000 = 450000 < 500000
    expect(afterDiscount).toMatchObject({ shipping: { fee: pkr(25000) }, messages: [{ code: 'free_shipping_remaining', amount: pkr(50000) }] })
  })

  it('a method with no threshold says nothing about free delivery', () => {
    expect(price({ shipping: { options: [express] } }).cart.messages).toEqual([])
  })

  it('an unserved city (no options) leaves delivery out', () => {
    const r = price({ shipping: { options: [] } })
    expect(r.cart.shippingOptions).toEqual([])
    expect(r.cart).not.toHaveProperty('shipping')
    expect(r.cart.messages).toEqual([])
    expect(r.cart.total).toEqual(pkr(500000))
  })
})

describe('deposits on made-to-order lines (ADR-0014: rounded up)', () => {
  it('30% of the line after its discount, rounded up to the paisa; the rest is due on delivery', () => {
    const mto = line({ stockMode: 'made_to_order', madeToOrder: { leadMinDays: 10, leadMaxDays: 14, depositBps: 3000 }, unitMinor: 333333, seenUnitMinor: 333333 })
    const r = price({ lines: [mto, line({ id: 'l2', variantId: 'v2', unitMinor: 100000, seenUnitMinor: 100000 })], shipping: { options: [express] }, payments: { methods: [cod] } })
    // 333333 * 30% = 99999.9 -> 100000; the ready-made line owes no deposit
    expect(r.lineDeposits).toEqual([100000, 0])
    expect(r.cart).toMatchObject({ depositDue: pkr(100000), total: pkr(333333 + 100000 + 45000), dueOnDelivery: pkr(333333 + 100000 + 45000 - 100000) })
  })

  it('works on the line after the promo took its share', () => {
    const mto = line({ stockMode: 'made_to_order', madeToOrder: { leadMinDays: 1, leadMaxDays: 2, depositBps: 5000 }, unitMinor: 200001, seenUnitMinor: 200001 })
    const r = price({ lines: [mto], promo: promo() }) // 200001 - 20000 = 180001; half = 90000.5 -> 90001
    expect(r.cart.depositDue).toEqual(pkr(90001))
  })

  it('ceilBps rounds up and is exact on whole results', () => {
    expect(ceilBps(100000, 3000)).toBe(30000)
    expect(ceilBps(100001, 3000)).toBe(30001)
    expect(ceilBps(0, 3000)).toBe(0)
  })
})

describe('payment options', () => {
  const ship = { options: [standard] }
  const options = (/** @type {object} */ over) => price({ shipping: ship, ...over }).cart.paymentOptions

  it('are listed only once the delivery is known, with their text', () => {
    expect(price({ payments: { methods: [cod] } }).cart.paymentOptions).toBeUndefined()
    expect(options({ payments: { methods: [cod, bank] } })).toEqual([
      { method: 'cod', label: 'Cash on delivery', allowed: true },
      { method: 'bank_transfer', label: 'Bank transfer', description: 'Send a screenshot', allowed: true },
    ])
  })

  it('cash on delivery is refused above the order limit, and allowed at it', () => {
    const over = options({ lines: [line({ unitMinor: 300000 })], payments: { methods: [cod], codLimitMinor: 300000 } })?.[0] // total 300000 + 25000 fee
    expect(over).toMatchObject({ allowed: false, reason: 'cod_limit_exceeded' })
    const at = options({ lines: [line({ unitMinor: 475000, seenUnitMinor: 475000 })], payments: { methods: [cod], codLimitMinor: 500000 } })?.[0] // 475000 + 25000
    expect(at).toMatchObject({ allowed: true })
  })

  it('cash on delivery is refused when the delivery method or the customer says no, before the limit is looked at', () => {
    expect(options({ payments: { methods: [cod], codLimitMinor: 1 }, customer: { noCod: true } })?.[0]).toMatchObject({ allowed: false, reason: 'cod_not_available' })
    expect(price({ shipping: { options: [{ ...standard, codAllowed: false }] }, payments: { methods: [cod] } }).cart.paymentOptions?.[0]).toMatchObject({ allowed: false, reason: 'cod_not_available' })
  })

  it('with a deposit due, cash on delivery needs a prepaid method to exist; alone it is allowed (launch rule, ADR-0017)', () => {
    const mto = line({ stockMode: 'made_to_order', madeToOrder: { leadMinDays: 5, leadMaxDays: 7, depositBps: 3000 } })
    expect(options({ lines: [mto], payments: { methods: [cod] } })?.[0]).toMatchObject({ allowed: true })
    const both = options({ lines: [mto], payments: { methods: [cod, bank] } })
    expect(both?.[0]).toMatchObject({ allowed: false, reason: 'deposit_requires_prepayment' })
    expect(both?.[1]).toMatchObject({ allowed: true })
  })

  it('no code of a limit means no limit', () => {
    expect(options({ lines: [line({ unitMinor: 99999999 })], payments: { methods: [cod], codLimitMinor: null } })?.[0]).toMatchObject({ allowed: true })
  })
})
