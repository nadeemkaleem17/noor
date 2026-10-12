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
import { navItems, safeItems } from '~/lib/nav'
import { getEnv } from '~/lib/env.server'
import { cached, loadShell } from '~/lib/shell.server'
import './app.css'

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
  const shell = await loadShell(locale)
  // Urdu is off until the shop switches it on: until then `/ur/...` is not a page
  if (locale !== 'en' && !shell.config.locale.supported.includes(locale)) throw new Response('Not Found', { status: 404 })
  // Only what the frame needs goes to the browser, already worked out: the page data carries every byte of it, and an unsafe menu address never gets there.
  const t = createI18n(locale).t
  const { theme, ...config } = shell.config
  const labels = { new: t('storefront:shell.new'), sale: t('storefront:shell.sale') }
  return {
    locale,
    siteUrl: getEnv().PUBLIC_SITE_URL,
    dir: dirOf(locale),
    themeCss: themeCss(theme),
    config,
    notices: [...(shell.home.announcement ? [{ id: 'announcement', text: shell.home.announcement.text, href: shell.home.announcement.href }] : []), ...shell.home.notices.map((n) => ({ id: n.id, text: n.text, href: n.href }))],
    about: shell.home.footer.about,
    nav: { header: navItems({ locale, menu: shell.menus.main, categories: shell.categories, labels }), footer: safeItems(locale, shell.menus.footer) },
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
        <Links />
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
      <main className="mx-auto max-w-xl p-8">{status === 404 ? <h1 className="font-heading text-3xl">404</h1> : <Failure status={status} />}</main>
    </I18nextProvider>
  )
}
