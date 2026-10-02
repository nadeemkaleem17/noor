// Registers every route of the contract table with its schemas, auth class and handler
// (plan/08-backend-architecture.md section 6.1). The table is the only list of routes: a route without a
// handler, or a handler without a route, stops startup.
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z, type Permission, type RouteDef, type RouteTable } from '@noor/contract'
import { DomainError, RequestValidationError } from '../errors'

export const API_PREFIX = '/api/v1'

/** The signed-in staff member. Filled by the auth module (M1-02); the registrar only needs its shape. */
export type Actor = { staffId: string; permissions: ReadonlySet<Permission> }

/** Returns the actor for a staff route, or null. Default: nobody is signed in, so staff routes are denied. */
export type Authorize = (req: FastifyRequest, route: RouteDef) => Promise<Actor | null>
const denyStaff: Authorize = async () => null

type Ctx<R extends RouteDef> = {
  params: R extends { params: infer P extends z.ZodType } ? z.output<P> : undefined
  query: R extends { query: infer Q extends z.ZodType } ? z.output<Q> : undefined
  body: R extends { body: infer B extends z.ZodType } ? z.output<B> : undefined
  actor: R extends { auth: 'staff' } ? Actor : null
  requestId: string
}

/** One handler per route key, typed from the table: it returns what the route's response schema accepts. */
export type Handlers<T extends RouteTable> = {
  [K in keyof T]: (ctx: Ctx<T[K]>) => Promise<z.input<T[K]['response']>>
}

declare module 'fastify' {
  interface FastifyContextConfig {
    routeKey?: string
    auth?: RouteDef['auth']
    permission?: Permission
    rateLimit?: string
  }
}

/** Validator that keeps the original ZodError so issues keep their field codes (toFieldIssues). */
export const zodValidatorCompiler = ({ schema }: { schema: unknown }) => {
  const s = schema as z.ZodType
  return (data: unknown) => {
    const r = s.safeParse(data)
    return r.success ? { value: r.data } : { error: new RequestValidationError(r.error) }
  }
}

const IdempotencyKey = z.uuid()

export function registerRoutes<T extends RouteTable>(app: FastifyInstance, table: T, handlers: Handlers<T>, authorize: Authorize = denyStaff) {
  const keys = Object.keys(table)
  const have = new Set(Object.keys(handlers))
  const missing = keys.filter((k) => !have.has(k))
  const extra = [...have].filter((k) => !(k in table))
  if (missing.length || extra.length) {
    throw new Error(`Route table and handlers disagree. Routes without a handler: [${missing.join(', ')}]. Handlers without a route: [${extra.join(', ')}]`)
  }

  for (const [key, def] of Object.entries(table) as [string, RouteDef][]) {
    const status = def.status ?? 200
    const handler = (handlers as Record<string, (ctx: unknown) => Promise<unknown>>)[key] as (ctx: unknown) => Promise<unknown>

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
          ;(req as FastifyRequest & { actor?: Actor }).actor = actor
        }
      },
      handler: async (req, reply) => {
        const out = await handler({
          params: req.params,
          query: req.query,
          body: req.body,
          actor: (req as FastifyRequest & { actor?: Actor }).actor ?? null,
          requestId: req.id,
        })
        reply.code(status)
        return status === 204 ? reply.send() : out
      },
    })
  }
}
