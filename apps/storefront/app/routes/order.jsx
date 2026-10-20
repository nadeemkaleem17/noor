import { data, redirect, useActionData, useLoaderData } from 'react-router'
import { privateMeta } from '~/features/seo/meta'
import { OrderPage } from '~/features/order/order-page'
import { cacheControl } from '~/lib/cache'
import { buyAgain, cartCookie } from '~/lib/cart.server'
import { loadOrder, orderAction } from '~/lib/orders.server'
import { loadShell } from '~/lib/shell.server'
import { localeOfPath } from '~/lib/locale'
import { localePath } from '~/lib/paths'

// the order of one customer, reached by its token: never kept, never indexed (the address is a key, so no referrer either: see security.server.js)
export const headers = /** @type {import('./+types/order').Route.HeadersFunction} */ (() => ({ 'Cache-Control': cacheControl.private, 'X-Robots-Tag': 'noindex' }))
export const meta = /** @type {import('./+types/order').Route.MetaFunction} */ (({ matches }) => privateMeta(matches, 'order'))

/**
 * The order as the API sends it, masked, read again on every visit (plan/06-storefront/06-orders-tracking.md section 4.4).
 * @param {import('./+types/order').Route.LoaderArgs} props
 */
export async function loader({ params, request }) {
  const token = params.token ?? ''
  const url = new URL(request.url)
  const { config } = await loadShell(localeOfPath(url.pathname))
  return data({ order: await loadOrder(token), token, whatsapp: config.contact.whatsapp, placed: url.searchParams.get('placed') === '1', reviewed: url.searchParams.get('reviewed') === '1' })
}

/** What the customer may do with the order. The loader runs again afterwards, so the page shows the new state. @param {import('./+types/order').Route.ActionArgs} props */
export async function action({ params, request }) {
  const form = await request.formData()
  if (form.get('intent') === 'buyAgain') {
    // every line that is still sold goes into the bag, then the bag is shown; nothing sold any more is an answer on this page
    const order = await loadOrder(params.token ?? '')
    const added = await buyAgain(request, order.lines.flatMap((l) => (l.variantId ? [{ variantId: l.variantId, quantity: l.quantity }] : [])))
    if (added.added === 0 || !added.cartToken) return data({ ok: false, error: 'buyAgainNone' })
    throw redirect(localePath(localeOfPath(new URL(request.url).pathname), '/cart'), { headers: { 'Set-Cookie': cartCookie(added.cartToken) } })
  }
  const result = await orderAction(params.token ?? '', form)
  return data(result)
}

export default function Order() {
  const { order, token, whatsapp, placed, reviewed } = useLoaderData()
  const result = useActionData()
  return <OrderPage order={order} token={token} whatsapp={whatsapp} placed={placed} reviewed={reviewed} requested={result?.ok ? result.requested : undefined} error={result && !result.ok ? result.error : undefined} />
}
