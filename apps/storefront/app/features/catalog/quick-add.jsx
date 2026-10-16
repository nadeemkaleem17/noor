import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useFetcher } from 'react-router'
import { useCartDrawer } from '../cart/cart-drawer'
import { useLocalePath } from '../layout/use-shell'
import { useHydrated } from './filters'

/**
 * Quick add on a card (DOC-06.11 section 5.3): a disclosure with the sizes of a product that is sold in one option, size. Pressing a size adds one of it to the bag and, with JavaScript,
 * opens the bag without leaving the page; without it the same form posts to the cart. A size that is sold out is struck through and cannot be pressed.
 * @param {{ product: import('@noor/contract').ProductSummary }} props
 */
export function QuickAdd({ product: p }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const hydrated = useHydrated()
  const fetcher = useFetcher()
  const { setOpen: openCart } = useCartDrawer()
  const answer = fetcher.data
  useEffect(() => {
    if (answer?.ok) openCart(true)
  }, [answer, openCart])
  const sizes = p.quickAdd ?? []
  if (!sizes.length || p.stockStatus === 'sold_out') return null
  const pending = fetcher.state !== 'idle'
  return (
    <details className="mt-2">
      <summary className="min-h-11 cursor-pointer list-none rounded-control border border-line-strong px-3 py-2.5 text-center text-small font-medium hover:bg-surface-2 [&::-webkit-details-marker]:hidden">{t('product.quickAdd.open')}</summary>
      <fetcher.Form method="post" action={path('/cart')} className="mt-2">
        <input type="hidden" name="intent" value="add" />
        <input type="hidden" name="quantity" value="1" />
        {hydrated ? <input type="hidden" name="mode" value="fetch" /> : null}
        <ul aria-label={t('product.quickAdd.sizes')} className="flex flex-wrap gap-2">
          {sizes.map((s) => (
            <li key={s.variantId}>
              <button
                type="submit"
                name="variantId"
                value={s.variantId}
                disabled={!s.inStock || pending}
                aria-label={s.inStock ? t('product.quickAdd.add', { size: s.label }) : t('product.quickAdd.soldOut', { size: s.label })}
                className={`grid min-h-11 min-w-11 place-items-center rounded-control border border-line-strong px-3 text-small hover:bg-surface-2 disabled:cursor-not-allowed ${s.inStock ? '' : 'text-muted line-through'}`}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
        {answer && !answer.ok ? (
          <p role="alert" className="mt-2 text-small text-danger">
            {t('product.quickAdd.failed')}
          </p>
        ) : null}
      </fetcher.Form>
    </details>
  )
}
