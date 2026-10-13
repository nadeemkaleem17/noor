import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@noor/ui/button'

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

const GuideDrawer = lazy(() => import('./size-guide-drawer'))

/** The size chart in a drawer next to the choices, so nothing is lost by opening it (plan/06-storefront/04-pdp.md section 4). The drawer is downloaded the first time the button is pressed. @param {{ chart: SizeChart }} props */
export function SizeGuide({ chart }) {
  const { t } = useTranslation('storefront')
  const [open, setOpen] = useState(false)
  const [opened, setOpened] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="underline"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen(true)
          setOpened(true)
        }}
      >
        {t('pdp.sizeGuide')}
      </Button>
      {opened ? (
        <Suspense fallback={null}>
          <GuideDrawer chart={chart} open={open} onOpenChange={setOpen} />
        </Suspense>
      ) : null}
    </>
  )
}
