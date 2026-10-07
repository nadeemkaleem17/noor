import { useTranslation } from 'react-i18next'
import { useFetcher } from 'react-router'
import { formatMoney } from '@noor/i18n'
import { Button } from '@noor/ui/button'
import { ShopPrice as Price } from '../catalog/shop-price'
import { useHydrated } from '../catalog/filters'
import { useLocalePath, useShell } from '../layout/use-shell'

/**
 * The promo code box (plan/06-storefront/05-cart-checkout.md section 3): "Have a promo code?" opens a field; an applied code shows as a chip that takes it off. One code per cart. The
 * shop decides whether a code applies, never this page: the message is the API's reason.
 * @param {{ cart: import('@noor/contract').Cart, error?: string | undefined, amount?: number | undefined }} props `error` and `amount` are the reason a visitor without JavaScript was sent back with
 */
export function Promo({ cart, error, amount }) {
  const { t } = useTranslation('storefront')
  const shell = useShell()
  const path = useLocalePath()
  const hydrated = useHydrated()
  const fetcher = useFetcher()
  const action = path('/cart')
  const fail = fetcher.data && !fetcher.data.ok ? fetcher.data : undefined
  const code = fail?.error ?? error
  const minSpend = fail?.amount ?? amount
  const reason = code?.startsWith('promo_') ? t(`cart.promo.${code}`, { amount: minSpend !== undefined ? formatMoney({ amount: minSpend, currency: 'PKR' }, shell?.locale ?? 'en', shell?.config.priceDisplay) : '' }) : code === 'invalid' || code === 'busy' || code === 'failed' ? t(`cart.errors.${code}`) : undefined

  if (cart.promo) {
    return (
      <div className="flex flex-col gap-1">
        <fetcher.Form method="post" action={action} className="flex items-center justify-between gap-3 rounded-card bg-accent-soft p-3">
          <input type="hidden" name="intent" value="removePromo" />
          {hydrated ? <input type="hidden" name="mode" value="fetch" /> : null}
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium">{cart.promo.code}</span>
            <span className="text-sm text-fg-soft">{cart.promo.label}</span>
            <span className="text-sm">−<Price money={cart.promo.discount} size="sm" /></span>
          </p>
          <Button type="submit" variant="ghost" size="sm" aria-label={t('cart.promo.remove', { code: cart.promo.code })}>✕</Button>
        </fetcher.Form>
        {reason ? <p role="alert" className="text-sm text-danger">{reason}</p> : null}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <details open={Boolean(reason) || undefined} className="group">
        <summary className="cursor-pointer text-sm underline underline-offset-4">{t('cart.promo.have')}</summary>
        <fetcher.Form method="post" action={action} className="mt-2 flex gap-2">
          <input type="hidden" name="intent" value="applyPromo" />
          {hydrated ? <input type="hidden" name="mode" value="fetch" /> : null}
          <label className="sr-only" htmlFor="promo-code">{t('cart.promo.label')}</label>
          <input id="promo-code" name="code" required maxLength={20} autoCapitalize="characters" autoComplete="off" aria-invalid={reason ? true : undefined} aria-describedby={reason ? 'promo-error' : undefined} className="h-11 min-w-0 flex-1 rounded-control border border-line-strong bg-surface px-3 uppercase" />
          <Button type="submit" variant="secondary" loading={fetcher.state !== 'idle'}>{t('cart.promo.apply')}</Button>
        </fetcher.Form>
      </details>
      {reason ? <p id="promo-error" role="alert" className="text-sm text-danger">{reason}</p> : null}
      {cart.promoProblem ? <p className="text-sm text-warning">{cart.promoProblem}</p> : null}
    </div>
  )
}
