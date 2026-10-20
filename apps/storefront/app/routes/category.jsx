import { useTranslation } from 'react-i18next'
import { useSite } from '~/features/seo/use-site'
import { breadcrumbLd, itemListLd } from '~/features/seo/jsonld'
import { JsonLd } from '~/features/seo/json-ld'
import { listingIndex } from '~/features/seo/listing'
import { buildMeta, clip, plainText, siteOf, titleOf } from '~/features/seo/meta'
import { redirect, useLoaderData } from 'react-router'
import { CategoryLanding } from '~/features/catalog/category-landing'
import { EmptyState } from '@noor/ui/empty-state'
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
  // a category with sub-categories opens with two short rails, on its plain address only (a filtered or paged one is the listing and nothing else)
  const landing = category && !('redirectTo' in category) && category.children.length > 0 && url.search === ''
  const rail = (/** @type {'newest' | 'bestselling'} */ sort) => api('catalog.listProducts', { query: { category: handle, sort, limit: 4, facets: false, locale } }).then((r) => r.items, () => [])
  const rails = landing ? { newest: await rail('newest'), best: await rail('bestselling') } : undefined
  return { category, rails, ...(await loadListing({ request, filter: { category: handle }, sort: sorts[0] })) }
}

export const meta = /** @type {import('./+types/category').Route.MetaFunction} */ (({ loaderData: data, matches, location }) => {
  const c = data?.category
  if (!c || 'redirectTo' in c) return []
  const { index, query } = listingIndex(new URLSearchParams(location.search), data.page.facets)
  const name = c.seo.title ?? c.name
  const description = c.seo.description ?? (c.description ? clip(plainText(c.description)) : undefined)
  return buildMeta({
    site: siteOf(matches), title: titleOf(name, data.brand), ogTitle: name, ...(description ? { description } : {}), canonical: `/c/${c.handle}${query}`,
    ...(index && data.page.total > 0 ? {} : { robots: 'noindex,follow' }), alternates: index, ...(c.image ? { image: c.image } : {}),
  })
})

export default function Category() {
  const { t } = useTranslation('storefront')
  const { category, page, rails } = useLoaderData()
  const site = useSite()
  if (!category || 'redirectTo' in category) return null
  const crumbs = [{ label: t('listing.home'), href: '/' }, ...category.breadcrumb.map((/** @type {{ handle: string, name: string }} */ b, /** @type {number} */ i, /** @type {unknown[]} */ all) => ({ label: b.name, ...(i < all.length - 1 ? { href: `/c/${b.handle}` } : {}) }))]
  const ld = site ? [breadcrumbLd(site, crumbs.map((c) => ({ name: c.label, ...(c.href ? { path: c.href } : {}) }))), itemListLd(site, page.items)] : []
  return (
    <>
      <JsonLd data={ld} />
      <ListingPage crumbs={crumbs} title={category.name} {...(category.description ? { intro: category.description } : {})} zero={<EmptyState title={t('listing.comingTitle', { name: category.name })} body={t('listing.comingBody')} />} siblings={category.siblings} lead={category.children.length ? <CategoryLanding category={category} rails={rails} /> : undefined} page={page} sorts={sorts} />
    </>
  )
}
