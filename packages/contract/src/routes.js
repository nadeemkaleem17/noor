// The route table (ADR-0005): the only list of endpoints. The API registers handlers from it, the clients call it,
// OpenAPI is generated from it. Add the route here first, then the handler, then the call (DOC-03 section 7).

/**
 * @typedef {'GET' | 'POST' | 'PUT' | 'DELETE'} Method
 */

/**
 * @typedef {object} Shape
 * @property {Method} method
 * @property {string} path - Relative to /api/v1, Fastify-style params: `/products/:id`.
 * @property {import('zod').z.ZodType} [params]
 * @property {import('zod').z.ZodType} [query]
 * @property {import('zod').z.ZodType} [body]
 * @property {import('zod').z.ZodType} response
 * @property {200 | 201 | 202 | 204} [status]
 * @property {boolean} [stepUp] - Needs a password confirmation within the last 15 minutes (DOC-11 section 3.4).
 * @property {boolean} [enrolment] - Also reachable from a session that is only allowed to enrol two-factor.
 * @property {boolean} [idempotent] - Requires an Idempotency-Key header (DOC-10.0 section 8).
 * @property {string} [rateLimit] - Rate-limit bucket (DOC-11 section 5.4); `default` when omitted.
 * @property {'shared'} [cache] - `shared`: `Cache-Control: public, s-maxage=60, stale-while-revalidate=600` (DOC-10.1 section 1). Without it, nothing is said.
 */

/**
 * A staff route must name its permission; every other auth class must not.
 * @typedef {Shape &
 * (
 * | { auth: 'staff'; permission: import('./permissions.js').Permission; }
 * | { auth: 'public' | 'cart' | 'order-token' | 'staff-pending' | 'staff-any' | 'webhook'; permission?: never; }
 * )} RouteDef
 */

/**
 * @typedef {Record<string, RouteDef>} RouteTable
 */

/**
 * Identity helper that keeps the literal types of a table: `export const routes = defineRoutes({ ... })`.
 * @template {RouteTable} const T
 * @param {T} table
 * @returns {T}
 */
export const defineRoutes = (table) => table

/**
 * @typedef {object} Extra
 * @property {AbortSignal} [signal]
 * @property {Record<string, string>} [headers]
 */

/**
 * @template {RouteDef} R
 * @typedef {(R extends { params: infer P extends import('zod').z.ZodType; } ? { params: import('zod').z.input<P>; } : unknown) &
 * (R extends { query: infer Q extends import('zod').z.ZodType; } ? { query?: Partial<import('zod').z.output<Q>>; } : unknown) &
 * (R extends { body: infer B extends import('zod').z.ZodType; } ? { body: import('zod').z.input<B>; } : unknown) &
 * (R extends { idempotent: true; } ? { idempotencyKey: string; } : unknown) &
 * Extra} CallInput
 */

/**
 * @template {RouteDef} R
 * @typedef {import('zod').z.output<R['response']>} CallOutput
 */

/**
 * "/products/:id" + { id: "x" } -> "/products/x".
 * @param {string} path
 * @param {Record<string, unknown>} [params]
 * @returns {string}
 */
export function buildPath(path, params = {}) {
  return path.replace(/:([A-Za-z0-9_]+)/g, /** @param {string} name */ (_, name) => {
    const v = params[name]
    if (v === undefined || v === null || v === '') throw new Error(`missing path parameter "${name}" for ${path}`)
    return encodeURIComponent(String(v))
  })
}

/**
 * Query string: arrays become comma lists, booleans 1/0, undefined and null are skipped (DOC-10.0 section 4).
 * @param {Record<string, unknown>} query
 * @returns {string}
 */
export function buildQuery(query) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue
    sp.set(k, Array.isArray(v) ? v.join(',') : typeof v === 'boolean' ? (v ? '1' : '0') : String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}
