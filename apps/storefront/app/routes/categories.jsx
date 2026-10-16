import { useTranslation } from 'react-i18next'
import { data, Link as RouterLink, useLoaderData } from 'react-router'
import { Breadcrumb } from '@noor/ui/breadcrumb'
import { Image, imageProps } from '@noor/ui/image'
import { createI18n } from '@noor/i18n'
import { buildMeta, pageName, siteOf, titleOf } from '~/features/seo/meta'
import { asRouterLink } from '~/features/layout/as-router-link'
import { useLocalePath } from '~/features/layout/use-shell'
import { cacheControl } from '~/lib/cache'
import { localeOfPath } from '~/lib/locale'
import { loadShell } from '~/lib/shell.server'

export const headers = /** @type {import('./+types/categories').Route.HeadersFunction} */ (() => ({ 'Cache-Control': cacheControl.content }))

/** @param {import('./+types/categories').Route.LoaderArgs} props */
export async function loader({ request }) {
  const locale = localeOfPath(new URL(request.url).pathname)
  const shell = await loadShell(locale)
  return data({ categories: shell.categories, brand: shell.config.brand.name, title: createI18n(locale).t('storefront:seo.categories') })
}

export const meta = /** @type {import('./+types/categories').Route.MetaFunction} */ (({ loaderData, matches }) => {
  const site = siteOf(matches)
  if (!loaderData || !site) return [{ title: loaderData?.title ?? '' }]
  return buildMeta({ site, title: titleOf(loaderData.title, loaderData.brand), ogTitle: loaderData.title, description: pageName(site.locale, 'categoriesDescription'), canonical: '/categories', alternates: true })
})

/** Every category of the shop with a picture and its sub-categories, as links: the page behind the footer's "All categories" (plan/06-storefront/13-navigation-and-categories.md section 6). */
export default function CategoriesPage() {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const { categories } = useLoaderData()
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Breadcrumb items={[{ label: t('listing.home'), href: path('/') }, { label: t('seo.categories') }]} renderLink={asRouterLink} />
      <h1 className="mt-3 font-heading text-h1">{t('seo.categories')}</h1>
      <ul className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((/** @type {import('@noor/contract').CategoryNode} */ c) => (
          <li key={c.id}>
            <RouterLink to={path(`/c/${c.handle}`)} className="group block">
              {c.image ? <Image {...imageProps(c.image)} alt="" sizes="(min-width:1024px) 30vw, (min-width:640px) 45vw, 100vw" ratio="3 / 2" className="w-full rounded-media" /> : null}
              <span className="mt-3 block font-heading text-h3 group-hover:underline">{c.name}</span>
              <span className="text-sm text-fg-soft">{t('listing.count', { count: c.productCount })}</span>
            </RouterLink>
            {c.children.length ? (
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {c.children.map((/** @type {import('@noor/contract').CategoryNode} */ s) => (
                  <li key={s.id}>
                    <RouterLink to={path(`/c/${s.handle}`)} className="inline-block py-0.5 text-fg-soft underline-offset-4 hover:text-fg hover:underline">
                      {s.name}
                    </RouterLink>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
