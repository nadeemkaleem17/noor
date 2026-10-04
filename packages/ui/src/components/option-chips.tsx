import { ToggleGroup } from '@base-ui/react/toggle-group'
import { Toggle } from '@base-ui/react/toggle'
import { cn } from '../cn'

export type ChipOption = {
  value: string
  label: string
  /** Sold out: struck through and `aria-disabled`, but still focusable so a "notify me" action can attach. Cannot be selected. */
  disabled?: boolean
  /** CSS color of a swatch dot (data from the catalog). */
  swatch?: string
}

type Props = {
  options: ChipOption[]
  /** The selected value, or '' for none. */
  value: string
  onValueChange: (value: string) => void
  'aria-label': string
  className?: string
}

/** One-of-many picker for sizes and colours. Arrow keys move between chips and follow the page direction. */
export function OptionChips({ options, value, onValueChange, className, ...props }: Props) {
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
