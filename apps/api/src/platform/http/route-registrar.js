// Registers every route of the contract table with its schemas, auth class and handler
// (plan/08-backend-architecture.md section 6.1). The table is the only list of routes: a route without a
// handler, or a handler without a route, stops startup.
import { z } from '@noor/contract'
import { DomainError, RequestValidationError } from '../errors.js'
import { createLimiter } from './rate-limit.js'
import { clientIp } from './security.js'

export const API_PREFIX = '/api/v1'

/**
 * The signed-in staff member. Filled by the auth module (M1-02); the registrar only needs its shape.
 * @typedef {object} Actor
 * @property {string} staffId
 * @property {ReadonlySet<import('@noor/contract').Permission>} permissions
 * @property {string} [name]
 * @property {string} role
 */

/**
 * Returns the actor for a staff route, or null. Default: nobody is signed in, so staff routes are denied.
 * @typedef {(req: import('fastify').FastifyRequest, route: import('@noor/contract').RouteDef) => Promise<Actor | null>} Authorize
 */
const denyStaff = /** @type {Authorize} */ (async () => null)

/**
 * @template {import('@noor/contract').RouteDef} R
 * @typedef {object} Ctx
 * @property {R extends { params: infer P extends z.ZodType; } ? z.output<P> : undefined} params
 * @property {R extends { query: infer Q extends z.ZodType; } ? z.output<Q> : undefined} query
 * @property {R extends { body: infer B extends z.ZodType; } ? z.output<B> : undefined} body
 * @property {R extends { auth: 'staff' | 'staff-any' | 'staff-pending'; } ? Actor : null} actor
 * @property {R extends { idempotent: true; } ? string : undefined} idempotencyKey the Idempotency-Key header, already checked to be a UUID
 * @property {string} requestId
 * @property {{ error: (o: object, msg: string) => void }} log the request's logger
 * @property {HttpInfo} http
 * @property {(bucket: string, by: import('./rate-limit.js').By, subject: string) => Promise<void>} limit counts one request against a rate-limit rule the route knows the subject of (a phone, an order number ...); throws `rate_limited`
 */

/**
 * What a handler may use of the HTTP exchange besides its validated input: the client, and cookies.
 * @typedef {object} HttpInfo
 * @property {string} ip
 * @property {string} userAgent
 * @property {(name: string, value: string, options: import('@fastify/cookie').CookieSerializeOptions) => void} setCookie
 * @property {(name: string) => void} clearCookie
 * @property {(name: string) => string | undefined} header a request header, by name in any case (the cart token, for instance)
 * @property {(name: string, value: string) => void} setHeader overrides a response header (the shared-cache flag of the route is set first)
 */

/**
 * One handler per route key, typed from the table: it returns what the route's response schema accepts.
 * @template {import('@noor/contract').RouteTable} T
 * @typedef {{
 * [K in keyof T]: (ctx: Ctx<T[K]>) => Promise<z.input<T[K]['response']>>
 * }} Handlers
 */

/**
 * Route options the registrar attaches to every Fastify route (read back by the auth hook).
 * @typedef {object} RouteConfig
 * @property {string} [routeKey]
 * @property {import('@noor/contract').RouteDef['auth']} [auth]
 * @property {import('@noor/contract').Permission} [permission]
 * @property {string} [rateLimit]
 */

/**
 * Validator that keeps the original ZodError so issues keep their field codes (toFieldIssues).
 * @param {{ schema: unknown; }} props
 */
export const zodValidatorCompiler = ({ schema }) => {
  const s = /** @type {z.ZodType} */ (schema)
  return /** @param {unknown} data */ (data) => {
    const r = s.safeParse(data)
    return r.success ? { value: r.data } : { error: new RequestValidationError(r.error) }
  }
}

const IdempotencyKey = z.uuid()

/**
 * @template {import('@noor/contract').RouteTable} T
 * @param {import('fastify').FastifyInstance} app
 * @param {T} table
 * @param {Handlers<T>} handlers
 * @param {Authorize} [authorize]
 * @param {import('./rate-limit.js').Limiter} [limiter]
 */
