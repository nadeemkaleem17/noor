// The address of a listing with one thing changed (plan/06-storefront/03-plp-search.md sections 4 to 6). Always the canonical form, and always without `cursor`:
// a new filter or sort starts again from the first page. Pure, so it is tested without a browser.
import { canonicalQuery } from './redirects'

/**
 * @param {string} path the listing's path, with the language in front
 * @param {URLSearchParams} search the current query
 * @param {Record<string, string | null>} [change] a parameter to set, or `null` to remove it
 * @param {{ remove?: [string, string] }} [options] `remove: [key, value]` takes one value out of a comma list
 * @returns {string}
 */
export function listingHref(path, search, change = {}, options = {}) {
  const next = new URLSearchParams(search)
  next.delete('cursor')
  if (options.remove) {
    const [key, value] = options.remove
    const kept = next.getAll(key).flatMap((v) => v.split(',')).filter((v) => v && v !== value)
    next.delete(key)
    if (kept.length) next.set(key, kept.join(','))
  }
  for (const [key, value] of Object.entries(change)) {
    if (value === null) next.delete(key)
    else next.set(key, value)
  }
  return path + canonicalQuery(next)
}

/** How many filters are on: every chosen value of every parameter except the sort, the search text and the page. @param {URLSearchParams} search */
export function filterCount(search) {
  let n = 0
  for (const key of new Set(search.keys())) {
    if (key === 'sort' || key === 'q' || key === 'cursor' || key === 'chunk') continue
    if (key === 'priceMin' || key === 'priceMax') {
      n += key === 'priceMin' || !search.has('priceMin') ? 1 : 0 // a price range counts once
      continue
    }
    n += search.getAll(key).flatMap((v) => v.split(',')).filter(Boolean).length
  }
  return n
}

/** "Clear all": the listing with no filter, keeping the search text and the sort. @param {string} path @param {URLSearchParams} search */
export function clearAllHref(path, search) {
  const keep = new URLSearchParams()
  for (const k of ['q', 'sort']) if (search.has(k)) keep.set(k, search.get(k) ?? '')
  return path + canonicalQuery(keep)
}
