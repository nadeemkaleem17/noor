import { Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useShell } from '../layout/use-shell'
import { toggleSaved, useWishlist } from './use-wishlist'

/**
 * The heart on a card and the "Save" on the product page: pressed when the product is saved. It is not drawn at all while the shop has the wishlist off, and it does nothing without
 * JavaScript (the list lives in a cookie the browser writes).
 * @param {{ product: { id: string, title: string }, text?: boolean, className?: string }} props `text`: the wide form with a word, for the product page
 */
export function WishlistButton({ product, text = false, className = '' }) {
  const { t } = useTranslation('storefront')
  const on = useShell()?.config.features.wishlist
  const saved = useWishlist().includes(product.id.toLowerCase())
  if (!on) return null
  const label = saved ? t('wishlist.remove', { title: product.title }) : t('wishlist.save', { title: product.title })
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={label}
      onClick={() => toggleSaved(product.id)}
      className={text ? `inline-flex h-11 items-center gap-2 rounded-control border border-line-strong px-4 hover:bg-surface-2 ${className}` : `grid size-10 place-items-center rounded-full bg-bg/90 text-fg shadow-sm hover:bg-bg ${className}`}
    >
      <Heart aria-hidden="true" className={`size-5 ${saved ? 'fill-sale text-sale' : ''}`} />
      {text ? <span>{saved ? t('wishlist.saved') : t('wishlist.saveShort')}</span> : null}
    </button>
  )
}
