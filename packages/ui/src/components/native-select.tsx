import { Field as BaseField } from '@base-ui/react/field'
import { ChevronDown } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '../cn'
import { controlBase, controlHeight, type ControlSize } from './control-styles'

export type NativeOption = { value: string; label: string; disabled?: boolean }

export type NativeSelectProps = Omit<ComponentProps<'select'>, 'size'> & {
  options: NativeOption[]
  placeholder?: string
  size?: ControlSize
  invalid?: boolean
}

/** The browser's own select. The default on the storefront: Android and iOS show their native picker. */
export function NativeSelect({ options, placeholder, size, invalid, className, ...props }: NativeSelectProps) {
  return (
    <div className="relative">
      <BaseField.Control
        render={
          <select aria-invalid={invalid || undefined} className={cn(controlBase, controlHeight(size), 'appearance-none pe-9', className)} {...props}>
            {placeholder ? (
              <option value="" disabled={props.required}>
                {placeholder}
              </option>
            ) : null}
            {options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ))}
          </select>
        }
      />
      <ChevronDown aria-hidden className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </div>
  )
}
