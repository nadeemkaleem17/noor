// The edges an order may follow (plan/09-data-model/07-orders-payments.md section 5.1). Anything not listed is `409 invalid_transition`.
// Guards and effects (who may, what must hold, what changes in the same transaction) are added by `orders.transition` (M4-05); the table of edges is only this.
import { DomainError } from '../../platform/errors.js'

/** @typedef {import('@noor/contract').EnumValue<'orderStatus'>} OrderStatus */

/** @type {Readonly<Record<OrderStatus, readonly OrderStatus[]>>} */
export const edges = {
  pending: ['pending_confirmation', 'confirmed', 'cancelled'],
  pending_confirmation: ['confirmed', 'cancelled'],
  confirmed: ['pending_confirmation', 'dispatched', 'cancelled'],
  dispatched: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
}

/** `cancelled` and `returned` are final. @param {OrderStatus} status */
export const isFinal = (status) => edges[status].length === 0

/** @param {OrderStatus} from @param {OrderStatus} to */
export const canTransition = (from, to) => edges[from].includes(to)

/** @param {OrderStatus} from @param {OrderStatus} to */
export function assertTransition(from, to) {
  if (!canTransition(from, to)) throw new DomainError('invalid_transition', { from, to })
}
