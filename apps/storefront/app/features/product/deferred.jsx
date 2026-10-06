import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFetcher } from 'react-router'
import { formatDate } from '@noor/i18n'
import { Button } from '@noor/ui/button'
import { Image, imageProps } from '@noor/ui/image'
import { useHydrated } from '../catalog/filters'
import { ProductCard } from '../catalog/product-card'
import { localePath } from '~/lib/paths'
import { useLocalePath, useShell } from '../layout/use-shell'

/** @typedef {import('@noor/contract').ReviewListing} ReviewListing */
/** @typedef {import('@noor/contract').ProductSummary} ProductSummary */

/** @param {{ n: number }} props */
function Stars({ n }) {
  const { t } = useTranslation('storefront')
  return (
    <span role="img" aria-label={t('pdp.stars', { n })} className="text-warning">
      {'★'.repeat(n)}
      <span className="text-line-strong">{'★'.repeat(5 - n)}</span>
    </span>
  )
}

/** @param {{ review: ReviewListing['items'][number] }} props */
function Review({ review: r }) {
  const { t } = useTranslation('storefront')
  const locale = useShell()?.locale ?? 'en'
  const brand = useShell()?.config.brand.name ?? ''
  return (
    <li className="flex flex-col gap-2 border-b border-line py-4">
      <div className="flex flex-wrap items-center gap-x-3">
        <Stars n={r.rating} />
        {r.title ? <span className="font-medium">{r.title}</span> : null}
      </div>
      <p>{r.body}</p>
      {r.photos.length ? (
        <ul className="flex flex-wrap gap-2">
          {r.photos.map((p) => (
            <li key={p.src}>
              <a href={p.src} className="block overflow-hidden rounded-control">
                <Image {...imageProps(p)} alt={p.alt || t('pdp.reviewPhoto')} sizes="96px" className="size-24 object-cover" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-sm text-muted">
        {r.displayName} · {formatDate(r.createdAt, locale)}
        {r.fit ? ` · ${t(`pdp.fit.${r.fit}`)}` : ''}
      </p>
      {r.reply ? (
        <div className="ms-6 rounded-card bg-surface-2 p-3 text-sm">
          <p className="font-medium">{t('pdp.reviewReply', { brand })}</p>
          <p>{r.reply.body}</p>
        </div>
      ) : null}
    </li>
  )
}

/** The reviews after the first page, each page fetched when asked for, with its own button for the next. @param {{ productId: string, cursor: string }} props */
function MoreReviews({ productId, cursor }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const fetcher = useFetcher()
  const { load, data } = fetcher
  const [asked, setAsked] = useState(false)
  const href = path(`/reviews/${productId}?cursor=${encodeURIComponent(cursor)}`)
  useEffect(() => {
    void load(href)
  }, [load, href])
  if (!data) return <p aria-busy="true" className="py-4 text-sm text-muted">{t('pdp.loading')}</p>
  if (!data.items) return <p role="alert" className="py-4 text-sm text-danger">{t('pdp.reviewsFailed')}</p>
  return (
    <>
      <ul>{data.items.map((/** @type {ReviewListing['items'][number]} */ r) => <Review key={r.id} review={r} />)}</ul>
      {data.nextCursor ? (asked ? <MoreReviews productId={productId} cursor={data.nextCursor} /> : <Button variant="secondary" onClick={() => setAsked(true)}>{t('pdp.moreReviews')}</Button>) : null}
    </>
  )
}

/** The approved reviews of the product (plan/06-storefront/04-pdp.md section 9): the average and a bar for each star, the first five, more on request. There is no form here: a review is written from the link sent after delivery. @param {{ listing: ReviewListing, productId: string }} props */
export function ReviewsSection({ listing, productId }) {
  const { t } = useTranslation('storefront')
  const hydrated = useHydrated()
  const [more, setMore] = useState(false)
  const { summary } = listing
  if (!summary.count) return null
  return (
    <section id="reviews" aria-labelledby="reviews-h" className="scroll-mt-24">
      <h2 id="reviews-h" className="font-heading text-2xl">{t('pdp.reviews')}</h2>
      <div className="mt-4 flex flex-wrap items-center gap-8">
        <p className="text-4xl tabular-nums">
          {summary.average.toFixed(1)}
          <span className="block text-sm text-fg-soft">{t('pdp.reviewCount', { count: summary.count })}</span>
        </p>
        <ul className="flex min-w-48 flex-1 flex-col gap-1 text-sm" aria-label={t('pdp.byStar')}>
          {[5, 4, 3, 2, 1].map((star) => {
            const n = summary.byStar[star - 1] ?? 0
            return (
              <li key={star} className="flex items-center gap-2">
                <span className="w-12 tabular-nums">{t('pdp.starsShort', { n: star })}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"><span className="block h-full bg-warning" style={{ width: `${(n / summary.count) * 100}%` }} /></span>
                <span className="w-8 text-end tabular-nums text-muted">{n}</span>
              </li>
            )
          })}
        </ul>
      </div>
      <ul className="mt-4">{listing.items.map((r) => <Review key={r.id} review={r} />)}</ul>
      {listing.nextCursor ? (more ? <MoreReviews productId={productId} cursor={listing.nextCursor} /> : hydrated ? <Button variant="secondary" onClick={() => setMore(true)}>{t('pdp.moreReviews')}</Button> : null) : null}
    </section>
  )
}

/** Related products: a swipeable row on a phone, a grid from `lg`. @param {{ items: ProductSummary[], title?: string }} props */
export function RelatedSection({ items, title }) {
  const { t } = useTranslation('storefront')
  const id = useId()
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="font-heading text-2xl">{title ?? t('pdp.related')}</h2>
      <ul className="mt-4 flex snap-x gap-4 overflow-x-auto pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible">
        {items.map((p) => (
          <li key={p.id} className="w-[60%] shrink-0 snap-start sm:w-[40%] lg:w-auto">
            <ProductCard product={p} />
          </li>
        ))}
      </ul>
    </section>
  )
}

const RECENT = 'nc_recent'
/** @returns {string[]} */
function readRecent() {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 8) : []
  } catch {
    return []
  }
}

/**
 * The last products this browser looked at (plan/06-storefront/04-pdp.md section 9). Kept in the browser only and fetched after hydration, so the page itself is the same for everyone and
 * can be cached; nothing is drawn when there is nothing to show.
 * @param {{ id: string }} props
 */
export function RecentlyViewed({ id }) {
  const { t } = useTranslation('storefront')
  const locale = useShell()?.locale ?? 'en'
  const fetcher = useFetcher()
  const { load } = fetcher
  useEffect(() => {
    const before = readRecent().filter((x) => x !== id)
    try {
      localStorage.setItem(RECENT, JSON.stringify([id, ...before].slice(0, 8)))
    } catch {
      // storage blocked: nothing is remembered, nothing breaks
    }
    if (before.length) void load(localePath(locale, `/recent?ids=${before.join(',')}`))
  }, [id, load, locale])
  const items = fetcher.data?.items
  return items?.length ? <RelatedSection items={items} title={t('pdp.recent')} /> : null
}
