import { ArrowLeft, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { useLocalePath } from './use-shell'

/** The top of the checkout (plan/06-storefront/05-cart-checkout.md section 4): the logo, the way back to the cart, and nothing else to wander off to. @param {{ brand: string, logo?: import('@noor/contract').Image | undefined }} props */
export function CheckoutHeader({ brand, logo }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  return (
    <header className="border-b border-line bg-bg">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <RouterLink to={path('/cart')} className="inline-flex min-h-11 items-center gap-2 text-sm underline-offset-4 hover:underline">
          <ArrowLeft aria-hidden="true" className="size-5 rtl:rotate-180" />
          {t('checkout.backToCart')}
        </RouterLink>
        <RouterLink to={path('/')} className="font-heading text-2xl font-semibold text-fg">
          {logo ? <img src={logo.src} srcSet={logo.srcset} alt={brand} width={logo.width} height={logo.height} className="h-8 w-auto" /> : brand}
        </RouterLink>
        <p className="inline-flex items-center gap-1 text-sm text-fg-soft"><Lock aria-hidden="true" className="size-4" />{t('checkout.secure')}</p>
      </div>
    </header>
  )
}
