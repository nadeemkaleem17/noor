// The route table (ADR-0005): the only list of endpoints. The API registers handlers from it, the clients call it,
// OpenAPI is generated from it. Add the route here first, then the handler, then the call (DOC-03 section 7).
import type { z } from 'zod'
import type { Permission } from './permissions'

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

type Shape = {
  method: Method
  /** Relative to /api/v1, Fastify-style params: `/products/:id`. */
  path: string
  params?: z.ZodType
  query?: z.ZodType
  body?: z.ZodType
  response: z.ZodType
  status?: 200 | 201 | 202 | 204
  /** Requires an Idempotency-Key header (DOC-10.0 section 8). */
  idempotent?: boolean
  /** Rate-limit bucket (DOC-11 section 5.4); `default` when omitted. */
  rateLimit?: string
}

/** A staff route must name its permission; every other auth class must not. */
export type RouteDef = Shape &
  (
    | { auth: 'staff'; permission: Permission }
    | { auth: 'public' | 'cart' | 'order-token' | 'staff-pending' | 'webhook'; permission?: never }
  )

export type RouteTable = Record<string, RouteDef>

/** Identity helper that keeps the literal types of a table: `export const routes = defineRoutes({ ... })`. */
export const defineRoutes = <const T extends RouteTable>(table: T): T => table

type Extra = { signal?: AbortSignal; headers?: Record<string, string> }

export type CallInput<R extends RouteDef> = (R extends { params: infer P extends z.ZodType } ? { params: z.input<P> } : unknown) &
  (R extends { query: infer Q extends z.ZodType } ? { query?: Partial<z.output<Q>> } : unknown) &
  (R extends { body: infer B extends z.ZodType } ? { body: z.input<B> } : unknown) &
  (R extends { idempotent: true } ? { idempotencyKey: string } : unknown) &
  Extra

export type CallOutput<R extends RouteDef> = z.output<R['response']>

/** "/products/:id" + { id: "x" } -> "/products/x". */
export function buildPath(path: string, params: Record<string, unknown> = {}): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, (_, name: string) => {
    const v = params[name]
    if (v === undefined || v === null || v === '') throw new Error(`missing path parameter "${name}" for ${path}`)
    return encodeURIComponent(String(v))
  })
}

/** Query string: arrays become comma lists, booleans 1/0, undefined and null are skipped (DOC-10.0 section 4). */
export function buildQuery(query: Record<string, unknown>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue
    sp.set(k, Array.isArray(v) ? v.join(',') : typeof v === 'boolean' ? (v ? '1' : '0') : String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}
