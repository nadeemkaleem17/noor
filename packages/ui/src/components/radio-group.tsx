import { Radio } from '@base-ui/react/radio'
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '../cn'

export type RadioOption = { value: string; label: ReactNode; description?: ReactNode; disabled?: boolean }

export type RadioGroupProps = Omit<ComponentProps<typeof BaseRadioGroup>, 'children' | 'onValueChange'> & {
  options: RadioOption[]
  onValueChange?: (value: string) => void
  orientation?: 'vertical' | 'horizontal'
  /** `card`: the whole row is a bordered, clickable target (payment and shipping pickers). */
  variant?: 'default' | 'card'
}

export function RadioGroup({ options, onValueChange, orientation = 'vertical', variant = 'default', className, ...props }: RadioGroupProps) {
  return (
    <BaseRadioGroup
      onValueChange={(v) => onValueChange?.(String(v))}
      className={cn('flex gap-3', orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap', className)}
      {...props}
    >
      {options.map((o) => (
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
            className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface data-[checked]:border-accent"
          >
            <Radio.Indicator className="size-2.5 rounded-full bg-accent" />
          </Radio.Root>
          <span className="flex flex-col text-(length:--control-text)">
            {o.label}
            {o.description ? <span className="text-sm text-muted">{o.description}</span> : null}
          </span>
        </label>
      ))}
    </BaseRadioGroup>
  )
}
