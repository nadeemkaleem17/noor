// The small pure parts of the order screens: the barcode, the tracking paste, the links, the waiting times.
import { describe, expect, it } from 'vitest'
import { ageText, ageTone, isWholePhone, telLink, waLink } from './format'
import { code128, code128Values, patterns } from './barcode'
import { parseTracking } from './components/bulk-order-dialog'
import { describeEvent } from './labels'

describe('Code 128 barcode', () => {
  it('has 107 symbols whose bars and spaces add up to 11 modules (the stop to 13), starting with a bar, each different', () => {
    expect(patterns).toHaveLength(107)
    patterns.slice(0, 106).forEach((p) => {
      expect(p).toHaveLength(6)
      expect(p.split('').reduce((n, d) => n + Number(d), 0)).toBe(11)
    })
    expect(patterns[106]?.split('').reduce((n, d) => n + Number(d), 0)).toBe(13)
    expect(new Set(patterns).size).toBe(107)
  })
  it('works out the check symbol the way the standard does (start B + each value times its place, modulo 103)', () => {
    // "A" is value 33; check = (104 + 33 * 1) mod 103 = 34
    expect(code128Values('A')).toEqual([104, 33, 34, 106])
    // the well-known "PJJ123C" example (Wikipedia) uses start A, so its check symbol is 54; with start B (104) the same sum is one more
    expect(code128Values('PJJ123C')).toEqual([104, 48, 42, 42, 17, 18, 19, 35, 55, 106])
  })
  it('draws bars inside its own width, in order, and refuses what it cannot encode', () => {
    const { bars, width } = code128('RB-10458')
    expect(bars.length).toBe(3 + 8 * 3 + 3 + 4) // the start, eight characters, the check symbol and the stop have three bars each, the stop four
    expect(bars.every((b, i) => b.x + b.width <= width && (i === 0 || b.x > (bars[i - 1]?.x ?? 0)))).toBe(true)
    expect(() => code128('tab\there')).toThrow()
    expect(() => code128('é')).toThrow()
  })
})

describe('the tracking paste of a bulk dispatch', () => {
  it('reads an order number and a tracking number from each line, split by comma, tab or spaces', () => {
    expect(parseTracking('RB-10458, TCS-1\nrb-10459\tTCS-2\nRB-10460 TCS 3')).toEqual({
      rows: [
        { orderNumber: 'RB-10458', trackingNumber: 'TCS-1' },
        { orderNumber: 'RB-10459', trackingNumber: 'TCS-2' },
        { orderNumber: 'RB-10460', trackingNumber: 'TCS 3' },
      ],
      bad: [],
    })
  })
  it('names a line it cannot read and ignores blank ones', () => {
    expect(parseTracking('\nRB-10458\nhello world\n  \nRB-1, X')).toEqual({ rows: [{ orderNumber: 'RB-1', trackingNumber: 'X' }], bad: ['RB-10458', 'hello world'] })
  })
})

describe('phone links', () => {
  it('makes tel and wa.me links from a whole mobile number, and none from a masked one', () => {
    expect(isWholePhone('0300 1234567')).toBe(true)
    expect(isWholePhone('0300 ••••567')).toBe(false)
    expect(telLink('0300 1234567')).toBe('tel:03001234567')
    expect(waLink('0300 1234567')).toBe('https://wa.me/923001234567')
    expect(waLink('+92 300 1234567', 'Hi there')).toBe('https://wa.me/923001234567?text=Hi%20there')
    expect(waLink('0300 ••••567')).toBeUndefined()
    expect(waLink('12345')).toBeUndefined()
  })
})

describe('waiting times', () => {
  const now = Date.parse('2026-10-05T12:00:00Z')
  it('reads as minutes, hours or days', () => {
    expect(ageText('2026-10-05T11:40:00Z', now)).toBe('20 min')
    expect(ageText('2026-10-05T09:00:00Z', now)).toBe('3 h')
    expect(ageText('2026-10-01T12:00:00Z', now)).toBe('4 d')
  })
  it('turns warning after 2 hours and danger after 12, only for orders still to confirm', () => {
    expect(ageTone('pending_confirmation', '2026-10-05T11:00:00Z', now)).toBe('neutral')
    expect(ageTone('pending_confirmation', '2026-10-05T09:30:00Z', now)).toBe('warning')
    expect(ageTone('pending_confirmation', '2026-10-04T23:00:00Z', now)).toBe('danger')
    expect(ageTone('confirmed', '2026-10-01T00:00:00Z', now)).toBe('neutral')
  })
})

describe('the timeline wording', () => {
  it('says what happened in one line', () => {
    expect(describeEvent({ id: 'x', type: 'status_changed', toStatus: 'cancelled', actorType: 'staff', data: { reason: 'duplicate' }, createdAt: '2026-10-05T10:00:00Z' })).toBe('Status: cancelled: Duplicate order')
    expect(describeEvent({ id: 'x', type: 'status_changed', toStatus: 'dispatched', actorType: 'staff', data: { courier: 'TCS', trackingNumber: 'T1' }, createdAt: '2026-10-05T10:00:00Z' })).toBe('Status: dispatched with TCS, tracking T1')
    expect(describeEvent({ id: 'x', type: 'something_new', actorType: 'system', createdAt: '2026-10-05T10:00:00Z' })).toBe('Something new')
  })
})
