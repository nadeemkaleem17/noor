import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useNavigate } from 'react-router'
import { formatMoney } from '@noor/i18n'
import { Button } from '@noor/ui/button'
import { clearAllHref, listingHref } from '~/lib/listing-url'
import { canonicalQuery } from '~/lib/redirects'
import { useShell } from '../layout/use-shell'
import { Dot } from './product-card'

/** @typedef {import('@noor/contract').Facet} Facet */
/** @typedef {import('@noor/contract').ProductListing} ProductListing */

const noop = () => () => {}
/** False in the server's HTML and while the page is hydrating, true after: what only works with JavaScript is drawn only then, and what only helps without it only before. */
export const useHydrated = () => useSyncExternalStore(noop, () => true, () => false)

/** @param {URLSearchParams} search @param {string} key */
const chosen = (search, key) => search.getAll(key).flatMap((v) => v.split(',')).filter(Boolean)

/** The most values of a facet shown before "Show all" (plan/06-storefront/03-plp-search.md section 4). */
const SHOWN = 8

/** One value of a facet: a checkbox or a chip. A value nobody can pick (count 0) is greyed out, not removed, so the list does not jump. @param {{ facet: Facet, value: Facet['values'][number], checked: boolean, onChange: ((e: import('react').ChangeEvent<HTMLInputElement>) => void) | undefined }} props */
function Value({ facet, value: v, checked, onChange }) {
  const asChip = facet.display === 'buttons' || facet.display === 'swatch'
  const input = (
    <input
      type="checkbox"
      name={facet.key}
      value={v.value}
      {...(onChange ? { checked, onChange } : { defaultChecked: checked })}
      disabled={v.count === 0 && !checked}
      className={asChip ? 'peer sr-only' : 'size-4 shrink-0 accent-accent'}
    />
  )
  if (asChip) {
    return (
      <label className="relative">
        {input}
        <span className="inline-flex min-h-9 min-w-10 items-center justify-center gap-1.5 rounded-control border border-line-strong px-3 text-sm peer-checked:border-accent peer-checked:bg-accent peer-checked:text-on-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-disabled:opacity-40">
          {facet.display === 'swatch' && v.swatch ? <Dot swatch={v.swatch} /> : null}
          {v.label}
          <span className="text-xs opacity-70">{v.count}</span>
        </span>
      </label>
    )
  }
  return (
    <label className={`flex items-center gap-2 ${v.count === 0 && !checked ? 'opacity-50' : ''}`}>
      {input}
      <span>{v.label}</span>
      <span className="text-sm text-muted">({v.count})</span>
    </label>
  )
}

/** @param {{ facet: Facet, selected: (value: string) => boolean, onChange: ((e: import('react').ChangeEvent<HTMLInputElement>) => void) | undefined }} props */
function Group({ facet, selected, onChange }) {
  const { t } = useTranslation('storefront')
  const chips = facet.display === 'buttons' || facet.display === 'swatch'
  const list = chips ? 'mt-2 flex flex-wrap gap-2' : 'mt-2 flex flex-col gap-2'
  /** @param {Facet['values']} values */
  const items = (values) => values.map((v) => <li key={v.value}><Value facet={facet} value={v} checked={selected(v.value)} onChange={onChange} /></li>)
  return (
    <details open className="border-b border-line py-3">
      <summary className="cursor-pointer font-medium">{facet.label}</summary>
      <ul className={list}>{items(facet.values.slice(0, SHOWN))}</ul>
      {facet.values.length > SHOWN ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm underline underline-offset-4">{t('listing.showAll')}</summary>
          <ul className={list}>{items(facet.values.slice(SHOWN))}</ul>
        </details>
      ) : null}
    </details>
  )
}

/** The price ranges the API worked out, as links: a range is two parameters, which one checkbox cannot be. @param {{ path: string, search: URLSearchParams, presets: NonNullable<ProductListing['pricePresets']> }} props */
function Prices({ path, search, presets }) {
  const { t } = useTranslation('storefront')
  const shell = useShell()
  const money = (/** @type {number} */ amount) => formatMoney({ amount, currency: 'PKR' }, shell?.locale ?? 'en', shell?.config.priceDisplay)
  return (
    <details open className="border-b border-line py-3">
      <summary className="cursor-pointer font-medium">{t('listing.price')}</summary>
      <ul className="mt-2 flex flex-col gap-2">
        {presets.map((p) => {
          const min = p.min === undefined ? null : String(p.min)
          const max = p.max === undefined ? null : String(p.max)
          const label = min !== null && max !== null ? t('listing.priceRange', { min: money(p.min ?? 0), max: money(p.max ?? 0) }) : max !== null ? t('listing.priceUnder', { amount: money(p.max ?? 0) }) : t('listing.priceOver', { amount: money(p.min ?? 0) })
          const on = (search.get('priceMin') ?? null) === min && (search.get('priceMax') ?? null) === max
          return (
            <li key={`${min}-${max}`}>
              <RouterLink to={listingHref(path, search, { priceMin: min, priceMax: max })} preventScrollReset aria-current={on ? 'true' : undefined} className={`underline-offset-4 hover:underline ${on ? 'font-medium text-accent' : ''}`}>
                {label}
              </RouterLink>
            </li>
          )
        })}
      </ul>
    </details>
  )
}

