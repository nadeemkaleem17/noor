// M4-05: what an order allows and what to watch for, from its own data only (no database).
import { enums } from '@noor/contract'
import { describe, expect, it } from 'vitest'
import { allowedActions, confirmable, invoiceNumberOf, riskMarkers } from '../src/modules/orders/rules.js'

/** @param {object} [over] */
const order = (over = {}) => ({ status: /** @type {import('../src/modules/orders/transitions.js').OrderStatus} */ ('pending_confirmation'), paymentMethod: 'cod', totalMinor: 500000, paidMinor: 0, refundedMinor: 0, depositDueMinor: 0, lines: [{ quantity: 2, returnedQuantity: 0 }], ...over })

describe('allowed actions', () => {
  it('each status offers exactly its own', () => {
    expect(allowedActions(order({ status: 'pending', paymentMethod: 'bank_transfer' }))).toEqual(['switch_to_cod', 'cancel', 'record_payment'])
    expect(allowedActions(order({ status: 'pending_confirmation' }))).toEqual(['confirm', 'edit_address', 'edit_items', 'cancel', 'record_payment'])
    expect(allowedActions(order({ status: 'confirmed' }))).toEqual(['dispatch', 'revert_confirmation', 'edit_address', 'cancel', 'record_payment'])
    expect(allowedActions(order({ status: 'dispatched' }))).toEqual(['deliver', 'return', 'update_tracking', 'record_payment'])
    expect(allowedActions(order({ status: 'delivered', paidMinor: 500000 }))).toEqual(['return'])
    expect(allowedActions(order({ status: 'cancelled' }))).toEqual([])
    expect(allowedActions(order({ status: 'returned' }))).toEqual([])
    expect(enums.orderStatus.length).toBe(7) // every status is covered above
  })

  it('a cash on delivery order that is still "pending" cannot switch to it again; a delivered order with everything returned offers no return', () => {
    expect(allowedActions(order({ status: 'pending', paymentMethod: 'cod' }))).not.toContain('switch_to_cod')
    expect(allowedActions(order({ status: 'delivered', paidMinor: 500000, lines: [{ quantity: 2, returnedQuantity: 2 }] }))).toEqual([])
    expect(allowedActions(order({ status: 'delivered', paidMinor: 500000, lines: [{ quantity: 2, returnedQuantity: 1 }, { quantity: 1, returnedQuantity: 1 }] }))).toEqual(['return'])
  })

  it('confirm waits for the deposit, or for the whole payment of a prepaid order', () => {
    expect(allowedActions(order({ depositDueMinor: 150000 }))).not.toContain('confirm')
    expect(allowedActions(order({ depositDueMinor: 150000, paidMinor: 150000 }))).toContain('confirm')
    expect(confirmable(order({ status: 'pending', paidMinor: 499999 }))).toBe(false)
    expect(confirmable(order({ status: 'pending', paidMinor: 500000 }))).toBe(true)
    expect(confirmable(order({ status: 'pending', depositDueMinor: 100000, paidMinor: 100000 }))).toBe(true) // a deposit order is confirmed once the deposit is in
    expect(allowedActions(order({ status: 'pending', paymentMethod: 'bank_transfer', paidMinor: 500000 }))).toContain('confirm')
  })

  it('recording a payment is offered while money is still owed, net of refunds', () => {
    expect(allowedActions(order({ status: 'confirmed', paidMinor: 500000 }))).not.toContain('record_payment')
    expect(allowedActions(order({ status: 'confirmed', paidMinor: 500000, refundedMinor: 100000 }))).toContain('record_payment')
  })
})

describe('risk markers', () => {
  const base = { paymentMethod: 'cod', totalMinor: 100000, customer: { deliveredCount: 0, refusedCount: 0, noCod: false }, duplicateOf: undefined, highValueMinor: 2500000 }
  it('a new customer with a small order has none', () => {
    expect(riskMarkers(base)).toEqual([])
  })
  it('each rule on its own', () => {
    expect(riskMarkers({ ...base, customer: { ...base.customer, deliveredCount: 2 } })).toEqual(['repeat_customer'])
    expect(riskMarkers({ ...base, customer: { ...base.customer, refusedCount: 1 } })).toEqual(['refused_before'])
    expect(riskMarkers({ ...base, customer: { ...base.customer, noCod: true } })).toEqual(['cod_blocked'])
    expect(riskMarkers({ ...base, duplicateOf: { id: 'x', orderNumber: 'RB-10001' } })).toEqual(['duplicate_suspect'])
    expect(riskMarkers({ ...base, totalMinor: 2500000 })).toEqual(['high_value'])
  })
  it('the cash on delivery markers only concern cash on delivery', () => {
    expect(riskMarkers({ ...base, paymentMethod: 'bank_transfer', totalMinor: 9000000, customer: { ...base.customer, noCod: true } })).toEqual([])
  })
})

describe('invoice numbers', () => {
  it('are INV, the year and six digits', () => {
    expect(invoiceNumberOf(2026, 1)).toBe('INV-2026-000001')
    expect(invoiceNumberOf(2027, 123456)).toBe('INV-2027-123456')
  })
})
