// buildApp(): the Fastify instance, plugins and routes (plan/08-backend-architecture.md section 4).
// Tests and main.ts both call it; nothing here reads the environment.
import { randomUUID } from 'node:crypto'
import Fastify, { LogController } from 'fastify'
import swagger from '@fastify/swagger'
import { jsonSchemaTransform, serializerCompiler } from 'fastify-type-provider-zod'
import { routes as contractRoutes, type RouteTable } from '@noor/contract'
import type { Config } from './platform/config'
import { errorHandler, sendProblem, toProblem } from './platform/errors'
import { loggerOptions } from './platform/logger'
import { registerRoutes, zodValidatorCompiler, type Authorize, type Handlers } from './platform/http/route-registrar'
import { appHandlers } from './modules'

export type Readiness = () => Promise<string[]> // names of failing dependencies; empty = ready

export type AppOptions<T extends RouteTable> = {
  config: Config
  table?: T
  handlers?: Handlers<T>
  authorize?: Authorize
  /** Database reachable and migrations at head. M0-06 supplies the real check; until then nothing can fail. */
  readiness?: Readiness
}

const requestIdPattern = /^[A-Za-z0-9-]{8,64}$/

export async function buildApp<T extends RouteTable = typeof contractRoutes>(opts: AppOptions<T>) {
  const { config } = opts
  const table = (opts.table ?? contractRoutes) as T
  const handlers = (opts.handlers ?? appHandlers(config)) as Handlers<T>

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
    trustProxy: (_address: string, hop: number) => hop < config.TRUST_PROXY_HOPS,
    bodyLimit: 1_048_576,
  })

  app.setValidatorCompiler(zodValidatorCompiler)
  // Responses are checked against their schema everywhere except production, where the check is skipped for speed.
  app.setSerializerCompiler(config.NODE_ENV === 'production' ? () => (data) => JSON.stringify(data) : serializerCompiler)

  await app.register(swagger, {
    openapi: { openapi: '3.1.0', info: { title: 'Rubaya API', version: '1.0.0' } },
    transform: jsonSchemaTransform,
  })

  app.addHook('onRequest', async (req, reply) => {
    void reply.header('x-request-id', req.id)
  })
  app.addHook('onResponse', async (req, reply) => {
    if (req.url === '/healthz' || req.url === '/readyz') return
    // route pattern, never the raw URL: query strings can hold phone numbers and search text
    req.log.info({ method: req.method, route: req.routeOptions.url, status: reply.statusCode, durationMs: Math.round(reply.elapsedTime), ip: req.ip }, 'request')
  })

  app.setErrorHandler(errorHandler(config))
  app.setNotFoundHandler((req, reply) => sendProblem(reply, toProblem('not_found', req.id)))

  app.get('/healthz', async () => ({ ok: true }))
  app.get('/readyz', async (_req, reply) => {
    const failing = await (opts.readiness ?? (async () => []))()
    return failing.length ? reply.code(503).send({ ok: false, failing }) : { ok: true }
  })

  registerRoutes(app, table, handlers, opts.authorize)
  return app
}
