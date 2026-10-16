import { Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { useLocalePath } from '../layout/use-shell'
import { useWishlist } from './use-wishlist'

/** The heart of the header, with the number of saved products once the browser has counted them (the page that a cache keeps holds no number). @param {{ className: string }} props */
export function WishlistLink({ className }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const count = useWishlist().length
  return (
    <RouterLink to={path('/wishlist')} aria-label={count ? t('wishlist.linkCount', { count }) : t('shell.wishlist')} className={`relative ${className}`}>
      <Heart aria-hidden="true" className="size-6" />
      {count ? <span aria-hidden="true" className="absolute end-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-caption font-medium text-on-accent">{count}</span> : null}
    </RouterLink>
  )
}
