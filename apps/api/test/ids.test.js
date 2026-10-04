import { describe, expect, it } from 'vitest'
import { uuidv7 } from '../src/platform/ids.js'

describe('uuidv7', () => {
  it('is a valid version 7 UUID', () => {
    expect(uuidv7()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('carries the timestamp in the first 48 bits', () => {
    const ms = Date.UTC(2026, 9, 4, 12, 0, 0, 123) + 1_000_000 // far ahead so the monotonic clock does not interfere
    const id = uuidv7(ms)
    expect(parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBe(ms)
  })

  it('sorts in creation order, also within one millisecond', () => {
    const ms = Date.now() + 5_000_000
    const ids = Array.from({ length: 5000 }, () => uuidv7(ms))
    expect([...ids].sort()).toEqual(ids)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('never goes backwards when the clock does', () => {
    const a = uuidv7(Date.now() + 9_000_000)
    const b = uuidv7(Date.now() + 8_000_000)
    expect(b > a).toBe(true)
  })
})
