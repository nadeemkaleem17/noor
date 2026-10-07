// The saved products of a visitor (plan/06-storefront/07-account-wishlist.md section 3): product ids in the cookie `nc_wishlist`, newest first, at most 100. Read both by the server (the
// wishlist page) and by the browser (the hearts and the badge), so the one reading of the cookie is here. Whatever a visitor's browser sends is only ever read as a list of ids: a
// hand-edited value gives the ids in it that look like ids, never an error.

export const WISHLIST_COOKIE = 'nc_wishlist'
export const WISHLIST_MAX = 100
/** A year, in seconds. */
export const WISHLIST_MAX_AGE = 31_536_000

const id = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** @param {string | undefined | null} raw @returns {string[]} the ids in it, once each, in order, at most 100 */
export function parseWishlist(raw) {
  if (!raw) return []
  const seen = new Set()
  /** @type {string[]} */
  const out = []
  for (const part of raw.slice(0, 100 * 37 + 200).split(',')) {
    const v = part.trim().toLowerCase()
    if (id.test(v) && !seen.has(v)) {
      seen.add(v)
      out.push(v)
      if (out.length === WISHLIST_MAX) break
    }
  }
  return out
}

/** @param {string[]} ids */
export const serializeWishlist = (ids) => ids.join(',')

/** Saving puts the product first and drops the oldest past the limit; saving again takes it out. @param {string[]} ids @param {string} product */
export function toggled(ids, product) {
  const p = product.toLowerCase()
  return ids.includes(p) ? ids.filter((x) => x !== p) : [p, ...ids].slice(0, WISHLIST_MAX)
}
