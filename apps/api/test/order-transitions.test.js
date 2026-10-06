// M4-04: the edges of plan/09-data-model/07-orders-payments.md section 5.1, tried pair by pair. Anything else is `409 invalid_transition` (ADR-0020).
import { enums, errorStatus } from '@noor/contract'
import { describe, expect, it } from 'vitest'
import { assertTransition, canTransition, isFinal } from '../src/modules/orders/transitions.js'

// the rows of the table in the data model, written out here on purpose: the code must agree with the document, not with itself
const allowed = [
  ['pending', 'pending_confirmation'], ['pending', 'confirmed'], ['pending', 'cancelled'],
  ['pending_confirmation', 'confirmed'], ['pending_confirmation', 'cancelled'],
  ['confirmed', 'pending_confirmation'], ['confirmed', 'dispatched'], ['confirmed', 'cancelled'],
  ['dispatched', 'delivered'], ['dispatched', 'returned'],
  ['delivered', 'returned'],
]

describe('order transitions', () => {
  it('exactly the documented pairs succeed, out of every pair of statuses', () => {
    const ok = enums.orderStatus.flatMap((from) => enums.orderStatus.filter((to) => canTransition(from, to)).map((to) => [from, to]))
    expect(ok.sort()).toEqual([...allowed].sort())
    expect(enums.orderStatus.length ** 2).toBe(49)
  })

  it('pending to delivered is 409 invalid_transition, and says which edge', () => {
    expect(() => assertTransition('pending', 'delivered')).toThrowError(expect.objectContaining({ code: 'invalid_transition', details: { from: 'pending', to: 'delivered' } }))
    expect(errorStatus.invalid_transition).toBe(409)
    expect(() => assertTransition('confirmed', 'dispatched')).not.toThrow()
  })

  it('cancelled and returned are final; nothing else is; a status never moves to itself', () => {
    expect(enums.orderStatus.filter(isFinal).sort()).toEqual(['cancelled', 'returned'])
    for (const s of enums.orderStatus) expect(canTransition(s, s)).toBe(false)
  })
})
