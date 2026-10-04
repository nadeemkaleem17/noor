// In-process cache with a time-to-live (DOC-08 section 10). Each API process has its own; other processes catch up within the TTL.
// Used for store config, the category tree, shipping zones and the role -> permission map. Never for carts, orders or anything per user.
import { now } from './clock.js'

export const DEFAULT_TTL_MS = 30_000

/**
 * @template T
 * @param {{ ttlMs?: number }} [opts]
 */
export function createCache({ ttlMs = DEFAULT_TTL_MS } = {}) {
  /** @type {Map<string, { value: T, expires: number }>} */
  const entries = new Map()
  /** @type {Map<string, Promise<T>>} */
  const inflight = new Map()

  /** @param {string} key @returns {T | undefined} */
  const get = (key) => {
    const hit = entries.get(key)
    if (!hit) return undefined
    if (hit.expires <= now().getTime()) {
      entries.delete(key)
      return undefined
    }
    return hit.value
  }

  return {
    get,
    /** @param {string} key @param {T} value */
    set(key, value) {
      entries.set(key, { value, expires: now().getTime() + ttlMs })
    },
    /**
     * Returns the cached value or loads it. Callers that arrive together share one load; a failed load is not cached.
     * @param {string} key
     * @param {() => Promise<T>} load
     * @returns {Promise<T>}
     */
    async remember(key, load) {
      const hit = get(key)
      if (hit !== undefined) return hit
      const pending = inflight.get(key)
      if (pending) return pending
      const p = load().then((value) => {
        entries.set(key, { value, expires: now().getTime() + ttlMs })
        return value
      })
      inflight.set(key, p)
      try {
        return await p
      } finally {
        inflight.delete(key)
      }
    },
    /** Drops every key that starts with `prefix` (all keys when empty). @param {string} [prefix] */
    clear(prefix = '') {
      for (const k of entries.keys()) if (k.startsWith(prefix)) entries.delete(k)
    },
    get size() {
      return entries.size
    },
  }
}
