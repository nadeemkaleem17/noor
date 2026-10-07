import { ShoppingBag } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useFetcher, useLocation } from 'react-router'
import { localePath } from '~/lib/paths'
import { useHydrated } from '../catalog/filters'
import { useShell } from '../layout/use-shell'
import { useCartDrawer } from './cart-drawer'

/**
 * The cart button of the header: a real link to the cart, with the number of things in it, which the browser asks for after the page has loaded (the page itself is the same for everyone
 * and may be cached). With JavaScript the link opens the drawer instead, except on the cart page itself.
 * @param {{ className: string }} props
 */
export function CartLink({ className }) {
  const { t } = useTranslation('storefront')
  const locale = useShell()?.locale ?? 'en'
  const { pathname } = useLocation()
  const hydrated = useHydrated()
  const { setOpen } = useCartDrawer()
  const fetcher = useFetcher({ key: 'cart-count' })
  const { load } = fetcher
  useEffect(() => {
    void load(localePath(locale, '/cart?summary=1'))
  }, [load, locale])
  const count = /** @type {number} */ (fetcher.data?.count ?? 0)
  const onCartPage = /^(\/ur)?\/cart\/?$/.test(pathname)
  return (
    <RouterLink
      to={localePath(locale, '/cart')}
      aria-label={count ? t('shell.cartCount', { count }) : t('shell.cart')}
      className={`relative ${className}`}
      onClick={(e) => {
        if (!hydrated || onCartPage) return
        e.preventDefault()
        setOpen(true)
      }}
    >
      <ShoppingBag aria-hidden="true" className="size-6" />
      {count ? <span aria-hidden="true" className="absolute end-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-xs font-medium text-on-accent">{count}</span> : null}
    </RouterLink>
  )
}
