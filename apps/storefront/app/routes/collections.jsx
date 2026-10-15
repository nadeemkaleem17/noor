import { useTranslation } from 'react-i18next'
import { data, Link as RouterLink, useLoaderData } from 'react-router'
import { Breadcrumb } from '@noor/ui/breadcrumb'
import { EmptyState } from '@noor/ui/empty-state'
import { Image, imageProps } from '@noor/ui/image'
import { createI18n } from '@noor/i18n'
import { buildMeta, pageName, siteOf, titleOf } from '~/features/seo/meta'
import { asRouterLink } from '~/features/layout/as-router-link'
import { useLocalePath } from '~/features/layout/use-shell'
import { api } from '~/lib/api.server'
import { cacheControl } from '~/lib/cache'
import { localeOfPath } from '~/lib/locale'
import { loadShell } from '~/lib/shell.server'

export const headers = /** @type {import('./+types/collections').Route.HeadersFunction} */ (() => ({ 'Cache-Control': cacheControl.content }))

/** @param {import('./+types/collections').Route.LoaderArgs} props */
export async function loader({ request }) {
  const locale = localeOfPath(new URL(request.url).pathname)
  const [shell, { items }] = await Promise.all([loadShell(locale), api('catalog.listCollections', { query: { locale, limit: 24 } })])
  return data({ collections: items, brand: shell.config.brand.name, title: createI18n(locale).t('storefront:seo.collections') })
}

export const meta = /** @type {import('./+types/collections').Route.MetaFunction} */ (({ loaderData, matches }) => {
  const site = siteOf(matches)
  if (!loaderData || !site) return [{ title: loaderData?.title ?? '' }]
  return buildMeta({ site, title: titleOf(loaderData.title, loaderData.brand), ogTitle: loaderData.title, description: pageName(site.locale, 'collectionsDescription'), canonical: '/collections', alternates: true })
})

/** All the shop's collections with their pictures: the page behind the "Collections" menu item and the footer (plan/06-storefront/13-navigation-and-categories.md section 6). */
export default function CollectionsPage() {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const { collections } = useLoaderData()
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Breadcrumb items={[{ label: t('listing.home'), href: path('/') }, { label: t('seo.collections') }]} renderLink={asRouterLink} />
      <h1 className="mt-3 font-heading text-3xl">{t('seo.collections')}</h1>
      {collections.length ? (
        <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((/** @type {{ id: string, handle: string, title: string, image?: import('@noor/contract').Image }} */ c) => (
            <li key={c.id}>
              <RouterLink to={path(`/collections/${c.handle}`)} className="group block">
                {c.image ? <Image {...imageProps(c.image)} alt="" sizes="(min-width:1024px) 30vw, (min-width:640px) 45vw, 100vw" ratio="3 / 2" className="w-full rounded-media" /> : null}
                <span className="mt-3 block font-heading text-xl group-hover:underline">{c.title}</span>
              </RouterLink>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t('seo.collections')} />
      )}
    </div>
  )
}
