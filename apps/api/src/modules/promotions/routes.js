// Handlers for the promo routes of the contract (plan/10-api/06-admin-orders-customers.md section 4).
import { eachOf } from '../../platform/bulk.js'
const staff = (/** @type {unknown} */ actor) => /** @type {import('./service.js').Staff} */ (actor)

/**
 * @param {ReturnType<typeof import('./service.js').createPromotionsService>} s
 * @returns {Partial<import('../../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>>}
 */
export function promotionsHandlers(s) {
  /** @param {{ ip: string, userAgent: string }} http @param {string} requestId */
  const info = (http, requestId) => ({ ip: http.ip, userAgent: http.userAgent, requestId })

  return {
    'promos.listPublic': async () => s.listPublic(),
    'admin.promos.list': async ({ query }) => s.list(query),
    'admin.promos.get': async ({ params }) => s.get(params.id),
    'admin.promos.create': async ({ actor, body, http, requestId }) => s.create(staff(actor), body, info(http, requestId)),
    'admin.promos.update': async ({ actor, params, body, http, requestId }) => s.update(staff(actor), params.id, body, info(http, requestId)),
    'admin.promos.delete': async ({ actor, params, http, requestId }) => {
      await s.delete(staff(actor), params.id, info(http, requestId))
    },
    'admin.promos.bulkDelete': async ({ actor, body, http, requestId }) => eachOf(body.ids, (id) => s.delete(staff(actor), id, info(http, requestId))),
    'admin.promos.preview': async ({ body }) => s.preview(body.promo, body.lines),
    'admin.promos.bulk': async ({ actor, body, http, requestId }) => s.bulk(staff(actor), body.ids, body.action, info(http, requestId)),
  }
}
