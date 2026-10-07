// What checkout keeps in this browser tab (plan/06-storefront/05-cart-checkout.md sections 4.4 and 4.5): the idempotency key of this checkout, so a retry after a lost answer is the same order,
// and the typed contact and address, so a refresh or a trip to the cart does not lose them. sessionStorage only: gone with the tab, and no payment data and no cart is ever kept here.
// Storage may be blocked or full: then nothing is kept and nothing breaks.

const KEY = 'nc_checkout_key'
const DRAFT = 'nc_checkout_draft'

/** The fields kept in the draft. */
export const draftFields = /** @type {const} */ (['name', 'phone', 'email', 'cityId', 'address', 'landmark', 'notes'])

/** @param {string} name */
const read = (name) => {
  try {
    return JSON.parse(sessionStorage.getItem(name) ?? 'null')
  } catch {
    return null
  }
}
/** @param {string} name @param {unknown} value */
const write = (name, value) => {
  try {
    sessionStorage.setItem(name, JSON.stringify(value))
  } catch {
    // blocked or full
  }
}

/** The key of this checkout, only while the cart is the one it was made for. @param {string} sig what the cart holds, as the server wrote it */
export function recallKey(sig) {
  const v = read(KEY)
  return v && v.sig === sig && typeof v.key === 'string' ? v.key : undefined
}
/** @param {string} key @param {string} sig */
export const rememberKey = (key, sig) => write(KEY, { key, sig })

/** @returns {Record<string, string>} */
export function recallDraft() {
  const v = read(DRAFT)
  return v && typeof v === 'object' ? v : {}
}
/** @param {Record<string, string>} draft */
export const rememberDraft = (draft) => write(DRAFT, draft)

/** After an order: the next checkout starts clean. */
export function forgetCheckout() {
  try {
    sessionStorage.removeItem(KEY)
    sessionStorage.removeItem(DRAFT)
  } catch {
    // blocked
  }
}