export function registerRoutes(app, table, handlers, authorize = denyStaff, limiter = createLimiter()) {
  const keys = Object.keys(table)
  const have = new Set(Object.keys(handlers))
  const missing = keys.filter((k) => !have.has(k))
  const extra = [...have].filter((k) => !(k in table))
  if (missing.length || extra.length) {
    throw new Error(`Route table and handlers disagree. Routes without a handler: [${missing.join(', ')}]. Handlers without a route: [${extra.join(', ')}]`)
  }

  const unknownBucket = Object.entries(table).find(([, d]) => d.rateLimit && !limiter.has(d.rateLimit))
  if (unknownBucket) throw new Error(`Route ${unknownBucket[0]} names the rate-limit bucket "${unknownBucket[1].rateLimit}", which does not exist (platform/http/rate-limit.js)`)

  for (const [key, def] of /** @type {[string, import('@noor/contract').RouteDef][]} */ (Object.entries(table))) {
    const status = def.status ?? 200
    const handler = /** @type {(ctx: unknown) => Promise<unknown>} */ ((/** @type {Record<string, (ctx: unknown) => Promise<unknown>>} */ (handlers))[key])

    app.route({
      method: def.method,
      url: API_PREFIX + def.path,
      schema: {
        operationId: key,
        tags: [key.split('.')[0] === 'admin' ? 'admin' : 'public'],
        ...(def.params ? { params: def.params } : {}),
        ...(def.query ? { querystring: def.query } : {}),
        ...(def.body ? { body: def.body } : {}),
        ...(status === 204 ? {} : { response: { [status]: def.response } }),
      },
      config: { routeKey: key, auth: def.auth, permission: def.permission, rateLimit: def.rateLimit },
      // Who is asking and how often, decided before the body is read or validated: a stranger gets 401 whatever they send (section 4.2)
      onRequest: async (req, reply) => {
        const staff = def.auth === 'staff' || def.auth === 'staff-any' || def.auth === 'staff-pending'
        const ip = clientIp(req)
        /** @type {Awaited<ReturnType<typeof limiter.consume>>} */
        let shown
        if (staff) {
          const actor = await authorize(req, def)
          if (!actor) {
            await limiter.consume('default', 'ip', ip) // a flood of unauthenticated requests costs a session lookup each
            throw new DomainError('unauthenticated')
          }
          if (def.permission && !actor.permissions.has(def.permission)) throw new DomainError('forbidden')
          ;(/** @type {import('fastify').FastifyRequest & { actor?: Actor; }} */ (req)).actor = actor
          shown = await limiter.consume(def.rateLimit ?? 'admin', 'staff', actor.staffId)
        } else {
          shown = await limiter.consume(def.rateLimit ?? 'default', 'ip', ip)
        }
        if (shown) void reply.header('ratelimit-limit', shown.limit).header('ratelimit-remaining', shown.remaining).header('ratelimit-reset', shown.reset)
      },
      preHandler: async (req) => {
        if (def.idempotent) {
          const k = req.headers['idempotency-key']
          if (typeof k !== 'string' || !IdempotencyKey.safeParse(k).success) {
            throw new DomainError('validation_failed', { issues: [{ path: 'Idempotency-Key', code: k === undefined ? 'required' : 'invalid_format' }] })
          }
        }
      },
      handler: async (req, reply) => {
        // the route's cache flag first, so a handler can still say something stricter (a search, a preview)
        if (def.cache === 'shared') void reply.header('cache-control', 'public, s-maxage=60, stale-while-revalidate=600')
        else if (def.auth === 'cart' || def.auth === 'order-token') void reply.header('cache-control', 'private, no-store') // what belongs to one holder is never shared
        const out = await handler({
          params: req.params,
          query: req.query,
          body: req.body,
          actor: (/** @type {import('fastify').FastifyRequest & { actor?: Actor; }} */ (req)).actor ?? null,
          requestId: req.id,
          log: req.log,
          idempotencyKey: def.idempotent ? req.headers['idempotency-key'] : undefined,
          /** @param {string} bucket @param {import('./rate-limit.js').By} by @param {string} subject */
          limit: async (bucket, by, subject) => void (await limiter.consume(bucket, by, subject)),
          http: {
            ip: clientIp(req),
            userAgent: String(req.headers['user-agent'] ?? ''),
            /** @param {string} name @param {string} value @param {import('@fastify/cookie').CookieSerializeOptions} options */
            setCookie: (name, value, options) => void reply.setCookie(name, value, options),
            /** @param {string} name */
            header: (name) => {
              const v = req.headers[name.toLowerCase()]
              return typeof v === 'string' ? v : undefined
            },
            /** @param {string} name */
            clearCookie: (name) => void reply.clearCookie(name, { path: '/' }),
            /** @param {string} name @param {string} value */
            setHeader: (name, value) => void reply.header(name, value),
          },
        })
        reply.code(status)
        return status === 204 ? reply.send() : out
      },
    })
  }
}
