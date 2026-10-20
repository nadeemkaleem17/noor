// How often a popup notice comes back to one visitor, and the colours a notice can have (apps/storefront/app/features/layout/notice-palette.js).
import { describe, expect, it } from 'vitest'
import { noticePalettes } from '@noor/contract'
import { paletteClass, popupDue } from '../app/features/layout/notice-palette'

const DAY = 24 * 60 * 60 * 1000
const now = Date.UTC(2026, 9, 20, 10)

describe('popupDue', () => {
  it('every visit: once in each browser session, however often the shop is opened', () => {
    expect(popupDue('visit', undefined, false, now)).toBe(true)
    expect(popupDue('visit', now - 5 * DAY, false, now)).toBe(true)
    expect(popupDue('visit', now - 1000, true, now)).toBe(false)
  })

  it('once a day: not again before a day has passed', () => {
    expect(popupDue('day', undefined, false, now)).toBe(true)
    expect(popupDue('day', now - DAY / 2, false, now)).toBe(false)
    expect(popupDue('day', now - DAY - 1, false, now)).toBe(true)
  })

  it('once ever: never again after the first time', () => {
    expect(popupDue('once', undefined, false, now)).toBe(true)
    expect(popupDue('once', now - 400 * DAY, false, now)).toBe(false)
  })
})

describe('the colours of a notice', () => {
  it('has a class pair for every palette staff can choose, and only those', () => {
    expect(Object.keys(paletteClass).sort()).toEqual([...noticePalettes].sort())
    for (const pair of Object.values(paletteClass)) expect(pair).toMatch(/^bg-\S+ text-\S+$/)
  })
})
