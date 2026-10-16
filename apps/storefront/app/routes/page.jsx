import { useTranslation } from 'react-i18next'
import { useSite } from '~/features/seo/use-site'
import { breadcrumbLd, faqLd } from '~/features/seo/jsonld'
import { JsonLd } from '~/features/seo/json-ld'
import { buildMeta, clip, plainText, siteOf, titleOf } from '~/features/seo/meta'
import { data, redirect, useLoaderData } from 'react-router'
import { Breadcrumb } from '@noor/ui/breadcrumb'
import { RichText } from '~/features/content/rich-text'
import { markdownHtml } from '~/lib/markdown.server'
import { ContactDetails } from '~/features/content/contact-details'
import { asRouterLink } from '~/features/layout/as-router-link'
import { useLocalePath } from '~/features/layout/use-shell'
import { api } from '~/lib/api.server'
import { cacheControl } from '~/lib/cache'
import { getEnv } from '~/lib/env.server'
import { orNotFound } from '~/lib/listing.server'
import { localeOfPath } from '~/lib/locale'
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
  return data({ page, bodyHtml: markdownHtml(page.bodyMd, new URL(getEnv().PUBLIC_IMG_URL).origin), brand: config.brand.name, locale })
}

export const meta = /** @type {import('./+types/page').Route.MetaFunction} */ (({ loaderData, matches }) => {
  const p = loaderData?.page
  if (!p || 'redirectTo' in p) return []
  const description = p.seo.description ?? (clip(plainText(p.bodyMd)) || undefined)
  return buildMeta({ site: siteOf(matches), title: titleOf(p.seo.title ?? p.title, loaderData.brand), ogTitle: p.seo.title ?? p.title, ...(description ? { description } : {}), canonical: `/pages/${p.slug}`, alternates: true })
})

export default function Page() {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const { page, bodyHtml, locale } = useLoaderData()
  const site = useSite()
  // the Urdu text is missing: the English one is shown, and said to be English
  const lang = page.locale !== locale ? page.locale : undefined
  const faq = page.slug === 'faq' ? faqLd(page.bodyMd) : undefined // the questions of a FAQ page, as structured data
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {site ? <JsonLd data={[breadcrumbLd(site, [{ name: t('listing.home'), path: '/' }, { name: page.title }]), ...(faq ? [faq] : [])]} /> : null}
      <Breadcrumb items={[{ label: t('listing.home'), href: path('/') }, { label: page.title }]} renderLink={asRouterLink} />
      <h1 className="mt-3 font-heading text-h1" {...(lang ? { lang } : {})}>{page.title}</h1>
      <div className="max-w-[65ch]" {...(lang ? { lang, dir: lang === 'ur' ? 'rtl' : 'ltr' } : {})}>
        <RichText html={bodyHtml} />
        {page.slug === 'contact' ? <ContactDetails /> : null}
      </div>
    </div>
  )
}
