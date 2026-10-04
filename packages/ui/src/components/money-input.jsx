import { moneyToDecimalString, money, parseRupees } from '@noor/contract'
import { useState } from 'react'
import { Input } from './input'

/**
 * @typedef {Omit<import('./input').InputProps, 'value' | 'defaultValue' | 'onChange' | 'onValueChange' | 'prefix' | 'type' | 'inputMode' | 'dir'> & {
 * value: import('@noor/contract').Money | null;
 * onValueChange: (value: import('@noor/contract').Money | null) => void;
 * currencyLabel?: string;
 * }} MoneyInputProps
 */

/**
 * @param {import('@noor/contract').Money | null} m
 * @returns {string}
 */
const toText = (m) => (m ? moneyToDecimalString(m) : '')

/**
 * The person types rupees; the value is integer paisa (ADR-0013). Text that is not a valid amount gives `null`.
 * @param {MoneyInputProps} props
 */
export function MoneyInput({ value, onValueChange, currencyLabel = 'Rs', onBlur, ...props }) {
  const [text, setText] = useState(toText(value))
  const [seen, setSeen] = useState(value?.amount ?? null)
  // The parent changed the value (reset, loaded record): show it. Our own edits update `seen` first, so they do not loop back.
  if ((value?.amount ?? null) !== seen) {
    setSeen(value?.amount ?? null)
    setText(toText(value))
  }
  return (
    <Input
      {...props}
      dir="ltr"
      inputMode="decimal"
      autoComplete="off"
      prefix={currencyLabel}
      value={text}
      onChange={(e) => {
        const raw = e.currentTarget.value
        const paisa = raw.trim() === '' ? null : parseRupees(raw)
        setText(raw)
        setSeen(paisa)
        onValueChange(paisa === null ? null : money(paisa))
      }}
      onBlur={(e) => {
        if (value) setText(toText(value)) // "6990" -> "6990.00"
        onBlur?.(e)
      }}
      invalid={props.invalid || (text.trim() !== '' && parseRupees(text) === null)}
    />
  )
}
