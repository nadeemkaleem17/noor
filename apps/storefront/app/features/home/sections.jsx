import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { formatMoney } from '@noor/i18n'
import { Carousel } from '@noor/ui/carousel'
import { Image, imageProps } from '@noor/ui/image'
import { SafeLinkButton } from '../layout/safe-link'
import { useLocalePath, useShell } from '../layout/use-shell'

/** @typedef {import('@noor/contract').HomePublic} HomePublic */

const slideText = 'absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 bg-gradient-to-t from-black/75 via-black/40 to-transparent p-6 pt-20 text-white md:p-12'

/** One slide: a picture across the width, its words on a dark gradient (so white text always reads), and a button. Only the first slide's picture is loaded eagerly: it is the page's largest element. @param {{ slide: HomePublic['heroSlides'][number], first: boolean, heading: 'h1' | 'h2' }} props */
function Slide({ slide, first, heading: Heading }) {
  const { t } = useTranslation('storefront')
  return (
    <div className="relative w-full shrink-0 snap-start">
      <div className="aspect-[4/5] w-full md:aspect-[16/7]">
        <Image {...imageProps(slide.image)} priority={first} sizes="100vw" style={{ aspectRatio: 'auto' }} className="h-full w-full" />
      </div>
      <div className={slideText}>
        <Heading className="max-w-xl font-heading text-display">{slide.heading}</Heading>
        {slide.subheading ? <p className="max-w-lg text-lg">{slide.subheading}</p> : null}
        <SafeLinkButton href={slide.buttonText ? slide.buttonHref : undefined} variant="secondary">{slide.buttonText ?? t('home.shopNow')}</SafeLinkButton>
      </div>
    </div>
  )
}

/** The hero: one slide is a still banner; several are a carousel that moves on by itself every six seconds, rests when hovered or focused, and has a pause button. @param {{ slides: HomePublic['heroSlides'] }} props */
export function Hero({ slides }) {
  const { t } = useTranslation('storefront')
  const [only] = slides
  if (!only) return null
  if (slides.length === 1) return <section aria-label={t('home.heroLabel')}><Slide slide={only} first heading="h1" /></section>
  return (
    <div>
      <Carousel items={slides} label={t('home.heroLabel')} autoPlayMs={6000} renderItem={(slide, i) => <Slide key={slide.id} slide={slide} first={i === 0} heading={i === 0 ? 'h1' : 'h2'} />} />
    </div>
  )
}

/** A short strip of reasons to buy here, from what the shop has set up; a reason with nothing behind it is left out. */
export function TrustStrip() {
  const { t } = useTranslation('storefront')
  const config = useShell()?.config
  if (!config) return null
  const items = [
    config.shipping.freeAboveFrom ? t('home.trustFree', { amount: formatMoney(config.shipping.freeAboveFrom, 'en', config.priceDisplay) }) : undefined,
    config.payments.some((p) => p.type === 'cod') ? t('home.trustCod') : undefined,
    config.policies.returnsDays ? t('home.trustReturns', { days: config.policies.returnsDays }) : undefined,
    config.contact.whatsapp ? t('home.trustWhatsapp') : undefined,
  ].filter((x) => x !== undefined)
  if (!items.length) return null
  return (
    <ul aria-label={t('home.trustLabel')} className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-4 py-4 text-sm text-fg-soft md:justify-center">
      {items.map((text) => (
        <li key={text} className="shrink-0 whitespace-nowrap">
          {text}
        </li>
      ))}
    </ul>
  )
}

/** A row of the shop's main categories (a category with no picture yet gets its first letter in a circle); two or more make a row, fewer is not worth a section. @param {{ categories: { id: string, handle: string, name: string, image?: import('@noor/contract').Image | undefined }[] }} props */
export function CategoryTiles({ categories }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const tiles = categories.slice(0, 8)
  if (tiles.length < 2) return null
  return (
    <section className="mx-auto max-w-7xl px-4 py-8" aria-labelledby="home-categories">
      <h2 id="home-categories" className="sr-only">
        {t('home.shopByCategory')}
      </h2>
      <ul className="flex snap-x gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-4 lg:grid-cols-8">
        {tiles.map((c) => (
          <li key={c.id} className="w-28 shrink-0 snap-start md:w-auto">
            <RouterLink to={path(`/c/${c.handle}`)} className="flex flex-col items-center gap-2 text-center">
              {c.image ? (
                <Image {...imageProps(c.image)} alt="" sizes="(min-width:1024px) 12vw, 112px" ratio="1 / 1" className="w-full rounded-full" />
              ) : (
                <span aria-hidden="true" className="grid aspect-square w-full place-items-center rounded-full bg-surface-2 font-heading text-h2 text-fg-soft">
                  {c.name.trim().charAt(0).toUpperCase()}
                </span>
              )}
              <span className="text-sm font-medium">{c.name}</span>
            </RouterLink>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The promo band: a heading, a line, a button, on the accent colour. @param {{ promo: NonNullable<HomePublic['promo']> }} props */
export function PromoBand({ promo }) {
  return (
    <section className="my-8 bg-accent text-on-accent">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-3 px-4 py-10">
        {promo.eyebrow ? <p className="text-sm uppercase tracking-wide">{promo.eyebrow}</p> : null}
        <h2 className="font-heading text-h2">{promo.heading}</h2>
        {promo.text ? <p className="max-w-xl">{promo.text}</p> : null}
        <SafeLinkButton href={promo.buttonText ? promo.buttonHref : undefined} variant="secondary">
          {promo.buttonText}
        </SafeLinkButton>
      </div>
    </section>
  )
}

/** The editorial band: a picture beside a short story and a link. @param {{ editorial: NonNullable<HomePublic['editorial']> }} props */
export function EditorialBand({ editorial }) {
  return (
    <section className="defer-render mx-auto grid max-w-7xl items-center gap-6 px-4 py-8 md:grid-cols-2">
      {editorial.image ? <Image {...imageProps(editorial.image)} sizes="(min-width:768px) 50vw, 100vw" className="w-full rounded-media" /> : null}
      <div className="flex flex-col items-start gap-3">
        {editorial.eyebrow ? <p className="text-sm uppercase tracking-wide text-fg-soft">{editorial.eyebrow}</p> : null}
        <h2 className="font-heading text-h2">{editorial.heading}</h2>
        {editorial.text ? <p className="text-fg-soft">{editorial.text}</p> : null}
        <SafeLinkButton href={editorial.buttonText ? editorial.buttonHref : undefined}>{editorial.buttonText}</SafeLinkButton>
      </div>
    </section>
  )
}

/** The shop's featured collections, up to three, each a picture and a name. @param {{ collections: import('@noor/contract').z.infer<typeof import('@noor/contract').CollectionSummary>[] }} props */
export function CollectionsRow({ collections }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  if (!collections.length) return null
  return (
    <section className="defer-render mx-auto max-w-7xl px-4 py-8" aria-labelledby="home-collections">
      <h2 id="home-collections" className="mb-4 font-heading text-h2">
        {t('home.collections')}
      </h2>
      <ul className="grid gap-4 md:grid-cols-3">
        {collections.slice(0, 3).map((c) => (
          <li key={c.id}>
            <RouterLink to={path(`/collections/${c.handle}`)} className="flex flex-col gap-2">
              {c.image ? <Image {...imageProps(c.image)} alt="" sizes="(min-width:768px) 33vw, 100vw" className="w-full rounded-media" /> : null}
              <span className="font-medium">{c.title}</span>
            </RouterLink>
          </li>
        ))}
      </ul>
    </section>
  )
}
