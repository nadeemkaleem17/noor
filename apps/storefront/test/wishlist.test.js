// M5-08: how the wishlist cookie is read and changed (plan/06-storefront/07-account-wishlist.md section 3). Pure.
import { describe, expect, it } from 'vitest'
import { parseWishlist, serializeWishlist, toggled, WISHLIST_MAX } from '../app/lib/wishlist'

const id = (/** @type {number} */ n) => `0192f5aa-0000-7000-8000-${String(n).padStart(12, '0')}`

describe('reading the cookie', () => {
  it('gives the ids in it, once each, in order, and nothing else', () => {
    expect(parseWishlist(`${id(1)},garbage,${id(2)},${id(1)},,12,<script>`)).toEqual([id(1), id(2)])
    expect(parseWishlist(` ${id(3).toUpperCase()} `)).toEqual([id(3)])
  })
  it('an empty or missing cookie is an empty list', () => {
    expect(parseWishlist(undefined)).toEqual([])
    expect(parseWishlist('')).toEqual([])
    expect(parseWishlist(null)).toEqual([])
  })
  it('a hand-edited cookie with five hundred ids is cut at one hundred, and a huge one of rubbish costs nothing', () => {
    const many = Array.from({ length: 500 }, (_, i) => id(i + 1)).join(',')
    expect(parseWishlist(many)).toHaveLength(WISHLIST_MAX)
    expect(parseWishlist(many)[0]).toBe(id(1))
    expect(parseWishlist('x,'.repeat(100_000))).toEqual([])
  })
})

describe('saving and taking away', () => {
  it('saving puts the product first; saving it again takes it out', () => {
    expect(toggled([id(1), id(2)], id(3))).toEqual([id(3), id(1), id(2)])
    expect(toggled([id(3), id(1), id(2)], id(1))).toEqual([id(3), id(2)])
  })
  it('the hundred and first drops the oldest', () => {
    const full = Array.from({ length: 100 }, (_, i) => id(i + 1))
    const next = toggled(full, id(200))
    expect(next).toHaveLength(100)
    expect(next[0]).toBe(id(200))
    expect(next).not.toContain(id(100))
  })
  it('is written back as ids with commas', () => {
    expect(serializeWishlist([id(1), id(2)])).toBe(`${id(1)},${id(2)}`)
    expect(serializeWishlist([])).toBe('')
  })
})
