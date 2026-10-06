// The order-level payment status, worked out from the payment rows (plan/09-data-model/07-orders-payments.md section 5.3). Pure: nothing keeps it by hand.

/**
 * @param {{ inMinor: number, outMinor: number, owedBack: number, totalMinor: number, depositDueMinor: number }} o
 *   `inMinor`: captured payments that are not refunds; `outMinor`: captured refunds; `owedBack`: the value of cancelled or returned goods that was already paid for
 * @returns {import('@noor/contract').EnumValue<'paymentStatus'>}
 */
export function paymentStatusOf({ inMinor, outMinor, owedBack, totalMinor, depositDueMinor }) {
  if (outMinor > 0 && outMinor >= inMinor) return 'refunded'
  if (outMinor > 0) return 'partially_refunded'
  if (owedBack > outMinor) return 'refund_due'
  if (inMinor >= totalMinor) return 'paid'
  if (depositDueMinor > 0 && inMinor >= depositDueMinor) return 'deposit_paid'
  return 'unpaid'
}

/** How long stock and the payment slot are held for an unpaid prepaid order: a bank transfer needs time to reach the account (DOC-12 section 3.3), a hosted page does not. @param {string} method */
export const holdMinutesFor = (method) => (method === 'bank_transfer' ? 48 * 60 : 30)
