import { formatPkMobileLocal, normalizePkMobile } from '@noor/contract'
import { useState } from 'react'
import { Input } from './input'

/**
 * @typedef {Omit<import('./input').InputProps, 'value' | 'defaultValue' | 'onChange' | 'onValueChange' | 'type' | 'inputMode' | 'dir'> & {
 * value: string;
 * onValueChange: (value: string) => void;
 * }} PhoneInputProps
 */

/**
 * Accepts 03001234567, 3001234567, +92..., 0092...; tidies the text on blur. The value is E.164 once the number is valid, otherwise what was typed.
 * @param {PhoneInputProps} props
 */
export function PhoneInput({ value, onValueChange, onBlur, autoComplete = 'tel', ...props }) {
  const [text, setText] = useState(value.startsWith('+92') ? formatPkMobileLocal(value) : value)
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    setText(value.startsWith('+92') ? formatPkMobileLocal(value) : value)
  }
  return (
    <Input
      {...props}
      dir="ltr"
      type="tel"
      inputMode="tel"
      autoComplete={autoComplete}
      value={text}
      onChange={(e) => {
        const raw = e.currentTarget.value
        const e164 = normalizePkMobile(raw)
        const next = e164 ?? raw
        setText(raw)
        setSeen(next)
        onValueChange(next)
      }}
      onBlur={(e) => {
        const e164 = normalizePkMobile(text)
        if (e164) setText(formatPkMobileLocal(e164))
        onBlur?.(e)
      }}
    />
  )
}
