import { data, useActionData, useLoaderData } from 'react-router'
import { OrderPage } from '~/features/order/order-page'
import { cacheControl } from '~/lib/cache'
import { loadOrder, orderAction } from '~/lib/orders.server'
import { loadShell } from '~/lib/shell.server'
import { localeOfPath } from '~/lib/locale'

// the order of one customer, reached by its token: never kept, never indexed (the address is a key, so no referrer either: see security.server.js)
export const headers = /** @type {import('./+types/order').Route.HeadersFunction} */ (() => ({ 'Cache-Control': cacheControl.private, 'X-Robots-Tag': 'noindex' }))
export const meta = /** @type {import('./+types/order').Route.MetaFunction} */ (() => [{ name: 'robots', content: 'noindex,nofollow' }])

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
  const result = await orderAction(params.token ?? '', await request.formData())
  return data(result)
}

export default function Order() {
  const { order, token, whatsapp, placed, reviewed } = useLoaderData()
  const result = useActionData()
  return <OrderPage order={order} token={token} whatsapp={whatsapp} placed={placed} reviewed={reviewed} error={result && !result.ok ? result.error : undefined} />
}
