// Handlers for the return routes of the contract (plan/10-api/10-returns.md).
const staff = (/** @type {unknown} */ actor) => /** @type {import('./service.js').Staff} */ (actor)

/**
 * @param {ReturnType<typeof import('./service.js').createReturnsService>} s
 * @returns {Partial<import('../../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>>}
 */
export function returnsHandlers(s) {
  return {
    'orders.requestReturn': async ({ params, body }) => s.create(params.token, body),
    'admin.returns.list': async ({ query }) => s.list(query),
    'admin.returns.update': async ({ actor, params, body, http, requestId }) => s.update(staff(actor), params.id, body, { ip: http.ip, userAgent: http.userAgent, requestId }),
  }
}
