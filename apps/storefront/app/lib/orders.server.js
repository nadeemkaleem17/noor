// The storefront's side of an order's own pages (plan/06-storefront/06-orders-tracking.md): the order by its token, what its customer may do with it, the lookup by number and phone, and the
// review of a line. The token is the key: it is a path parameter and goes nowhere else (no query, no log). Never imported by browser code.
import { ApiError, CreateReturnBody, normalizePkMobile, ReviewInput } from '@noor/contract'
import { api } from './api.server'
import { normalizeOrderNumber } from './order-number'

/** A token that no order has, or one that was never an order's: the shop's 404 page. @param {unknown} e @returns {never} */
export function orNoOrder(e) {
  if (e instanceof ApiError && (e.status === 404 || e.code === 'order_not_found' || e.code === 'validation_failed')) throw new Response('Not Found', { status: 404 })
  throw e
}

/** @param {string} token */
export const loadOrder = (token) => api('orders.getByToken', { params: { token } }).catch(orNoOrder)

/**
 * The request form as the contract's body: one `qty_<lineId>` number per line, the pieces left at 0 are not part of it. Nothing here decides what is allowed (the API does).
 * @param {FormData} form
 */
function returnBody(form) {
  const lines = [...form.entries()].flatMap(([k, v]) => (k.startsWith('qty_') && Number(v) > 0 ? [{ lineId: k.slice(4), quantity: Number(v) }] : []))
  const text = (/** @type {string} */ k) => String(form.get(k) ?? '').trim() || undefined
  const parsed = CreateReturnBody.safeParse({ kind: form.get('kind'), reason: form.get('reason'), note: text('note'), exchangeNote: text('exchangeNote'), lines })
  return parsed.success ? parsed.data : undefined
}

/**
 * What the customer may do with the order: cancel it, or switch it to cash on delivery. The API decides if it is allowed (`allowedActions`); a refusal is shown as such.
 * @param {string} token @param {FormData} form
 * @returns {Promise<{ ok: true, requested?: string } | { ok: false, error: 'notAllowed' | 'busy' | 'failed' | 'returnInvalid' }>}
 */
export async function orderAction(token, form) {
  const intent = form.get('intent')
  try {
    if (intent === 'cancel') {
      const reason = String(form.get('reason') ?? '').trim()
      await api('orders.cancelByToken', { params: { token }, body: reason ? { reason: reason.slice(0, 200) } : {} })
    } else if (intent === 'switchToCod') {
      await api('orders.switchToCod', { params: { token } })
    } else if (intent === 'return') {
      const body = returnBody(form)
      if (!body) return { ok: false, error: 'returnInvalid' }
      return { ok: true, requested: (await api('orders.requestReturn', { params: { token }, body })).number }
    } else {
      return { ok: false, error: 'failed' }
    }
    return { ok: true }
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.code === 'validation_failed') return { ok: false, error: 'returnInvalid' }
      if (e.code === 'invalid_transition' || e.code === 'forbidden' || e.status === 409 || e.status === 422) return { ok: false, error: 'notAllowed' }
      if (e.code === 'rate_limited') return { ok: false, error: 'busy' }
    }
    console.error('order action failed', e)
    return { ok: false, error: 'failed' }
  }
}

/**
 * The lookup by order number and mobile number. Every way of not finding the order gives the same answer (a wrong number and a wrong phone cannot be told apart); only "too many tries"
 * is told.
 * @param {FormData} form
 * @returns {Promise<{ ok: true, token: string } | { ok: false, error: 'notFound' | 'busy' | 'failed' }>}
 */
export async function trackOrder(form) {
  const orderNumber = normalizeOrderNumber(String(form.get('orderNumber') ?? '')).slice(0, 40)
  const rawPhone = String(form.get('phone') ?? '')
  const phone = (normalizePkMobile(rawPhone) ?? rawPhone).slice(0, 40)
  if (!orderNumber || !phone) return { ok: false, error: 'notFound' }
  try {
    const found = await api('orders.track', { body: { orderNumber, phone } })
    return { ok: true, token: found.trackingToken }
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.code === 'rate_limited' || e.status === 429) return { ok: false, error: 'busy' }
      if (e.status === 404 || e.code === 'order_not_found' || e.code === 'validation_failed') return { ok: false, error: 'notFound' }
    }
    console.error('order lookup failed', e)
    return { ok: false, error: 'failed' }
  }
}

/** @param {string} token @param {string} lineId */
export const loadInvite = (token, lineId) => api('reviews.getInvite', { params: { token, lineId } }).catch(orNoOrder)

/**
 * Sends the review of one order line. The fields are checked with the contract's own `ReviewInput` first, so each problem can be written beside its field.
 * @param {string} token @param {string} lineId @param {FormData} form
 * @returns {Promise<{ ok: true } | { ok: false, error: 'fields', fields: Record<string, string> } | { ok: false, error: 'already' | 'busy' | 'failed' }>}
 */
export async function sendReview(token, lineId, form) {
  const text = (/** @type {string} */ k) => String(form.get(k) ?? '').trim()
  const photos = form.getAll('photo').map(String).filter(Boolean)
  const parsed = ReviewInput.safeParse({
    rating: Number(form.get('rating')),
    ...(text('title') ? { title: text('title') } : {}),
    body: text('body'),
    ...(text('fit') ? { fit: text('fit') } : {}),
    displayName: text('displayName'),
    ...(photos.length ? { photoMediaIds: photos } : {}),
  })
  if (!parsed.success) {
    /** @type {Record<string, string>} */
    const fields = {}
    for (const i of parsed.error.issues) fields[String(i.path[0] ?? 'form')] ??= i.code
    return { ok: false, error: 'fields', fields }
  }
  try {
    await api('reviews.createForOrderLine', { params: { token, lineId }, body: parsed.data })
    return { ok: true }
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.code === 'review_already_submitted') return { ok: false, error: 'already' }
      if (e.code === 'rate_limited') return { ok: false, error: 'busy' }
      if (e.code === 'validation_failed') {
        /** @type {Record<string, string>} */
        const fields = {}
        for (const i of e.issues) fields[i.path.split('.')[0] ?? 'form'] ??= i.code
        return { ok: false, error: 'fields', fields }
      }
    }
    console.error('review failed', e)
    return { ok: false, error: 'failed' }
  }
}

/**
 * One review picture: a slot from the API, the bytes put into it from here (the browser only ever talks to the storefront), and the id to send with the review.
 * @param {string} token @param {string} lineId @param {string} contentType @param {ArrayBuffer} bytes
 * @returns {Promise<{ mediaId: string } | { error: 'type' | 'size' | 'failed' }>}
 */
export async function uploadReviewPhoto(token, lineId, contentType, bytes) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) return { error: 'type' }
  if (bytes.byteLength < 1 || bytes.byteLength > 5 * 1024 * 1024) return { error: 'size' }
  try {
    const slot = await api('reviews.createPhotoUpload', { params: { token, lineId }, body: { contentType: /** @type {'image/jpeg'} */ (contentType), bytes: bytes.byteLength } })
    const put = await fetch(slot.uploadUrl, { method: 'PUT', headers: slot.headers, body: bytes, signal: AbortSignal.timeout(20_000) })
    if (!put.ok) return { error: 'failed' }
    return { mediaId: slot.mediaId }
  } catch (e) {
    console.error('review photo failed', e)
    return { error: 'failed' }
  }
}
