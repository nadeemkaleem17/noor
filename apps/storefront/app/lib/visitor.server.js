// Who is asking, for the API's limits (plan/11-security-auth.md section 5.4). Every customer reaches the API through this server, so without the visitor's
// address the API would count the whole shop as one person (10 orders in 10 minutes for everybody). The address comes from the proxy in front of this
// server; the API believes it only with the shared key (`X-Internal-Key`).
import { AsyncLocalStorage } from 'node:async_hooks'
import { isIP } from 'node:net'
import { getEnv } from './env.server'

/** @type {AsyncLocalStorage<{ ip: string | undefined }>} */
const visitor = new AsyncLocalStorage()

/**
 * The address the nearest trusted proxy saw. With `hops` proxies in front of this server each one appends the address it received the request from, so the
 * visitor is the `hops`-th entry from the end; anything before that was written by the visitor and is not believed. Without trusted proxies there is nothing to read.
 * @param {string | null} forwardedFor the `X-Forwarded-For` header
 * @param {number} hops
 * @returns {string | undefined}
 */
export function visitorIp(forwardedFor, hops) {
  if (hops < 1 || !forwardedFor) return undefined
  const entries = forwardedFor.split(',').map((e) => e.trim()).filter(Boolean)
  const ip = entries[entries.length - hops]
  return ip && isIP(ip) ? ip : undefined
}

/** Route middleware: the rest of the request (loaders, actions) runs with the visitor's address at hand. @type {import('react-router').MiddlewareFunction} */
export function visitorMiddleware({ request }, next) {
  return visitor.run({ ip: visitorIp(request.headers.get('x-forwarded-for'), getEnv().TRUSTED_PROXY_HOPS) }, next)
}

/** The headers every call to the API carries: the key, and the visitor's address when it is known. @returns {Record<string, string>} */
export function visitorHeaders() {
  const { API_INTERNAL_KEY: key } = getEnv()
  const ip = visitor.getStore()?.ip
  return { ...(key ? { 'x-internal-key': key } : {}), ...(key && ip ? { 'x-forwarded-for': ip } : {}) }
}
