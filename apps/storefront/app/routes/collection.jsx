import { useTranslation } from 'react-i18next'
import { redirect, useLoaderData } from 'react-router'
import { ListingPage } from '~/features/catalog/listing'
import { api } from '~/lib/api.server'
import { cacheControl } from '~/lib/cache'
import { loadListing, orNotFound } from '~/lib/listing.server'
import { pageTitle } from '~/lib/page-title'
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

export const meta = /** @type {import('./+types/collection').Route.MetaFunction} */ (({ loaderData: data }) => {
  const c = data?.collection
  if (!c || 'redirectTo' in c) return []
  return [{ title: pageTitle(c.seo.title ?? c.title, data.brand) }, ...(c.seo.description ? [{ name: 'description', content: c.seo.description }] : [])]
})

export default function Collection() {
  const { t } = useTranslation('storefront')
  const { collection, page } = useLoaderData()
  if (!collection || 'redirectTo' in collection) return null
  return <ListingPage crumbs={[{ label: t('listing.home'), href: '/' }, { label: collection.title }]} title={collection.title} {...(collection.description ? { intro: collection.description } : {})} page={page} sorts={sorts} />
}
