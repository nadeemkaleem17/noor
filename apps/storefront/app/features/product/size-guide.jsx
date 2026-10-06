import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@noor/ui/button'
import { Drawer } from '@noor/ui/drawer'
import { Image, imageProps } from '@noor/ui/image'
import { formatNumber } from '@noor/i18n'
import { useShell } from '../layout/use-shell'

/** @typedef {import('@noor/contract').SizeChart} SizeChart */

const IN_CM = 2.54

/** The size chart in a drawer next to the choices, so nothing is lost by opening it (plan/06-storefront/04-pdp.md section 4): tables, an inches and centimetres switch, how to measure. @param {{ chart: SizeChart }} props */
export function SizeGuide({ chart }) {
  const { t } = useTranslation('storefront')
  const locale = useShell()?.locale ?? 'en'
  const [unit, setUnit] = useState(chart.unit)
  /** @param {number} n */
  const show = (n) => formatNumber(unit === chart.unit ? n : unit === 'cm' ? n * IN_CM : n / IN_CM, locale, { maximumFractionDigits: 1 })
  return (
    <Drawer
      title={chart.title}
      trigger={<Button variant="ghost" size="sm" className="underline">{t('pdp.sizeGuide')}</Button>}
      footer={null}
    >
      <div className="flex flex-col gap-5">
        <div role="group" aria-label={t('pdp.unit')} className="inline-flex self-start overflow-hidden rounded-control border border-line-strong">
          {(['in', 'cm']).map((u) => (
            <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(/** @type {'in' | 'cm'} */ (u))} className={`h-10 px-4 text-sm ${unit === u ? 'bg-accent text-on-accent' : 'bg-surface'}`}>
              {t(`pdp.units.${u}`)}
            </button>
          ))}
        </div>
        {chart.tables.map((table) => (
          <div key={table.id} className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <caption className="pb-2 text-start font-medium">{table.title}</caption>
              <thead>
                <tr className="border-b border-line">
                  <td className="py-2 pe-3"><span className="sr-only">{t('pdp.measurement')}</span></td>
                  {table.columns.map((c) => <th key={c} scope="col" className="px-3 py-2 text-start font-medium">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r) => (
                  <tr key={r.label} className="border-b border-line">
                    <th scope="row" className="py-2 pe-3 text-start font-medium">{r.label}</th>
                    {r.values.map((n, i) => <td key={i} className="px-3 py-2 tabular-nums">{show(n)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {chart.notes ? <p className="text-fg-soft">{chart.notes}</p> : null}
        {chart.guideImage ? <Image {...imageProps(chart.guideImage)} alt={chart.guideImage.alt || t('pdp.howToMeasure')} sizes="(min-width:768px) 32rem, 100vw" className="w-full rounded-media" /> : null}
      </div>
    </Drawer>
  )
}
