import { Suspense } from 'react'
import { useShell } from '~/features/layout/use-shell'
import { useSite } from '~/features/seo/use-site'
import { homeLd } from '~/features/seo/jsonld'
import { JsonLd } from '~/features/seo/json-ld'
import { buildMeta, clip, pageName, siteOf } from '~/features/seo/meta'
import { useTranslation } from 'react-i18next'
import { Await, useLoaderData } from 'react-router'
import { CategoryTiles, CollectionsRow, EditorialBand, Hero, PromoBand, TrustStrip } from '~/features/home/sections'
import { CategorySpotlights } from '~/features/home/spotlights'
import { TabbedSection } from '~/features/home/tabbed-section'
import { safeHref } from '@noor/ui/safe-href'
import { api } from '~/lib/api.server'
import { cacheControl } from '~/lib/cache'
import { localeOfPath } from '~/lib/locale'
import { loadShell } from '~/lib/shell.server'

export const headers = /** @type {import('./+types/home').Route.HeadersFunction} */ (() => ({ 'Cache-Control': cacheControl.listing }))

/** A section that cannot be loaded is left out; it does not take the page down (plan/05-react-patterns.md section 7). @template T @param {Promise<T>} p @returns {Promise<T | undefined>} */
const optional = (p) => p.catch((e) => {
  console.error('home section could not be loaded', e)
  return undefined
})

/** A button staff set up keeps its words only with a safe address; the page data never carries an address that must not be followed. @template {{ buttonText?: string | undefined, buttonHref?: string | undefined }} T @param {T} block @returns {T} */
function withSafeButton(block) {
  const href = block.buttonHref ? safeHref(block.buttonHref) : undefined
  const rest = { ...block }
  delete rest.buttonText
  delete rest.buttonHref
  return /** @type {T} */ (href && block.buttonText ? { ...rest, buttonText: block.buttonText, buttonHref: href } : rest)
}

/**
 * The home page (plan/06-storefront/02-home.md section 4): what is above the fold is waited for; the bestsellers below it stream in after.
 * The shop's settings, banners and categories come from the shell data, kept for 30 seconds.
 * @param {import('./+types/home').Route.LoaderArgs} props
 */
export async function loader({ request }) {
  const locale = localeOfPath(new URL(request.url).pathname)
  const { config, home, categories } = await loadShell(locale)
  const bestsellers = optional(api('catalog.listProducts', { query: { sort: 'bestselling', limit: 8, facets: false, locale } }))
  // four best sellers of each top category for its block (up to six categories); a block that cannot be loaded is left out
  const spotlights = Promise.all(categories.slice(0, 6).map(async (category) => ({ category, items: (await optional(api('catalog.listProducts', { query: { category: category.handle, sort: 'bestselling', limit: 4, facets: false, locale } })))?.items ?? [] })))
  const [newArrivals, collections, blocks] = await Promise.all([
    optional(api('catalog.listProducts', { query: { sort: 'newest', limit: 8, facets: false, locale } })),
    optional(api('catalog.listCollections', { query: { featured: true, limit: 3, locale } })),
    spotlights,
  ])
  return {
    brand: config.brand.name,
    title: config.brand.tagline ? `${config.brand.name}: ${config.brand.tagline}` : config.brand.name,
    description: config.seo.homeDescription ?? clip(`${config.brand.tagline ?? ''} ${pageName(locale, 'homeDescription')}`.trim()),
    ogImage: home.heroSlides[0] ? { src: home.heroSlides[0].image.src, width: home.heroSlides[0].image.width, height: home.heroSlides[0].image.height, alt: home.heroSlides[0].image.alt } : undefined,
    slides: home.heroSlides.map(withSafeButton),
    promo: home.promo && withSafeButton(home.promo),
    editorial: home.editorial && withSafeButton(home.editorial),
    categories,
    newArrivals: newArrivals?.items ?? [],
    collections: collections?.items ?? [],
    blocks,
    bestsellers,
  }
}

export const meta = /** @type {import('./+types/home').Route.MetaFunction} */ (({ loaderData, matches }) =>
  buildMeta({ site: siteOf(matches), title: loaderData.title, ogTitle: loaderData.brand, description: loaderData.description, canonical: '/', alternates: true, ...(loaderData.ogImage ? { image: loaderData.ogImage } : {}) }))

export default function Home() {
  const { t } = useTranslation('storefront')
  const { brand, slides, promo, editorial, categories, newArrivals, collections, blocks, bestsellers } = useLoaderData()
  const site = useSite()
  const config = useShell()?.config
  return (
    <>
      {site && config ? <JsonLd data={homeLd(site, { logo: config.brand.logoLight?.src, socials: config.contact.socials.map((x) => x.url), phone: config.contact.phone })} /> : null}
      {slides.length ? <Hero slides={slides} /> : <h1 className="sr-only">{brand}</h1>}
      <TrustStrip />
      <CategoryTiles categories={categories} />
      <TabbedSection id="home-new" title={t('home.newArrivals')} href="/new" sort="newest" items={newArrivals} categories={categories} />
      <CollectionsRow collections={collections} />
      <CategorySpotlights blocks={blocks} />
      {promo?.heading ? <PromoBand promo={promo} /> : null}
      <Suspense fallback={null}>
        <Await resolve={bestsellers} errorElement={null}>
          {(list) => <TabbedSection id="home-best" title={t('home.bestsellers')} href="/new?sort=bestselling" sort="bestselling" items={list?.items ?? []} categories={categories} />}
        </Await>
      </Suspense>
      {editorial?.heading ? <EditorialBand editorial={editorial} /> : null}
    </>
  )
}
