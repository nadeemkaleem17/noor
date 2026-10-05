const BASE = 'https://admin.invalid'

/**
 * The page to return to after sign-in. Same-origin paths only: `//evil.example`, `/\evil.example` and absolute URLs all give null (plan/07-admin/01 section 8).
 * @param {unknown} value
 * @returns {string | null}
 */
export function safeNext(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return null
  try {
    const url = new URL(value, BASE)
    return url.origin === BASE ? url.pathname + url.search + url.hash : null
  } catch {
    return null
  }
}

/** Where to send someone who is not signed in, remembering the page they wanted. @param {string} from a path with its search @param {boolean} [expired] */
export function loginUrl(from, expired = false) {
  const params = new URLSearchParams()
  if (from && from !== '/') params.set('next', from)
  if (expired) params.set('reason', 'expired')
  const query = params.toString()
  return query ? `/login?${query}` : '/login'
}
