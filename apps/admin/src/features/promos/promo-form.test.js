// The promo form's conversions and the rule in words (plan/07-admin/07-promos.md sections 3 and 5). Pure.
import { describe, expect, it } from 'vitest'
import { describePromo, emptyForm, generateCode, toBody, toForm } from './promo-form'

const money = (/** @type {number} */ amount) => ({ amount, currency: /** @type {const} */ ('PKR') })

describe('what the API takes', () => {
  it('sends only what belongs to the kind and the scope, in capitals, with no empty field', () => {
    const body = toBody({ ...emptyForm(), code: ' eid10 ', percent: 10, amount: money(50000), maxDiscount: money(200000), scope: 'categories', targetIds: ['a'], note: '  ' })
    expect(body).toEqual({ code: 'EID10', type: 'percent', percent: 10, maxDiscount: money(200000), scope: 'categories', targetIds: ['a'], excludeSaleItems: true, firstOrderOnly: false, perCustomerLimit: 1, enabled: true, public: false })
    const fixed = toBody({ ...emptyForm(), code: 'SORRY', type: 'fixed', amount: money(50000), maxDiscount: money(1), percent: 10 })
    expect(fixed).toMatchObject({ type: 'fixed', amount: money(50000) })
    expect(fixed).not.toHaveProperty('percent')
    expect(fixed).not.toHaveProperty('maxDiscount')
    expect(toBody({ ...emptyForm(), code: 'SHIPFREE', type: 'free_shipping' })).not.toHaveProperty('percent')
  })
  it('reads the dates as Pakistan time and gives them back the same', () => {
    const body = toBody({ ...emptyForm(), code: 'EID10', startsAt: '2026-10-01T00:00', endsAt: '2026-10-15T23:59' })
    expect(body.startsAt).toBe('2026-09-30T19:00:00.000Z')
    expect(body.endsAt).toBe('2026-10-15T18:59:00.000Z')
    const back = toForm(/** @type {never} */ ({ ...body, id: 'x', status: 'active', usageCount: 0, used: false, targets: [], summary: '', version: 1, createdAt: '2026-10-01T00:00:00.000Z' }))
    expect(back.startsAt).toBe('2026-10-01T00:00')
    expect(back.endsAt).toBe('2026-10-15T23:59')
  })
  it('makes an eight-character code from letters and digits that are hard to confuse', () => {
    const code = generateCode()
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
    expect(generateCode(() => 0)).toBe('AAAAAAAA')
  })
})

describe('the rule in words', () => {
  const labels = { c1: 'Lawn', c2: 'Stitched', c3: 'Silk', c4: 'Cotton' }
  it('reads the example of the doc back', () => {
    const f = { ...emptyForm(), percent: 10, maxDiscount: money(200000), minSpend: money(500000), scope: /** @type {const} */ ('categories'), targetIds: ['c1', 'c2'], startsAt: '2026-10-01T00:00', endsAt: '2026-10-15T23:00' }
    expect(describePromo(f, labels)).toBe('10% off Lawn and Stitched, up to Rs 2,000, on orders over Rs 5,000. Sale items are not discounted. Once per customer. 1–15 Oct 2026.')
  })
  it('says what each kind does and what each option adds', () => {
    expect(describePromo({ ...emptyForm(), type: 'fixed', amount: money(50000), excludeSaleItems: false, perCustomerLimit: 3, usageLimit: 1000 }, {})).toBe('Rs 500 off everything. 3 times per customer. 1,000 uses in all.')
    expect(describePromo({ ...emptyForm(), type: 'free_shipping', excludeSaleItems: false, firstOrderOnly: true, perCustomerLimit: null, enabled: false }, {})).toBe('Free delivery everything. First order only. Switched off.')
    expect(describePromo({ ...emptyForm(), scope: 'categories', targetIds: ['c1', 'c2', 'c3', 'c4'], excludeSaleItems: false, perCustomerLimit: null }, labels)).toBe('10% off 4 categories.')
    expect(describePromo({ ...emptyForm(), excludeSaleItems: false, perCustomerLimit: null, endsAt: '2026-10-15T23:00' }, {})).toBe('10% off everything. Until 15 Oct 2026.')
  })
  it('says nothing until there is a value', () => {
    expect(describePromo({ ...emptyForm(), percent: null }, {})).toBe('')
    expect(describePromo({ ...emptyForm(), type: 'fixed', amount: null }, {})).toBe('')
  })
})
