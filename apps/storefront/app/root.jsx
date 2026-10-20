import { I18nextProvider, useTranslation } from 'react-i18next'
import { isRouteErrorResponse, Links, Meta, Outlet, redirect, Scripts, ScrollRestoration, useLoaderData, useRouteLoaderData } from 'react-router'
import { createI18n, dirOf } from '@noor/i18n'
import { ErrorState } from '@noor/ui/error-state'
import { DirectionProvider } from '@noor/ui/direction'
import { themeCss } from '@noor/ui/theme'
import { api, handleOf } from '~/lib/api.server'
import { localeOfPath } from '~/lib/locale'
import { pagePath } from '~/lib/paths'
import { redirectFor } from '~/lib/redirects'
import { footerColumns, navItems, safeItems } from '~/lib/nav'
import { getEnv } from '~/lib/env.server'
import { fontsFor } from '~/lib/fonts.server'
import { previewOf } from '~/lib/preview'
import { cached, loadShell } from '~/lib/shell.server'
import { visitorMiddleware } from '~/lib/visitor.server'
import './app.css'

/** Every request, loaders and actions included, runs knowing who the visitor is (for the API's limits). */
export const middleware = [visitorMiddleware]

/**
 * Everything every page is given: the language, the shop's settings, its announcement, menus and categories, and the theme as CSS. None of it belongs to one visitor.
 * @typedef {Awaited<ReturnType<typeof loader>>} ShellData
 */

/**
 * @param {import('./+types/root').Route.LoaderArgs} props
 */
export async function loader({ request }) {
  const url = new URL(request.url)

  // The old shop's addresses, and a clean form of every address, go to the right place with a 301 (plan/06-storefront/01-sitemap.md section 4).
  const needsCategories = pagePath(url).replace(/\/+$/, '') === '/shop' && url.searchParams.has('category')
  const where = redirectFor(url, needsCategories ? (await cached('categories:en', () => api('catalog.listCategories', { query: { locale: 'en' } }))).items : [])
  if (where && 'to' in where) throw redirect(where.to, 301)
  if (where && 'productId' in where) {
    const handle = await handleOf(where.productId).catch(() => undefined)
    if (!handle) throw new Response('Not Found', { status: 404 })
    throw redirect('/p/' + handle, 301)
  }

  const locale = localeOfPath(url.pathname)
  const shell = await loadShell(locale, previewOf(url))
  // Urdu is off until the shop switches it on: until then `/ur/...` is not a page
  if (locale !== 'en' && !shell.config.locale.supported.includes(locale)) throw new Response('Not Found', { status: 404 })
  // Only what the frame needs goes to the browser, already worked out: the page data carries every byte of it, and an unsafe menu address never gets there.
  const t = createI18n(locale).t
  const { theme, ...config } = shell.config
  const fonts = fontsFor(theme?.fonts ?? { heading: 'Playfair Display', body: 'Inter' }, locale)
  const labels = { new: t('storefront:shell.new'), sale: t('storefront:shell.sale'), collections: t('storefront:shell.collections'), more: t('storefront:shell.more') }
  const footerLabels = { new: labels.new, sale: labels.sale, allCategories: t('storefront:shell.allCategories'), allCollections: t('storefront:shell.allCollections'), trackOrder: t('storefront:shell.trackOrder'), sizeGuide: t('storefront:shell.sizeGuide'), offers: t('storefront:shell.offers') }
  return {
    locale,
    preview: shell.preview,
    siteUrl: getEnv().PUBLIC_SITE_URL,
    dir: dirOf(locale),
    // the fonts are declared in the same inline block as the theme: one block, one hash for the CSP
    themeCss: fonts.css + themeCss(theme),
    fontFiles: fonts.preload,
    imgOrigin: new URL(getEnv().PUBLIC_IMG_URL).origin,
    config,
    // the Appearance settings of the header (DOC-06.12): left or centre, and whether it stays at the top
    headerBar: { layout: theme?.header.layout ?? 'left', sticky: theme?.header.sticky ?? true },
    notices: [...(shell.home.announcement ? [{ id: 'announcement', text: shell.home.announcement.text, href: shell.home.announcement.href, severity: /** @type {const} */ ('info'), position: /** @type {const} */ ('bar'), palette: /** @type {const} */ ('accent'), popupEvery: /** @type {const} */ ('day') }] : []), ...shell.home.notices],
    about: shell.home.footer.about,
    nav: { header: navItems({ locale, mode: shell.config.navigation.mode, menu: shell.menus.main, categories: shell.categories, collections: shell.collections, labels }), footer: footerColumns({ locale, categories: shell.categories, collections: shell.collections, pages: safeItems(locale, shell.menus.footer), labels: footerLabels, hasOffers: shell.hasOffers }) },
    categories: shell.categories.map((c) => ({ id: c.id, handle: c.handle, name: c.name })),
  }
}

