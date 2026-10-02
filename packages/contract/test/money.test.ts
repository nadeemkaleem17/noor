import { describe, expect, it } from 'vitest'
import { Money, add, allocate, money, moneyToDecimalString, mulInt, parseRupees, percentOf, sub } from '../src/money'

describe('percentOf (half away from zero, ADR-0013)', () => {
  it('matches the ADR example', () => {
    expect(percentOf(1775920, 1000)).toBe(177592)
  })
  it('matches DOC-09.6 section 6: 10% of two lines, discounts sum to 82246', () => {
    const a = percentOf(699000, 1000)
    const b = percentOf(123456, 1000) // 12345.6 -> 12346
    expect([a, b]).toEqual([69900, 12346])
    expect(add(a, b)).toBe(82246)
  })
  it('rounds .5 away from zero, both signs', () => {
    expect(percentOf(5, 1000)).toBe(1) // 0.5
    expect(percentOf(15, 1000)).toBe(2) // 1.5
    expect(percentOf(-5, 1000)).toBe(-1)
    expect(percentOf(4, 1000)).toBe(0) // 0.4
  })
  it('is exact where float maths is not', () => {
    // 9_007_199_254_740_000 paisa x 1250 bps overflows 2^53 as a Number product
    expect(percentOf(900_719_925_474_000, 1250)).toBe(112_589_990_684_250)
  })
})

describe('allocate (largest remainder)', () => {
  it('sums exactly to the total', () => {
    const parts = allocate(50000, [699000, 123456, 55555])
    expect(parts.reduce((a, b) => a + b, 0)).toBe(50000)
  })
  it('gives leftover paisa to the largest remainders, earlier index on a tie', () => {
    expect(allocate(10, [1, 1, 1])).toEqual([4, 3, 3])
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33])
    expect(allocate(0, [3, 7])).toEqual([0, 0])
  })
  it('handles zero weights and rejects invalid input', () => {
    expect(allocate(9, [0, 1, 0])).toEqual([0, 9, 0])
    expect(() => allocate(9, [0, 0])).toThrow()
    expect(() => allocate(-1, [1])).toThrow()
    expect(() => allocate(1, [])).toThrow()
    expect(() => allocate(1, [1.5])).toThrow()
  })
})

describe('integer helpers', () => {
  it('add, sub, mulInt', () => {
    expect(add(1, 2, 3)).toBe(6)
    expect(sub(10, 12)).toBe(-2)
    expect(mulInt(699000, 3)).toBe(2097000)
  })
  it('reject floats and unsafe results', () => {
    expect(() => add(0.1, 0.2)).toThrow(RangeError)
    expect(() => money(10.5)).toThrow(RangeError)
    expect(() => mulInt(Number.MAX_SAFE_INTEGER, 2)).toThrow(RangeError)
  })
})

describe('parseRupees', () => {
  it('parses typed amounts to paisa without floats', () => {
    expect(parseRupees('6990')).toBe(699000)
    expect(parseRupees('6,990')).toBe(699000)
    expect(parseRupees('Rs. 6,990.5')).toBe(699050)
    expect(parseRupees('1234.56')).toBe(123456)
    expect(parseRupees('0.07')).toBe(7)
    expect(parseRupees('0.1')).toBe(10)
  })
  it('returns null for anything else', () => {
    for (const bad of ['', 'abc', '-5', '12.345', '1e3', '12.', '.5']) expect(parseRupees(bad)).toBeNull()
  })
})

describe('moneyToDecimalString', () => {
  it('pads paisa instead of dividing', () => {
    expect(moneyToDecimalString(money(699000))).toBe('6990.00')
    expect(moneyToDecimalString(5)).toBe('0.05')
    expect(moneyToDecimalString(123456)).toBe('1234.56')
    expect(moneyToDecimalString(-150)).toBe('-1.50')
  })
})

describe('Money schema', () => {
  it('accepts integer PKR and rejects floats, other currencies and extra keys', () => {
    expect(Money.safeParse({ amount: 100, currency: 'PKR' }).success).toBe(true)
    expect(Money.safeParse({ amount: 10.5, currency: 'PKR' }).success).toBe(false)
    expect(Money.safeParse({ amount: 100, currency: 'USD' }).success).toBe(false)
    expect(Money.safeParse({ amount: 100, currency: 'PKR', x: 1 }).success).toBe(false)
  })
})
