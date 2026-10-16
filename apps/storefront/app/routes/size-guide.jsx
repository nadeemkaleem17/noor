import { useState } from 'react'
import { buildMeta, pageName, siteOf, titleOf } from '~/features/seo/meta'
import { useTranslation } from 'react-i18next'
import { data, useLoaderData } from 'react-router'
import { Breadcrumb } from '@noor/ui/breadcrumb'
import { EmptyState } from '@noor/ui/empty-state'
import { useHydrated } from '~/features/catalog/filters'
import { asRouterLink } from '~/features/layout/as-router-link'
import { useLocalePath } from '~/features/layout/use-shell'
import { SizeChartExtras, SizeChartTables } from '~/features/product/size-chart'
import { UnitSwitch } from '~/features/product/size-guide'
import { api } from '~/lib/api.server'
import { cacheControl } from '~/lib/cache'
import { loadShell } from '~/lib/shell.server'
import { localeOfPath } from '~/lib/locale'
import { createI18n } from '@noor/i18n'

export const headers = /** @type {import('./+types/size-guide').Route.HeadersFunction} */ (() => ({ 'Cache-Control': cacheControl.content }))

/** @param {import('./+types/size-guide').Route.LoaderArgs} props */
export async function loader({ request }) {
  const locale = localeOfPath(new URL(request.url).pathname)
  const [{ config }, { items }] = await Promise.all([loadShell(locale), api('catalog.listSizeCharts')])
  return data({ charts: items, brand: config.brand.name, title: createI18n(locale).t('storefront:sizeGuide.title') })
}

export const meta = /** @type {import('./+types/size-guide').Route.MetaFunction} */ (({ loaderData, matches }) => {
  const site = siteOf(matches)
  if (!loaderData || !site) return [{ title: loaderData?.title ?? '' }]
  return buildMeta({ site, title: titleOf(loaderData.title, loaderData.brand), ogTitle: loaderData.title, description: pageName(site.locale, 'sizeGuideDescription'), canonical: '/size-guide', alternates: true })
})

/** One chart: its name, the in/cm switch (with JavaScript; without it both unit sets are shown), its tables and how to measure. @param {{ chart: import('@noor/contract').SizeChart }} props */
function Chart({ chart }) {
  const { t } = useTranslation('storefront')
  const hydrated = useHydrated()
  const [unit, setUnit] = useState(chart.unit)
  const units = hydrated ? [unit] : /** @type {('in' | 'cm')[]} */ ([chart.unit, chart.unit === 'in' ? 'cm' : 'in'])
  return (
    <details open className="group border-b border-line py-3">
      <summary className="cursor-pointer font-heading text-h3">{chart.title}</summary>
      <div className="mt-4 flex flex-col gap-5">
        {hydrated ? <UnitSwitch unit={unit} onChange={setUnit} /> : <p className="text-sm text-fg-soft">{t('sizeGuide.bothUnits')}</p>}
        {units.map((u) => <SizeChartTables key={u} chart={chart} unit={u} />)}
        <SizeChartExtras chart={chart} />
      </div>
    </details>
  )
}

/** The size charts of the shop (plan/06-storefront/08-cms-pages.md section 4): the one place all of them are, linked from the footer. */
export default function SizeGuidePage() {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const { charts } = useLoaderData()
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Breadcrumb items={[{ label: t('listing.home'), href: path('/') }, { label: t('sizeGuide.title') }]} renderLink={asRouterLink} />
      <h1 className="mt-3 font-heading text-h1">{t('sizeGuide.title')}</h1>
      {charts.length ? (
        <div className="mt-6">
          {charts.map((/** @type {import('@noor/contract').SizeChart} */ c) => <Chart key={c.id} chart={c} />)}
        </div>
      ) : (
        <EmptyState title={t('sizeGuide.empty')} />
      )}
    </div>
  )
}
