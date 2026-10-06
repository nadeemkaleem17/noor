// Handlers for the order routes of the contract (plan/10-api/03-cart-orders-public.md section 3).
import { subjectHash } from '../../platform/rate-limit.js'

/**
 * @param {ReturnType<typeof import('./service.js').createOrdersService>} s
 * @returns {Partial<import('../../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>>}
 */
export function ordersHandlers(s) {
  return {
    'orders.create': async ({ body, http, limit, idempotencyKey }) => {
      await limit('checkout', 'phone', subjectHash(body.customer.phone)) // five attempts per phone in ten minutes, however many addresses they come from
      return s.create(http.header('x-cart-token'), body, /** @type {string} */ (idempotencyKey))
    },
  }
}
