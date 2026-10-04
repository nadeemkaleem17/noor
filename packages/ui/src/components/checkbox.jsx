import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { Check, Minus } from 'lucide-react'
import { cn } from '../cn'

/**
 * @typedef {Omit<import('react').ComponentProps<typeof BaseCheckbox.Root>, 'children'> & { label: import('react').ReactNode; invalid?: boolean; }} CheckboxProps
 */

/**
 * @param {CheckboxProps} props
 */
export function Checkbox({ label, invalid, className, disabled, ...props }) {
  return (
    <label className={cn('inline-flex items-start gap-2 text-fg', disabled && 'opacity-50')}>
      <BaseCheckbox.Root
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          'group mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-control border border-line-strong bg-surface',
          'data-[checked]:border-accent data-[checked]:bg-accent data-[indeterminate]:border-accent data-[indeterminate]:bg-accent aria-invalid:border-danger',
          className,
        )}
        {...props}
      >
        <BaseCheckbox.Indicator className="flex text-on-accent">
          <Check aria-hidden className="size-3.5 group-data-[indeterminate]:hidden" strokeWidth={3} />
          <Minus aria-hidden className="hidden size-3.5 group-data-[indeterminate]:block" strokeWidth={3} />
        </BaseCheckbox.Indicator>
      </BaseCheckbox.Root>
      <span className="text-(length:--control-text)">{label}</span>
    </label>
  )
}
