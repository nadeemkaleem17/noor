import { data } from 'react-router'
import { api } from '~/lib/api.server'
import { cacheControl } from '~/lib/cache'

// The cities the shop delivers to, each with what delivery there costs and how long it takes: for the product page's "check your city" (plan/06-storefront/11-storefront-v2.md section 5.4).
// It is loaded only when a visitor asks, so the page itself stays light. Nothing here belongs to a visitor, so a cache may keep it.
export async function loader() {
  const found = await api('shipping.listCities').catch(() => undefined)
  if (!found) return data({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': cacheControl.private } })
  return data(
    { items: found.items.flatMap((c) => (c.delivery ? [{ id: c.id, name: c.name, delivery: c.delivery }] : [])) },
    { headers: { 'Cache-Control': cacheControl.listing } },
  )
}
