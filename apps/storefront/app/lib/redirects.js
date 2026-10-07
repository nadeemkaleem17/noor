// Addresses the storefront sends somewhere else (plan/06-storefront/01-sitemap.md sections 4 and 5): the old shop's URLs, a clean form of every URL, and the one
// canonical form of a listing's query. Pure, so each rule is a test; the root loader turns the answer into a 301.
import { pagePath } from './paths'

/** What the old categories were called, found by name or by handle. @typedef {{ handle: string, name: string, children: Category[] }} Category */

const same = (/** @type {string} */ a, /** @type {string} */ b) => a.trim().toLowerCase() === b.trim().toLowerCase()
/** @param {Category[]} list @param {string} name */
const named = (list, name) => list.find((c) => same(c.name, name) || same(c.handle, name))

/**
 * Where an old or untidy address should go, or `undefined` when it is fine as it is. A product by its old id needs the API: that answer is `{ productId }`.
 * @param {URL} url
 * @param {Category[]} [categories] the category tree, needed only for `/shop?category=`
 * @returns {{ to: string } | { productId: string } | undefined}
 */
export function redirectFor(url, categories = []) {
  const path = pagePath(url)
  const q = url.searchParams

  if (path === '/shop' || path === '/shop/') {
    if (q.get('tag') === 'new') return { to: '/new' }
    if (q.get('tag') === 'sale') return { to: '/sale' }
    if (q.has('q')) return { to: `/search?q=${encodeURIComponent(q.get('q') ?? '')}` }
    const category = q.get('category')
    if (category) {
      const top = named(categories, category)
      const sub = q.get('sub')
      const child = top && sub ? named(top.children, sub) : undefined
      const found = child ?? top
      return { to: found ? `/c/${found.handle}` : `/search?q=${encodeURIComponent(sub ?? category)}` }
    }
    return { to: '/new' }
  }
  if (path === '/track-order') return { to: '/track' }
  if (path.startsWith('/order-confirmation/')) return { to: '/track' } // the old ids are not tokens
  if (path === '/pages/size-guide') return { to: '/size-guide' }
  const product = /^\/product\/([^/]+)\/?$/.exec(path)
  if (product) return { productId: decodeURIComponent(product[1] ?? '') }

  // lower case and no trailing slash (the query stays as it is). An order's link is a token, and a token is case-sensitive: only its trailing slash goes.
  const keepCase = /^(\/ur)?\/orders\//.test(path)
  const bare = path.replace(/\/+$/, '')
  const clean = path.length > 1 ? (keepCase ? bare : bare.toLowerCase()) : path
  if (clean !== path) return { to: clean + url.search }
  return undefined
}

/** The parameters of a listing, in the order they are written (section 5). Anything else is dropped. */
export const listingParams = /** @type {const} */ (['attr', 'color', 'cursor', 'inStock', 'kind', 'priceMax', 'priceMin', 'q', 'size', 'sort'])

/**
 * The one form of a listing's query: known parameters only, alphabetical, the values of a parameter sorted, `utm_*` and the like gone.
 * A request in any other form is sent here, so a CDN keeps a small number of cache entries.
 * @param {URLSearchParams} search
 * @param {readonly string[]} [allowed] parameter names, `attr.<code>` also allowed when `attr` is listed
 * @returns {string} `?a=1&b=2`, or an empty string
 */
export function canonicalQuery(search, allowed = listingParams) {
  const known = (/** @type {string} */ key) => allowed.includes(key) || (allowed.includes('attr') && key.startsWith('attr.'))
  /** @type {string[]} */
  const parts = []
  for (const key of [...new Set(search.keys())].filter(known).sort()) {
    // a search text is one value: its commas are part of it
    const values = key === 'q' ? [search.get(key)?.trim() ?? ''].filter(Boolean) : search.getAll(key).flatMap((v) => v.split(',')).filter(Boolean).sort()
    if (values.length) parts.push(`${encodeURIComponent(key)}=${values.map(encodeURIComponent).join(',')}`)
  }
  return parts.length ? `?${parts.join('&')}` : ''
}
