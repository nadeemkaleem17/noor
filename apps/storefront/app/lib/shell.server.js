// What every page needs and nobody's own: the store's settings, its announcement and menus, its categories (plan/06-storefront/01-sitemap.md section 3).
// Cached in this process for 30 seconds, so a busy shop asks the API once for them and not once per visit. Nothing here may depend on who is asking.
import { api } from './api.server'

const TTL_MS = 30_000
/** @type {Map<string, { at: number, value: Promise<unknown> }>} */
const memory = new Map()

/** @template T @param {string} key @param {() => Promise<T>} load @returns {Promise<T>} */
export function cached(key, load) {
  const hit = memory.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return /** @type {Promise<T>} */ (hit.value)
  const value = load()
  memory.set(key, { at: Date.now(), value })
  value.catch(() => memory.delete(key)) // a failure is not remembered
  return value
}

export const clearShellCache = () => memory.clear()

/** The API did not answer: a short, uncached 503 that the error page shows (section 6). */
const unavailable = () => new Response('Service unavailable', { status: 503, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' } })

/**
 * @param {import('@noor/i18n').Locale} locale
 * @param {string} [preview] a preview token: the home page is then the draft, read fresh and never remembered; a token the API refuses leaves the live page
 */
export async function loadShell(locale, preview) {
  try {
    const draft = preview ? await api('content.getHome', { query: { locale, preview } }).catch(() => undefined) : undefined
    const [config, home, main, footer, categories, collections, offers] = await Promise.all([
      cached(`config:${locale}`, () => api('store.getConfig', { query: { locale } })),
      draft ?? cached(`home:${locale}`, () => api('content.getHome', { query: { locale } })),
      cached(`menu:main:${locale}`, () => api('content.getMenu', { params: { handle: 'main' }, query: { locale } })),
      cached(`menu:footer:${locale}`, () => api('content.getMenu', { params: { handle: 'footer' }, query: { locale } })),
      cached(`categories:${locale}`, () => api('catalog.listCategories', { query: { locale } })),
      cached(`collections:${locale}`, () => api('catalog.listCollections', { query: { locale, featured: true, limit: 12 } })),
      // the Offers page is linked from the footer only while there is an offer to show; a failure here is not a reason to lose the shop
      cached('offers', () => api('promos.listPublic')).catch(() => ({ items: [] })),
    ])
    return { preview: Boolean(draft), config, home, menus: { main: main.items, footer: footer.items }, categories: categories.items, collections: collections.items, hasOffers: offers.items.length > 0 }
  } catch (e) {
    console.error('shell data could not be loaded', e)
    throw unavailable()
  }
}
