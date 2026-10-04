import { describe, expect, it, vi } from 'vitest'
import { databaseReadiness, isRetryable, withRetry } from '../src/platform/db.js'

const deadlock = Object.assign(new Error('Deadlock found'), { errno: 1213, code: 'ER_LOCK_DEADLOCK' })
const lockTimeout = Object.assign(new Error('Lock wait timeout'), { errno: 1205 })
const noSleep = { sleep: async () => {} }

describe('withRetry', () => {
  it('runs the work again after a deadlock and returns its result', async () => {
    const fn = vi.fn().mockRejectedValueOnce(deadlock).mockRejectedValueOnce(lockTimeout).mockResolvedValue('done')
    await expect(withRetry(fn, noSleep)).resolves.toBe('done')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('gives up after 3 attempts and throws the last error', async () => {
    const fn = vi.fn().mockRejectedValue(deadlock)
    await expect(withRetry(fn, noSleep)).rejects.toBe(deadlock)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('does not retry other errors', async () => {
    const boom = Object.assign(new Error('Duplicate entry'), { errno: 1062 })
    const fn = vi.fn().mockRejectedValue(boom)
    await expect(withRetry(fn, noSleep)).rejects.toBe(boom)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('waits 20-100 ms between attempts', async () => {
    const waits = /** @type {number[]} */ ([])
    const fn = vi.fn().mockRejectedValueOnce(deadlock).mockResolvedValue(1)
    await withRetry(fn, { sleep: async (ms) => void waits.push(ms) })
    expect(waits).toHaveLength(1)
    expect(waits[0]).toBeGreaterThanOrEqual(20)
    expect(waits[0]).toBeLessThanOrEqual(100)
  })

  it('recognises the two retryable MySQL errors only', () => {
    expect(isRetryable(deadlock)).toBe(true)
    expect(isRetryable(lockTimeout)).toBe(true)
    expect(isRetryable({ code: 'ER_LOCK_WAIT_TIMEOUT' })).toBe(true)
    expect(isRetryable({ errno: 1062 })).toBe(false)
    expect(isRetryable(null)).toBe(false)
  })
})

describe('databaseReadiness', () => {
  it('is ready when the query works and names the database when it fails', async () => {
    const ok = { query: vi.fn().mockResolvedValue([]) }
    expect(await databaseReadiness(/** @type {never} */ (ok))()).toEqual([])
    const down = { query: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) }
    expect(await databaseReadiness(/** @type {never} */ (down))()).toEqual(['database'])
  })
})
