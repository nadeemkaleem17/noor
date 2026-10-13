import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useFetcher } from 'react-router'
import { Drawer } from '@noor/ui/drawer'
import { Skeleton } from '@noor/ui/skeleton'
import { useLocalePath } from '../layout/use-shell'
import { useCartDrawer } from './cart-drawer'
import { CartLines } from './cart-lines'
import { CartSummary } from './summary'

/**
 * The cart in a panel (plan/06-storefront/05-cart-checkout.md section 3): the same lines and totals as the cart page, a bottom sheet on a phone and a side panel from `md`.
 * The cart is read when it opens, and again whenever an action changes it (the router does that for every fetcher that has loaded something).
 */
export default function CartPanel() {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const { open, setOpen } = useCartDrawer()
  const fetcher = useFetcher({ key: 'cart-drawer' })
  const { load } = fetcher
  const href = path('/cart')
  useEffect(() => {
    if (open) void load(href)
  }, [open, load, href])
  /** @type {import('@noor/contract').Cart | undefined} */
  const cart = fetcher.data?.cart
  return (
    <Drawer open={open} onOpenChange={setOpen} title={t('cart.title')} footer={cart?.lines.length ? <div className="w-full"><CartSummary cart={cart} footer onNavigate={() => setOpen(false)} /></div> : null}>
      {!cart ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : cart.lines.length === 0 ? (
        <p className="py-8 text-center text-fg-soft">{t('cart.empty')}</p>
      ) : (
        <CartLines cart={cart} compact />
      )}
    </Drawer>
  )
}
