// Assembles the handlers of every module. Each module exports its handlers; this is the only place that lists modules.
import { auditHandlers } from './audit/index.js'
import { authHandlers } from './auth/index.js'

// ponytail: shipping.listCities is a placeholder until M1-07; admin.system.info grows with the job queue numbers (M1-01 added the tables).
/**
 * @param {import('../platform/config.js').Config} config
 * @param {{ auth: ReturnType<import('./auth/index.js').createAuthService>, audit: ReturnType<import('./audit/index.js').createAuditService> }} deps
 * @returns {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>}
 */
export const appHandlers = (config, { auth, audit }) => ({
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (authHandlers(auth, config))),
  ...(/** @type {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>} */ (auditHandlers(audit))),
  'shipping.listCities': async () => ({ items: [] }),
  'admin.system.info': async () => ({ environment: config.APP_ENV, version: config.APP_VERSION, queue: { pending: 0, dead: 0 } }),
})
