import { useTranslation } from 'react-i18next'
import { data, redirect } from 'react-router'
import { addToCart, cartCookie } from '~/lib/cart.server'
import { cacheControl } from '~/lib/cache'

export const headers = /** @type {import('./+types/cart').Route.HeadersFunction} */ (() => ({ 'Cache-Control': cacheControl.private }))

/** Where a visitor without JavaScript is sent back to after a failed add: a product page of the shop, nothing else. */
const productPath = /^\/(ur\/)?p\/[a-z0-9-]+$/

/**
 * The cart's actions, one `intent` per request (plan/06-storefront/05-cart-checkout.md section 2.1). Only `add` so far (M5-04); the rest come with M5-05.
 * With JavaScript the product page sends `mode=fetch` and gets the result as data; without it a success redirects to the cart and a failure back to the product with the reason in the address.
 * @param {import('./+types/cart').Route.ActionArgs} props
 */
export async function action({ request }) {
  // a form on another site cannot add to this visitor's cart: React Router answers 400 to an action whose Origin is not this site's
  const form = await request.formData()
  if (form.get('intent') !== 'add') throw new Response('Bad Request', { status: 400 })
  const result = await addToCart(request, form)
  const cookie = result.ok && result.cartToken ? { 'Set-Cookie': cartCookie(result.cartToken) } : undefined
  if (form.get('mode') === 'fetch') return data(result, cookie ? { headers: cookie } : undefined)
  if (result.ok) throw redirect(new URL(request.url).pathname, { headers: cookie ?? {} })
  const back = String(form.get('returnTo') ?? '')
  if (!productPath.test(back)) throw redirect(new URL(request.url).pathname)
  const extra = result.available !== undefined ? `&n=${result.available}` : result.max !== undefined ? `&n=${result.max}` : ''
  throw redirect(`${back}?cartError=${result.error}${extra}`)
}

// ponytail: the page itself is built in its own task (plan/16-roadmap.md section 5); until then it answers with the right cache class and says so.
export default function Cart() {
  const { t } = useTranslation('storefront')
  return (
    <div className="mx-auto max-w-2xl p-8">
      <p className="text-fg-soft">{t('stub.soon')}</p>
    </div>
  )
}
