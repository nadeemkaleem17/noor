// Request protections of the API that do not depend on a route: response headers, exact-origin CORS, the Origin check on admin
// state changes, and the client address (plan/11-security-auth.md sections 2, 5.1-5.3).
import { createHash, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'
import { DomainError } from '../errors.js'
import { API_PREFIX } from './route-registrar.js'
import { DEV_UPLOAD_PREFIX } from './storage-routes.js'

const sha256 = (/** @type {string} */ s) => createHash('sha256').update(s).digest()

/** The address of the person behind a request. Set by `registerSecurity`; `req.ip` is the fallback. @param {import('fastify').FastifyRequest} req */
export const clientIp = (req) => /** @type {{ clientIp?: string }} */ (/** @type {unknown} */ (req)).clientIp || req.ip

/**
 * @param {import('fastify').FastifyInstance} app
 * @param {import('../config.js').Config} config
 */
export function registerSecurity(app, config) {
  const adminPrefix = `${API_PREFIX}/admin/` // read here, not at import time: route-registrar.js imports this file too
  const hsts = config.APP_ENV === 'staging' || config.APP_ENV === 'production'
  const internalKey = config.INTERNAL_KEY ? sha256(config.INTERNAL_KEY) : null

  /**
   * The storefront server proves itself with X-Internal-Key; only then is the address it forwards believed. Compared as hashes in constant time.
   * @param {import('fastify').FastifyRequest} req
   */
  const fromStorefront = (req) => {
    const sent = req.headers['x-internal-key']
    return internalKey !== null && typeof sent === 'string' && timingSafeEqual(sha256(sent), internalKey)
  }

  app.decorateRequest('clientIp', '')
  app.addHook('onRequest', async (req, reply) => {
    const forwarded = fromStorefront(req) ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim() : ''
    ;/** @type {{ clientIp: string }} */ (/** @type {unknown} */ (req)).clientIp = forwarded && isIP(forwarded) ? forwarded : req.ip

    void reply.header('x-content-type-options', 'nosniff').header('referrer-policy', 'no-referrer').header('x-frame-options', 'DENY')
    void reply.header('content-security-policy', "default-src 'none'; frame-ancestors 'none'")
    if (hsts) void reply.header('strict-transport-security', 'max-age=31536000; includeSubDomains')

    // the admin site (and, in development, its uploads to the local storage link) is the only browser caller; public routes are called by the storefront server
    if (!req.url.startsWith(adminPrefix) && !req.url.startsWith(DEV_UPLOAD_PREFIX)) return
    void reply.header('cache-control', 'no-store').header('vary', 'Origin')
    const origin = req.headers.origin
    if (origin === config.ADMIN_ORIGIN) {
      void reply
        .header('access-control-allow-origin', origin)
        .header('access-control-allow-credentials', 'true')
        .header('access-control-expose-headers', 'x-request-id, retry-after, ratelimit-limit, ratelimit-remaining, ratelimit-reset')
      if (req.method === 'OPTIONS' && req.headers['access-control-request-method']) {
        return reply
          .code(204)
          .header('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE')
          .header('access-control-allow-headers', 'content-type, x-csrf-token, x-request-id, idempotency-key')
          .header('access-control-max-age', '600')
          .send()
      }
    }
    // CSRF, first line of defence (section 5.1): every state change must come from the admin site
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && origin !== config.ADMIN_ORIGIN) throw new DomainError('csrf_failed')
  })
}
