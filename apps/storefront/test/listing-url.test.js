// M5-03: the address of a listing with one thing changed (plan/06-storefront/03-plp-search.md sections 4 and 5). Pure.
import { describe, expect, it } from 'vitest'
import { canonicalQuery } from '../app/lib/redirects'
import { clearAllHref, filterCount, listingHref } from '../app/lib/listing-url'

const q = (/** @type {string} */ s) => new URLSearchParams(s)

describe('listingHref', () => {
  it('sets a parameter, in the canonical order, and always starts from the first page', () => {
    expect(listingHref('/c/lawn', q('size=M&cursor=abc'), { sort: 'newest' })).toBe('/c/lawn?size=M&sort=newest')
  })

  it('takes one value out of a list, and the whole parameter when it was the last', () => {
    expect(listingHref('/c/lawn', q('size=L,M,S'), {}, { remove: ['size', 'M'] })).toBe('/c/lawn?size=L,S')
    expect(listingHref('/c/lawn', q('size=M&sort=newest'), {}, { remove: ['size', 'M'] })).toBe('/c/lawn?sort=newest')
  })

  it('removes a parameter with null: a price range is two of them', () => {
    expect(listingHref('/sale', q('priceMin=1&priceMax=2&kind=stitched'), { priceMin: null, priceMax: null })).toBe('/sale?kind=stitched')
  })

  it('keeps the search text as one value, commas and all', () => {
    expect(listingHref('/search', q('q=red%2C+blue&sort=price_asc'), { sort: 'newest' })).toBe('/search?q=red%2C%20blue&sort=newest')
  })
})

describe('canonicalQuery with a search text', () => {
  it('trims it and never splits it', () => {
    expect(canonicalQuery(q('q=%20shalwar%20kameez%20,x'))).toBe('?q=shalwar%20kameez%20%2Cx')
    expect(canonicalQuery(q('q=%20%20'))).toBe('')
  })
})

describe('filterCount and clearAllHref', () => {
  it('counts the chosen values, a price range once, and not the sort, the search or the page', () => {
    expect(filterCount(q('size=M,L&attr.fabric=silk&priceMin=1&priceMax=2&sort=newest&q=x&cursor=y'))).toBe(4)
    expect(filterCount(q('priceMax=2'))).toBe(1)
    expect(filterCount(q(''))).toBe(0)
  })

  it('clearing keeps the search text and the sort', () => {
    expect(clearAllHref('/search', q('q=lawn&size=M&sort=newest&cursor=z'))).toBe('/search?q=lawn&sort=newest')
    expect(clearAllHref('/c/lawn', q('size=M'))).toBe('/c/lawn')
  })
})
