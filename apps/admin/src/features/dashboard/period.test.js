// The dashboard's periods: Pakistan days, presets, a range in the address, and the change shown on a tile. Pure.
import { describe, expect, it } from 'vitest'
import { addDays, change, daysIn, periodParams, resolvePeriod, todayIn } from './period'

/** 12 Oct 2026, 23:30 in Pakistan is 18:30 UTC the same day; 00:30 on the 13th in Pakistan is 19:30 UTC on the 12th. */
const lateEvening = Date.parse('2026-10-12T18:30:00Z')
const justAfterMidnight = Date.parse('2026-10-12T19:30:00Z')
const q = (/** @type {string} */ s) => new URLSearchParams(s)

describe('days in Pakistan', () => {
  it('turns over at midnight in Pakistan, not in UTC', () => {
    expect(todayIn(lateEvening)).toBe('2026-10-12')
    expect(todayIn(justAfterMidnight)).toBe('2026-10-13')
  })
  it('counts and adds days across month ends', () => {
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30')
    expect(addDays('2026-02-27', 3)).toBe('2026-03-02')
    expect(daysIn('2026-10-06', '2026-10-12')).toBe(7)
    expect(daysIn('2026-10-12', '2026-10-12')).toBe(1)
  })
})

describe('the period of the address', () => {
  it('is the last 7 days when nothing is asked, today included', () => {
    expect(resolvePeriod(q(''), lateEvening)).toEqual({ id: '7d', from: '2026-10-06', to: '2026-10-12', days: 7 })
  })
  it('knows the presets', () => {
    expect(resolvePeriod(q('period=today'), lateEvening)).toMatchObject({ from: '2026-10-12', to: '2026-10-12' })
    expect(resolvePeriod(q('period=yesterday'), lateEvening)).toMatchObject({ from: '2026-10-11', to: '2026-10-11' })
    expect(resolvePeriod(q('period=30d'), lateEvening)).toMatchObject({ from: '2026-09-13', to: '2026-10-12', days: 30 })
    expect(resolvePeriod(q('period=month'), lateEvening)).toMatchObject({ from: '2026-10-01', to: '2026-10-12' })
  })
  it('takes a custom range of at most 366 days, and nothing else from a bad address', () => {
    expect(resolvePeriod(q('from=2026-09-01&to=2026-09-30'), lateEvening)).toMatchObject({ id: 'custom', days: 30 })
    expect(resolvePeriod(q('from=2025-09-30&to=2026-09-30'), lateEvening).id).toBe('custom') // 366 days
    expect(resolvePeriod(q('from=2025-09-29&to=2026-09-30'), lateEvening).id).toBe('7d') // 367
    expect(resolvePeriod(q('from=2026-09-30&to=2026-09-01'), lateEvening).id).toBe('7d')
    expect(resolvePeriod(q('from=soon&to=later'), lateEvening).id).toBe('7d')
    expect(resolvePeriod(q('period=forever'), lateEvening).id).toBe('7d')
  })
  it('writes the address for a choice: the default leaves it empty', () => {
    expect(periodParams('7d')).toEqual({ period: undefined, from: undefined, to: undefined })
    expect(periodParams('30d')).toEqual({ period: '30d', from: undefined, to: undefined })
    expect(periodParams('custom', { from: '2026-09-01', to: '2026-09-30' })).toEqual({ period: undefined, from: '2026-09-01', to: '2026-09-30' })
  })
})

describe('the change on a tile', () => {
  it('is the percent and the direction, and nothing when there was nothing before', () => {
    expect(change(41230000, 36800000)).toEqual({ pct: 12, dir: 'up' })
    expect(change(64, 67)).toEqual({ pct: 4, dir: 'down' })
    expect(change(5, 5)).toEqual({ pct: 0, dir: 'same' })
    expect(change(5, 0)).toBeNull()
  })
})
