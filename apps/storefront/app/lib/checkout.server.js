// The storefront's side of checkout (plan/06-storefront/05-cart-checkout.md section 4): the delivery cities, the quote for a city and method, and placing the order. Never imported by
// browser code. No money is worked out or sent from here except `expectedTotal`, which is the total the customer was shown, handed back so the server can refuse if it has moved.
import { ApiError, Cart, CreateOrderBody, normalizePkMobile } from '@noor/contract'
import { api } from './api.server'
import { cartHeaders, getCart } from './cart.server'
import { cached } from './shell.server'

/** The cities the shop delivers to, majors first, then A to Z (section 4.1). */
export function deliveryCities() {
  return cached('cities', async () => {
    const { items } = await api('shipping.listCities')
    return items.toSorted((a, b) => Number(b.isMajor) - Number(a.isMajor) || a.name.localeCompare(b.name)).map((c) => ({ id: c.id, name: c.name, province: c.province, isMajor: c.isMajor }))
  })
}

/** What the visitor typed, as strings, kept so the page can be drawn again with it after any answer. @typedef {Record<string, string>} Values */

/** Every field of the form as text; extra checkout fields are `cf.<key>`. @param {FormData} form @returns {Values} */
export function valuesOf(form) {
  /** @type {Values} */
  const out = {}
  for (const [key, value] of form.entries()) if (typeof value === 'string' && key !== 'intent' && key !== 'mode') out[key] = value
  return out
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The cart priced for a city and a method: the shipping fee, the total, the methods of the city's zone and which payment methods are allowed. The server's answer, whole.
 * @param {Request} request @param {Values} v @returns {Promise<import('@noor/contract').Cart>}
 */
export async function quote(request, v) {
  if (!v.cityId || !uuid.test(v.cityId)) return getCart(request)
  const phone = v.phone ? normalizePkMobile(v.phone) : undefined
  try {
    return await api('cart.quote', {
      body: { cityId: v.cityId, ...(v.shippingMethodId && uuid.test(v.shippingMethodId) ? { shippingMethodId: v.shippingMethodId } : {}), ...(v.paymentMethod === 'cod' || v.paymentMethod === 'bank_transfer' ? { paymentMethod: v.paymentMethod } : {}), ...(phone ? { phone } : {}) },
      ...(cartHeaders(request) ? { headers: cartHeaders(request) } : {}),
    })
  } catch (e) {
    // a city outside every zone: the cart as it was, and the page says the city is not served
    if (e instanceof ApiError && (e.code === 'city_not_served' || e.code === 'validation_failed' || e.code === 'not_found')) return getCart(request)
    throw e
  }
}

/** @param {Values} v @param {import('@noor/contract').FormField[]} fields @param {string} locale */
function bodyOf(v, fields, locale) {
  /** @type {Record<string, string | number | boolean>} */
  const customFields = {}
  for (const f of fields) {
    const raw = v[`cf.${f.key}`]
    if (f.type === 'checkbox') customFields[f.key] = raw === 'on' || raw === 'true'
    else if (raw !== undefined && raw.trim() !== '') customFields[f.key] = raw.trim()
  }
  const total = Number(v.expectedTotal)
  return {
    customer: { name: v.name ?? '', phone: v.phone ?? '', ...(v.email?.trim() ? { email: v.email.trim() } : {}) },
    shippingAddress: { cityId: v.cityId ?? '', address: v.address ?? '', ...(v.landmark?.trim() ? { landmark: v.landmark } : {}), ...(v.notes?.trim() ? { notes: v.notes } : {}) },
    shippingMethodId: v.shippingMethodId ?? '',
    paymentMethod: v.paymentMethod ?? '',
    ...(Object.keys(customFields).length ? { customFields } : {}),
    ...(v.marketingConsent === 'on' ? { marketingConsent: true } : {}),
    locale,
    ...(Number.isInteger(total) && total >= 0 && v.expectedTotal !== '' ? { expectedTotal: { amount: total, currency: 'PKR' } } : {}),
  }
}

/** What each way an order can be refused is called on the page. */
export const placeErrors = /** @type {const} */ (['changed', 'payment', 'city', 'busy', 'empty', 'unavailable', 'failed'])

/**
 * Places the order (section 4.4). The idempotency key is the one of this checkout, so a second press or a retry after a lost answer returns the first order. A refusal that carries the cart
 * (the price moved, stock ran short, a promo stopped applying) gives the new cart and a new key.
 * @param {Request} request
 * @param {Values} v
 * @param {import('@noor/contract').FormField[]} fields the shop's extra checkout fields
 * @param {string} locale
 * @returns {Promise<
 *   | { ok: true, token: string, redirectUrl?: string }
 *   | { ok: false, error: 'fields', fields: Record<string, string> }
 *   | { ok: false, error: 'changed', cart: import('@noor/contract').Cart, reason?: string }
 *   | { ok: false, error: Exclude<(typeof placeErrors)[number], 'changed'>, reason?: string }
 * >}
 */
export async function placeOrder(request, v, fields, locale) {
  const parsed = CreateOrderBody.safeParse(bodyOf(v, fields, locale))
  if (!parsed.success) {
    /** @type {Record<string, string>} */
    const bad = {}
    for (const issue of parsed.error.issues) bad[issue.path.join('.')] ??= issue.code
    return { ok: false, error: 'fields', fields: bad }
  }
  const key = v.idempotencyKey ?? ''
  if (!uuid.test(key)) return { ok: false, error: 'failed' }
  try {
    const created = await api('orders.create', { body: parsed.data, idempotencyKey: key, ...(cartHeaders(request) ? { headers: cartHeaders(request) } : {}) })
    return { ok: true, token: created.trackingToken, ...(created.payment?.redirectUrl ? { redirectUrl: created.payment.redirectUrl } : {}) }
  } catch (e) {
    if (e instanceof ApiError) {
      const reason = typeof e.details.reason === 'string' ? e.details.reason : undefined
      if (['price_changed', 'insufficient_stock', 'promo_invalid', 'cart_has_issues'].includes(e.code)) {
        const carried = Cart.safeParse(e.details.cart)
        return { ok: false, error: 'changed', cart: carried.success ? carried.data : await getCart(request), ...(reason ? { reason } : {}) }
      }
      if (e.code === 'payment_method_not_allowed') return { ok: false, error: 'payment', ...(reason ? { reason } : {}) }
      if (e.code === 'city_not_served') return { ok: false, error: 'city' }
      if (e.code === 'cart_empty') return { ok: false, error: 'empty' }
      if (e.code === 'rate_limited') return { ok: false, error: 'busy' }
      if (e.code === 'validation_failed') {
        /** @type {Record<string, string>} */
        const bad = {}
        for (const issue of e.issues) bad[issue.path] ??= issue.code
        return { ok: false, error: 'fields', fields: bad }
      }
      // the same key is still being worked on (a second tap): the retry, with the same key, gets the first order
      if (e.code === 'request_in_progress' || e.code === 'unavailable' || e.status >= 500) return { ok: false, error: 'unavailable' }
    }
    console.error('placing the order failed', e)
    return { ok: false, error: 'unavailable' }
  }
}
