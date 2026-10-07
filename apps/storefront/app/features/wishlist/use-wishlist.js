import { useMemo, useSyncExternalStore } from 'react'
import { cookieIn, readCookies, subscribeCookies, writeCookie } from '~/lib/browser-cookie'
import { parseWishlist, serializeWishlist, toggled, WISHLIST_COOKIE, WISHLIST_MAX_AGE } from '~/lib/wishlist'

/** Saves or takes away one product: the cookie is written and every heart and the badge on the page change with it, with no request to the server. @param {string} product */
export function toggleSaved(product) {
  writeCookie(WISHLIST_COOKIE, serializeWishlist(toggled(parseWishlist(cookieIn(readCookies(), WISHLIST_COOKIE)), product)), { maxAge: WISHLIST_MAX_AGE })
}

/**
 * The visitor's saved product ids. The server (and the first render in the browser) says "none", so the HTML is the same for everyone and a cache may keep it; the saved ones are
 * marked after hydration (plan/06-storefront/07-account-wishlist.md section 3).
 */
export function useWishlist() {
  const cookies = useSyncExternalStore(subscribeCookies, readCookies, () => '')
  return useMemo(() => parseWishlist(cookieIn(cookies, WISHLIST_COOKIE)), [cookies])
}
