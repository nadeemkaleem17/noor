// Handlers for the visit routes of the contract (plan/17-owner-requests-2026-10.md section 6).
/**
 * @param {ReturnType<typeof import('./service.js').createVisitsService>} s
 * @returns {Partial<import('../../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>>}
 */
export function visitsHandlers(s) {
  return {
    'visits.record': async ({ body }) => {
      await s.record(body)
    },
    'visits.link': async ({ body }) => {
      await s.link(body)
    },
    'admin.customers.visits': async ({ query }) => s.summary(query.from, query.to),
  }
}
