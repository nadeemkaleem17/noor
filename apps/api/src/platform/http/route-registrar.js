// Registers every route of the contract table with its schemas, auth class and handler
// (plan/08-backend-architecture.md section 6.1). The table is the only list of routes: a route without a
// handler, or a handler without a route, stops startup.
import { z } from '@noor/contract'
import { DomainError, RequestValidationError } from '../errors.js'

export const API_PREFIX = '/api/v1'

/**
 * The signed-in staff member. Filled by the auth module (M1-02); the registrar only needs its shape.
 * @typedef {object} Actor
 * @property {string} staffId
 * @property {ReadonlySet<import('@noor/contract').Permission>} permissions
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
 * @property {R extends { auth: 'staff'; } ? Actor : null} actor
 * @property {string} requestId
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
 */
export function registerRoutes(app, table, handlers, authorize = denyStaff) {
  const keys = Object.keys(table)
  const have = new Set(Object.keys(handlers))
  const missing = keys.filter((k) => !have.has(k))
  const extra = [...have].filter((k) => !(k in table))
  if (missing.length || extra.length) {
    throw new Error(`Route table and handlers disagree. Routes without a handler: [${missing.join(', ')}]. Handlers without a route: [${extra.join(', ')}]`)
  }

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
      preHandler: async (req) => {
        if (def.idempotent) {
          const k = req.headers['idempotency-key']
          if (typeof k !== 'string' || !IdempotencyKey.safeParse(k).success) {
            throw new DomainError('validation_failed', { issues: [{ path: 'Idempotency-Key', code: k === undefined ? 'required' : 'invalid_format' }] })
          }
        }
        if (def.auth === 'staff' || def.auth === 'staff-pending') {
          const actor = def.auth === 'staff' ? await authorize(req, def) : null
          if (!actor) throw new DomainError('unauthenticated')
          if (def.permission && !actor.permissions.has(def.permission)) throw new DomainError('forbidden')
          ;(/** @type {import('fastify').FastifyRequest & { actor?: Actor; }} */ (req)).actor = actor
        }
      },
      handler: async (req, reply) => {
        const out = await handler({
          params: req.params,
          query: req.query,
          body: req.body,
          actor: (/** @type {import('fastify').FastifyRequest & { actor?: Actor; }} */ (req)).actor ?? null,
          requestId: req.id,
        })
        reply.code(status)
        return status === 204 ? reply.send() : out
      },
    })
  }
}
