import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { data, Link as RouterLink, useLoaderData } from 'react-router'
import { createI18n, formatDate } from '@noor/i18n'
import { Breadcrumb } from '@noor/ui/breadcrumb'
import { LinkButton } from '@noor/ui/button'
import { EmptyState } from '@noor/ui/empty-state'
import { asRouterLink } from '~/features/layout/as-router-link'
import { useLocalePath, useShell } from '~/features/layout/use-shell'
import { useHydrated } from '~/features/catalog/filters'
import { buildMeta, pageName, siteOf, titleOf } from '~/features/seo/meta'
import { api } from '~/lib/api.server'
import { cacheControl } from '~/lib/cache'
import { localeOfPath } from '~/lib/locale'
import { loadShell } from '~/lib/shell.server'

export const headers = /** @type {import('./+types/offers').Route.HeadersFunction} */ (() => ({ 'Cache-Control': cacheControl.listing }))

/** The offers staff chose to show (plan/06-storefront/14-site-blueprint.md MK-01): each a code and what it does in words. @param {import('./+types/offers').Route.LoaderArgs} props */
export async function loader({ request }) {
  const locale = localeOfPath(new URL(request.url).pathname)
  const [found, shell] = await Promise.all([api('promos.listPublic').catch(() => ({ items: [] })), loadShell(locale)])
  return data({ items: found.items, brand: shell.config.brand.name, title: createI18n(locale).t('storefront:seo.offers') })
}

export const meta = /** @type {import('./+types/offers').Route.MetaFunction} */ (({ loaderData, matches }) => {
  const site = siteOf(matches)
  if (!loaderData || !site) return [{ title: loaderData?.title ?? '' }]
  return buildMeta({ site, title: titleOf(loaderData.title, loaderData.brand), ogTitle: loaderData.title, description: pageName(site.locale, 'offersDescription'), canonical: '/offers', alternates: true })
})

/** A code with a button that copies it; the code is on the page either way, so a browser that will not copy loses nothing. @param {{ code: string }} props */
function CopyCode({ code }) {
  const { t } = useTranslation('storefront')
  const hydrated = useHydrated()
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <code className="rounded-control border border-dashed border-line-strong bg-surface px-3 py-2 font-mono text-ui tracking-wider">{code}</code>
      {hydrated && typeof navigator !== 'undefined' && navigator.clipboard ? (
        <button
          type="button"
          className="min-h-11 rounded-control border border-line-strong px-4 text-small font-medium hover:bg-surface-2"
          onClick={() => {
            navigator.clipboard.writeText(code).then(() => setCopied(true), () => setCopied(false))
          }}
        >
          {t('offers.copy')}
        </button>
      ) : null}
      <span role="status" className="text-small text-success">{copied ? t('offers.copied', { code }) : ''}</span>
    </div>
  )
}

export default function Offers() {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const locale = useShell()?.locale ?? 'en'
  const { items } = useLoaderData()
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Breadcrumb items={[{ label: t('listing.home'), href: path('/') }, { label: t('shell.offers') }]} renderLink={asRouterLink} />
      <h1 className="mt-3 font-heading text-h1">{t('shell.offers')}</h1>
      {items.length ? (
        <>
          <p className="mt-2 text-fg-soft">{t('offers.intro')}</p>
          <ul className="mt-6 flex flex-col gap-4">
            {items.map((/** @type {import('@noor/contract').PublicOffer} */ o) => (
              <li key={o.code} className="flex flex-col gap-3 rounded-card border border-line p-4">
                <p className="text-body">{o.summary}</p>
                {o.endsAt ? <p className="text-small text-muted">{t('offers.ends', { date: formatDate(o.endsAt, locale) })}</p> : null}
                <CopyCode code={o.code} />
              </li>
            ))}
          </ul>
          <p className="mt-6 text-small text-fg-soft">{t('offers.how')}</p>
        </>
      ) : (
        <EmptyState title={t('offers.none')} body={t('offers.noneBody')} action={<LinkButton href={path('/new')} variant="secondary" render={<RouterLink to={path('/new')} />}>{t('listing.seeNew')}</LinkButton>} />
      )}
    </div>
  )
}
