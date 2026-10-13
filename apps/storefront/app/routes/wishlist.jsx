import { useTranslation } from 'react-i18next'
import { privateMeta } from '~/features/seo/meta'
import { data, Link as RouterLink, useLoaderData } from 'react-router'
import { LinkButton } from '@noor/ui/button'
import { EmptyState } from '@noor/ui/empty-state'
import { ProductCard } from '~/features/catalog/product-card'
import { useHydrated } from '~/features/catalog/filters'
import { useLocalePath } from '~/features/layout/use-shell'
import { toggleSaved, useWishlist } from '~/features/wishlist/use-wishlist'
import { api } from '~/lib/api.server'
import { cacheControl } from '~/lib/cache'
import { cookieValue } from '~/lib/cart.server'
import { cookieSecure } from '~/lib/env.server'
import { localeOfPath } from '~/lib/locale'
import { loadShell } from '~/lib/shell.server'
import { parseWishlist, serializeWishlist, WISHLIST_COOKIE, WISHLIST_MAX_AGE } from '~/lib/wishlist'

// one visitor's saved products: never kept by a cache, never indexed
export const headers = /** @type {import('./+types/wishlist').Route.HeadersFunction} */ (({ loaderHeaders }) => {
  const out = new Headers({ 'Cache-Control': cacheControl.private, 'X-Robots-Tag': 'noindex' })
  const cookie = loaderHeaders.get('Set-Cookie')
  if (cookie) out.set('Set-Cookie', cookie)
  return out
})
export const meta = /** @type {import('./+types/wishlist').Route.MetaFunction} */ (({ matches }) => privateMeta(matches, 'wishlist'))

/** The most the API gives in one answer. */
const CHUNK = 48

/**
 * The saved products (plan/06-storefront/07-account-wishlist.md section 3): the ids in the cookie, asked of the API in as few calls as it allows, in the order they were saved. A product that
 * is no longer for sale is not given back, and then the cookie is written again without it (and without anything in it that was not an id).
 * @param {import('./+types/wishlist').Route.LoaderArgs} props
 */
export async function loader({ request }) {
  const locale = localeOfPath(new URL(request.url).pathname)
  const { config } = await loadShell(locale)
  // without the wishlist in the shop there is no such page
  if (!config.features.wishlist) throw new Response('Not Found', { status: 404 })
  const raw = cookieValue(request.headers.get('cookie'), WISHLIST_COOKIE)
  const ids = parseWishlist(raw)
  const chunks = Array.from({ length: Math.ceil(ids.length / CHUNK) }, (_, i) => ids.slice(i * CHUNK, (i + 1) * CHUNK))
  const answers = await Promise.all(chunks.map((c) => api('catalog.listProducts', { query: { ids: c, limit: CHUNK, facets: false, locale } })))
  const items = answers.flatMap((a) => a.items)
  const live = serializeWishlist(items.map((p) => p.id.toLowerCase()))
  // the cookie is only touched when it holds something the shop no longer sells or something that is not an id
  const rewrite = raw !== undefined && raw !== live
  const cookie = `${WISHLIST_COOKIE}=${encodeURIComponent(live)}; Path=/; Max-Age=${live ? WISHLIST_MAX_AGE : 0}; SameSite=Lax${cookieSecure()}`
  return data({ items, notifyMe: config.features.notifyMe }, rewrite ? { headers: { 'Set-Cookie': cookie } } : undefined)
}

export default function Wishlist() {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const { items, notifyMe } = useLoaderData()
  const saved = useWishlist()
  const hydrated = useHydrated()
  // the server drew what the cookie said; once the browser is in charge, what the visitor takes away disappears at once
  const shown = hydrated ? items.filter((/** @type {{ id: string }} */ p) => saved.includes(p.id.toLowerCase())) : items
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="font-heading text-3xl">{t('wishlist.title', { count: shown.length })}</h1>
      {shown.length === 0 ? (
        <EmptyState
          title={t('wishlist.empty')}
          body={t('wishlist.emptyBody')}
          action={<LinkButton href={path('/new')} variant="secondary" render={<RouterLink to={path('/new')} />}>{t('cart.continue')}</LinkButton>}
        />
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {shown.map((/** @type {import('@noor/contract').ProductSummary} */ p, /** @type {number} */ i) => (
            <li key={p.id} className="flex flex-col gap-2">
              <ProductCard product={p} priority={i < 4} />
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <RouterLink to={path(`/p/${p.handle}`)} className="font-medium underline underline-offset-4">{p.stockStatus === 'sold_out' && notifyMe ? t('wishlist.notify') : t('wishlist.view')}</RouterLink>
                <button type="button" onClick={() => toggleSaved(p.id)} className="underline underline-offset-4">{t('wishlist.removeShort')}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
