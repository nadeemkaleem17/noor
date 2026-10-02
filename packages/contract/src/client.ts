// The typed client built from a route table (DOC-03 section 7). Every response is parsed, never cast.
import { ApiError } from './errors'
import { buildPath, buildQuery, type CallInput, type CallOutput, type RouteTable } from './routes'

export type ClientOptions = {
  /** e.g. "http://localhost:3000/api/v1" */
  baseUrl: string
  fetch?: typeof fetch
  /** Headers added to every call (CSRF token, internal key, cart token, locale ...). Evaluated per call. */
  headers?: () => Record<string, string>
  /** Browser clients send the session cookie; ignored by Node. Default "include". */
  credentials?: 'omit' | 'same-origin' | 'include'
  timeoutMs?: number
}

// optional argument when every key of the input is optional
type Args<I> = Partial<I> extends I ? [input?: I] : [input: I]

export function createClient<const T extends RouteTable>(table: T, opts: ClientOptions) {
  const doFetch = opts.fetch ?? fetch
  const base = opts.baseUrl.replace(/\/+$/, '')

  return async function call<K extends keyof T & string>(key: K, ...args: Args<CallInput<T[K]>>): Promise<CallOutput<T[K]>> {
    const route = table[key]
    if (!route) throw new Error(`unknown route "${key}"`)
    const input = (args[0] ?? {}) as {
      params?: unknown; query?: Record<string, unknown>; body?: unknown
      idempotencyKey?: string; signal?: AbortSignal; headers?: Record<string, string>
    }

    const params = route.params ? (route.params.parse(input.params) as Record<string, unknown>) : undefined
    let query = ''
    if (route.query && input.query) {
      const parsed = route.query.parse(input.query) as Record<string, unknown>
      // send only what the caller provided, not schema defaults
      query = buildQuery(Object.fromEntries(Object.keys(input.query).map((k) => [k, parsed[k]])))
    }
    const headers: Record<string, string> = { accept: 'application/json', ...opts.headers?.(), ...input.headers }
    let body: string | undefined
    if (route.body) {
      body = JSON.stringify(route.body.parse(input.body))
      headers['content-type'] = 'application/json'
    }
    if (route.idempotent) {
      if (!input.idempotencyKey) throw new Error(`route "${key}" needs an idempotencyKey`)
      headers['idempotency-key'] = input.idempotencyKey
    }

    const signals = [AbortSignal.timeout(opts.timeoutMs ?? 20_000), ...(input.signal ? [input.signal] : [])]
    let res: Response
    try {
      res = await doFetch(base + buildPath(route.path, params) + query, {
        method: route.method,
        headers,
        body,
        credentials: opts.credentials ?? 'include',
        signal: AbortSignal.any(signals),
      })
    } catch (cause) {
      if (input.signal?.aborted) throw cause
      throw new ApiError('unavailable', 0, {}, [], undefined, cause instanceof Error ? cause.message : 'network error')
    }

    if (!res.ok) throw ApiError.from(await res.json().catch(() => null), res.status)
    if (res.status === 204) return undefined as CallOutput<T[K]>
    return route.response.parse(await res.json()) as CallOutput<T[K]>
  }
}
