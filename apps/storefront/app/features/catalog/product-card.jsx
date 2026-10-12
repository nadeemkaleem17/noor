import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { Image, imageProps } from '@noor/ui/image'
import { Price } from '@noor/ui/price'
import { useLocalePath, useShell } from '../layout/use-shell'
import { WishlistButton } from '../wishlist/wishlist-button'

/** @typedef {import('@noor/contract').ProductSummary} ProductSummary */

/** How much is off, worked out from the two prices: the one place the percentage is computed. @param {import('@noor/contract').Money} price @param {import('@noor/contract').Money} compareAt */
export const percentOff = (price, compareAt) => Math.round(((compareAt.amount - price.amount) / compareAt.amount) * 100)

/** The one badge a card shows, by priority (plan/06-storefront/03-plp-search.md section 3): sold out, then sale, made to order, limited, new, bestseller. @param {ProductSummary} p */
export function badgeOf(p) {
  if (p.badges.includes('sold_out') || p.stockStatus === 'sold_out') return { name: /** @type {const} */ ('sold_out') }
  if (p.badges.includes('sale') && p.compareAtFrom && p.compareAtFrom.amount > p.priceFrom.amount) {
    return { name: /** @type {const} */ ('sale'), percent: percentOff(p.priceFrom, p.compareAtFrom) }
  }
  const next = /** @type {const} */ (['made_to_order', 'limited', 'new', 'bestseller']).find((b) => p.badges.includes(b))
  return next ? { name: next } : undefined
}

/** A colour swatch: one or two flat colours. A swatch that is a picture has no address here to draw, so it shows a neutral dot. @param {{ swatch: import('@noor/contract').Swatch }} props */
export function Dot({ swatch }) {
  const colours = 'hex' in swatch ? swatch.hex : []
  return (
    <span
      aria-hidden="true"
      className="inline-block size-4 rounded-full border border-line-strong"
      style={{ background: colours.length > 1 ? `linear-gradient(135deg, ${colours[0]} 50%, ${colours[1]} 50%)` : (colours[0] ?? 'var(--sem-surface-2)') }}
    />
  )
}

/**
 * A product in a grid (plan/06-storefront/03-plp-search.md section 3). The whole card is one link to the product; the colour swatches sit beside it, not inside it (a link
 * must not contain a link). With a second picture, a pointer hovering the card shows it. No add-to-cart here: most pieces need a size first.
 * @param {{ product: ProductSummary, priority?: boolean }} props
 */
export function ProductCard({ product: p, priority = false }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const display = useShell()?.config.priceDisplay
  const badge = badgeOf(p)
  const soldOut = badge?.name === 'sold_out'
  const range = p.priceTo !== undefined && p.priceTo.amount !== p.priceFrom.amount
  const swatches = p.colorways.slice(0, 4)

  return (
    <article className="group relative flex flex-col">
      <RouterLink to={path(`/p/${p.handle}`)} prefetch="intent" className="flex flex-col gap-2 rounded-card focus-visible:outline-2">
        <span className="relative block overflow-hidden rounded-media bg-surface-2">
          <Image
            {...imageProps(p.primaryImage)}
            alt={p.primaryImage.alt || p.title}
            sizes="(min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw"
            priority={priority ? 'eager' : false}
            ratio="var(--media-ratio, 3 / 4)"
            className={`w-full ${soldOut ? 'opacity-60' : ''}`}
          />
          {p.secondaryImage ? (
            <Image
              {...imageProps(p.secondaryImage)}
              alt=""
              sizes="(min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw"
              ratio="var(--media-ratio, 3 / 4)"
              className="absolute inset-0 hidden h-full w-full opacity-0 transition-opacity duration-(--dur-micro) [@media(hover:hover)]:block [@media(hover:hover)]:group-hover:opacity-100"
            />
          ) : null}
          {badge ? (
            <span className="absolute start-2 top-2 rounded-control bg-bg px-2 py-0.5 text-xs font-medium text-fg shadow-sm">
              {t(`product.badge.${badge.name}`, { percent: 'percent' in badge ? badge.percent : undefined })}
            </span>
          ) : null}
        </span>
        <span className="line-clamp-2 text-fg">{p.title}</span>
        <span className="flex flex-wrap items-baseline gap-x-1">
          {range ? <span className="text-sm text-fg-soft">{t('product.from')}</span> : null}
          <Price money={p.priceFrom} {...(p.compareAtFrom && !range ? { compareAt: p.compareAtFrom } : {})} display={display} />
        </span>
      </RouterLink>
      {/* beside the link, not in it: a link must not hold a button */}
      <WishlistButton product={p} className="absolute end-2 top-2" />
      {p.colorways.length > 1 ? (
        <ul className="mt-2 flex items-center gap-1.5" aria-label={t('product.colour', { name: '' }).replace(/:\s*$/, '')}>
          {swatches.map((c) => (
            <li key={c.handle}>
              <RouterLink to={path(`/p/${c.handle}`)} aria-label={t('product.colour', { name: c.label })} aria-current={c.current ? 'true' : undefined} className={`grid size-6 place-items-center rounded-full ${c.current ? 'ring-2 ring-fg' : ''}`}>
                <Dot swatch={c.swatch} />
              </RouterLink>
            </li>
          ))}
          {p.colorways.length > swatches.length ? <li className="text-xs text-fg-soft">{t('product.moreColours', { count: p.colorways.length - swatches.length })}</li> : null}
        </ul>
      ) : null}
    </article>
  )
}

/** The grid a card sits in: two across on a phone, three on a tablet, four on a desktop. The first `eager` cards load first (a listing page's top row; on the home page none, the hero picture is the one that does). @param {{ items: ProductSummary[], eager?: number }} props */
export function ProductGrid({ items, eager = 4 }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
      {items.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < eager} />
        </li>
      ))}
    </ul>
  )
}
