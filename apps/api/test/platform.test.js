// M1-01 unit tests that need no database: the in-process cache and the cron matcher.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCache } from '../src/platform/cache.js'
import { advanceClock, now, setClock } from '../src/platform/clock.js'
import { canonicalJson, hashRequest } from '../src/platform/idempotency.js'
import { cronMatches, platformSchedule } from '../src/platform/scheduler.js'

afterEach(() => setClock(null))

describe('clock', () => {
  it('can be frozen, moved and released', () => {
    setClock(new Date('2026-10-04T10:00:00Z'))
    expect(now().toISOString()).toBe('2026-10-04T10:00:00.000Z')
    advanceClock(1500)
    expect(now().toISOString()).toBe('2026-10-04T10:00:01.500Z')
    now().setFullYear(1999) // a copy: the frozen time cannot be changed from outside
    expect(now().getUTCFullYear()).toBe(2026)
    setClock(null)
    expect(Math.abs(now().getTime() - Date.now())).toBeLessThan(1000)
    expect(() => advanceClock(1)).toThrow(/not frozen/)
  })
})

describe('cache', () => {
  it('expires after the TTL and clears by prefix', () => {
    setClock(new Date('2026-10-04T10:00:00Z'))
    const cache = createCache({ ttlMs: 30_000 })
    cache.set('store-config', 1)
    cache.set('category:1', 2)
    cache.set('category:2', 3)
    advanceClock(29_000)
    expect(cache.get('store-config')).toBe(1)
    cache.clear('category:')
    expect(cache.get('category:1')).toBeUndefined()
    expect(cache.get('store-config')).toBe(1)
    advanceClock(2_000)
    expect(cache.get('store-config')).toBeUndefined()
    expect(cache.size).toBe(0)
  })

  it('remember() shares one load between simultaneous callers and does not cache a failure', async () => {
    const cache = createCache()
    const load = vi.fn(async () => 'value')
    expect(await Promise.all([cache.remember('k', load), cache.remember('k', load), cache.remember('k', load)])).toEqual(['value', 'value', 'value'])
    expect(await cache.remember('k', load)).toBe('value')
    expect(load).toHaveBeenCalledTimes(1)

    const failing = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce('ok')
    await expect(cache.remember('f', failing)).rejects.toThrow('down')
    expect(await cache.remember('f', failing)).toBe('ok')
  })
})

describe('cron', () => {
  const at = (/** @type {string} */ iso) => new Date(iso)
  it('matches plain numbers, steps, ranges, lists and wildcards (UTC)', () => {
    expect(cronMatches('* * * * *', at('2026-10-04T10:07:00Z'))).toBe(true)
    expect(cronMatches('*/5 * * * *', at('2026-10-04T10:10:00Z'))).toBe(true)
    expect(cronMatches('*/5 * * * *', at('2026-10-04T10:12:00Z'))).toBe(false)
    expect(cronMatches('0 22 * * *', at('2026-10-04T22:00:00Z'))).toBe(true)
    expect(cronMatches('0 22 * * *', at('2026-10-04T22:01:00Z'))).toBe(false)
    expect(cronMatches('0,30 8-10 * * *', at('2026-10-04T09:30:00Z'))).toBe(true)
    expect(cronMatches('0,30 8-10 * * *', at('2026-10-04T11:30:00Z'))).toBe(false)
    expect(cronMatches('0 0 1 * *', at('2026-11-01T00:00:00Z'))).toBe(true)
    expect(cronMatches('0 0 * * 0', at('2026-10-04T00:00:00Z'))).toBe(true) // 4 Oct 2026 is a Sunday
    expect(cronMatches('0 0 * * 1', at('2026-10-04T00:00:00Z'))).toBe(false)
  })
  it('rejects a malformed expression instead of never running', () => {
    expect(() => cronMatches('* * * *', new Date())).toThrow(/five fields/)
    expect(() => cronMatches('x * * * *', new Date())).toThrow(/bad cron/)
    expect(() => cronMatches('*/0 * * * *', new Date())).toThrow(/bad cron step/)
  })
  it('every platform schedule entry is a valid expression', () => {
    for (const s of platformSchedule) expect(() => cronMatches(s.cron, new Date())).not.toThrow()
  })
})

describe('idempotency hashing', () => {
  it('is the same whatever the key order and ignores undefined members', () => {
    expect(canonicalJson({ b: 1, a: { d: 1, c: [1, { z: 1, y: 2 }] } })).toBe('{"a":{"c":[1,{"y":2,"z":1}],"d":1},"b":1}')
    expect(hashRequest({ a: 1, b: undefined })).toBe(hashRequest({ a: 1 }))
    expect(hashRequest({ a: 1 })).not.toBe(hashRequest({ a: 2 }))
    expect(hashRequest({ a: 1 })).toMatch(/^[0-9a-f]{64}$/)
  })
})
