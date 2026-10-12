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

export const headers = /** @type {import('./+types/category').Route.HeadersFunction} */ (() => ({ 'Cache-Control': cacheControl.listing }))

const sorts = ['featured', 'newest', 'price_asc', 'price_desc', 'bestselling']

/** A category (plan/06-storefront/03-plp-search.md section 8): its own words, then its first page of products and their facets. @param {import('./+types/category').Route.LoaderArgs} props */
export async function loader({ request, params }) {
  const url = new URL(request.url)
  const locale = localeOfPath(url.pathname)
  const handle = params.handle ?? ''
  // a fetcher after one more page needs the products only
  const category = url.searchParams.has('chunk') ? undefined : await api('catalog.getCategory', { params: { handle }, query: { locale } }).catch(orNotFound)
  if (category && 'redirectTo' in category) throw redirect(localePath(locale, `/c/${category.redirectTo}`) + url.search, 301)
  return { category, ...(await loadListing({ request, filter: { category: handle }, sort: sorts[0] })) }
}

export const meta = /** @type {import('./+types/category').Route.MetaFunction} */ (({ loaderData: data, matches, location }) => {
  const c = data?.category
  if (!c || 'redirectTo' in c) return []
  const { index, query } = listingIndex(new URLSearchParams(location.search), data.page.facets)
  const name = c.seo.title ?? c.name
  const description = c.seo.description ?? (c.description ? clip(plainText(c.description)) : undefined)
  return buildMeta({
    site: siteOf(matches), title: titleOf(name, data.brand), ogTitle: name, ...(description ? { description } : {}), canonical: `/c/${c.handle}${query}`,
    ...(index ? {} : { robots: 'noindex,follow' }), alternates: index, ...(c.image ? { image: c.image } : {}),
  })
})

export default function Category() {
  const { t } = useTranslation('storefront')
  const { category, page } = useLoaderData()
  const site = useSite()
  if (!category || 'redirectTo' in category) return null
  const crumbs = [{ label: t('listing.home'), href: '/' }, ...category.breadcrumb.map((/** @type {{ handle: string, name: string }} */ b, /** @type {number} */ i, /** @type {unknown[]} */ all) => ({ label: b.name, ...(i < all.length - 1 ? { href: `/c/${b.handle}` } : {}) }))]
  const ld = site ? [breadcrumbLd(site, crumbs.map((c) => ({ name: c.label, ...(c.href ? { path: c.href } : {}) }))), itemListLd(site, page.items)] : []
  return (
    <>
      <JsonLd data={ld} />
  return <ListingPage crumbs={crumbs} title={category.name} {...(category.description ? { intro: category.description } : {})} subcategories={category.children} page={page} sorts={sorts} />
    </>
  )
}
