// buildApp(): the Fastify instance, plugins and routes (plan/08-backend-architecture.md section 4).
// Tests and main.ts both call it; nothing here reads the environment.
import { randomUUID } from 'node:crypto'
import Fastify, { LogController } from 'fastify'
import swagger from '@fastify/swagger'
import { jsonSchemaTransform, serializerCompiler } from 'fastify-type-provider-zod'
import { routes as contractRoutes } from '@noor/contract'
import { errorHandler, sendProblem, toProblem } from './platform/errors.js'
import { loggerOptions } from './platform/logger.js'
import { registerRoutes, zodValidatorCompiler } from './platform/http/route-registrar.js'
import { registerWebhookRoutes } from './modules/payments/webhook-routes.js'
import cookie from '@fastify/cookie'
import { createLimiter } from './platform/http/rate-limit.js'
import { clientIp, registerSecurity } from './platform/http/security.js'
import { registerLocalStorageRoutes } from './platform/http/storage-routes.js'
import { createAuthorize } from './modules/auth/index.js'
import { appHandlers } from './modules/index.js'
import { createServices } from './modules/services.js'

/**
 * @typedef {() => Promise<string[]>} Readiness
 */ // names of failing dependencies; empty = ready

/**
 * @template {import('@noor/contract').RouteTable} T
 * @typedef {object} AppOptions
 * @property {import('./platform/config.js').Config} config
 * @property {T} [table]
 * @property {import('./platform/http/route-registrar.js').Handlers<T>} [handlers]
 * @property {import('./platform/http/route-registrar.js').Authorize} [authorize]
 * @property {import('./platform/db.js').Database['db']} [db] the application database handle (the app user)
 * @property {import('./platform/storage.js').Storage} [storage] default: the driver named in the config
 * @property {ReturnType<typeof import('./modules/payments/index.js').createProviders>} [providers] the payment providers; default: cash on delivery, manual and bank transfer
 * @property {Readiness} [readiness] - Database reachable and migrations at head. M0-06 supplies the real check; until then nothing can fail.
 */

const requestIdPattern = /^[A-Za-z0-9-]{8,64}$/

/**
 * @template {import('@noor/contract').RouteTable} T
 * @param {AppOptions<T>} opts
 */
export async function buildApp(opts) {
  const { config } = opts
  const table = /** @type {T} */ ((opts.table ?? contractRoutes))
  // the database handle is optional so route-table tests can run without one; auth routes then fail only when they need it
  const db = /** @type {import('./platform/db.js').Database['db']} */ (opts.db)
  const { auth, audit, storage, media, settings, shipping, customers, promotions, cart, orders, adminOrders, payments, reporting, reviews, catalog, inventory, search, visits, delivery, returns, notifications } = createServices({ db, config, ...(opts.storage ? { storage: opts.storage } : {}), ...(opts.providers ? { providers: opts.providers } : {}) })
  const handlers = /** @type {import('./platform/http/route-registrar.js').Handlers<T>} */ ((opts.handlers ?? appHandlers(config, { auth, audit, media, settings, shipping, customers, promotions, cart, orders, adminOrders, reporting, reviews, catalog, inventory, search, visits, delivery, returns, notifications })))

  const app = Fastify({
    logger: loggerOptions(config),
    // we log one line per request ourselves (onResponse below); Fastify's own per-request lines are off
    logController: new LogController({ disableRequestLogging: true, requestIdLogLabel: 'requestId' }),
    // accept an inbound id only when it looks like one (our storefront and CDN send one); never echo arbitrary text
    genReqId: (req) => {
      const h = req.headers['x-request-id']
      return typeof h === 'string' && requestIdPattern.test(h) ? h : randomUUID()
    },
    // trust the last N proxies only (0 = nobody); the same meaning as Fastify's numeric form, which its types omit
    trustProxy: /**
     * @param {string} _address
     * @param {number} hop
     */
    (_address, hop) => hop < config.TRUST_PROXY_HOPS,
    bodyLimit: 1_048_576,
  })

  app.setValidatorCompiler(zodValidatorCompiler)
  // Responses are checked against their schema everywhere except production, where the check is skipped for speed.
  app.setSerializerCompiler(config.NODE_ENV === 'production' ? () => (data) => JSON.stringify(data) : serializerCompiler)

  await app.register(swagger, {
    openapi: { openapi: '3.1.0', info: { title: 'Rubaya API', version: '1.0.0' } },
    transform: jsonSchemaTransform,
  })

  await app.register(cookie)

  registerSecurity(app, config)
  app.addHook('onRequest', async (req, reply) => void reply.header('x-request-id', req.id))
  app.addHook('onResponse', async (req, reply) => {
    if (req.url === '/healthz' || req.url === '/readyz') return
    // route pattern, never the raw URL: query strings can hold phone numbers and search text
    req.log.info({ method: req.method, route: req.routeOptions.url, status: reply.statusCode, durationMs: Math.round(reply.elapsedTime), ip: clientIp(req) }, 'request')
  })

  app.setErrorHandler(errorHandler(config))
  app.setNotFoundHandler((req, reply) => sendProblem(reply, toProblem('not_found', req.id)))
  // after the error handler: a plugin inherits the handler that exists when it is registered
  if (storage.driver === 'local') await registerLocalStorageRoutes(app, { storage })

  app.get('/healthz', async () => ({ ok: true }))
  app.get('/readyz', async (_req, reply) => {
    const failing = await (opts.readiness ?? (async () => []))()
    return failing.length ? reply.code(503).send({ ok: false, failing }) : { ok: true }
  })

  registerRoutes(app, table, handlers, opts.authorize ?? (db ? createAuthorize({ db, config, auth }) : undefined), createLimiter({ db }))
  await registerWebhookRoutes(app, { payments })
  return app
}
