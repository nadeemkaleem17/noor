import { describe, expect, it } from 'vitest'
import { PkMobile, formatPkMobileLocal, maskPkMobile, normalizePkMobile } from '../src/phone.js'

describe('normalizePkMobile', () => {
  it.each(['0300 1234567', '03001234567', '3001234567', '+92 300 1234567', '+923001234567', '0092-300-1234567', '(0300) 123 4567', '923001234567'])(
    'accepts %s',
    (input) => expect(normalizePkMobile(input)).toBe('+923001234567'),
  )
  it.each(['051 1234567', '0511234567', '', 'abc', '0300123456', '030012345678', '+14155550123', '2001234567'])('rejects %s', (input) =>
    expect(normalizePkMobile(input)).toBeNull(),
  )
})

describe('PkMobile schema', () => {
  it('outputs E.164 and reports phone_invalid for a landline', () => {
    expect(PkMobile.parse('0300 1234567')).toBe('+923001234567')
    const r = PkMobile.safeParse('051 1234567')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.message).toBe('phone_invalid')
  })
})

describe('display helpers', () => {
  it('formats and masks', () => {
    expect(formatPkMobileLocal('+923001234567')).toBe('0300 1234567')
    expect(maskPkMobile('+923001234567')).toBe('0300 ••••567')
  })
})
