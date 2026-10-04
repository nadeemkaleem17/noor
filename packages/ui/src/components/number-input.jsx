import { NumberField } from '@base-ui/react/number-field'
import { cn } from '../cn'
import { controlBase, controlHeight } from './control-styles'

/**
 * @typedef {Omit<import('react').ComponentProps<typeof NumberField.Root>, 'children' | 'onValueChange'> & {
 * onValueChange?: (value: number | null) => void;
 * size?: import('./control-styles').ControlSize;
 * invalid?: boolean;
 * placeholder?: string;
 * inputClassName?: string;
 * }} NumberInputProps
 */

/**
 * Integer by default (`step` 1, no decimals). Pass `format` for decimals.
 * @param {NumberInputProps} props
 */
export function NumberInput({ onValueChange, size, invalid, placeholder, className, inputClassName, 'aria-label': ariaLabel, 'aria-labelledby': labelledBy, format = { maximumFractionDigits: 0 }, ...props }) {
  return (
    <NumberField.Root format={format} onValueChange={(v) => onValueChange?.(v)} className={className} {...props}>
      <NumberField.Input
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        aria-invalid={invalid || undefined}
        className={cn(controlBase, controlHeight(size), 'tabular-nums', inputClassName)}
      />
    </NumberField.Root>
  )
}