/**
 * The filters: a real `<form method="get">`, so they work without JavaScript. With JavaScript a change becomes a navigation to the canonical address; the sidebar
 * (`controlled`) applies each change at once and shows what the address says, the sheet on a phone waits for its button.
 * @param {{ id: string, path: string, page: ProductListing, search: URLSearchParams, effective: URLSearchParams, controlled?: boolean, onApply?: () => void }} props
 */
export function FilterForm({ id, path, page, search, effective, controlled = false, onApply }) {
  const { t } = useTranslation('storefront')
  const navigate = useNavigate()
  const hydrated = useHydrated()
  const facets = page.facets ?? []
  // what stays as it is when the form is sent: the search text, the sort and the price range (its own links change that)
  const kept = ['q', 'sort', 'priceMin', 'priceMax'].filter((k) => search.has(k))

  /** @param {import('react').FormEvent<HTMLFormElement>} e */
  const submit = (e) => {
    e.preventDefault()
    const data = new URLSearchParams(/** @type {Record<string, string>} */ (/** @type {unknown} */ (new FormData(e.currentTarget))))
    navigate(path + canonicalQuery(data), { preventScrollReset: true })
    onApply?.()
  }
  const onChange = controlled && hydrated ? (/** @type {import('react').ChangeEvent<HTMLInputElement>} */ e) => e.currentTarget.form?.requestSubmit() : undefined

  return (
    <form id={id} method="get" action={path} onSubmit={submit}>
      {kept.map((k) => <input key={k} type="hidden" name={k} value={search.get(k) ?? ''} />)}
      {facets.filter((f) => f.key !== 'inStock').map((f) => (
        <Group key={f.key} facet={f} selected={(value) => (controlled ? chosen(effective, f.key).includes(value) : chosen(search, f.key).includes(value))} onChange={onChange} />
      ))}
      {page.pricePresets?.length ? <Prices path={path} search={search} presets={page.pricePresets} /> : null}
      {facets.filter((f) => f.key === 'inStock').map((f) => (
        <Group key={f.key} facet={{ ...f, label: t('listing.availability') }} selected={(value) => (controlled ? chosen(effective, f.key).includes(value) : chosen(search, f.key).includes(value))} onChange={onChange} />
      ))}
      {!hydrated ? <Button type="submit" className="mt-4" fullWidth>{t('listing.applyFilters')}</Button> : null}
    </form>
  )
}

/**
 * The filters that are on, each a link that takes it off, and "Clear all" (plan/06-storefront/03-plp-search.md section 4).
 * @param {{ path: string, page: ProductListing, search: URLSearchParams }} props
 */
export function Applied({ path, page, search }) {
  const { t } = useTranslation('storefront')
  const shell = useShell()
  const chips = (page.facets ?? []).flatMap((f) => f.values.filter((v) => chosen(search, f.key).includes(v.value)).map((v) => ({ id: `${f.key}=${v.value}`, label: v.label, href: listingHref(path, search, {}, { remove: [f.key, v.value] }) })))
  if (search.has('priceMin') || search.has('priceMax')) {
    const money = (/** @type {string | null} */ v) => formatMoney({ amount: Number(v), currency: 'PKR' }, shell?.locale ?? 'en', shell?.config.priceDisplay)
    const [min, max] = [search.get('priceMin'), search.get('priceMax')]
    const label = min !== null && max !== null ? t('listing.priceRange', { min: money(min), max: money(max) }) : max !== null ? t('listing.priceUnder', { amount: money(max) }) : t('listing.priceOver', { amount: money(min) })
    chips.push({ id: 'price', label, href: listingHref(path, search, { priceMin: null, priceMax: null }) })
  }
  if (!chips.length) return null
  return (
    <ul aria-label={t('listing.applied')} className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <li key={c.id}>
          <RouterLink to={c.href} preventScrollReset aria-label={t('listing.removeFilter', { label: c.label })} className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm hover:bg-surface-2">
            {c.label}
            <span aria-hidden="true">×</span>
          </RouterLink>
        </li>
      ))}
      <li>
        <RouterLink to={clearAllHref(path, search)} preventScrollReset className="text-sm underline underline-offset-4">
          {t('listing.clearAll')}
        </RouterLink>
      </li>
    </ul>
  )
}
