// Assembles the handlers of every module. Each module exports its handlers; this is the only place that lists modules.

// ponytail: placeholders so the spike has one public and one staff route; the real handlers arrive with
// their modules (shipping: M1-07, system/queue: M1-01). The staff handler is unreachable until auth exists (M1-02).
/**
 * @param {import('../platform/config.js').Config} config
 * @returns {import('../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>}
 */
export const appHandlers = (config) => ({
  'shipping.listCities': async () => ({ items: [] }),
  'admin.system.info': async () => ({ environment: config.APP_ENV, version: config.APP_VERSION, queue: { pending: 0, dead: 0 } }),
})
