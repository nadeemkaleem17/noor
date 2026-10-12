// The words of the order screens: reason codes (plan/07-admin/05-orders.md section 6), risk markers and what the timeline says about each event.
import { ApiError } from '@noor/contract'
import { formatMoney } from '@noor/i18n/format'
import { messageFor } from '@/lib/errors'

export const cancelReasons = /** @type {const} */ ([
  ['customer_request', 'Customer asked'],
  ['unreachable', 'Unreachable after attempts'],
  ['duplicate', 'Duplicate order'],
  ['out_of_stock', 'Out of stock'],
  ['suspected_fake', 'Suspected fake'],
  ['other', 'Other'],
])
export const returnTypes = /** @type {const} */ ([
  ['refused_at_door', 'Refused at the door'],
  ['undelivered', 'Undelivered'],
  ['customer_return', 'Customer return'],
])
export const attemptOutcomes = /** @type {const} */ ([
  ['no_answer', 'No answer'],
  ['busy', 'Busy'],
  ['wrong_number', 'Wrong number'],
  ['call_later', 'Asked to call later'],
  ['declined', 'Declined'],
])
const all = Object.fromEntries([...cancelReasons, ...returnTypes, ...attemptOutcomes, ['payment_expired', 'Payment expired']])
/** @param {string | undefined} code */
export const reasonLabel = (code) => (code ? (all[code] ?? code.replace(/_/g, ' ')) : '')

/** @param {string} v */
export const humanise = (v) => v.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

/** The chips of section 5.3 (they inform; they never block). @type {Record<string, { label: string; tone: 'success' | 'warning' | 'danger' }>} */
export const riskLabels = {
  repeat_customer: { label: 'Repeat customer', tone: 'success' },
  refused_before: { label: 'Refused before', tone: 'danger' },
  cod_blocked: { label: 'COD blocked', tone: 'danger' },
  duplicate_suspect: { label: 'Possible duplicate', tone: 'warning' },
  high_value: { label: 'High value', tone: 'warning' },
}

export const paymentMethods = /** @type {const} */ ([
  ['cash', 'Cash'],
  ['bank_transfer', 'Bank transfer'],
  ['wallet', 'JazzCash / Easypaisa'],
  ['card', 'Card'],
  ['other', 'Other'],
])

/** The one line a timeline entry reads as. @param {import('@noor/contract').AdminOrder['events'][number]} e */
export function describeEvent(e) {
  const d = /** @type {Record<string, any>} */ (e.data ?? {})
  const money = (/** @type {number} */ amount) => formatMoney({ amount, currency: 'PKR' }, 'en')
  switch (e.type) {
    case 'placed':
      return `Order placed${e.actorType === 'storefront' ? ' on the website' : ''}`
    case 'status_changed': {
      const to = humanise(String(e.toStatus ?? '')).toLowerCase()
      const extra = d.reason ? `: ${reasonLabel(d.reason)}` : d.via ? ` (by ${humanise(d.via).toLowerCase()})` : d.courier ? ` with ${d.courier}${d.trackingNumber ? `, tracking ${d.trackingNumber}` : ''}` : d.cashReceived ? ' (cash received)' : ''
      return `Status: ${to}${extra}${d.note ? `. ${d.note}` : ''}`
    }
    case 'partial_return':
      return `Part of the order came back (${reasonLabel(d.returnType).toLowerCase()})${d.note ? `. ${d.note}` : ''}`
    case 'note':
      return String(d.body ?? '')
    case 'confirmation_attempt':
      return `Tried to reach the customer by ${d.channel}: ${reasonLabel(d.outcome).toLowerCase()}${d.note ? `. ${d.note}` : ''}`
    case 'tracking_updated':
      return `Tracking set to ${d.courier ?? ''}${d.trackingNumber ? ` ${d.trackingNumber}` : ''}`
    case 'edited':
      return `Order edited: ${
        Object.keys(d.changes ?? {})
          .map(humanise)
          .join(', ')
          .toLowerCase() || 'details'
      }`
    case 'payment_recorded':
      return `Payment recorded${typeof d.amount === 'number' ? `: ${money(d.amount)}` : ''}`
    case 'refund_recorded':
      return `Refund recorded${typeof d.amount === 'number' ? `: ${money(d.amount)}` : ''}`
    case 'notification':
      return `Message to the customer (${String(d.template ?? '')}): ${d.status === 'skipped' ? 'not sent, no provider' : String(d.status ?? '')}`
    default:
      return humanise(e.type)
  }
}

const orderMessages = /** @type {Record<string, string>} */ ({
  invalid_transition: 'The order cannot go there from where it is now. The latest version is shown.',
  action_not_allowed: 'That cannot be done to the order in its current status. The latest version is shown.',
  stale_write: 'Someone else changed this order a moment ago. The latest version is shown: check it and try again.',
  deposit_unpaid: 'The deposit has not been paid yet. Record the payment first.',
  payment_method_not_allowed: 'This customer is flagged for no cash on delivery. Give a reason to confirm anyway.',
  insufficient_stock: 'There is not enough stock for that change.',
  city_not_served: 'We do not deliver to that city.',
  promo_invalid: 'The promo code no longer applies to the new order.',
  shipping_method_invalid: 'That shipping method does not serve the city.',
})

/** What to tell staff about a failed order call. @param {unknown} error */
export const orderMessage = (error) => (error instanceof ApiError && orderMessages[error.code]) || messageFor(error)

/** The failures after which the order on screen is stale: refetch it and say so. @param {unknown} error */
export const isConflict = (error) => error instanceof ApiError && ['stale_write', 'invalid_transition', 'action_not_allowed'].includes(error.code)
