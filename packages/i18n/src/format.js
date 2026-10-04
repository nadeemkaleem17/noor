// All display formatting goes through here (ADR-0013 money, ADR-0018 locale). Amounts stay integer paisa until the last step.
import { moneyToDecimalString } from '@noor/contract'
import { intlTag } from './locale.js'

/**
 * @typedef {object} PriceDisplay
 * @property {boolean} showDecimals
 * @property {'none' | 'nearest' | 'up'} rounding
 */

const defaultPriceDisplay = /** @type {PriceDisplay} */ ({ showDecimals: true, rounding: 'none' })

/**
 * Presentation rounding to whole rupees; never changes stored amounts (ADR-0013).
 * @param {number} amount
 * @param {PriceDisplay['rounding']} rounding
 * @returns {number}
 */
function roundPaisa(amount, rounding) {
  if (rounding === 'none') return amount
  const rupees = amount / 100
  return (rounding === 'up' ? Math.ceil(rupees) : Math.sign(rupees) * Math.round(Math.abs(rupees))) * 100
}

/**
 * @param {import('@noor/contract').Money} value
 * @param {import('./locale.js').Locale} locale
 * @param {PriceDisplay} [display]
 * @returns {string}
 */
export function formatMoney(value, locale, display = defaultPriceDisplay) {
  const amount = roundPaisa(value.amount, display.rounding)
  // ICU gives PKR no decimals by default, so both cases are explicit
  const digits = display.showDecimals ? 2 : 0
  const fraction = { minimumFractionDigits: digits, maximumFractionDigits: digits }
  // Intl accepts an exact decimal string, so no float rupees are ever built.
  return new Intl.NumberFormat(intlTag(locale), { style: 'currency', currency: value.currency, ...fraction }).format(
    /** @type {`${number}`} */ (moneyToDecimalString(amount)),
  )
}

/**
 * @param {number} n
 * @param {import('./locale.js').Locale} locale
 * @param {Intl.NumberFormatOptions} [options]
 * @returns {string}
 */
export const formatNumber = (n, locale, options) =>
  new Intl.NumberFormat(intlTag(locale), options).format(n)

/**
 * Shop dates are Pakistan time whatever the server's zone is.
 * @param {Date | string} value
 * @param {import('./locale.js').Locale} locale
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string}
 */
export const formatDate = (value, locale, options = { dateStyle: 'medium' }) =>
  new Intl.DateTimeFormat(intlTag(locale), { timeZone: 'Asia/Karachi', ...options }).format(new Date(value))
