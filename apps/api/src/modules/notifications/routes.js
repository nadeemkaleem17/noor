// Handlers for the email routes of the contract (plan/17-owner-requests-2026-10.md item 13).
const staff = (/** @type {unknown} */ actor) => /** @type {{ staffId: string, name: string, role: string }} */ (actor)

/**
 * @param {ReturnType<typeof import('./service.js').createNotifications>} n
 * @returns {Partial<import('../../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>>}
 */
export function emailHandlers(n) {
  return {
    'admin.emails.status': async () => n.status(),
    'admin.emails.preview': async ({ body }) => n.render(body),
    'admin.emails.test': async ({ actor, body, http, requestId }) => n.sendTest(staff(actor), body, { ip: http.ip, userAgent: http.userAgent, requestId }),
    'admin.emails.log': async ({ query }) => n.log(query),
  }
}
