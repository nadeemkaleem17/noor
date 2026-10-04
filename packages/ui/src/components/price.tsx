import type { Money } from '@noor/contract'
import { formatMoney, type Locale, type PriceDisplay } from '@noor/i18n'
import { useTranslation } from 'react-i18next'
import { cn } from '../cn'

const sizes = { sm: 'text-sm', md: 'text-md', lg: 'text-lg font-medium' } as const

type Props = {
  money: Money
  /** The original price when `money` is a sale price: shown struck through. */
  compareAt?: Money
  size?: keyof typeof sizes
  /** Store setting `priceDisplay` (decimals and rounding). Presentation only. */
  display?: PriceDisplay
  className?: string
}

/** Prices are always left-to-right, even inside Urdu text. The sale price uses the sale color. */
export function Price({ money, compareAt, size = 'md', display, className }: Props) {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language === 'ur' ? 'ur' : 'en') satisfies Locale
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
