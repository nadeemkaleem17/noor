import { useTranslation } from 'react-i18next'
import { useSite } from '~/features/seo/use-site'
import { breadcrumbLd, itemListLd } from '~/features/seo/jsonld'
import { JsonLd } from '~/features/seo/json-ld'
import { listingIndex } from '~/features/seo/listing'
import { buildMeta, clip, plainText, siteOf, titleOf } from '~/features/seo/meta'
import { redirect, useLoaderData } from 'react-router'
import { ListingPage } from '~/features/catalog/listing'
import { api } from '~/lib/api.server'
import { cacheControl } from '~/lib/cache'
import { loadListing, orNotFound } from '~/lib/listing.server'
import { localeOfPath } from '~/lib/locale'
import { localePath } from '~/lib/paths'

export const headers = /** @type {import('./+types/collection').Route.HeadersFunction} */ (() => ({ 'Cache-Control': cacheControl.listing }))

const sorts = ['featured', 'newest', 'price_asc', 'price_desc', 'bestselling']

/** A collection: staff's own selection of products, in the order they set (the `featured` sort). @param {import('./+types/collection').Route.LoaderArgs} props */
export async function loader({ request, params }) {
  const url = new URL(request.url)
  const locale = localeOfPath(url.pathname)
  const handle = params.handle ?? ''
  const collection = url.searchParams.has('chunk') ? undefined : await api('catalog.getCollection', { params: { handle }, query: { locale } }).catch(orNotFound)
  if (collection && 'redirectTo' in collection) throw redirect(localePath(locale, `/collections/${collection.redirectTo}`) + url.search, 301)
  return { collection, ...(await loadListing({ request, filter: { collection: handle }, sort: sorts[0] })) }
}

export const meta = /** @type {import('./+types/collection').Route.MetaFunction} */ (({ loaderData: data, matches, location }) => {
  const c = data?.collection
  if (!c || 'redirectTo' in c) return []
  const { index, query } = listingIndex(new URLSearchParams(location.search), data.page.facets)
  const name = c.seo.title ?? c.title
  const description = c.seo.description ?? (c.description ? clip(plainText(c.description)) : undefined)
  return buildMeta({
    site: siteOf(matches), title: titleOf(name, data.brand), ogTitle: name, ...(description ? { description } : {}), canonical: `/collections/${c.handle}${query}`,
    ...(index ? {} : { robots: 'noindex,follow' }), alternates: index, ...(c.image ? { image: c.image } : {}),
  })
})

export default function Collection() {
  const { t } = useTranslation('storefront')
  const { collection, page } = useLoaderData()
  const site = useSite()
  if (!collection || 'redirectTo' in collection) return null
  const crumbs = [{ label: t('listing.home'), href: '/' }, { label: collection.title }]
  const ld = site ? [breadcrumbLd(site, crumbs.map((c) => ({ name: c.label, ...(c.href ? { path: c.href } : {}) }))), itemListLd(site, page.items)] : []
  return (
    <>
      <JsonLd data={ld} />
      <ListingPage crumbs={crumbs} title={collection.title} {...(collection.description ? { intro: collection.description } : {})} page={page} sorts={sorts} />
    </>
  )
}
