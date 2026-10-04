import { NumberField } from '@base-ui/react/number-field'
import type { ComponentProps } from 'react'
import { cn } from '../cn'
import { controlBase, controlHeight, type ControlSize } from './control-styles'

export type NumberInputProps = Omit<ComponentProps<typeof NumberField.Root>, 'children' | 'onValueChange'> & {
  onValueChange?: (value: number | null) => void
  size?: ControlSize
  invalid?: boolean
  placeholder?: string
  inputClassName?: string
}

/** Integer by default (`step` 1, no decimals). Pass `format` for decimals. */
export function NumberInput({ onValueChange, size, invalid, placeholder, className, inputClassName, 'aria-label': ariaLabel, 'aria-labelledby': labelledBy, format = { maximumFractionDigits: 0 }, ...props }: NumberInputProps) {
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
