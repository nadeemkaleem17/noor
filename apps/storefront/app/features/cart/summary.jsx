import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useFetchers } from 'react-router'
import { formatMoney } from '@noor/i18n'
import { Button, LinkButton } from '@noor/ui/button'
import { ShopPrice as Price } from '../catalog/shop-price'
import { useLocalePath, useShell } from '../layout/use-shell'

/**
 * What the cart comes to (plan/06-storefront/05-cart-checkout.md section 3). Every figure is what the API returned, shown as it came: nothing here adds, subtracts or multiplies money. While an
 * action on the cart is on its way the figures are dimmed, because they are about to change and only the API can say to what.
 * @param {{ cart: import('@noor/contract').Cart, footer?: boolean, onNavigate?: () => void }} props `footer`: the short form in the drawer
 */
export function CartSummary({ cart, footer, onNavigate }) {
  const { t } = useTranslation('storefront')
  const shell = useShell()
  const path = useLocalePath()
  const busy = useFetchers().some((f) => f.state !== 'idle' && f.formAction?.endsWith('/cart'))
  const money = (/** @type {import('@noor/contract').Money} */ m) => formatMoney(m, shell?.locale ?? 'en', shell?.config.priceDisplay)
  const remaining = cart.messages.find((m) => m.code === 'free_shipping_remaining')
  const applied = cart.messages.some((m) => m.code === 'free_shipping_applied')
  const checkout = path('/checkout')

  return (
    <section aria-label={t('cart.summary')} aria-busy={busy} className={`flex flex-col gap-3 rounded-card border border-line p-4 transition-opacity ${busy ? 'opacity-60' : ''}`}>
      {footer ? null : (
        <dl className="flex flex-col gap-2">
          <div className="flex justify-between"><dt>{t('cart.subtotal')}</dt><dd><Price money={cart.subtotal} /></dd></div>
          {cart.discount.amount > 0 ? <div className="flex justify-between"><dt>{t('cart.discount')}</dt><dd>−<Price money={cart.discount} /></dd></div> : null}
          <div className="flex justify-between">
            <dt>{t('cart.shipping')}</dt>
            <dd>{cart.shipping ? (cart.shipping.fee.amount === 0 ? t('cart.free') : <Price money={cart.shipping.fee} />) : <span className="text-fg-soft">{applied ? t('cart.free') : t('cart.shippingLater')}</span>}</dd>
          </div>
        </dl>
      )}
      <p className="flex items-baseline justify-between border-t border-line pt-3 font-medium">
        <span>{t('cart.total')}</span>
        <Price money={cart.total} size="lg" />
      </p>
      {remaining?.amount ? <p className="text-sm text-fg-soft">{t('cart.freeRemaining', { amount: money(remaining.amount) })}</p> : null}
      {cart.depositDue ? <p className="text-sm text-fg-soft">{t('cart.deposit', { amount: money(cart.depositDue) })}</p> : null}
      {cart.hasBlockingIssues ? (
        <>
          <p id="checkout-blocked" role="alert" className="text-sm text-danger">{t('cart.blocked')}</p>
          <Button disabled fullWidth size="lg" aria-describedby="checkout-blocked">{t('cart.checkout')}</Button>
        </>
      ) : (
        <LinkButton href={checkout} fullWidth size="lg" render={<RouterLink to={checkout} {...(onNavigate ? { onClick: onNavigate } : {})} />}>{t('cart.checkout')}</LinkButton>
      )}
      {footer ? (
        <RouterLink to={path('/cart')} onClick={onNavigate} className="text-center text-sm underline underline-offset-4">{t('cart.viewCart')}</RouterLink>
      ) : null}
    </section>
  )
}
