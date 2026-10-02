// All display formatting goes through here (ADR-0013 money, ADR-0018 locale). Amounts stay integer paisa until the last step.
import { moneyToDecimalString, type Money } from '@noor/contract'
import { intlTag, type Locale } from './locale'

export type PriceDisplay = { showDecimals: boolean; rounding: 'none' | 'nearest' | 'up' }

const defaultPriceDisplay: PriceDisplay = { showDecimals: true, rounding: 'none' }

/** Presentation rounding to whole rupees; never changes stored amounts (ADR-0013). */
function roundPaisa(amount: number, rounding: PriceDisplay['rounding']): number {
  if (rounding === 'none') return amount
  const rupees = amount / 100
  return (rounding === 'up' ? Math.ceil(rupees) : Math.sign(rupees) * Math.round(Math.abs(rupees))) * 100
}

export function formatMoney(value: Money, locale: Locale, display: PriceDisplay = defaultPriceDisplay): string {
  const amount = roundPaisa(value.amount, display.rounding)
  // ICU gives PKR no decimals by default, so both cases are explicit
  const digits = display.showDecimals ? 2 : 0
  const fraction = { minimumFractionDigits: digits, maximumFractionDigits: digits }
  // Intl accepts an exact decimal string, so no float rupees are ever built.
  return new Intl.NumberFormat(intlTag(locale), { style: 'currency', currency: value.currency, ...fraction }).format(
    moneyToDecimalString(amount) as `${number}`,
  )
}

export const formatNumber = (n: number, locale: Locale, options?: Intl.NumberFormatOptions): string =>
  new Intl.NumberFormat(intlTag(locale), options).format(n)

/** Shop dates are Pakistan time whatever the server's zone is. */
export const formatDate = (value: Date | string, locale: Locale, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string =>
  new Intl.DateTimeFormat(intlTag(locale), { timeZone: 'Asia/Karachi', ...options }).format(new Date(value))
