import { Radio } from '@base-ui/react/radio'
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group'
import { useId } from 'react'
import { cn } from '../cn'

/**
 * @typedef {object} RadioOption
 * @property {string} value
 * @property {import('react').ReactNode} label
 * @property {import('react').ReactNode} [description]
 * @property {boolean} [disabled]
 */

/**
 * @typedef {Omit<import('react').ComponentProps<typeof BaseRadioGroup>, 'children' | 'onValueChange'> & {
 * options: RadioOption[];
 * onValueChange?: (value: string) => void;
 * orientation?: 'vertical' | 'horizontal';
 * variant?: 'default' | 'card';
 * }} RadioGroupProps
 */

/**
 * @param {RadioGroupProps} props
 */
export function RadioGroup({ options, onValueChange, orientation = 'vertical', variant = 'default', className, ...props }) {
  const base = useId()
  return (
    <BaseRadioGroup
      onValueChange={(v) => onValueChange?.(String(v))}
      className={cn('flex gap-3', orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap', className)}
      {...props}
    >
      {options.map((o, i) => (
        <label
          key={o.value}
          className={cn(
            'flex items-start gap-3 text-fg',
            variant === 'card' && 'rounded-control border border-line-strong bg-surface p-3 has-[[data-checked]]:border-accent has-[[data-checked]]:bg-accent-soft',
            o.disabled && 'opacity-50',
          )}
        >
          <Radio.Root
            value={o.value}
            disabled={o.disabled}
            // the round control is a span: it is named by the words beside it, not by the wrapping label
            aria-labelledby={`${base}-${i}`}
            className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface transition-colors duration-(--dur-micro) ease-standard hover:border-fg data-[checked]:border-accent"
          >
            <Radio.Indicator className="size-2.5 rounded-full bg-accent" />
          </Radio.Root>
          <span id={`${base}-${i}`} className="flex flex-col text-(length:--control-text)">
            {o.label}
            {o.description ? <span className="text-sm text-muted">{o.description}</span> : null}
          </span>
        </label>
      ))}
    </BaseRadioGroup>
  )
}
