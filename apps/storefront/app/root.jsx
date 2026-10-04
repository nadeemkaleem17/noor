import { I18nextProvider } from 'react-i18next'
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData, useRouteLoaderData } from 'react-router'
import { createI18n, dirOf } from '@noor/i18n'
import { DirectionProvider } from '@noor/ui/direction'
import { localeFromParams } from '~/lib/locale'
import './app.css'

/**
 * @param {import('./+types/root').Route.LoaderArgs} props
 */
export function loader({ params }) {
  const locale = localeFromParams(params)
  return { locale, dir: dirOf(locale) }
}

/**
 * @param {{ children: import('react').ReactNode; }} props
 */
export function Layout({ children }) {
  const data = /** @type {ReturnType<typeof loader> | undefined} */ (useRouteLoaderData('root'))
  const locale = data?.locale ?? 'en'
  return (
    <html lang={locale} dir={dirOf(locale)} data-brand="storefront">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
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
  const { locale, dir } = /** @type {ReturnType<typeof loader>} */ (useLoaderData())
  return (
    <I18nextProvider i18n={createI18n(locale)}>
      <DirectionProvider direction={dir}>
        <Outlet />
      </DirectionProvider>
    </I18nextProvider>
  )
}

/**
 * @param {import('./+types/root').Route.ErrorBoundaryProps} props
 */
export function ErrorBoundary({ error }) {
  const status = isRouteErrorResponse(error) ? error.status : 500
  const i18n = createI18n('en') // ponytail: English only; localise once the error pages are designed (DOC-06)
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="font-heading text-3xl">{status}</h1>
      <p className="mt-2 text-fg-soft">{i18n.t('errors:unknown')}</p>
    </main>
  )
}
