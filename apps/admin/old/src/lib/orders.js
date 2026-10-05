// Order status flow: what a transition writes to the order (status, invoice, dispatch, history).
import { generateInvoiceNo } from './invoice.js'

export const COURIERS = ['TCS', 'Leopards', 'M&P', 'Trax', 'PostEx', 'Own rider', 'Other']

export function historyOf(order) {
  // Orders created before history existed still show where they started.
  return order.history?.length ? order.history : [{ status: 'pending', at: order.createdAt }]
}

// `extra`: { courier, trackingNo, reason }. Returns the patch to apply to the order.
export function transitionPatch(order, to, extra = {}, now = new Date()) {
  const at = now.toISOString()
  const patch = { status: to }
  const entry = { status: to, at }
  if (to === 'dispatched') {
    if (!order.invoiceNo) patch.invoiceNo = generateInvoiceNo()
    patch.dispatch = { courier: extra.courier || 'Other', trackingNo: extra.trackingNo?.trim() || undefined, dispatchedAt: at }
    entry.note = [patch.dispatch.courier, patch.dispatch.trackingNo].filter(Boolean).join(' · ')
  } else if (extra.reason?.trim()) {
    entry.note = extra.reason.trim()
  }
  if (!entry.note) delete entry.note
  patch.history = [...historyOf(order), entry]
  return patch
}
