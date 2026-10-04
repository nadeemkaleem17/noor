import { NumberField } from '@base-ui/react/number-field'
import { Minus, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../cn'

type Props = {
  value: number
  onValueChange: (value: number) => void
  min?: number
  /** Available stock. At the limit the plus button is disabled and a message is read out politely. */
  max?: number
  disabled?: boolean
  decreaseLabel?: string
  increaseLabel?: string
  maxMessage?: string
  /** Accessible name of the number; defaults to "Quantity". */
  label?: string
  className?: string
}

const button =
  'flex size-11 items-center justify-center bg-surface text-fg hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50'

export function QuantityStepper({ value, onValueChange, min = 1, max, disabled, decreaseLabel, increaseLabel, maxMessage, label, className }: Props) {
  const { t } = useTranslation()
  const atMax = max !== undefined && value >= max
  return (
    <div className={cn('inline-flex flex-col gap-1', className)}>
      <NumberField.Root
        value={value}
        min={min}
        max={max}
        step={1}
        largeStep={10}
        disabled={disabled}
        format={{ maximumFractionDigits: 0 }}
        onValueChange={(v) => {
          if (v !== null) onValueChange(v)
        }}
        className="inline-flex"
      >
        <NumberField.Group className="inline-flex items-stretch overflow-hidden rounded-control border border-line-strong">
          <NumberField.Decrement aria-label={decreaseLabel ?? t('decrease')} className={button}>
            <Minus aria-hidden className="size-4" />
          </NumberField.Decrement>
          <NumberField.Input aria-label={label ?? t('quantity')} className="h-11 w-14 border-x border-line-strong bg-surface text-center text-md tabular-nums text-fg" />
          <NumberField.Increment aria-label={increaseLabel ?? t('increase')} className={button}>
            <Plus aria-hidden className="size-4" />
          </NumberField.Increment>
        </NumberField.Group>
      </NumberField.Root>
      <span role="status" className="text-sm text-muted">
        {atMax ? (maxMessage ?? t('maxQuantity')) : null}
      </span>
    </div>
  )
}
