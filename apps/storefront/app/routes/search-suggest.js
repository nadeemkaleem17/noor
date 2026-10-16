import { data } from 'react-router'
import { api } from '~/lib/api.server'
import { cacheControl } from '~/lib/cache'
import { localeOfPath } from '~/lib/locale'

// What the search box offers while someone types (plan/06-storefront/11-storefront-v2.md section 5.2). The browser talks to this server only, so this is the way to the API's
// `catalog.suggest`. Nothing is kept: the key space is whatever people type.
/** @param {import('./+types/search-suggest').Route.LoaderArgs} props */
export async function loader({ request }) {
  const url = new URL(request.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  const headers = { 'Cache-Control': cacheControl.private }
  if (q.length < 2 || q.length > 80) return data({ products: [], total: 0, categories: [], collections: [] }, { headers })
  const found = await api('catalog.suggest', { query: { q, locale: localeOfPath(url.pathname) } }).catch(() => undefined)
  return found ? data(found, { headers }) : data({ error: 'unavailable' }, { status: 503, headers })
}
