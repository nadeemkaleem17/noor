import { useTranslation } from 'react-i18next'
import { Image, imageProps } from '@noor/ui/image'
import { ShopPrice as Price } from '../catalog/shop-price'

/**
 * The order beside the form (plan/06-storefront/05-cart-checkout.md section 4): what is being bought and what it comes to. Every figure is what the API returned; nothing is added here.
 * @param {{ cart: import('@noor/contract').Cart, pending?: boolean }} props
 */
export function OrderSummary({ cart, pending }) {
  const { t } = useTranslation('storefront')
  return (
    <div aria-busy={pending} className={`flex flex-col gap-4 transition-opacity ${pending ? 'opacity-60' : ''}`}>
      <ul className="flex flex-col gap-3">
        {cart.lines.map((l) => (
          <li key={l.id} className="flex gap-3">
            {l.image ? <Image {...imageProps(l.image)} alt="" sizes="64px" ratio="3 / 4" className="w-14 shrink-0 rounded-control bg-surface-2" /> : <div className="aspect-3/4 w-14 shrink-0 rounded-control bg-surface-2" />}
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">{l.title}</p>
              <p className="text-fg-soft">{[l.variantLabel, t('checkout.qty', { n: l.quantity })].filter(Boolean).join(' · ')}</p>
            </div>
            <Price money={l.lineSubtotal} size="sm" />
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-2 border-t border-line pt-3">
        <div className="flex justify-between"><dt>{t('cart.subtotal')}</dt><dd><Price money={cart.subtotal} /></dd></div>
        {cart.discount.amount > 0 ? <div className="flex justify-between"><dt>{t('cart.discount')}</dt><dd>−<Price money={cart.discount} /></dd></div> : null}
        <div className="flex justify-between">
          <dt>{t('cart.shipping')}</dt>
          <dd>{cart.shipping ? (cart.shipping.fee.amount === 0 ? t('cart.free') : <Price money={cart.shipping.fee} />) : <span className="text-fg-soft">{t('checkout.shippingAfterCity')}</span>}</dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-line pt-3 font-medium"><dt>{t('cart.total')}</dt><dd><Price money={cart.total} size="lg" /></dd></div>
        {cart.depositDue ? <div className="flex justify-between text-sm text-fg-soft"><dt>{t('checkout.depositNow')}</dt><dd><Price money={cart.depositDue} size="sm" /></dd></div> : null}
        {cart.dueOnDelivery && cart.depositDue ? <div className="flex justify-between text-sm text-fg-soft"><dt>{t('checkout.dueOnDelivery')}</dt><dd><Price money={cart.dueOnDelivery} size="sm" /></dd></div> : null}
      </dl>
    </div>
  )
}
