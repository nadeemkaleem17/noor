import { formatMoney } from '@noor/i18n'
import { useTranslation } from 'react-i18next'
import { cn } from '../cn'

const sizes = /** @type {const} */ ({ sm: 'text-sm', md: 'text-md', lg: 'text-lg font-medium' })

/**
 * @typedef {object} Props
 * @property {import('@noor/contract').Money} money
 * @property {import('@noor/contract').Money} [compareAt] - The original price when `money` is a sale price: shown struck through.
 * @property {keyof typeof sizes} [size]
 * @property {import('@noor/i18n').PriceDisplay} [display] - Store setting `priceDisplay` (decimals and rounding). Presentation only.
 * @property {string} [className]
 */

/**
 * Prices are always left-to-right, even inside Urdu text. The sale price uses the sale color.
 * @param {Props} props
 */
export function Price({ money, compareAt, size = 'md', display, className }) {
  const { t, i18n } = useTranslation()
  const locale = /** @satisfies {import('@noor/i18n').Locale} */ ((i18n.language === 'ur' ? 'ur' : 'en'))
  const onSale = compareAt !== undefined && compareAt.amount > money.amount
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-2', sizes[size], className)}>
      <bdi dir="ltr" className={cn('tabular-nums', onSale && 'text-sale')}>
        {formatMoney(money, locale, display)}
      </bdi>
      {onSale ? (
        <bdi dir="ltr" className="text-sm tabular-nums text-muted line-through">
          <span className="sr-only">{t('was')} </span>
          {formatMoney(compareAt, locale, display)}
        </bdi>
      ) : null}
    </span>
  )
}
