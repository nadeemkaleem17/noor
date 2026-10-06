import { data } from 'react-router'
import { api } from '~/lib/api.server'
import { cacheControl } from '~/lib/cache'
import { localeOfPath } from '~/lib/locale'

// The products a browser looked at last, for the product page (plan/06-storefront/04-pdp.md section 9). The browser says which (`ids`); nothing here knows the visitor, so nothing is kept.
/** @param {import('./+types/recent').Route.LoaderArgs} props */
export async function loader({ request }) {
  const url = new URL(request.url)
  const ids = (url.searchParams.get('ids') ?? '').split(',').filter((id) => /^[0-9a-f-]{36}$/.test(id)).slice(0, 8)
  const found = ids.length ? await api('catalog.listProducts', { query: { ids, limit: 8, facets: false, locale: localeOfPath(url.pathname) } }).catch(() => undefined) : undefined
  // the API gives them in its own order; the browser's order (latest first) is kept
  const items = found ? ids.flatMap((id) => found.items.filter((p) => p.id === id)) : []
  return data({ items }, { headers: { 'Cache-Control': cacheControl.private } })
}
