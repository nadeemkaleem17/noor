import { useTranslation } from 'react-i18next'
import { buildMeta, pageName, siteOf, titleOf } from '~/features/seo/meta'
import { Link as RouterLink, useLoaderData } from 'react-router'
import { LinkButton } from '@noor/ui/button'
import { EmptyState } from '@noor/ui/empty-state'
import { ListingPage } from '~/features/catalog/listing'
import { ProductGrid } from '~/features/catalog/product-card'
import { useLocalePath, useShell } from '~/features/layout/use-shell'
import { api } from '~/lib/api.server'
import { cacheControl } from '~/lib/cache'
import { loadListing } from '~/lib/listing.server'
import { localeOfPath } from '~/lib/locale'
import { loadShell } from '~/lib/shell.server'

// the key space is the whole of what people can type: nothing here is worth keeping in a cache (plan/06-storefront/03-plp-search.md section 7)
export const headers = /** @type {import('./+types/search').Route.HeadersFunction} */ (() => ({ 'Cache-Control': cacheControl.private }))

const sorts = ['relevance', 'newest', 'price_asc', 'price_desc', 'bestselling']

/** @param {import('./+types/search').Route.LoaderArgs} props */
export async function loader({ request }) {
  const url = new URL(request.url)
  const locale = localeOfPath(url.pathname)
  const q = (url.searchParams.get('q') ?? '').trim()
  // under two letters nothing is asked of the API: the page shows the search field and the categories
  if (q.length < 2) return { q, page: undefined, failed: false, brand: (await loadShell(locale)).config.brand.name, newest: [] }
  const listing = await loadListing({ request, filter: {}, sort: sorts[0] })
  const newest = listing.page.total === 0 && !url.searchParams.has('chunk') ? await api('catalog.listProducts', { query: { sort: 'newest', limit: 4, facets: false, locale } }).then((r) => r.items, () => []) : []
  return { q, ...listing, newest }
}

export const meta = /** @type {import('./+types/search').Route.MetaFunction} */ (({ loaderData: data, matches }) => {
  const site = siteOf(matches)
  const name = pageName(site?.locale ?? 'en', 'search')
  return buildMeta({ site, title: titleOf(data?.q ? `${name}: ${data.q}` : name, data?.brand ?? ''), robots: 'noindex,follow' })
})

/** The words staff keep in the Store settings, as links that search for them. @param {{ words: readonly string[] }} props */
function PopularWords({ words }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  if (!words.length) return null
  return (
    <>
      <h2 className="mt-8 font-heading text-xl">{t('shell.suggest.popular')}</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {words.map((w) => (
          <li key={w}>
            <RouterLink to={path(`/search?q=${encodeURIComponent(w)}`)} className="inline-flex min-h-9 items-center rounded-full border border-line-strong px-4 text-sm hover:bg-surface-2">{w}</RouterLink>
          </li>
        ))}
      </ul>
    </>
  )
}

export default function Search() {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const shell = useShell()
  const { q, page, newest } = useLoaderData()

  if (!page) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="font-heading text-3xl">{t('listing.search.crumb')}</h1>
        <form role="search" method="get" action={path('/search')} className="mt-4 flex gap-2">
          <label className="sr-only" htmlFor="q">{t('shell.searchLabel')}</label>
          <input id="q" name="q" type="search" required minLength={2} maxLength={80} defaultValue={q} placeholder={t('shell.searchPlaceholder')} className="h-(--control-h) flex-1 rounded-control border border-line-strong bg-bg px-3" />
          <button type="submit" className="h-(--control-h) rounded-control bg-accent px-5 font-medium text-on-accent">{t('shell.searchSubmit')}</button>
        </form>
        {q ? <p className="mt-2 text-sm text-fg-soft">{t('listing.search.short')}</p> : null}
        <PopularWords words={shell?.config.popularSearches ?? []} />
        {shell?.categories.length ? (
          <>
            <h2 className="mt-8 font-heading text-xl">{t('listing.search.popular')}</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {shell.categories.map((c) => (
                <li key={c.id}>
                  <RouterLink to={path(`/c/${c.handle}`)} className="inline-flex min-h-9 items-center rounded-full border border-line-strong px-4 text-sm hover:bg-surface-2">{c.name}</RouterLink>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    )
  }

  const whatsapp = shell?.config.contact.whatsapp
  const zero = (
    <>
      <form role="search" method="get" action={path('/search')} className="mb-6 flex gap-2">
        <label className="sr-only" htmlFor="q">{t('shell.searchLabel')}</label>
        <input id="q" name="q" type="search" required minLength={2} maxLength={80} defaultValue={q} className="h-(--control-h) flex-1 rounded-control border border-line-strong bg-bg px-3" />
        <button type="submit" className="h-(--control-h) rounded-control bg-accent px-5 font-medium text-on-accent">{t('shell.searchSubmit')}</button>
      </form>
      <EmptyState
        title={t('listing.search.zeroTitle', { q })}
        body={t('listing.search.tips')}
        action={whatsapp ? <LinkButton href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(q)}`} variant="secondary">{t('listing.search.whatsapp')}</LinkButton> : undefined}
      />
      <PopularWords words={shell?.config.popularSearches ?? []} />
      {shell?.categories.length ? (
        <>
          <h2 className="mt-8 font-heading text-xl">{t('listing.search.popular')}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {shell.categories.map((c) => (
              <li key={c.id}>
                <RouterLink to={path(`/c/${c.handle}`)} className="inline-flex min-h-9 items-center rounded-full border border-line-strong px-4 text-sm hover:bg-surface-2">{c.name}</RouterLink>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {newest.length ? (
        <section aria-labelledby="search-new" className="mt-6">
          <h2 id="search-new" className="mb-4 font-heading text-xl">{t('listing.new')}</h2>
          <ProductGrid items={newest} eager={0} />
        </section>
      ) : null}
    </>
  )
  return <ListingPage crumbs={[{ label: t('listing.home'), href: '/' }, { label: t('listing.search.crumb') }]} title={t('listing.search.title', { q })} page={page} sorts={sorts} zero={zero} />
}