/** An error response keeps its own headers (a 503 says `Retry-After` and is never cached). @param {{ errorHeaders: Headers | null }} props */
export const headers = ({ errorHeaders }) => errorHeaders ?? new Headers()

/**
 * @param {{ children: import('react').ReactNode; }} props
 */
export function Layout({ children }) {
  const data = /** @type {ShellData | undefined} */ (useRouteLoaderData('root'))
  const locale = data?.locale ?? 'en'
  return (
    <html lang={locale} dir={dirOf(locale)} data-brand="storefront" data-theme="light">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        {/* the shop's own favicon (Settings, Store, Brand) when staff uploaded one; the built-in icon until then */}
        {data?.config.brand.favicon ? <link rel="icon" href={data.config.brand.favicon.src} /> : <link rel="icon" type="image/svg+xml" href="/favicon.svg" />}
        <link rel="apple-touch-icon" href={data?.config.brand.favicon?.src ?? '/apple-touch-icon.png'} />
        <Links />
        {data?.fontFiles.map((href) => <link key={href} rel="preload" as="font" type="font/woff2" crossOrigin="anonymous" href={href} />)}
        {data && data.imgOrigin !== new URL(data.siteUrl).origin ? <link rel="preconnect" href={data.imgOrigin} /> : null}
        {/* the theme: the one inline block, allowed in the CSP by its hash (entry.server.jsx), because a cached page cannot carry a nonce */}
        {data ? <style dangerouslySetInnerHTML={{ __html: data.themeCss }} /> : null}
      </head>
      <body className="bg-bg font-body text-fg">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  const { locale, dir } = /** @type {ShellData} */ (useLoaderData())
  return (
    <I18nextProvider i18n={createI18n(locale)}>
      <DirectionProvider direction={dir}>
        <Outlet />
      </DirectionProvider>
    </I18nextProvider>
  )
}

/** The API did not answer, or something broke: a short page with a way to try again (plan/06-storefront/01-sitemap.md section 6). */
/** @param {{ status: number }} props */
function Failure({ status }) {
  const { t } = useTranslation('storefront')
  return <ErrorState code={String(status)} title={t('error.title')} body={t('error.body')} retryLabel={t('error.reload')} onRetry={() => window.location.reload()} />
}

/**
 * @param {import('./+types/root').Route.ErrorBoundaryProps} props
 */
export function ErrorBoundary({ error }) {
  const status = isRouteErrorResponse(error) ? error.status : 500
  const data = /** @type {ShellData | undefined} */ (useRouteLoaderData('root'))
  const i18n = createI18n(data?.locale ?? 'en')
  return (
    <I18nextProvider i18n={i18n}>
      {status === 404 ? <title>{`${i18n.t('storefront:seo.notFound')}${data ? ` | ${data.config.brand.name}` : ''}`}</title> : null}
      <main className="mx-auto max-w-xl p-8">{status === 404 ? <h1 className="font-heading text-h1">404</h1> : <Failure status={status} />}</main>
    </I18nextProvider>
  )
}
