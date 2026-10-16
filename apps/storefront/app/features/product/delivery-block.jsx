import { useEffect, useId, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { formatMoney } from '@noor/i18n'
import { NativeSelect } from '@noor/ui/native-select'
import { useHydrated } from '../catalog/filters'
import { useLocalePath, useShell } from '../layout/use-shell'

const KEY = 'nc_city'
const EVENT = 'nc-city'

/** @typedef {{ id: string, name: string, delivery: { fee: import('@noor/contract').Money, freeAbove?: import('@noor/contract').Money, etaMinDays: number, etaMaxDays: number } }} City */

/** @param {() => void} notify */
const subscribe = (notify) => {
  window.addEventListener(EVENT, notify)
  window.addEventListener('storage', notify)
  return () => {
    window.removeEventListener(EVENT, notify)
    window.removeEventListener('storage', notify)
  }
}
/** The city this browser chose before ("" for none); storage can be missing, then none. */
function read() {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}
/** @param {string} id */
function remember(id) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // nothing to do: the choice lasts until the page is left
  }
  window.dispatchEvent(new Event(EVENT))
}

/** The fee, the days and the free-delivery line for the city chosen (all from the shop's own zones, as the API sends them). @param {{ city: City }} props */
function CityResult({ city }) {
  const { t } = useTranslation('storefront')
  const shell = useShell()
  const locale = shell?.locale ?? 'en'
  const display = shell?.config.priceDisplay
  const { fee, freeAbove, etaMinDays, etaMaxDays } = city.delivery
  return (
    <p role="status" className="text-small text-fg">
      {t('pdp.delivery.toCity', { city: city.name, fee: fee.amount === 0 ? t('pdp.delivery.free') : formatMoney(fee, locale, display), min: etaMinDays, max: etaMaxDays })}
      {freeAbove ? ` ${t('pdp.delivery.freeAbove', { amount: formatMoney(freeAbove, locale, display) })}` : ''}
    </p>
  )
}

/** "Check delivery to your city": the cities are fetched when it is asked for (or at once for a city remembered from last time), and the choice is remembered in this browser. */
function CityCheck() {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const hydrated = useHydrated()
  const id = useId()
  const chosen = useSyncExternalStore(subscribe, read, () => '')
  const [asked, setAsked] = useState(false)
  const [cities, setCities] = useState(/** @type {City[] | 'failed' | undefined} */ (undefined))
  const want = hydrated && (asked || chosen !== '')
  useEffect(() => {
    if (!want || cities) return
    const ctl = new AbortController()
    fetch(path('/delivery/cities'), { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('unavailable'))))
      .then((d) => setCities(d.items))
      .catch((e) => {
        if (e?.name !== 'AbortError') setCities('failed')
      })
    return () => ctl.abort()
  }, [want, cities, path])
  if (!hydrated) return null
  if (!want) {
    return (
      <button type="button" className="self-start text-small underline underline-offset-4" onClick={() => setAsked(true)}>
        {t('pdp.delivery.check')}
      </button>
    )
  }
  if (cities === 'failed') return <p role="alert" className="text-small text-danger">{t('pdp.delivery.failed')}</p>
  if (!cities) return <p aria-busy="true" className="text-small text-muted">{t('pdp.loading')}</p>
  const city = cities.find((c) => c.id === chosen)
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-small text-fg-soft">{t('pdp.delivery.city')}</label>
      <NativeSelect id={id} size="sm" value={chosen} onChange={(e) => remember(e.target.value)} placeholder={t('checkout.cityChoose')} options={cities.map((c) => ({ value: c.id, label: c.name }))} />
      {city ? <CityResult city={city} /> : null}
    </div>
  )
}

/**
 * The delivery block of the product page (DOC-06.14 PD-06): the lead time of a made-to-order piece or the delivery days, the dispatch promise, cash on delivery and the free-delivery
 * threshold, then a way to see the fee and days for the visitor's own city.
 * @param {{ delivery: import('~/lib/selection').ProductDetail['delivery'], mto: import('~/lib/selection').ProductDetail['madeToOrder'] }} props
 */
export function DeliveryBlock({ delivery, mto }) {
  const { t } = useTranslation('storefront')
  const shell = useShell()
  const locale = shell?.locale ?? 'en'
  const display = shell?.config.priceDisplay
  const dispatchPromise = shell?.config.shipping.dispatchPromise
  return (
    <section aria-labelledby="delivery-h" className="flex flex-col gap-2 rounded-card border border-line p-4 text-small text-fg-soft">
      <h2 id="delivery-h" className="text-ui font-medium text-fg">{t('pdp.sections.delivery')}</h2>
      <ul className="flex flex-col gap-1.5">
        {mto ? <li>{mto.label}</li> : delivery.etaMinDays !== undefined && delivery.etaMaxDays !== undefined ? <li>{t('pdp.delivery.eta', { min: delivery.etaMinDays, max: delivery.etaMaxDays })}</li> : null}
        {mto?.depositPercent ? <li>{t('pdp.mto.deposit', { percent: mto.depositPercent })}</li> : null}
        {mto && !mto.returnable ? <li>{t('pdp.mto.notReturnable')}</li> : null}
        {dispatchPromise ? <li>{dispatchPromise}</li> : null}
        {delivery.codAvailable ? <li>{t('pdp.delivery.cod')}</li> : null}
        {delivery.freeAbove ? <li>{t('pdp.delivery.freeAbove', { amount: formatMoney(delivery.freeAbove, locale, display) })}</li> : null}
      </ul>
      <CityCheck />
    </section>
  )
}
