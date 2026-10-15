import { Button } from '@noor/ui/button'
import { Checkbox } from '@noor/ui/checkbox'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { Popover } from '@noor/ui/popover'
import { Switch } from '@noor/ui/switch'
import { ListFilter, Search, X } from 'lucide-react'
import { useRef, useState } from 'react'

/**
 * Filter definitions of a list (plan/07-admin/14-tables-bulk.md section 3). The `async` type (a Combobox with server search) comes with the first screen that needs one.
 * @typedef {{ key: string; label: string; type: 'select'; options: { value: string; label: string; }[]; }
 *   | { key: string; label: string; type: 'multi'; options: { value: string; label: string; }[]; }
 *   | { key: string; label: string; type: 'boolean'; }
 *   | { key: string; label: string; type: 'dateRange'; fromKey: string; toKey: string; }} FilterDef
 */

/** @param {Date} d */
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** The ranges the date filter offers as buttons. @param {Date} [today] */
export function datePresets(today = new Date()) {
  const ago = (/** @type {number} */ days) => {
    const d = new Date(today)
    d.setDate(d.getDate() - days)
    return isoDay(d)
  }
  return [
    { label: 'Today', from: isoDay(today), to: isoDay(today) },
    { label: '7 days', from: ago(6), to: isoDay(today) },
    { label: '30 days', from: ago(29), to: isoDay(today) },
    { label: 'This month', from: isoDay(new Date(today.getFullYear(), today.getMonth(), 1)), to: isoDay(today) },
  ]
}

/**
 * The search box: waits 300 ms after typing, needs two characters, and says what it searches (plan/07-admin/14 section 3).
 * @param {{ value: string | undefined; placeholder: string; onSearch: (q: string | undefined) => void; }} props
 */
export function SearchBox({ value, placeholder, onSearch }) {
  const [typed, setTyped] = useState(/** @type {string | null} */ (null))
  /** @type {import('react').MutableRefObject<ReturnType<typeof setTimeout> | undefined>} */
  const timer = useRef(undefined)
  return (
    <form role="search" className="min-w-48 flex-1 sm:max-w-sm" onSubmit={(e) => e.preventDefault()}>
      <Input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        prefix={<Search aria-hidden className="size-4 text-muted" />}
        value={typed ?? value ?? ''}
        onChange={(e) => {
          const text = e.target.value
          setTyped(text)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => {
            const trimmed = text.trim()
            if (trimmed.length === 1) return // one character is not a search yet; the box keeps what was typed
            onSearch(trimmed || undefined)
            setTyped(null)
          }, 300)
        }}
      />
    </form>
  )
}

/**
 * The filter controls of a list.
 * @param {{ filters: FilterDef[]; params: Record<string, any>; onChange: (patch: Record<string, unknown>) => void; }} props
 */
export function FilterControls({ filters, params, onChange }) {
  return (
    <>
      {filters.map((f) => {
        if (f.type === 'select') {
          return (
            <NativeSelect
              key={f.key}
              aria-label={f.label}
              placeholder={f.label}
              options={f.options}
              value={params[f.key] ?? ''}
              onChange={(e) => onChange({ [f.key]: e.target.value || undefined })}
              className="w-auto"
            />
          )
        }
        if (f.type === 'multi') {
          const chosen = /** @type {string[]} */ (params[f.key] ?? [])
          return (
            <Popover key={f.key} label={f.label} trigger={<Button variant="secondary" size="sm" iconStart={<ListFilter aria-hidden className="size-4" />}>{f.label}</Button>}>
              <div className="space-y-2">
                {f.options.map((o) => (
                  <Checkbox
                    key={o.value}
                    label={o.label}
                    checked={chosen.includes(o.value)}
                    onCheckedChange={(on) => onChange({ [f.key]: on ? [...chosen, o.value] : chosen.filter((v) => v !== o.value) })}
                  />
                ))}
              </div>
            </Popover>
          )
        }
        if (f.type === 'boolean') {
          return <Switch key={f.key} label={f.label} checked={Boolean(params[f.key])} onCheckedChange={(on) => onChange({ [f.key]: on ? 1 : undefined })} />
        }
        return (
          <Popover key={f.key} label={f.label} trigger={<Button variant="secondary" size="sm">{f.label}</Button>}>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {datePresets().map((p) => (
                  <Button key={p.label} variant="secondary" size="sm" onClick={() => onChange({ [f.fromKey]: p.from, [f.toKey]: p.to })}>
                    {p.label}
                  </Button>
                ))}
              </div>
              <label className="block text-sm">
                From
                <Input type="date" value={params[f.fromKey] ?? ''} onChange={(e) => onChange({ [f.fromKey]: e.target.value || undefined })} />
              </label>
              <label className="block text-sm">
                To
                <Input type="date" value={params[f.toKey] ?? ''} onChange={(e) => onChange({ [f.toKey]: e.target.value || undefined })} />
              </label>
            </div>
          </Popover>
        )
      })}
    </>
  )
}

/**
 * What a filter currently says, for its chip; null when it is not applied.
 * @param {FilterDef} f @param {Record<string, any>} params
 */
export function chipText(f, params) {
  if (f.type === 'select') {
    const v = params[f.key]
    return v ? `${f.label}: ${f.options.find((o) => o.value === v)?.label ?? v}` : null
  }
  if (f.type === 'multi') {
    const v = /** @type {string[] | undefined} */ (params[f.key])
    return v?.length ? `${f.label}: ${v.map((x) => f.options.find((o) => o.value === x)?.label ?? x).join(', ')}` : null
  }
  if (f.type === 'boolean') return params[f.key] ? f.label : null
  const from = params[f.fromKey]
  const to = params[f.toKey]
  return from || to ? `${f.label}: ${from ?? '…'} to ${to ?? '…'}` : null
}

/** The keys a filter writes to the address. @param {FilterDef} f */
export const filterKeys = (f) => (f.type === 'dateRange' ? [f.fromKey, f.toKey] : [f.key])

/**
 * Applied filters as removable chips with "Clear all".
 * @param {{ filters: FilterDef[]; params: Record<string, any>; onChange: (patch: Record<string, unknown>) => void; }} props
 */
export function FilterChips({ filters, params, onChange }) {
  const active = filters.flatMap((f) => {
    const text = chipText(f, params)
    return text ? [{ f, text }] : []
  })
  if (active.length === 0) return null
  const clear = (/** @type {FilterDef[]} */ list) => onChange(Object.fromEntries(list.flatMap(filterKeys).map((k) => [k, undefined])))
  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Applied filters">
      {active.map(({ f, text }) => (
        <li key={f.key} className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-1 ps-3 pe-1 text-sm text-accent-text">
          {text}
          <button type="button" aria-label={`Remove filter ${f.label}`} className="grid size-6 place-items-center rounded-full hover:bg-surface" onClick={() => clear([f])}>
            <X aria-hidden className="size-3.5" />
          </button>
        </li>
      ))}
      <li>
        <Button variant="link" onClick={() => clear(active.map((a) => a.f))}>
          Clear all
        </Button>
      </li>
    </ul>
  )
}
