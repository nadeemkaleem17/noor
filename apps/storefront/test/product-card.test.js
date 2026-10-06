// M5-02: which badge a product card shows (plan/06-storefront/03-plp-search.md section 3). Pure.
import { describe, expect, it } from 'vitest'
import { badgeOf } from '../app/features/catalog/product-card'

const base = { priceFrom: { amount: 600000, currency: 'PKR' }, badges: [], stockStatus: 'in_stock' }
const card = (/** @type {object} */ over) => /** @type {never} */ ({ ...base, ...over })

describe('the one badge of a card', () => {
  it('shows nothing when there is nothing to say', () => {
    expect(badgeOf(card({}))).toBeUndefined()
  })

  it('sold out beats everything, and is also known from the stock status alone', () => {
    expect(badgeOf(card({ badges: ['new', 'sale', 'sold_out'] }))).toEqual({ name: 'sold_out' })
    expect(badgeOf(card({ stockStatus: 'sold_out', badges: ['new'] }))).toEqual({ name: 'sold_out' })
  })

  it('a sale shows how much is off, worked out from the two prices', () => {
    expect(badgeOf(card({ badges: ['sale', 'new'], compareAtFrom: { amount: 800000, currency: 'PKR' } }))).toEqual({ name: 'sale', percent: 25 })
    expect(badgeOf(card({ badges: ['sale'], priceFrom: { amount: 699000, currency: 'PKR' }, compareAtFrom: { amount: 849000, currency: 'PKR' } }))).toEqual({ name: 'sale', percent: 18 })
  })

  it('a sale with no real saving is not a sale; the next badge is used', () => {
    expect(badgeOf(card({ badges: ['sale', 'new'], compareAtFrom: { amount: 600000, currency: 'PKR' } }))).toEqual({ name: 'new' })
    expect(badgeOf(card({ badges: ['sale'] }))).toBeUndefined()
  })

  it('then made to order, limited, new, bestseller, in that order', () => {
    expect(badgeOf(card({ badges: ['bestseller', 'new', 'limited', 'made_to_order'] }))).toEqual({ name: 'made_to_order' })
    expect(badgeOf(card({ badges: ['bestseller', 'new', 'limited'] }))).toEqual({ name: 'limited' })
    expect(badgeOf(card({ badges: ['bestseller', 'new'] }))).toEqual({ name: 'new' })
    expect(badgeOf(card({ badges: ['bestseller'] }))).toEqual({ name: 'bestseller' })
  })
})
