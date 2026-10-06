import { useTranslation } from 'react-i18next'
import { useLoaderData } from 'react-router'
import { createI18n } from '@noor/i18n'
import { ListingPage } from '~/features/catalog/listing'
import { cacheControl } from '~/lib/cache'
import { loadListing } from '~/lib/listing.server'
import { pageTitle } from '~/lib/page-title'
import { localeOfPath } from '~/lib/locale'

export const headers = /** @type {import('./+types/new').Route.HeadersFunction} */ (() => ({ 'Cache-Control': cacheControl.listing }))

const sorts = ['newest', 'price_asc', 'price_desc', 'bestselling']

/** @param {import('./+types/new').Route.LoaderArgs} props */
export async function loader({ request }) {
  const listing = await loadListing({ request, filter: { onlyNew: true }, sort: sorts[0] })
  return { ...listing, title: createI18n(localeOfPath(new URL(request.url).pathname)).t('storefront:listing.new') }
}

export const meta = /** @type {import('./+types/new').Route.MetaFunction} */ (({ loaderData: data }) => [{ title: pageTitle(data?.title ?? '', data?.brand ?? '') }])

export default function New() {
  const { t } = useTranslation('storefront')
  const { page, title } = useLoaderData()
  return <ListingPage crumbs={[{ label: t('listing.home'), href: '/' }, { label: title }]} title={title} page={page} sorts={sorts} />
}
