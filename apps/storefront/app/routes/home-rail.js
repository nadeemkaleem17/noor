import { data } from 'react-router'
import { api } from '~/lib/api.server'
import { cacheControl } from '~/lib/cache'
import { localeOfPath } from '~/lib/locale'

// One tab of the home page's "New in" and "Bestsellers" (plan/06-storefront/13-navigation-and-categories.md section 5): the eight pieces of a top category, newest or best selling.
// The tab is also an ordinary link to the category's own page, so without JavaScript nothing here is needed. Nothing belongs to a visitor, so a cache may keep it.
const sorts = new Set(['newest', 'bestselling'])

/** @param {import('./+types/home-rail').Route.LoaderArgs} props */
export async function loader({ request }) {
  const url = new URL(request.url)
  const sort = url.searchParams.get('sort') ?? ''
  const category = url.searchParams.get('category') ?? ''
  if (!sorts.has(sort) || !/^[a-z0-9-]{1,80}$/.test(category)) throw new Response('Bad Request', { status: 400 })
  const found = await api('catalog.listProducts', { query: { category, sort: /** @type {'newest' | 'bestselling'} */ (sort), limit: 8, facets: false, locale: localeOfPath(url.pathname) } }).catch(() => undefined)
  return found ? data({ items: found.items }, { headers: { 'Cache-Control': cacheControl.listing } }) : data({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': cacheControl.private } })
}
