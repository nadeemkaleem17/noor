// The one typed client (plan/03 section 7). The session is a cookie; the CSRF token from `admin.me.get` is sent with every call.
import { createClient, routes } from '@noor/contract'
import { env } from './env'

let csrfToken = ''
/** @param {string} token */
export const setCsrfToken = (token) => {
  csrfToken = token
}

export const api = createClient(routes, {
  baseUrl: `${env.apiUrl}/api/v1`,
  fetch: (...args) => fetch(...args), // looked up per call, so a test can replace the global
  headers: () => (csrfToken ? { 'x-csrf-token': csrfToken } : /** @type {Record<string, string>} */ ({})),
})
