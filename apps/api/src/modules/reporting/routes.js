// Handlers for the dashboard, search, failed-job and browser-report routes of the contract (plan/10-api/08-admin-dashboard-ops.md).
/**
 * @param {ReturnType<typeof import('./service.js').createReporting>} s
 * @returns {Partial<import('../../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>>}
 */
export function reportingHandlers(s) {
  return {
    'admin.nav.counts': async ({ actor }) => s.navCounts(actor),
    'admin.background.status': async () => s.backgroundStatus(),
    'admin.dashboard.todo': async ({ actor }) => s.todo(actor),
    'admin.dashboard.summary': async ({ actor, query }) => s.summary(actor, query),
    'admin.dashboard.topProducts': async ({ actor, query }) => s.topProducts(actor, query),
    'admin.dashboard.zeroSearches': async ({ query }) => s.zeroSearches(query),
    'admin.search': async ({ actor, query }) => s.search(actor, query.q),
    'admin.jobs.listDead': async ({ query }) => s.deadJobs(query),
    'admin.jobs.retry': async ({ actor, params, http, requestId }) => {
      await s.retryJob(actor, params.id, { ip: http.ip, userAgent: http.userAgent, requestId })
    },
    'reporting.vitals': async ({ body }) => {
      await s.recordVital(body)
    },
    // what the browser says goes to the log with the page and release, and nothing that names a person
    'reporting.clientError': async ({ body, log, requestId }) => {
      log.error({ clientError: true, app: body.app, release: body.release, route: body.route, stack: body.stack, requestId }, `client error: ${body.message}`)
    },
  }
}
