import { Combobox as BaseCombobox } from '@base-ui/react/combobox'
import { Check, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../cn'
import { controlBase, controlHeight, type ControlSize } from './control-styles'
import { floating, listItem } from './overlay-styles'

export type ComboboxOption = { value: string; label: string; disabled?: boolean }

type Common = {
  placeholder?: string
  /** Shown when nothing matches. Defaults to "No results". */
  emptyText?: string
  size?: ControlSize
  invalid?: boolean
  disabled?: boolean
  'aria-label'?: string
  className?: string
} & (
  | { options: ComboboxOption[]; onSearch?: undefined }
  /** Async mode: called 250 ms after the person stops typing; the server filters, so no client filtering happens. */
  | { options?: ComboboxOption[]; onSearch: (query: string) => Promise<ComboboxOption[]> }
)

export type ComboboxProps = Common &
  (
    | { multiple?: false; value: string | null; onValueChange: (value: string | null) => void }
    | { multiple: true; value: string[]; onValueChange: (value: string[]) => void }
  )

const SEARCH_DELAY_MS = 250

export function Combobox(props: ComboboxProps) {
  const { t } = useTranslation()
  const { options = [], onSearch, placeholder, emptyText, size, invalid, disabled, className } = props
  const [results, setResults] = useState<ComboboxOption[]>(options)
  const [searching, setSearching] = useState(false)
  const known = useRef(new Map<string, ComboboxOption>())
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const latest = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  const items = onSearch ? results : options
  for (const o of items) known.current.set(o.value, o)
  const asOption = (v: string): ComboboxOption => known.current.get(v) ?? { value: v, label: v }

  const search = (query: string) => {
    if (!onSearch) return
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const mine = ++latest.current
      setSearching(true)
      try {
        const found = await onSearch(query)
        if (mine === latest.current) setResults(found) // ignore an answer to an older query
      } finally {
        if (mine === latest.current) setSearching(false)
      }
    }, SEARCH_DELAY_MS)
  }

  const popup = (
    <BaseCombobox.Portal>
      <BaseCombobox.Positioner sideOffset={4} align="start" className="z-popover">
        <BaseCombobox.Popup className={cn(floating, 'min-w-(--anchor-width)')}>
          <BaseCombobox.Empty className="px-3 py-2 text-muted">{searching ? t('searching') : (emptyText ?? t('noResults'))}</BaseCombobox.Empty>
          <BaseCombobox.List>
            {(o: ComboboxOption) => (
              <BaseCombobox.Item key={o.value} value={o} disabled={o.disabled} className={cn(listItem, 'justify-between')}>
                {o.label}
                <BaseCombobox.ItemIndicator>
                  <Check aria-hidden className="size-4" />
                </BaseCombobox.ItemIndicator>
              </BaseCombobox.Item>
            )}
          </BaseCombobox.List>
        </BaseCombobox.Popup>
      </BaseCombobox.Positioner>
    </BaseCombobox.Portal>
  )

  const shared = {
    items,
    disabled,
    // the server already filtered in async mode
    filter: onSearch ? null : undefined,
    itemToStringLabel: (o: ComboboxOption) => o.label,
    isItemEqualToValue: (a: ComboboxOption, b: ComboboxOption) => a.value === b.value,
    onInputValueChange: (q: string) => search(q),
  } as const
  const aria = { 'aria-label': props['aria-label'], 'aria-invalid': invalid || undefined }

  if (props.multiple) {
    return (
      <BaseCombobox.Root {...shared} multiple value={props.value.map(asOption)} onValueChange={(v) => props.onValueChange(v.map((o) => o.value))}>
        <BaseCombobox.Chips className={cn(controlBase, 'flex min-h-(--control-h) flex-wrap items-center gap-1 py-1', 'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus', className)}>
          <BaseCombobox.Value>
            {(selected: ComboboxOption[]) =>
              selected.map((o) => (
                <BaseCombobox.Chip key={o.value} className="inline-flex items-center gap-1 rounded-control bg-surface-2 px-2 py-0.5 text-sm">
                  {o.label}
                  <BaseCombobox.ChipRemove aria-label={t('remove', { label: o.label })} className="flex size-4 items-center justify-center rounded-control hover:bg-line">
                    <X aria-hidden className="size-3" />
                  </BaseCombobox.ChipRemove>
                </BaseCombobox.Chip>
              ))
            }
          </BaseCombobox.Value>
          <BaseCombobox.Input placeholder={placeholder} className="min-w-24 flex-1 bg-transparent text-(length:--control-text) outline-none placeholder:text-muted" {...aria} />
        </BaseCombobox.Chips>
        {popup}
      </BaseCombobox.Root>
    )
  }
  return (
    <BaseCombobox.Root
      {...shared}
      value={props.value === null ? null : asOption(props.value)}
      onValueChange={(v) => props.onValueChange(v ? v.value : null)}
    >
      <BaseCombobox.Input placeholder={placeholder} className={cn(controlBase, controlHeight(size), className)} {...aria} />
      {popup}
    </BaseCombobox.Root>
  )
}
