// Handlers for the order routes of the contract (plan/10-api/03-cart-orders-public.md section 3).
import { subjectHash } from '../../platform/rate-limit.js'

/**
 * @param {ReturnType<typeof import('./service.js').createOrdersService>} s
 * @param {ReturnType<typeof import('./admin.js').createAdminOrders>} admin
 * @returns {Partial<import('../../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>>}
 */
export function ordersHandlers(s, admin) {
  /** @param {{ ip: string, userAgent: string }} http @param {string} requestId */
  const info = (http, requestId) => ({ ip: http.ip, userAgent: http.userAgent, requestId })

  /** What the per-token limit counts by: never the token itself. @param {string} token */
  const tokenSubject = (token) => subjectHash(token)
  return {
    'admin.orders.list': async ({ actor, query }) => admin.list(query, actor),
    'admin.orders.counts': async () => admin.counts(),
    'admin.orders.get': async ({ actor, params }) => admin.get(params.id, actor),
    'admin.orders.transition': async ({ actor, params, body, http, requestId }) => admin.transition(actor, params.id, body, info(http, requestId)),
    'admin.orders.edit': async ({ actor, params, body, http, requestId }) => admin.edit(actor, params.id, body, info(http, requestId)),
    'admin.orders.previewEdit': async ({ params, body }) => admin.previewEdit(params.id, body),
    'admin.orders.addNote': async ({ actor, params, body, http, requestId }) => admin.addNote(actor, params.id, body.body, info(http, requestId)),
    'admin.orders.logAttempt': async ({ actor, params, body, http, requestId }) => admin.logAttempt(actor, params.id, body, info(http, requestId)),
    'admin.orders.recordPayment': async ({ actor, params, body, idempotencyKey, http, requestId }) => admin.recordPayment(actor, params.id, body, idempotencyKey, info(http, requestId)),
    'admin.orders.updateTracking': async ({ actor, params, body, http, requestId }) => admin.updateTracking(actor, params.id, body, info(http, requestId)),
    'admin.orders.create': async ({ actor, body, idempotencyKey, http, requestId }) => admin.create(actor, body, idempotencyKey, info(http, requestId)),
    'admin.orders.quote': async ({ body }) => admin.quote(body),
    'admin.orders.invoice': async ({ actor, params }) => admin.invoice(params.id, actor),
    'admin.orders.bulk': async ({ actor, body, http, requestId }) => admin.bulk(actor, body, info(http, requestId)),
    'admin.orders.export': async ({ actor, body, http, requestId }) => admin.exportCsv(actor, body, info(http, requestId)),
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
