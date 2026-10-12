import { useTranslation } from 'react-i18next'
import { privateMeta } from '~/features/seo/meta'
import { data, redirect, useLoaderData } from 'react-router'
import { LinkButton } from '@noor/ui/button'
import { EmptyState } from '@noor/ui/empty-state'
import { CartLines } from '~/features/cart/cart-lines'
import { Promo } from '~/features/cart/promo'
import { forgetCheckout } from '~/features/checkout/memory'
import { CartSummary } from '~/features/cart/summary'
import { useLocalePath } from '~/features/layout/use-shell'
import { addToCart, cartAction, cartCookie, cartCount, cartErrors, getCart } from '~/lib/cart.server'
import { cacheControl } from '~/lib/cache'
import { pagePath } from '~/lib/paths'
import { Link as RouterLink } from 'react-router'
import { useEffect } from 'react'

// the cart is one visitor's: never kept by a cache
export const headers = /** @type {import('./+types/cart').Route.HeadersFunction} */ (() => ({ 'Cache-Control': cacheControl.private }))

/** Where a visitor without JavaScript is sent back to after a failed add: a product page of the shop, nothing else. */
const productPath = /^\/(ur\/)?p\/[a-z0-9-]+$/

/**
 * The cart's actions, one `intent` per request (plan/06-storefront/05-cart-checkout.md section 2.1). With JavaScript the page sends `mode=fetch` and gets the result as data, and the cart is
 * read again by the router; without it a success redirects to the cart and a failure back (to the cart, or to the product for an add) with the reason in the address.
 * @param {import('./+types/cart').Route.ActionArgs} props
 */
export async function action({ request }) {
  // a form on another site cannot change this visitor's cart: React Router answers 400 to an action whose Origin is not this site's
  const form = await request.formData()
  const intent = form.get('intent')
  const here = pagePath(new URL(request.url))
  if (intent !== 'add' && !['setQty', 'remove', 'applyPromo', 'removePromo'].includes(String(intent))) throw new Response('Bad Request', { status: 400 })
  const result = intent === 'add' ? await addToCart(request, form) : await cartAction(request, form)
  const token = result.ok && 'cartToken' in result ? result.cartToken : undefined
  const cookie = typeof token === 'string' ? { 'Set-Cookie': cartCookie(token) } : undefined
  if (form.get('mode') === 'fetch') return data(result, cookie ? { headers: cookie } : undefined)
  if (result.ok) throw redirect(here, { headers: cookie ?? {} })
  const n = 'available' in result && result.available !== undefined ? result.available : 'max' in result && result.max !== undefined ? result.max : 'n' in result ? result.n : undefined
  const extra = `${n !== undefined ? `&n=${n}` : ''}${'amount' in result && result.amount !== undefined ? `&amount=${result.amount}` : ''}`
  const back = String(form.get('returnTo') ?? '')
  if (intent === 'add' && productPath.test(back)) throw redirect(`${back}?cartError=${result.error}${extra}`)
  throw redirect(`${here}?error=${result.error}${extra}`)
}

/**
 * The cart as the API prices it now; `?summary=1` is only the number for the header badge (plan/06-storefront/05-cart-checkout.md section 2.1).
 * @param {import('./+types/cart').Route.LoaderArgs} props
 */
export async function loader({ request }) {
  const url = new URL(request.url)
  if (url.searchParams.get('summary')) return data({ count: await cartCount(request) })
  const error = url.searchParams.get('error')
  return data({ cart: await getCart(request), error: cartErrors.find((e) => e === error), n: Number(url.searchParams.get('n')) || undefined, amount: Number(url.searchParams.get('amount')) || undefined })
}

export const meta = /** @type {import('./+types/cart').Route.MetaFunction} */ (({ matches }) => privateMeta(matches, 'cart'))

export default function Cart() {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const d = useLoaderData()
  const cart = d.cart
  const empty = cart ? cart.lines.length === 0 : false
  // an empty cart is where a placed order leaves it: the next checkout starts clean
  useEffect(() => {
    if (empty) forgetCheckout()
  }, [empty])
  if (!cart) return null
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="font-heading text-3xl">{t('cart.title')}</h1>
      {d.error && d.error !== 'insufficient_stock' && d.error !== 'max_per_order' && !d.error.startsWith('promo_') ? <p role="alert" className="mt-3 text-danger">{t(`cart.errors.${d.error}`)}</p> : null}
      {cart.lines.length === 0 ? (
        <EmptyState
          title={t('cart.empty')}
          body={t('cart.emptyBody')}
          action={<LinkButton href={path('/new')} variant="secondary" render={<RouterLink to={path('/new')} />}>{t('cart.continue')}</LinkButton>}
        />
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <CartLines cart={cart} error={d.error} n={d.n} />
          <div className="flex flex-col gap-4">
            <Promo cart={cart} error={d.error} amount={d.amount} />
            <CartSummary cart={cart} />
          </div>
        </div>
      )}
    </div>
  )
}
