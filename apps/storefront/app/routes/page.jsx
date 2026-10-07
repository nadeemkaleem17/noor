import { useTranslation } from 'react-i18next'
import { data, redirect, useLoaderData } from 'react-router'
import { Breadcrumb } from '@noor/ui/breadcrumb'
import { Markdown } from '@noor/ui/markdown'
import { ContactDetails } from '~/features/content/contact-details'
import { asRouterLink } from '~/features/layout/as-router-link'
import { useLocalePath } from '~/features/layout/use-shell'
import { api } from '~/lib/api.server'
import { cacheControl } from '~/lib/cache'
import { getEnv } from '~/lib/env.server'
import { orNotFound } from '~/lib/listing.server'
import { localeOfPath } from '~/lib/locale'
import { pageTitle } from '~/lib/page-title'
import { localePath } from '~/lib/paths'
import { loadShell } from '~/lib/shell.server'

export const headers = /** @type {import('./+types/page').Route.HeadersFunction} */ (() => ({ 'Cache-Control': cacheControl.content }))

/**
 * A page staff wrote (plan/06-storefront/08-cms-pages.md section 2). The API answers only for an active page and has already put the shop's own numbers where the text names them
 * (`{{store.phone}}`, `{{returns.days}}` ...); the text is drawn as elements by the allow-list renderer, never as HTML.
 * @param {import('./+types/page').Route.LoaderArgs} props
 */
export async function loader({ params, request }) {
  const locale = localeOfPath(new URL(request.url).pathname)
  const { config } = await loadShell(locale)
  const page = await api('content.getPage', { params: { slug: params.slug ?? '' }, query: { locale } }).catch(orNotFound)
  if ('redirectTo' in page) throw redirect(localePath(locale, `/pages/${page.redirectTo}`), 301)
  return data({ page, brand: config.brand.name, imageOrigin: new URL(getEnv().PUBLIC_IMG_URL).origin, locale })
}

export const meta = /** @type {import('./+types/page').Route.MetaFunction} */ (({ loaderData }) => {
  const p = loaderData?.page
  if (!p || 'redirectTo' in p) return []
  return [{ title: pageTitle(p.seo.title ?? p.title, loaderData.brand) }, ...(p.seo.description ? [{ name: 'description', content: p.seo.description }] : [])]
})

export default function Page() {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const { page, imageOrigin, locale } = useLoaderData()
  // the Urdu text is missing: the English one is shown, and said to be English
  const lang = page.locale !== locale ? page.locale : undefined
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Breadcrumb items={[{ label: t('listing.home'), href: path('/') }, { label: page.title }]} renderLink={asRouterLink} />
      <h1 className="mt-3 font-heading text-3xl" {...(lang ? { lang } : {})}>{page.title}</h1>
      <div className="max-w-[65ch]" {...(lang ? { lang, dir: lang === 'ur' ? 'rtl' : 'ltr' } : {})}>
        {page.bodyMd.trim() ? <Markdown source={page.bodyMd} imageOrigin={imageOrigin} /> : null}
        {page.slug === 'contact' ? <ContactDetails /> : null}
      </div>
    </div>
  )
}
