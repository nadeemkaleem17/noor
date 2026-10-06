import { useTranslation } from 'react-i18next'
import { redirect, useLoaderData } from 'react-router'
import { ListingPage } from '~/features/catalog/listing'
import { api } from '~/lib/api.server'
import { cacheControl } from '~/lib/cache'
import { loadListing, orNotFound } from '~/lib/listing.server'
import { pageTitle } from '~/lib/page-title'
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

export const meta = /** @type {import('./+types/category').Route.MetaFunction} */ (({ loaderData: data }) => {
  const c = data?.category
  if (!c || 'redirectTo' in c) return []
  return [{ title: pageTitle(c.seo.title ?? c.name, data.brand) }, ...(c.seo.description ? [{ name: 'description', content: c.seo.description }] : [])]
})

export default function Category() {
  const { t } = useTranslation('storefront')
  const { category, page } = useLoaderData()
  if (!category || 'redirectTo' in category) return null
  const crumbs = [{ label: t('listing.home'), href: '/' }, ...category.breadcrumb.map((/** @type {{ handle: string, name: string }} */ b, /** @type {number} */ i, /** @type {unknown[]} */ all) => ({ label: b.name, ...(i < all.length - 1 ? { href: `/c/${b.handle}` } : {}) }))]
  return <ListingPage crumbs={crumbs} title={category.name} {...(category.description ? { intro: category.description } : {})} subcategories={category.children} page={page} sorts={sorts} />
}
