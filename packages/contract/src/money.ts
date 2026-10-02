// Money is integer paisa everywhere (ADR-0013). Arithmetic goes through these helpers only.
// Helpers work on bare integers (paisa); `Money` is the JSON boundary shape.
// BigInt inside so intermediate products never lose precision (amount x bps can pass 2^53).
import { z } from 'zod'

export const Money = z.strictObject({ amount: z.number().int().safe(), currency: z.literal('PKR') })
export type Money = z.infer<typeof Money>

export const money = (amount: number): Money => ({ amount: minor(amount), currency: 'PKR' })

/** Asserts a safe integer number of paisa and returns it. */
export function minor(n: number): number {
  if (!Number.isSafeInteger(n)) throw new RangeError(`not an integer amount of paisa: ${n}`)
  return n
}

const back = (n: bigint): number => {
  const r = Number(n)
  if (!Number.isSafeInteger(r)) throw new RangeError('money result is outside the safe integer range')
  return r
}

export const add = (...xs: number[]): number => back(xs.reduce((a, x) => a + BigInt(minor(x)), 0n))
export const sub = (a: number, b: number): number => back(BigInt(minor(a)) - BigInt(minor(b)))
export const mulInt = (amount: number, n: number): number => back(BigInt(minor(amount)) * BigInt(minor(n)))

/** Integer division rounded half away from zero (the ADR-0013 rule). */
function roundDiv(num: bigint, den: bigint): bigint {
  const q = num / den
  const r = num % den
  const twice = (r < 0n ? -r : r) * 2n
  if (twice < den) return q
  return num < 0n ? q - 1n : q + 1n
}

/** `bps` basis points of `amount` (12.5% = 1250), rounded half away from zero to the paisa. */
export const percentOf = (amount: number, bps: number): number =>
  back(roundDiv(BigInt(minor(amount)) * BigInt(minor(bps)), 10000n))

/**
 * Splits `total` across `weights` so the parts sum exactly to `total` (largest remainder;
 * ties go to the earlier index). Used for promo discounts spread over order lines.
 */
export function allocate(total: number, weights: readonly number[]): number[] {
  if (minor(total) < 0) throw new RangeError('allocate: total must not be negative')
  if (weights.length === 0) throw new RangeError('allocate: no weights')
  const w = weights.map((x) => {
    if (minor(x) < 0) throw new RangeError('allocate: weights must not be negative')
    return BigInt(x)
  })
  const sum = w.reduce((a, b) => a + b, 0n)
  if (sum === 0n) throw new RangeError('allocate: weights sum to zero')
  const t = BigInt(total)
  const parts = w.map((x) => (t * x) / sum)
  const rems = w.map((x) => (t * x) % sum)
  let left = Number(t - parts.reduce((a, b) => a + b, 0n))
  const order = rems.map((r, i) => ({ r, i })).sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1))
  for (const { i } of order) {
    if (left === 0) break
    parts[i] = (parts[i] ?? 0n) + 1n
    left--
  }
  return parts.map(back)
}

/** Parses text a person typed ("6,990", "Rs. 6990.5") into paisa, or null. Never uses floats. */
export function parseRupees(text: string): number | null {
  const s = text.replace(/^\s*(rs\.?|pkr)\s*/i, '').replace(/[,\s]/g, '')
  const m = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(s)
  if (!m) return null
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0')
}

/** Paisa to a decimal string for machine formats (JSON-LD, analytics): 699000 -> "6990.00". No float division. */
export function moneyToDecimalString(m: Money | number): string {
  const a = typeof m === 'number' ? minor(m) : m.amount
  const abs = Math.abs(a)
  return `${a < 0 ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}
