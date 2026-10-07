// Cookies that only the browser reads and writes (plan/06-storefront/07-account-wishlist.md section 4): the saved products, the closed notices. A page that a cache keeps must not hold what
// they say, so the server's reading is always "nothing" and the browser fills it in after hydration (`useSyncExternalStore` with `() => ''` for the server).

/** @type {Set<() => void>} */
const listeners = new Set()

/** @param {() => void} callback */
export const subscribeCookies = (callback) => {
  listeners.add(callback)
  return () => void listeners.delete(callback)
}

/** The whole cookie string of the page; the server has none. */
export const readCookies = () => document.cookie

/** @param {string} cookies @param {string} name @returns {string | undefined} */
export function cookieIn(cookies, name) {
  const found = cookies.split('; ').find((c) => c.startsWith(`${name}=`))
  if (found === undefined) return undefined
  try {
    return decodeURIComponent(found.slice(name.length + 1))
  } catch {
    return undefined
  }
}

/**
 * Writes a cookie and tells every reader on the page. `Secure` where the page is on https (a browser refuses it elsewhere); never `HttpOnly`, the script has to read it.
 * @param {string} name @param {string} value @param {{ maxAge?: number }} [options] no `maxAge`: a session cookie
 */
export function writeCookie(name, value, options = {}) {
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax${options.maxAge !== undefined ? `; Max-Age=${options.maxAge}` : ''}${secure}`
  for (const notify of listeners) notify()
}
