// The typed client built from a route table (DOC-03 section 7). Every response is parsed, never cast.
import { ApiError } from './errors.js'
import { buildPath, buildQuery } from './routes.js'

/**
 * @typedef {object} ClientOptions
 * @property {string} baseUrl - e.g. "http://localhost:3000/api/v1"
 * @property {typeof fetch} [fetch]
 * @property {() => Record<string, string>} [headers] - Headers added to every call (CSRF token, internal key, cart token, locale ...). Evaluated per call.
 * @property {'omit' | 'same-origin' | 'include'} [credentials] - Browser clients send the session cookie; ignored by Node. Default "include".
 * @property {number} [timeoutMs]
 */

// optional argument when every key of the input is optional
/**
 * @template I
 * @typedef {Partial<I> extends I ? [input?: I] : [input: I]} Args
 */

/**
 * @template {import('./routes.js').RouteTable} const T
 * @param {T} table
 * @param {ClientOptions} opts
 */
export function createClient(table, opts) {
  const doFetch = opts.fetch ?? fetch
  const base = opts.baseUrl.replace(/\/+$/, '')

  return (
    /**
     * @template {keyof T & string} K
     * @param {K} key
     * @param {Args<import('./routes.js').CallInput<T[K]>>} args
     * @returns {Promise<import('./routes.js').CallOutput<T[K]>>}
     */
    async function call(key, ...args) {
    const route = table[key]
    if (!route) throw new Error(`unknown route "${key}"`)
    const input = /** @type {{ params?: unknown; query?: Record<string, unknown>; body?: unknown; idempotencyKey?: string; signal?: AbortSignal; headers?: Record<string, string>; }} */ ((args[0] ?? {}))

    const params = route.params ? (/** @type {Record<string, unknown>} */ (route.params.parse(input.params))) : undefined
    let query = ''
    if (route.query && input.query) {
      const parsed = /** @type {Record<string, unknown>} */ (route.query.parse(input.query))
      // send only what the caller provided, not schema defaults
      query = buildQuery(Object.fromEntries(Object.keys(input.query).map((k) => [k, parsed[k]])))
    }
    const headers = /** @type {Record<string, string>} */ ({ accept: 'application/json', ...opts.headers?.(), ...input.headers })
    /** @type {string | undefined} */
    let body
    if (route.body) {
      body = JSON.stringify(route.body.parse(input.body))
      headers['content-type'] = 'application/json'
    }
    if (route.idempotent) {
      if (!input.idempotencyKey) throw new Error(`route "${key}" needs an idempotencyKey`)
      headers['idempotency-key'] = input.idempotencyKey
    }

    const signals = [AbortSignal.timeout(opts.timeoutMs ?? 20_000), ...(input.signal ? [input.signal] : [])]
    /** @type {Response} */
    let res
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
    if (res.status === 204) return /** @type {import('./routes.js').CallOutput<T[K]>} */ (undefined)
    return /** @type {import('./routes.js').CallOutput<T[K]>} */ (route.response.parse(await res.json()))
  })
}
