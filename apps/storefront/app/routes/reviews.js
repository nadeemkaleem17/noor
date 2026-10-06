import { data } from 'react-router'
import { api } from '~/lib/api.server'
import { cacheControl } from '~/lib/cache'

// More reviews of a product, for the page's "Load more" (plan/06-storefront/04-pdp.md section 9). Not a page: the answer is the reviews as data, or nothing when they cannot be had.
/** @param {import('./+types/reviews').Route.LoaderArgs} props */
export async function loader({ params, request }) {
  const cursor = new URL(request.url).searchParams.get('cursor') ?? undefined
  const found = await api('reviews.listForProduct', { params: { id: params.id ?? '' }, query: { limit: 5, ...(cursor ? { cursor } : {}) } }).catch(() => undefined)
  return data(found ?? {}, { headers: { 'Cache-Control': found ? cacheControl.listing : cacheControl.private } })
}
