// A promo as the form holds it, the body the API takes, and the rule read back in words (plan/07-admin/07-promos.md sections 3 and 5).
// The words give the rule, never the discount: the amount of a discount is worked out by the server (`admin.promos.preview`).
import { formatMoney } from '@noor/i18n/format'
import { prune } from '@/lib/form'
import { fromLocalInput, toLocalInput } from '@/lib/dates'

/** @typedef {import('@noor/contract').Money} Money */
/**
 * @typedef {object} PromoForm
 * @property {string} code
 * @property {'percent' | 'fixed' | 'free_shipping'} type
 * @property {number | null} percent
 * @property {Money | null} amount
 * @property {Money | null} maxDiscount
 * @property {Money | null} minSpend
 * @property {'all' | 'categories' | 'products'} scope
 * @property {string[]} targetIds
 * @property {boolean} excludeSaleItems
 * @property {boolean} firstOrderOnly
 * @property {number | null} usageLimit
 * @property {number | null} perCustomerLimit
 * @property {string} startsAt - a `datetime-local` value, Pakistan time
 * @property {string} endsAt
 * @property {boolean} enabled
 * @property {boolean} public - listed on the shop's Offers page
 * @property {string} note
 */

/** A new promo: ten percent off everything, once per customer, sale items left out. @returns {PromoForm} */
export const emptyForm = () => ({
  code: '', type: 'percent', percent: 10, amount: null, maxDiscount: null, minSpend: null, scope: 'all', targetIds: [], excludeSaleItems: true, firstOrderOnly: false,
  usageLimit: null, perCustomerLimit: 1, startsAt: '', endsAt: '', enabled: true, public: false, note: '',
})

/** @param {import('@noor/contract').AdminPromo} p @returns {PromoForm} */
export const toForm = (p) => ({
  code: p.code, type: p.type, percent: p.percent ?? null, amount: p.amount ?? null, maxDiscount: p.maxDiscount ?? null, minSpend: p.minSpend ?? null, scope: p.scope, targetIds: p.targetIds ?? [],
  excludeSaleItems: p.excludeSaleItems, firstOrderOnly: p.firstOrderOnly, usageLimit: p.usageLimit ?? null, perCustomerLimit: p.perCustomerLimit ?? null,
  startsAt: toLocalInput(p.startsAt), endsAt: toLocalInput(p.endsAt), enabled: p.enabled, public: p.public, note: p.note ?? '',
})

/** What the API takes: only the fields that belong to the type and the scope, nothing empty. @param {PromoForm} f */
export function toBody(f) {
  return prune({
    code: f.code.trim().toUpperCase(),
    type: f.type,
    ...(f.type === 'percent' && f.percent !== null ? { percent: f.percent } : {}),
    ...(f.type === 'fixed' && f.amount ? { amount: f.amount } : {}),
    ...(f.type === 'percent' && f.maxDiscount ? { maxDiscount: f.maxDiscount } : {}),
    ...(f.minSpend ? { minSpend: f.minSpend } : {}),
    scope: f.scope,
    ...(f.scope !== 'all' && f.targetIds.length ? { targetIds: f.targetIds } : {}),
    excludeSaleItems: f.excludeSaleItems,
    firstOrderOnly: f.firstOrderOnly,
    ...(f.usageLimit ? { usageLimit: f.usageLimit } : {}),
    ...(f.perCustomerLimit ? { perCustomerLimit: f.perCustomerLimit } : {}),
    ...(fromLocalInput(f.startsAt) ? { startsAt: fromLocalInput(f.startsAt) } : {}),
    ...(fromLocalInput(f.endsAt) ? { endsAt: fromLocalInput(f.endsAt) } : {}),
    enabled: f.enabled,
    public: f.public,
    ...(f.note.trim() ? { note: f.note.trim() } : {}),
  })
}

/** A random code of eight characters that cannot be mistaken for each other (no 0, O, 1, I). @param {() => number} [random] */
export function generateCode(random = Math.random) {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => letters[Math.floor(random() * letters.length)]).join('')
}

const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' })
const dayShort = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'Asia/Karachi' })
const monthDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Karachi' })

/** "1–15 Oct 2026", "from 1 Oct 2026", "until 15 Oct 2026" or nothing. @param {string} startsAt @param {string} endsAt local values */
function windowText(startsAt, endsAt) {
  const s = fromLocalInput(startsAt)
  const e = fromLocalInput(endsAt)
  if (s && e) {
    const a = new Date(s)
    const b = new Date(e)
    const sameMonth = day.format(a).slice(day.format(a).indexOf(' ')) === day.format(b).slice(day.format(b).indexOf(' '))
    return sameMonth ? `${dayShort.format(a)}–${day.format(b)}` : `${monthDay.format(a)} – ${day.format(b)}`
  }
  if (s) return `from ${day.format(new Date(s))}`
  if (e) return `until ${day.format(new Date(e))}`
  return ''
}

/**
 * The rule in a sentence: "10% off Lawn and Stitched, up to Rs 2,000, on orders over Rs 5,000. Sale items are not discounted. Once per customer. 1–15 Oct 2026."
 * @param {PromoForm} f
 * @param {Record<string, string>} labels the names of the chosen categories and products, by id
 */
export function describePromo(f, labels) {
  // inside a sentence an ordinary space is right (the price format keeps its figures together with a no-break one)
  const money = (/** @type {Money} */ m) => formatMoney({ amount: m.amount, currency: 'PKR' }, 'en', { showDecimals: false, rounding: 'none' }).replace(/\s/g, ' ')
  const value = f.type === 'percent' ? (f.percent ? `${f.percent}% off` : '') : f.type === 'fixed' ? (f.amount ? `${money(f.amount)} off` : '') : 'Free delivery'
  if (!value) return ''
  const names = f.targetIds.map((id) => labels[id] ?? '').filter(Boolean)
  const list = names.length <= 3 ? names.join(names.length === 2 ? ' and ' : ', ') : `${names.length} ${f.scope}`
  const scope = f.scope === 'all' ? 'everything' : names.length ? list : f.scope
  const parts = [`${value} ${scope}`]
  if (f.type === 'percent' && f.maxDiscount) parts.push(`up to ${money(f.maxDiscount)}`)
  if (f.minSpend) parts.push(`on orders over ${money(f.minSpend)}`)
  const sentences = [`${parts.join(', ')}.`]
  if (f.excludeSaleItems) sentences.push('Sale items are not discounted.')
  if (f.firstOrderOnly) sentences.push('First order only.')
  if (f.perCustomerLimit) sentences.push(f.perCustomerLimit === 1 ? 'Once per customer.' : `${f.perCustomerLimit} times per customer.`)
  if (f.usageLimit) sentences.push(`${f.usageLimit.toLocaleString('en')} uses in all.`)
  const when = windowText(f.startsAt, f.endsAt)
  if (when) sentences.push(`${when[0]?.toUpperCase()}${when.slice(1)}.`)
  if (!f.enabled) sentences.push('Switched off.')
  return sentences.join(' ')
}

/** What the server says when a code does not apply, in words. @type {Record<string, string>} */
export const reasons = {
  promo_not_found: 'There is no such code.',
  promo_not_started: 'The code has not started yet.',
  promo_expired: 'The code has ended.',
  promo_usage_limit: 'The code has been used the most times it may be.',
  promo_not_applicable: 'Nothing in this cart is covered by the code.',
  promo_customer_limit: 'This customer has used the code as often as allowed.',
  promo_first_order_only: 'The code is for a first order, and this customer has ordered before.',
  promo_min_spend: 'The cart is under the minimum spend.',
  promo_invalid: 'The code is not valid.',
}
