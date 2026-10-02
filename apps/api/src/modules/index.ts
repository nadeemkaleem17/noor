// Assembles the handlers of every module. Each module exports its handlers; this is the only place that lists modules.
import type { Routes } from '@noor/contract'
import type { Config } from '../platform/config'
import type { Handlers } from '../platform/http/route-registrar'

// ponytail: placeholders so the spike has one public and one staff route; the real handlers arrive with
// their modules (shipping: M1-07, system/queue: M1-01). The staff handler is unreachable until auth exists (M1-02).
export const appHandlers = (config: Config): Handlers<Routes> => ({
  'shipping.listCities': async () => ({ items: [] }),
  'admin.system.info': async () => ({ environment: config.APP_ENV, version: config.APP_VERSION, queue: { pending: 0, dead: 0 } }),
})
