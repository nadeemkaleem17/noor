// What an order allows and what to watch for, from its own data and nothing else (plan/09-data-model/07-orders-payments.md section 5.1, plan/07-admin/05-orders.md section 5.3).
// Pure. The admin screens offer exactly `allowedActions` (intersected with the staff member's permissions); risk markers inform and never block.
import { isFinal } from './transitions.js'

/**
 * @typedef {import('./transitions.js').OrderStatus} OrderStatus
 * @typedef {'confirm' | 'revert_confirmation' | 'dispatch' | 'deliver' | 'cancel' | 'return' | 'edit_address' | 'edit_items' | 'record_payment' | 'switch_to_cod' | 'update_tracking'} Action
 * @typedef {object} OrderFacts
 * @property {OrderStatus} status
 * @property {string} paymentMethod
 * @property {number} totalMinor
 * @property {number} paidMinor
 * @property {number} refundedMinor
 * @property {number} depositDueMinor
 * @property {readonly { quantity: number, returnedQuantity: number }[]} lines
 */

/** The money that has to be in before an order may be confirmed: the deposit when there is one, else the whole total (prepaid orders only). @param {OrderFacts} o */
const required = (o) => (o.depositDueMinor > 0 ? o.depositDueMinor : o.totalMinor)

/** Has a prepaid order been paid enough to confirm, or does a cash on delivery order have its deposit? @param {OrderFacts} o */
export const confirmable = (o) => (o.status === 'pending' ? o.paidMinor >= required(o) : o.depositDueMinor === 0 || o.paidMinor >= o.depositDueMinor)

/**
 * @param {OrderFacts} o
 * @returns {Action[]}
 */
export function allowedActions(o) {
  if (isFinal(o.status)) return []
  /** @type {Action[]} */
  const out = []
  const unpaid = o.paidMinor - o.refundedMinor < o.totalMinor
  switch (o.status) {
    case 'pending':
      if (confirmable(o)) out.push('confirm')
      if (o.paymentMethod !== 'cod') out.push('switch_to_cod')
      out.push('cancel')
      break
    case 'pending_confirmation':
      if (confirmable(o)) out.push('confirm')
      out.push('edit_address', 'edit_items', 'cancel')
      break
    case 'confirmed':
      out.push('dispatch', 'revert_confirmation', 'edit_address', 'cancel')
      break
    case 'dispatched':
      out.push('deliver', 'return', 'update_tracking')
      break
    case 'delivered':
      if (o.lines.some((l) => l.returnedQuantity < l.quantity)) out.push('return')
      break
  }
  if (unpaid) out.push('record_payment')
  return out
}

/**
 * @typedef {object} RiskInput
 * @property {string} paymentMethod
 * @property {number} totalMinor
 * @property {{ deliveredCount: number, refusedCount: number, noCod: boolean }} customer
 * @property {{ id: string, orderNumber: string } | undefined} duplicateOf another order of this phone number in the last 24 hours that is not cancelled
 * @property {number} highValueMinor the store's high-value cash on delivery threshold
 * @returns {string[]}
 */
/** @param {RiskInput} r */
export function riskMarkers({ paymentMethod, totalMinor, customer, duplicateOf, highValueMinor }) {
  const cod = paymentMethod === 'cod'
  /** @type {string[]} */
  const out = []
  if (customer.deliveredCount >= 1) out.push('repeat_customer')
  if (customer.refusedCount >= 1) out.push('refused_before')
  if (cod && customer.noCod) out.push('cod_blocked')
  if (duplicateOf) out.push('duplicate_suspect')
  if (cod && totalMinor >= highValueMinor) out.push('high_value')
  return out
}

/** `INV-2026-000123`. @param {number} year @param {number} n */
export const invoiceNumberOf = (year, n) => `INV-${year}-${String(n).padStart(6, '0')}`
