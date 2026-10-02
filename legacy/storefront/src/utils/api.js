// Tiny read-only client for the store API (see mock-api/ at the repo root).
// When VITE_API_URL is unset the storefront runs entirely on src/data/mockData.js.
export const API_URL = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '')
export const apiEnabled = API_URL !== ''

// Generous on purpose: a free Render web service sleeps when idle and can take 30–60s to wake.
// This covers shorter cold starts; after a longer one the catalog falls back to sample data and
// the "Try again" banner recovers once the API is up.
const TIMEOUT_MS = 20000

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// GET a JSON resource. Rejects with ApiError on network failure, timeout or non-2xx.
// Pass an AbortSignal to cancel (e.g. on unmount); that rejects with the signal's AbortError.
export function apiGet(path, { signal } = {}) {
  return request('GET', path, { signal })
}

// POST JSON (checkout). On a 4xx the server's own message ("Only 1 left…") becomes the error message.
export function apiPost(path, body, { signal } = {}) {
  return request('POST', path, { signal, body })
}

async function request(method, path, { signal, body } = {}) {
  if (!apiEnabled) throw new ApiError('VITE_API_URL is not set')
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, TIMEOUT_MS)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new ApiError(timedOut ? 'The store server took too long to respond' : 'Could not reach the store server')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
  let data = null
  try {
    data = await res.json()
  } catch {
    if (res.ok) throw new ApiError('Store server sent an invalid response', res.status)
  }
  if (!res.ok) throw new ApiError(data?.error || `Store server returned ${res.status}`, res.status)
  return data
}

// Only allow relative links and http(s) URLs from API-provided settings, so a bad value
// (e.g. "javascript:...") can never become a clickable link.
export function safeHref(href) {
  if (typeof href !== 'string' || !href.trim()) return null
  const value = href.trim()
  if (value.startsWith('/') && !value.startsWith('//')) return value
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}
