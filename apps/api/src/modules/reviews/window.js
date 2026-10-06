// Who may still review what (plan/09-data-model/08-reviews-notifications.md section 2.1): a line of a delivered order, until 90 days after delivery.
// Pure, so the order page and the review endpoints answer the same.

export const REVIEW_WINDOW_DAYS = 90

/**
 * @param {{ status: string, deliveredAt: Date | null }} order
 * @param {{ quantity: number, returnedQuantity: number }} line
 * @param {Date} at
 * @returns {'ok' | 'not_delivered' | 'expired'} `not_delivered` also covers a line that was returned in full: there is nothing left to review
 */
export function reviewState(order, line, at) {
  if (order.status !== 'delivered' || !order.deliveredAt || line.returnedQuantity >= line.quantity) return 'not_delivered'
  return at.getTime() > order.deliveredAt.getTime() + REVIEW_WINDOW_DAYS * 86_400_000 ? 'expired' : 'ok'
}
