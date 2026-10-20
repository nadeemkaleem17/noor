// Handlers for the customer routes of the contract (plan/10-api/06-admin-orders-customers.md section 3).
const staff = (/** @type {unknown} */ actor) => /** @type {import('./service.js').Staff} */ (actor)

/**
 * @param {ReturnType<typeof import('./service.js').createCustomersService>} s
 * @returns {Partial<import('../../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>>}
 */
export function customersHandlers(s) {
  /** @param {{ ip: string, userAgent: string }} http @param {string} requestId */
  const info = (http, requestId) => ({ ip: http.ip, userAgent: http.userAgent, requestId })

  return {
    'admin.customers.list': async ({ query }) => s.list(query),
    'admin.customers.highlightRules.list': async () => s.rules(),
    'admin.customers.highlightRules.save': async ({ actor, body, http, requestId }) => s.saveRules(staff(actor), body.rules, info(http, requestId)),
    'admin.customers.lookup': async ({ query }) => s.lookup(query.phone),
    'admin.customers.get': async ({ params }) => s.get(params.id),
    'admin.customers.update': async ({ actor, params, body, http, requestId }) => s.update(staff(actor), params.id, body, info(http, requestId)),
    'admin.customers.addNote': async ({ actor, params, body, http, requestId }) => s.addNote(staff(actor), params.id, body.body, info(http, requestId)),
    'admin.customers.export': async ({ actor, body, http, requestId }) => s.exportCsv(staff(actor), body, info(http, requestId)),
    'admin.customers.anonymise': async ({ actor, params, body, http, requestId }) => {
      await s.anonymise(staff(actor), params.id, body.confirm, info(http, requestId))
    },
  }
}
