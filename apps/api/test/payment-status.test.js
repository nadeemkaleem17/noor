// M4-06: the order-level payment status from the payment rows (plan/09-data-model/07-orders-payments.md section 5.3), and the hold times. No database.
import { describe, expect, it } from 'vitest'
import { holdMinutesFor, paymentStatusOf } from '../src/modules/payments/status.js'

const o = (/** @type {object} */ over = {}) => ({ inMinor: 0, outMinor: 0, owedBack: 0, totalMinor: 500000, depositDueMinor: 0, ...over })

describe('payment status', () => {
  it('unpaid, deposit paid, paid', () => {
    expect(paymentStatusOf(o())).toBe('unpaid')
    expect(paymentStatusOf(o({ depositDueMinor: 150000, inMinor: 149999 }))).toBe('unpaid')
    expect(paymentStatusOf(o({ depositDueMinor: 150000, inMinor: 150000 }))).toBe('deposit_paid')
    expect(paymentStatusOf(o({ inMinor: 500000 }))).toBe('paid')
    expect(paymentStatusOf(o({ depositDueMinor: 150000, inMinor: 500000 }))).toBe('paid') // a deposit order that has paid in full
  })

  it('money to pay back: cancelled or returned goods that were paid for, until the refund is made', () => {
    expect(paymentStatusOf(o({ inMinor: 150000, owedBack: 150000 }))).toBe('refund_due')
    expect(paymentStatusOf(o({ inMinor: 500000, owedBack: 200000 }))).toBe('refund_due') // some goods came back
  })

  it('a refund: partial while something is still owed or kept, refunded when it matches what came in', () => {
    expect(paymentStatusOf(o({ inMinor: 500000, outMinor: 200000, owedBack: 500000 }))).toBe('partially_refunded')
    expect(paymentStatusOf(o({ inMinor: 500000, outMinor: 500000, owedBack: 500000 }))).toBe('refunded')
    expect(paymentStatusOf(o({ inMinor: 150000, outMinor: 150000, owedBack: 150000 }))).toBe('refunded')
  })

  it('the first rule that matches wins: a refund beats "owed back" and "paid"', () => {
    expect(paymentStatusOf(o({ inMinor: 500000, outMinor: 1, owedBack: 500000 }))).toBe('partially_refunded')
  })
})

describe('how long an unpaid order is held', () => {
  it('a bank transfer gets 48 hours; a hosted page 30 minutes', () => {
    expect(holdMinutesFor('bank_transfer')).toBe(2880)
    expect(holdMinutesFor('card')).toBe(30)
    expect(holdMinutesFor('wallet')).toBe(30)
  })
})
