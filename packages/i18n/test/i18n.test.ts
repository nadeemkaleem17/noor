import { describe, expect, it } from 'vitest'
import { createI18n, dirOf, formatDate, formatMoney, formatNumber, intlTag, isLocale, supportedLocales } from '../src'

const rs = (s: string) => s.replace(/\s/g, ' ') // Intl uses a no-break space

describe('locale helpers', () => {
  it('knows the supported locales and their direction', () => {
    expect(supportedLocales).toEqual(['en', 'ur'])
    expect(isLocale('ur')).toBe(true)
    expect(isLocale('fr')).toBe(false)
    expect(dirOf('en')).toBe('ltr')
    expect(dirOf('ur')).toBe('rtl')
    expect(intlTag('ur')).toBe('ur-PK-u-nu-latn')
  })
})

describe('createI18n', () => {
  it('translates per locale, with ICU plurals', () => {
    const en = createI18n('en')
    const ur = createI18n('ur')
    expect(en.t('storefront:home.title')).toBe('Welcome to Rubaya')
    expect(ur.t('storefront:home.title')).toBe('روبایا میں خوش آمدید')
    expect(en.t('storefront:home.items', { count: 1 })).toBe('1 item in your bag')
    expect(en.t('storefront:home.items', { count: 3 })).toBe('3 items in your bag')
    expect(ur.t('storefront:home.items', { count: 3 })).toContain('3 چیزیں')
  })

  it('falls back to English for a key missing in Urdu, and returns the key for an unknown one', () => {
    const ur = createI18n('ur')
    expect(ur.t('common:close', { lng: 'xx' })).toBe('Close')
    expect(ur.t('no.such.key')).toBe('no.such.key')
  })

  it('does not share state between instances (one per request)', () => {
    const a = createI18n('en')
    createI18n('ur')
    expect(a.language).toBe('en')
  })

  it('has the same keys in every locale for the shipped namespaces', () => {
    const en = createI18n('en')
    const ur = createI18n('ur')
    for (const ns of ['common', 'storefront', 'errors']) {
      expect(Object.keys(ur.getResourceBundle('ur', ns) as object).sort()).toEqual(Object.keys(en.getResourceBundle('en', ns) as object).sort())
    }
  })
})

describe('formatMoney', () => {
  const m = (amount: number) => ({ amount, currency: 'PKR' as const })
  it('formats paisa as rupees with Western digits', () => {
    expect(rs(formatMoney(m(1775920), 'en'))).toBe('Rs 17,759.20')
    expect(rs(formatMoney(m(699000), 'en'))).toBe('Rs 6,990.00')
    expect(formatMoney(m(1775920), 'ur')).toMatch(/17,759\.20/)
  })
  it('hides decimals and rounds for display only', () => {
    expect(rs(formatMoney(m(1775920), 'en', { showDecimals: false, rounding: 'nearest' }))).toBe('Rs 17,759')
    expect(rs(formatMoney(m(1775950), 'en', { showDecimals: false, rounding: 'nearest' }))).toBe('Rs 17,760')
    expect(rs(formatMoney(m(1775901), 'en', { showDecimals: false, rounding: 'up' }))).toBe('Rs 17,760')
    expect(rs(formatMoney(m(-1775950), 'en', { showDecimals: false, rounding: 'nearest' }))).toBe('-Rs 17,760')
  })
  it('is exact for amounts a float rupee would lose', () => {
    expect(rs(formatMoney(m(9007199254740991), 'en'))).toBe('Rs 90,071,992,547,409.91')
  })
})

describe('formatNumber and formatDate', () => {
  it('formats numbers', () => {
    expect(formatNumber(1234567.5, 'en')).toBe('1,234,567.5')
    expect(formatNumber(1234567, 'ur')).toBe('1,234,567')
  })
  it('formats dates in Pakistan time', () => {
    // 19:30 UTC on 31 Dec is already 1 Jan in Karachi (UTC+5)
    expect(formatDate('2026-12-31T19:30:00Z', 'en')).toBe('01-Jan-2027')
    expect(formatDate('2026-12-31T19:30:00Z', 'en', { timeStyle: 'short' })).toMatch(/12:30/)
  })
})
