// Rate-limit buckets (plan/11-security-auth.md section 5.4) and the limiter that applies them. One place holds every number.
// Memory buckets are per API instance; database buckets (the abuse-relevant ones) hold across instances.
import { DomainError } from '../errors.js'
import { now } from '../clock.js'
import { hit } from '../rate-limit.js'

/**
 * What a rule counts. `ip` and `staff` are applied to every request by the route registrar; the others need a value only the
 * route's module has (cart id, phone, order number, token), and that module calls `limiter.consume`.
 * @typedef {'ip' | 'staff' | 'cart' | 'phone' | 'order' | 'token'} By
 * @typedef {{ by: By, limit: number, windowMs: number, store?: 'db' }} Rule
 */

const MIN = 60_000
const HOUR = 60 * MIN

/** @type {Record<string, Rule[]>} */
export const buckets = {
  default: [{ by: 'ip', limit: 300, windowMs: MIN }],
  search: [{ by: 'ip', limit: 60, windowMs: MIN }],
  cart: [{ by: 'ip', limit: 60, windowMs: MIN }, { by: 'cart', limit: 120, windowMs: MIN }],
  checkout: [{ by: 'ip', limit: 10, windowMs: 10 * MIN, store: 'db' }, { by: 'phone', limit: 5, windowMs: 10 * MIN, store: 'db' }],
  track: [{ by: 'ip', limit: 10, windowMs: HOUR, store: 'db' }, { by: 'order', limit: 5, windowMs: HOUR, store: 'db' }],
  orderAction: [{ by: 'token', limit: 10, windowMs: HOUR }],
  notify: [{ by: 'ip', limit: 10, windowMs: HOUR, store: 'db' }, { by: 'phone', limit: 3, windowMs: 24 * HOUR, store: 'db' }],
  review: [{ by: 'ip', limit: 5, windowMs: HOUR }],
  login: [], // counted by the auth service from `login_attempts` (5 per email, 20 per IP, 15 minutes), which also escalates to a lock
  admin: [{ by: 'staff', limit: 600, windowMs: MIN }],
  adminExport: [{ by: 'staff', limit: 10, windowMs: MIN }],
  upload: [{ by: 'staff', limit: 60, windowMs: MIN }],
}

/**
 * @param {{ db?: import('../db.js').Executor }} [deps] without a database, database buckets count in memory (route-table tests)
 */
export function createLimiter({ db } = {}) {
  /** @type {Map<string, { count: number, windowStart: number, expires: number }>} */
  const memory = new Map()

  /** @param {string} key @param {Rule} rule */
  const countInMemory = (key, rule) => {
    const at = now().getTime()
    if (memory.size > 10_000) for (const [k, v] of memory) if (v.expires < at) memory.delete(k)
    const windowStart = Math.floor(at / rule.windowMs) * rule.windowMs
    const entry = memory.get(key)
    const count = entry && entry.windowStart === windowStart ? entry.count + 1 : 1
    memory.set(key, { count, windowStart, expires: windowStart + rule.windowMs })
    return { allowed: count <= rule.limit, count, retryAfterSeconds: Math.max(1, Math.ceil((windowStart + rule.windowMs - at) / 1000)) }
  }

  return {
    /** @param {string} name */
    has: (name) => name in buckets,
    /**
     * Counts one request against the rules of bucket `name` that count by `by`. Throws `rate_limited` over the limit.
     * Returns what the RateLimit-* headers say for the last rule applied (undefined when none applies).
     * @param {string} name
     * @param {By} by
     * @param {string} subject an address, staff id, cart id, `subjectHash(phone)` ...
     */
    async consume(name, by, subject) {
      /** @type {{ limit: number, remaining: number, reset: number } | undefined} */
      let header
      for (const rule of buckets[name] ?? []) {
        if (rule.by !== by) continue
        const r = rule.store === 'db' && db ? await hit(db, { bucket: `${name}:${by}`, subject, limit: rule.limit, windowMs: rule.windowMs }) : countInMemory(`${name}|${by}|${subject}`, rule)
        if (!r.allowed) throw new DomainError('rate_limited', { retryAfter: r.retryAfterSeconds })
        header = { limit: rule.limit, remaining: rule.limit - r.count, reset: r.retryAfterSeconds }
      }
      return header
    },
  }
}

/** @typedef {ReturnType<typeof createLimiter>} Limiter */
