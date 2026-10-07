import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@noor/ui/button'
import { Drawer } from '@noor/ui/drawer'
import { SizeChartExtras, SizeChartTables } from './size-chart'

/** @typedef {import('@noor/contract').SizeChart} SizeChart */

/** The inches and centimetres switch: a group of two buttons, the pressed one is the unit shown. @param {{ unit: 'in' | 'cm', onChange: (unit: 'in' | 'cm') => void }} props */
export function UnitSwitch({ unit, onChange }) {
  const { t } = useTranslation('storefront')
  return (
    <div role="group" aria-label={t('pdp.unit')} className="inline-flex self-start overflow-hidden rounded-control border border-line-strong">
      {(/** @type {const} */ (['in', 'cm'])).map((u) => (
        <button key={u} type="button" aria-pressed={unit === u} onClick={() => onChange(u)} className={`h-10 px-4 text-sm ${unit === u ? 'bg-accent text-on-accent' : 'bg-surface'}`}>
          {t(`pdp.units.${u}`)}
        </button>
      ))}
    </div>
  )
}

/** The size chart in a drawer next to the choices, so nothing is lost by opening it (plan/06-storefront/04-pdp.md section 4): tables, an inches and centimetres switch, how to measure. @param {{ chart: SizeChart }} props */
export function SizeGuide({ chart }) {
  const { t } = useTranslation('storefront')
  const [unit, setUnit] = useState(chart.unit)
  return (
    <Drawer title={chart.title} trigger={<Button variant="ghost" size="sm" className="underline">{t('pdp.sizeGuide')}</Button>} footer={null}>
      <div className="flex flex-col gap-5">
        <UnitSwitch unit={unit} onChange={setUnit} />
        <SizeChartTables chart={chart} unit={unit} />
        <SizeChartExtras chart={chart} />
      </div>
    </Drawer>
  )
}
