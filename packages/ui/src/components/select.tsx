import { Select as BaseSelect } from '@base-ui/react/select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../cn'
import { controlBase, controlHeight, type ControlSize } from './control-styles'
import { floating, listItem } from './overlay-styles'

export type SelectOption = { value: string; label: string; disabled?: boolean }

export type SelectProps = {
  options: SelectOption[]
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string) => void
  placeholder?: string
  size?: ControlSize
  invalid?: boolean
  disabled?: boolean
  name?: string
  required?: boolean
  'aria-label'?: string
  className?: string
}

/** Custom select for the admin or for options that need more than text. On the storefront prefer NativeSelect. */
export function Select({ options, value, defaultValue, onValueChange, placeholder, size, invalid, disabled, name, required, className, ...aria }: SelectProps) {
  return (
    <BaseSelect.Root
      items={options}
      value={value}
      defaultValue={defaultValue}
      disabled={disabled}
      name={name}
      required={required}
      onValueChange={(v) => {
        if (v !== null) onValueChange?.(String(v))
      }}
    >
      <BaseSelect.Trigger
        aria-invalid={invalid || undefined}
        className={cn(controlBase, controlHeight(size), 'flex items-center justify-between gap-2 text-start', className)}
        {...aria}
      >
        <BaseSelect.Value placeholder={placeholder} className="truncate data-[placeholder]:text-muted" />
        <BaseSelect.Icon aria-hidden className="shrink-0 text-muted">
          <ChevronDown className="size-4" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        {/* alignItemWithTrigger off: the item-aligned default is not mirrored in RTL (M0-11, DOC-04b section 8) */}
        <BaseSelect.Positioner sideOffset={4} align="start" alignItemWithTrigger={false} className="z-popover">
          <BaseSelect.Popup className={cn(floating, 'min-w-(--anchor-width)')}>
            <BaseSelect.List>
              {options.map((o) => (
                <BaseSelect.Item key={o.value} value={o.value} disabled={o.disabled} className={cn(listItem, 'justify-between')}>
                  <BaseSelect.ItemText>{o.label}</BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator>
                    <Check aria-hidden className="size-4" />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  )
}
