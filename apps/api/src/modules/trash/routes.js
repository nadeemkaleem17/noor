// Handlers for the trash routes of the contract (plan/17-owner-requests-2026-10.md item 6).
const staff = (/** @type {unknown} */ actor) => /** @type {import('./service.js').Actor} */ (actor)

/**
 * @param {ReturnType<typeof import('./service.js').createTrash>} s
 * @returns {Partial<import('../../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>>}
 */
export function trashHandlers(s) {
  return {
    'admin.trash.list': async ({ actor }) => s.list(staff(actor)),
    'admin.trash.restore': async ({ actor, params, http, requestId }) => s.restore(staff(actor), params.id, { ip: http.ip, userAgent: http.userAgent, requestId }),
    'admin.trash.purge': async ({ actor, params, http, requestId }) => s.purge(staff(actor), params.id, { ip: http.ip, userAgent: http.userAgent, requestId }).then(() => undefined),
  }
}
