// Handlers for the order routes of the contract (plan/10-api/03-cart-orders-public.md section 3).
import { subjectHash } from '../../platform/rate-limit.js'

/**
 * @param {ReturnType<typeof import('./service.js').createOrdersService>} s
 * @returns {Partial<import('../../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>>}
 */
export function ordersHandlers(s) {
  /** What the per-token limit counts by: never the token itself. @param {string} token */
  const tokenSubject = (token) => subjectHash(token)
  return {
    'orders.getByToken': ({ params }) => s.getByToken(params.token),
    'orders.cancelByToken': async ({ params, body, http, requestId, limit }) => {
      await limit('orderAction', 'token', tokenSubject(params.token))
      return s.cancelByToken(params.token, body.reason, { ip: http.ip, userAgent: http.userAgent, requestId })
    },
    'orders.switchToCod': async ({ params, http, requestId, limit }) => {
      await limit('orderAction', 'token', tokenSubject(params.token))
      return s.switchToCod(params.token, { ip: http.ip, userAgent: http.userAgent, requestId })
    },
    'orders.track': async ({ body, limit }) => {
      await limit('track', 'order', subjectHash(body.orderNumber.replace(/s+/g, '').toUpperCase())) // counted before the lookup, so a guessed number costs an attempt whether it exists or not
      return s.track(body)
    },
    'orders.create': async ({ body, http, limit, idempotencyKey }) => {
      await limit('checkout', 'phone', subjectHash(body.customer.phone)) // five attempts per phone in ten minutes, however many addresses they come from
      return s.create(http.header('x-cart-token'), body, /** @type {string} */ (idempotencyKey))
    },
  }
}
