// HTTP client for the store API (mock-api/ at the repo root). Only lib/db.js uses this;
// components never call fetch directly.
//
//   VITE_API_URL    base URL, e.g. http://localhost:3000. Unset → the admin runs on localStorage only.
//   VITE_ADMIN_KEY  sent as x-admin-key on every admin request.
//
// Both are baked into the JavaScript at build time, so VITE_ADMIN_KEY is readable by anyone who
// can load the admin site. Fine for the mock API; a real backend needs real auth.
export const API_URL = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '')
export const apiEnabled = API_URL !== ''
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || ''
const TIMEOUT_MS = 20000 // a sleeping free Render instance can take a while to wake up
const UPLOAD_TIMEOUT_MS = 60000

// `issues` mirrors the server's zod issues as [{ path, message }], the same shape validate.js uses.
export class ApiError extends Error {
  constructor(message, { status = 0, issues = [] } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.issues = issues
  }
}

async function request(method, path, { json, form, timeout = TIMEOUT_MS } = {}) {
  if (!apiEnabled) throw new ApiError('VITE_API_URL is not set')
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeout)
  const headers = { Accept: 'application/json' }
  if (ADMIN_KEY) headers['x-admin-key'] = ADMIN_KEY
  if (json !== undefined) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method, headers, signal: controller.signal,
      body: json !== undefined ? JSON.stringify(json) : form,
    })
  } catch {
    throw new ApiError(timedOut
      ? 'The API server took too long to respond'
      : `Can't reach the API server at ${API_URL} — is it running?`)
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 204) return null
  let body = null
  try { body = await res.json() } catch { /* empty or non-JSON body */ }
  if (!res.ok) {
    const issues = (body?.issues || []).map((i) => ({ path: (i.path || []).join('.') || '(item)', message: i.message }))
    const message = res.status === 401 ? 'The API rejected the admin key (check VITE_ADMIN_KEY)'
      : res.status === 503 ? 'The API has no ADMIN_KEY configured'
        : body?.error || `API request failed (${res.status})`
    throw new ApiError(message, { status: res.status, issues })
  }
  return body
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, json) => request('POST', path, { json }),
  put: (path, json) => request('PUT', path, { json }),
  del: (path) => request('DELETE', path),
  // Multipart upload of one image file/blob; resolves to { url, size, type }.
  upload: (blob, filename = 'image') => {
    const form = new FormData()
    form.append('file', blob, filename)
    return request('POST', '/api/admin/uploads', { form, timeout: UPLOAD_TIMEOUT_MS })
  },
}
