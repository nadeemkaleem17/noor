import { NumberField } from '@base-ui/react/number-field'
import { Minus, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../cn'

/**
 * @typedef {object} Props
 * @property {number} value
 * @property {(value: number) => void} onValueChange
 * @property {number} [min]
 * @property {number} [max] - Available stock. At the limit the plus button is disabled and a message is read out politely.
 * @property {boolean} [disabled]
 * @property {string} [decreaseLabel]
 * @property {string} [increaseLabel]
 * @property {string} [maxMessage]
 * @property {string} [label] - Accessible name of the number; defaults to "Quantity".
 * @property {string} [className]
 */

const button =
  'flex size-11 items-center justify-center bg-surface text-fg hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50'

/**
 * @param {Props} props
 */
export function QuantityStepper({ value, onValueChange, min = 1, max, disabled, decreaseLabel, increaseLabel, maxMessage, label, className }) {
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
