import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData, useRouteLoaderData } from 'react-router'
import { createI18n, dirOf, type Locale } from '@noor/i18n'
import { DirectionProvider } from '@noor/ui/direction'
import { localeFromParams } from '~/lib/locale'
import type { Route } from './+types/root'
import './app.css'

export function loader({ params }: Route.LoaderArgs) {
  const locale = localeFromParams(params)
  return { locale, dir: dirOf(locale) }
}

export function Layout({ children }: { children: ReactNode }) {
  const data = useRouteLoaderData<typeof loader>('root')
  const locale: Locale = data?.locale ?? 'en'
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
  const { locale, dir } = useLoaderData<typeof loader>()
  return (
    <I18nextProvider i18n={createI18n(locale)}>
      <DirectionProvider direction={dir}>
        <Outlet />
      </DirectionProvider>
    </I18nextProvider>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const status = isRouteErrorResponse(error) ? error.status : 500
  const i18n = createI18n('en') // ponytail: English only; localise once the error pages are designed (DOC-06)
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="font-heading text-3xl">{status}</h1>
      <p className="mt-2 text-fg-soft">{i18n.t('errors:unknown')}</p>
    </main>
  )
}
