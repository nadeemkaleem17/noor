import { Select as BaseSelect } from '@base-ui/react/select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../cn'
import { controlBase, controlHeight } from './control-styles'
import { floating, listItem } from './overlay-styles'

/**
 * @typedef {object} SelectOption
 * @property {string} value
 * @property {string} label
 * @property {boolean} [disabled]
 */

/**
 * @typedef {object} SelectProps
 * @property {SelectOption[]} options
 * @property {string | null} [value]
 * @property {string | null} [defaultValue]
 * @property {(value: string) => void} [onValueChange]
 * @property {string} [placeholder]
 * @property {import('./control-styles').ControlSize} [size]
 * @property {boolean} [invalid]
 * @property {boolean} [disabled]
 * @property {string} [name]
 * @property {boolean} [required]
 * @property {string} [aria-label]
 * @property {string} [className]
 */

/**
 * Custom select for the admin or for options that need more than text. On the storefront prefer NativeSelect.
 * @param {SelectProps} props
 */
export function Select({ options, value, defaultValue, onValueChange, placeholder, size, invalid, disabled, name, required, className, ...aria }) {
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
