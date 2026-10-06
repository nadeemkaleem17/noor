// The storefront's side of the server cart (plan/06-storefront/05-cart-checkout.md section 2): the cart token lives in the `nc_cart` cookie, which the browser cannot read,
// and goes to the API as `X-Cart-Token`. Only the add-to-cart action is here so far (M5-04); the cart page and its other actions come with M5-05. Never imported by browser code.
import { ApiError } from '@noor/contract'
import { variantFor } from '~/lib/selection'
import { api } from './api.server'
import { getEnv } from './env.server'
import { localeOfPath } from './locale'

export const CART_COOKIE = 'nc_cart'
const THIRTY_DAYS = 60 * 60 * 24 * 30

/** @param {string | null} header @param {string} name */
export function cookieValue(header, name) {
  for (const part of (header ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) return decodeURIComponent(value.join('='))
  }
  return undefined
}

/** The header that tells the API whose cart this is; nothing for a visitor who has none yet. @param {Request} request @returns {Record<string, string> | undefined} */
export function cartHeaders(request) {
  const token = cookieValue(request.headers.get('cookie'), CART_COOKIE)
  return token ? { 'x-cart-token': token } : undefined
}

/** @param {string} token */
export const cartCookie = (token) => `${CART_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${THIRTY_DAYS}; HttpOnly; SameSite=Lax${getEnv().NODE_ENV === 'production' ? '; Secure' : ''}`

/** What a customer attached to a line, from the add form: the answers to the custom-size form (`m.<key>`), a note, and the chosen variant of each child of a bundle (`bundle.<productId>`). @param {FormData} form @returns {import('@noor/contract').LineCustomization | undefined} */
export function customizationOf(form) {
  /** @type {Record<string, string>} */
  const measurements = {}
  /** @type {{ productId: string, variantId: string }[]} */
  const bundle = []
  for (const [key, value] of form.entries()) {
    if (typeof value !== 'string' || !value.trim()) continue
    if (key.startsWith('m.')) measurements[key.slice(2)] = value.trim()
    else if (key.startsWith('bundle.')) bundle.push({ productId: key.slice(7), variantId: value })
  }
  const notes = String(form.get('notes') ?? '').trim()
  const out = { ...(Object.keys(measurements).length ? { measurements } : {}), ...(notes ? { notes } : {}), ...(bundle.length ? { bundle } : {}) }
  return Object.keys(out).length ? out : undefined
}

/** The errors the product page knows how to say (plan/06-storefront/04-pdp.md section 8). */
export const addErrors = /** @type {const} */ (['insufficient_stock', 'variant_unavailable', 'max_per_order', 'cart_full', 'invalid', 'busy', 'failed'])

/**
 * One line into the cart. The variant comes from the form (`variantId`, set by the page once the choices are made) or, for a visitor without JavaScript, is worked out here from the option
 * radios (`opt.<optionId>`) and the product's `handle`. The client sends no price: the cart is priced by the API.
 * @param {Request} request
 * @param {FormData} form
 * @returns {Promise<{ ok: true, cartToken: string | undefined, count: number } | { ok: false, error: (typeof addErrors)[number], available?: number, max?: number, variantId?: string }>}
 */
export async function addToCart(request, form) {
  let variantId = String(form.get('variantId') ?? '')
  if (!variantId) {
    const handle = String(form.get('handle') ?? '')
    if (!handle) return { ok: false, error: 'invalid' }
    const found = await api('catalog.getProduct', { params: { handleOrId: handle }, query: { locale: localeOfPath(new URL(request.url).pathname) } }).catch(() => undefined)
    if (!found || 'redirectTo' in found) return { ok: false, error: 'variant_unavailable' }
    /** @type {Record<string, string>} */
    const chosen = {}
    for (const [key, value] of form.entries()) if (key.startsWith('opt.') && typeof value === 'string') chosen[key.slice(4)] = value
    const v = variantFor(found.options, found.variants, chosen)
    if (!v) return { ok: false, error: 'invalid' }
    variantId = v.id
  }
  const quantity = Number(form.get('quantity') ?? 1)
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return { ok: false, error: 'invalid' }
  try {
    const customization = customizationOf(form)
    const cart = await api('cart.addLine', { body: { variantId, quantity, ...(customization ? { customization } : {}) }, ...(cartHeaders(request) ? { headers: cartHeaders(request) } : {}) })
    return { ok: true, cartToken: cart.cartToken, count: cart.count }
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.code === 'insufficient_stock') return { ok: false, error: 'insufficient_stock', available: Number(e.details.available ?? 0), variantId }
      if (e.code === 'max_per_order') return { ok: false, error: 'max_per_order', max: Number(e.details.max ?? 0), variantId }
      if (e.code === 'variant_unavailable' || e.code === 'cart_full') return { ok: false, error: e.code, variantId }
      if (e.code === 'validation_failed') return { ok: false, error: 'invalid' }
      if (e.code === 'rate_limited') return { ok: false, error: 'busy' }
    }
    console.error('add to cart failed', e)
    return { ok: false, error: 'failed' }
  }
}
