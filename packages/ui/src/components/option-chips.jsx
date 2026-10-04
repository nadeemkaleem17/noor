import { ToggleGroup } from '@base-ui/react/toggle-group'
import { Toggle } from '@base-ui/react/toggle'
import { cn } from '../cn'

/**
 * @typedef {object} ChipOption
 * @property {string} value
 * @property {string} label
 * @property {boolean} [disabled] - Sold out: struck through and `aria-disabled`, but still focusable so a "notify me" action can attach. Cannot be selected.
 * @property {string} [swatch] - CSS color of a swatch dot (data from the catalog).
 */

/**
 * @typedef {object} Props
 * @property {ChipOption[]} options
 * @property {string} value - The selected value, or '' for none.
 * @property {(value: string) => void} onValueChange
 * @property {string} aria-label
 * @property {string} [className]
 */

/**
 * One-of-many picker for sizes and colours. Arrow keys move between chips and follow the page direction.
 * @param {Props} props
 */
export function OptionChips({ options, value, onValueChange, className, ...props }) {
  return (
    <ToggleGroup
      value={value ? [value] : []}
      onValueChange={(next) => {
        const picked = next.find((v) => v !== value) ?? ''
        if (options.find((o) => o.value === picked)?.disabled) return
        onValueChange(picked)
      }}
      className={cn('flex flex-wrap gap-2', className)}
      {...props}
    >
      {options.map((o) => (
        <Toggle
          key={o.value}
          value={o.value}
          aria-disabled={o.disabled || undefined}
          className={cn(
            'inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-control border border-line-strong bg-surface px-3 text-md text-fg',
            'data-[pressed]:border-accent data-[pressed]:bg-accent-soft data-[pressed]:font-medium',
            o.disabled && 'text-muted line-through opacity-60',
          )}
        >
          {o.swatch ? <span aria-hidden className="size-4 rounded-full border border-line-strong" style={{ backgroundColor: o.swatch }} /> : null}
          {o.label}
        </Toggle>
      ))}
    </ToggleGroup>
  )
}
