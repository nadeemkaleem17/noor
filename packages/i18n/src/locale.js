import { enums } from '@noor/contract'

/** @typedef {import('@noor/contract').Locale} Locale */

export const supportedLocales = enums.locale
export const defaultLocale = /** @type {import('@noor/contract').Locale} */ ('en')

/**
 * @param {unknown} v
 * @returns {v is import('@noor/contract').Locale}
 */
export const isLocale = (v) => (/** @type {readonly unknown[]} */ (supportedLocales)).includes(v)

/**
 * @param {import('@noor/contract').Locale} locale
 * @returns {'ltr' | 'rtl'}
 */
export const dirOf = (locale) => (locale === 'ur' ? 'rtl' : 'ltr')

/**
 * BCP 47 tag for `Intl`. `-u-nu-latn` keeps Western digits (0-9), the ADR-0018 default for prices and numbers.
 * @param {import('@noor/contract').Locale} locale
 * @returns {string}
 */
export const intlTag = (locale) => `${locale}-PK-u-nu-latn`
