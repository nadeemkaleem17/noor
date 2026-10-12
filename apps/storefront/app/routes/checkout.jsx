import { data, redirect, useActionData, useLoaderData } from 'react-router'
import { privateMeta } from '~/features/seo/meta'
import { CheckoutForm } from '~/features/checkout/checkout-form'
import { cacheControl } from '~/lib/cache'
import { clearCartCookie, getCart } from '~/lib/cart.server'
import { deliveryCities, placeOrder, quote, valuesOf } from '~/lib/checkout.server'
import { localeOfPath } from '~/lib/locale'
import { localePath } from '~/lib/paths'
import { loadShell } from '~/lib/shell.server'

// one visitor's, with their address in it: never kept by a cache, never indexed
export const headers = /** @type {import('./+types/checkout').Route.HeadersFunction} */ (() => ({ 'Cache-Control': cacheControl.private }))
export const meta = /** @type {import('./+types/checkout').Route.MetaFunction} */ (({ matches }) => privateMeta(matches, 'checkout'))

/**
 * The checkout page (plan/06-storefront/05-cart-checkout.md section 4): the cart as it is now, the cities the shop delivers to, the shop's extra fields and payment methods, and the
 * idempotency key of this checkout. An empty cart goes back to the cart.
 * @param {import('./+types/checkout').Route.LoaderArgs} props
 */
export async function loader({ request }) {
  const locale = localeOfPath(new URL(request.url).pathname)
  const cart = await getCart(request)
  if (!cart.lines.length) throw redirect(localePath(locale, '/cart'))
  const [{ config }, cities] = await Promise.all([loadShell(locale), deliveryCities()])
  return data({
    cart,
    cities,
    key: crypto.randomUUID(),
    // which cart and what it holds, as text: a stored key is used again only for the same cart (a new order starts a new cart)
    sig: `${cart.id ?? ''}:${cart.lines.map((l) => `${l.variantId}x${l.quantity}`).join('|')}`,
    extraFields: config.checkout.extraFields,
    marketing: config.checkout.marketingConsent,
    payments: config.payments,
    whatsapp: config.contact.whatsapp,
  })
}

/**
 * `intent=quote`: the cart priced for the chosen city and method. `intent=place`: the order. Whatever goes wrong gives the page back with what the visitor typed and the reason; only a placed
 * order leaves for the order page (and forgets the cart).
 * @param {import('./+types/checkout').Route.ActionArgs} props
 */
export async function action({ request }) {
  const form = await request.formData()
  const intent = form.get('intent')
  const locale = localeOfPath(new URL(request.url).pathname)
  const values = valuesOf(form)
  // a quote that cannot be had leaves the page's own cart in place: the visitor's typing is never lost to it
  if (intent === 'quote') return data({ values, cart: await quote(request, values).catch(() => undefined) })
  if (intent !== 'place') throw new Response('Bad Request', { status: 400 })

  const { config } = await loadShell(locale)
  const result = await placeOrder(request, values, config.checkout.extraFields, locale)
  if (result.ok) throw redirect(result.redirectUrl ?? localePath(locale, `/orders/${result.token}?placed=1`), { headers: { 'Set-Cookie': clearCartCookie() } })
  // the price moved or stock ran short: the new cart, and a new key (the old one belongs to the cart the customer saw)
  if (result.error === 'changed') return data({ values: { ...values, idempotencyKey: crypto.randomUUID() }, cart: result.cart, result })
  return data({ values, cart: await quote(request, values).catch(() => undefined), result })
}

export default function Checkout() {
  const loader = useLoaderData()
  const action = useActionData()
  return <CheckoutForm loader={loader} action={action} />
}
