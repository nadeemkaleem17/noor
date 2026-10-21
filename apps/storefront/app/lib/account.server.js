// The storefront's side of a customer account (plan/10-api/11-account.md): the session token lives in the `nc_session` cookie, which the browser cannot read, and goes to the API as
// `X-Customer-Session`. A visitor with no session is simply not signed in; nothing here is needed to browse or to buy. Never imported by browser code.
import { ApiError, LoginBody, RegisterBody, normalizePkMobile } from '@noor/contract'
import { api } from './api.server'
import { cookieValue } from './cart.server'
import { cookieSecure } from './env.server'
import { trackOrder } from './orders.server'
import { visitorOf } from './visit.server'

export const SESSION_COOKIE = 'nc_session'
const THIRTY_DAYS = 60 * 60 * 24 * 30

/** @param {Request} request */
export const sessionOf = (request) => cookieValue(request.headers.get('cookie'), SESSION_COOKIE)

/** @param {Request} request @returns {Record<string, string> | undefined} */
export function sessionHeaders(request) {
  const token = sessionOf(request)
  return token ? { 'x-customer-session': token } : undefined
}

/** @param {string} token */
export const sessionCookie = (token) => `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${THIRTY_DAYS}; HttpOnly; SameSite=Lax${cookieSecure()}`
export const clearSessionCookie = () => `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${cookieSecure()}`

/** Who is signed in, or nothing: an expired or unknown session is the same as none. @param {Request} request */
export async function loadAccount(request) {
  const headers = sessionHeaders(request)
  if (!headers) return undefined
  return api('account.me', { headers }).catch((e) => {
    if (e instanceof ApiError && e.status === 401) return undefined
    throw e
  })
}

/** @typedef {'invalid' | 'weak' | 'exists' | 'credentials' | 'busy' | 'notFound' | 'failed'} AccountError */

/** What a failed call is called on the page. @param {unknown} e @returns {{ ok: false, error: AccountError, reason?: string, fields?: string[] }} */
function failure(e) {
  if (e instanceof ApiError) {
    if (e.code === 'password_too_weak') return { ok: false, error: 'weak', reason: String(e.details.reason ?? '') }
    if (e.code === 'account_exists') return { ok: false, error: 'exists' }
    if (e.code === 'invalid_credentials') return { ok: false, error: 'credentials' }
    if (e.code === 'rate_limited' || e.code === 'too_many_attempts' || e.status === 429) return { ok: false, error: 'busy' }
    if (e.status === 404) return { ok: false, error: 'notFound' }
    if (e.code === 'validation_failed') return { ok: false, error: 'invalid', fields: e.issues.map((i) => String(i.path)) }
  }
  console.error('account call failed', e)
  return { ok: false, error: 'failed' }
}

/** @param {FormData} form @param {string} name */
const text = (form, name) => String(form.get(name) ?? '')

/**
 * Register or sign in: the form checked with the contract's own schema before the API is asked. The answer carries the session for the cookie.
 * @param {Request} request @param {FormData} form @param {'register' | 'login'} kind
 * @returns {Promise<{ ok: true, token: string } | ReturnType<typeof failure>>}
 */
export async function enter(request, form, kind) {
  const visitor = visitorOf(request)
  const phone = text(form, 'phone')
  const shape = {
    phone,
    password: text(form, 'password'),
    ...(visitor ? { visitor } : {}),
    ...(kind === 'register' ? { name: text(form, 'name'), ...(text(form, 'email').trim() ? { email: text(form, 'email').trim() } : {}) } : {}),
  }
  const parsed = (kind === 'register' ? RegisterBody : LoginBody).safeParse(shape)
  if (!parsed.success) return { ok: false, error: 'invalid', fields: parsed.error.issues.map((i) => String(i.path[0])) }
  if (!normalizePkMobile(phone)) return { ok: false, error: 'invalid', fields: ['phone'] }
  try {
    const answer = kind === 'register' ? await api('account.register', { body: /** @type {never} */ (parsed.data) }) : await api('account.login', { body: /** @type {never} */ (parsed.data) })
    return { ok: true, token: answer.token }
  } catch (e) {
    return failure(e)
  }
}

/**
 * What a signed-in customer does with the account: leave the session, change the details, change the password, add an order, leave.
 * @param {Request} request @param {FormData} form
 * @returns {Promise<{ ok: true, done: string } | ReturnType<typeof failure>>}
 */
export async function accountAction(request, form) {
  const headers = sessionHeaders(request)
  if (!headers) return { ok: false, error: 'credentials' }
  const intent = text(form, 'intent')
  try {
    if (intent === 'update') {
      const email = text(form, 'email').trim()
      await api('account.update', { headers, body: { name: text(form, 'name').trim(), ...(email ? { email } : {}) } })
      return { ok: true, done: 'updated' }
    }
    if (intent === 'password') {
      await api('account.changePassword', { headers, body: { currentPassword: text(form, 'currentPassword'), newPassword: text(form, 'newPassword') } })
      return { ok: true, done: 'password' }
    }
    if (intent === 'claim') {
      // the same lookup as "Track your order": the order number and the mobile number together are the proof, and a miss says one thing
      const found = await trackOrder(form)
      if (!found.ok) return { ok: false, error: found.error === 'busy' ? 'busy' : 'notFound' }
      await api('account.claimOrder', { headers, body: { order: found.token } })
      return { ok: true, done: 'claimed' }
    }
    if (intent === 'delete') {
      await api('account.delete', { headers, body: { password: text(form, 'password') } })
      return { ok: true, done: 'deleted' }
    }
  } catch (e) {
    // the lookup says the same for a wrong number and a wrong phone, and so does this
    if (e instanceof ApiError && (e.code === 'order_not_found' || e.status === 404) && intent === 'claim') return { ok: false, error: 'notFound' }
    return failure(e)
  }
  return { ok: false, error: 'failed' }
}

/** Sign out: the API forgets the session. Never an error to the visitor. @param {Request} request */
export async function leave(request) {
  const headers = sessionHeaders(request)
  if (headers) await api('account.logout', { headers }).catch(() => undefined)
}

/** The order just placed goes to the account of whoever is signed in, if it is theirs. Never in the way of the order. @param {Request} request @param {string} orderToken */
export async function addToAccount(request, orderToken) {
  const headers = sessionHeaders(request)
  if (headers) await api('account.claimOrder', { headers, body: { order: orderToken } }).catch(() => undefined)
}
