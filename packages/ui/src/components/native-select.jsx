import { Field as BaseField } from '@base-ui/react/field'
import { ChevronDown } from 'lucide-react'
import { cn } from '../cn'
import { controlBase, controlHeight } from './control-styles'

/**
 * @typedef {object} NativeOption
 * @property {string} value
 * @property {string} label
 * @property {boolean} [disabled]
 */

/**
 * @typedef {Omit<import('react').ComponentProps<'select'>, 'size'> & {
 * options: NativeOption[];
 * placeholder?: string;
 * size?: import('./control-styles').ControlSize;
 * invalid?: boolean;
 * }} NativeSelectProps
 */

/**
 * The browser's own select. The default on the storefront: Android and iOS show their native picker.
 * @param {NativeSelectProps} props
 */
export function NativeSelect({ options, placeholder, size, invalid, className, ...props }) {
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
