import { useTranslation } from 'react-i18next'
import { formatNumber } from '@noor/i18n'
import { Image, imageProps } from '@noor/ui/image'
import { useShell } from '../layout/use-shell'

const IN_CM = 2.54

/** The tables of a size chart in one unit (the chart's own numbers, or those worked out in the other unit, to one decimal), and how to measure. Real tables with header cells that have a `scope`; wide ones scroll inside their own box with the first column kept in view. @param {{ chart: import('@noor/contract').SizeChart, unit: 'in' | 'cm' }} props */
export function SizeChartTables({ chart, unit }) {
  const { t } = useTranslation('storefront')
  const locale = useShell()?.locale ?? 'en'
  /** @param {number} n */
  const show = (n) => formatNumber(unit === chart.unit ? n : unit === 'cm' ? n * IN_CM : n / IN_CM, locale, { maximumFractionDigits: 1 })
  return (
    <>
      {chart.tables.map((table) => (
        <div key={table.id} className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${table.title} (${t(`pdp.units.${unit}`)})`}>
          <table className="w-full text-start text-sm">
            <caption className="pb-2 text-start font-medium">{table.title} ({t(`pdp.units.${unit}`)})</caption>
            <thead>
              <tr className="border-b border-line">
                <td className="sticky start-0 bg-bg py-2 pe-3"><span className="sr-only">{t('pdp.measurement')}</span></td>
                {table.columns.map((c) => <th key={c} scope="col" className="px-3 py-2 text-start font-medium">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r) => (
                <tr key={r.label} className="border-b border-line">
                  <th scope="row" className="sticky start-0 bg-bg py-2 pe-3 text-start font-medium">{r.label}</th>
                  {r.values.map((n, i) => <td key={i} className="px-3 py-2 tabular-nums">{show(n)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  )
}

/** The notes and the how-to-measure picture of a chart. @param {{ chart: import('@noor/contract').SizeChart }} props */
export function SizeChartExtras({ chart }) {
  const { t } = useTranslation('storefront')
  return (
    <>
      {chart.notes ? <p className="text-fg-soft">{chart.notes}</p> : null}
      {chart.guideImage ? <Image {...imageProps(chart.guideImage)} alt={chart.guideImage.alt || t('pdp.howToMeasure')} sizes="(min-width:768px) 32rem, 100vw" className="w-full max-w-lg rounded-media" /> : null}
    </>
  )
}
