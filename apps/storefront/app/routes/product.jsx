import { Suspense } from 'react'
import { useSite } from '~/features/seo/use-site'
import { breadcrumbLd, productLd } from '~/features/seo/jsonld'
import { JsonLd } from '~/features/seo/json-ld'
import { buildMeta, clip, plainText, siteOf, titleOf } from '~/features/seo/meta'
import { useTranslation } from 'react-i18next'
import { Await, data, redirect, useLoaderData } from 'react-router'
import { ApiError, moneyToDecimalString } from '@noor/contract'
import { formatMoney } from '@noor/i18n'
import { addErrors } from '~/lib/cart.server'
import { api } from '~/lib/api.server'
import { cacheControl } from '~/lib/cache'
import { getEnv } from '~/lib/env.server'
import { orNotFound } from '~/lib/listing.server'
import { localeOfPath } from '~/lib/locale'
import { localePath, pagePath } from '~/lib/paths'
import { loadShell } from '~/lib/shell.server'
import { ProductPage } from '~/features/product/product-page'
import { RecentlyViewed, RelatedSection, ReviewsSection } from '~/features/product/deferred'

/** A page seen through a staff preview link is for one person: never cached. */
export const headers = /** @type {import('./+types/product').Route.HeadersFunction} */ (({ loaderHeaders }) => ({ 'Cache-Control': loaderHeaders.get('Cache-Control') ?? cacheControl.listing }))

/**
 * The product page (plan/06-storefront/04-pdp.md section 10): the product with its colourways, the size chart and the custom-size form it names, and, deferred, its reviews and related products.
 * @param {import('./+types/product').Route.LoaderArgs} props
 */
export async function loader({ params, request }) {
  const url = new URL(request.url)
  const locale = localeOfPath(url.pathname)
  const preview = url.searchParams.get('preview') ?? undefined
  const { config } = await loadShell(locale)
  const res = await api('catalog.getProduct', { params: { handleOrId: params.handle ?? '' }, query: { locale, ...(preview ? { preview } : {}) } }).catch(orNotFound)
  if ('redirectTo' in res) throw redirect(localePath(locale, `/p/${res.redirectTo}`) + url.search, 301)
  const product = res
  const [sizeChart, formSchema] = await Promise.all([
    product.sizeChartId ? api('catalog.getSizeChart', { params: { id: product.sizeChartId } }).catch(() => null) : null,
    // without its form a made-to-measure size cannot be ordered, so this one is not optional
    product.customSizeSchemaId ? api('catalog.getFormSchema', { params: { id: product.customSizeSchemaId } }) : null,
  ])
  const reviews = config.features.reviews ? api('reviews.listForProduct', { params: { id: product.id }, query: { limit: 5 } }).catch(() => undefined) : undefined
  const related = api('catalog.listRelated', { params: { id: product.id }, query: { locale, limit: 8 } }).then((r) => r.items, () => undefined)
  const error = url.searchParams.get('cartError')
  // a section that cannot be loaded is left out, the page stays (plan/05-react-patterns.md section 7)
  return data({
    product,
    sizeChart,
    formSchema,
    reviews,
    related,
    brand: config.brand.name,
    whatsapp: config.contact.whatsapp,
    imageOrigin: new URL(getEnv().PUBLIC_IMG_URL).origin,
    url: `${getEnv().PUBLIC_SITE_URL}${pagePath(url)}`,
    cartError: addErrors.find((e) => e === error),
    cartErrorN: Number(url.searchParams.get('n')) || undefined,
    sizeParam: url.searchParams.get('size'),
  }, preview ? { headers: { 'Cache-Control': cacheControl.private } } : undefined)
}

/**
 * "Tell me when it is back" (plan/06-storefront/04-pdp.md section 6): the mobile number goes to the API, which keeps it for the back-in-stock message.
 * @param {import('./+types/product').Route.ActionArgs} props
 */
export async function action({ request }) {
  const form = await request.formData()
  if (form.get('intent') !== 'notify') throw new Response('Bad Request', { status: 400 })
  try {
    await api('catalog.subscribeBackInStock', { params: { id: String(form.get('variantId') ?? '') }, body: { phone: String(form.get('phone') ?? ''), locale: localeOfPath(new URL(request.url).pathname) } })
    return { ok: true }
  } catch (e) {
    // a number that is not a mobile number, a variant that is gone, too many requests: the visitor is told to check the number
    if (!(e instanceof ApiError) && !(e instanceof Error && e.name === 'ZodError')) console.error('notify me failed', e)
    return { ok: false }
  }
}

export const meta = /** @type {import('./+types/product').Route.MetaFunction} */ (({ loaderData, matches }) => {
  const p = loaderData?.product
  if (!p) return []
  const site = siteOf(matches)
  const lowest = p.variants.reduce((a, b) => (b.price.amount < a.price.amount ? b : a), /** @type {typeof p.variants[number]} */ (p.variants[0]))
  const name = p.seo.title ?? (p.colorway ? `${p.title} – ${p.colorway.label}` : p.title)
  const picture = p.media.find((m) => m.kind === 'image')
  const description = p.seo.description ?? clip([p.subtitle, plainText(p.descriptionMd).slice(0, 120), lowest && site ? formatMoney(lowest.price, site.locale, site.priceDisplay) : undefined].flatMap((x) => (x ? [x.replace(/[.\s]+$/, '')] : [])).join('. '))
  return buildMeta({
    site, title: titleOf(name, loaderData.brand), ogTitle: name, ...(description ? { description } : {}), canonical: `/p/${p.handle}`, type: 'product', alternates: true,
    ...(p.status === 'active' ? {} : { robots: 'noindex,nofollow' }),
    ...(picture ? { image: { src: picture.src, width: picture.width, height: picture.height, alt: picture.alt } } : {}),
    ...(lowest ? { price: { amount: moneyToDecimalString(lowest.price), currency: lowest.price.currency } } : {}),
  })
})

export default function Product() {
  const { t } = useTranslation('storefront')
  const { product, sizeChart, formSchema, reviews, related, whatsapp, url, imageOrigin, cartError, cartErrorN, sizeParam } = useLoaderData()
  const site = useSite()
  return (
    <>
      {site && product.status === 'active' ? <JsonLd data={[breadcrumbLd(site, [{ name: t('listing.home'), path: '/' }, ...product.breadcrumb.map((/** @type {{ handle: string, name: string }} */ b) => ({ name: b.name, path: `/c/${b.handle}` })), { name: product.title }]), productLd(site, product)]} /> : null}
    <ProductPage product={product} sizeChart={sizeChart} formSchema={formSchema} whatsapp={whatsapp} url={url} imageOrigin={imageOrigin} cartError={cartError} cartErrorN={cartErrorN} sizeParam={sizeParam}>
      {reviews ? (
        <Suspense fallback={<section id="reviews" aria-label={t('pdp.reviews')} className="min-h-40" />}>
          <Await resolve={reviews} errorElement={null}>
            {(r) => (r ? <ReviewsSection listing={r} productId={product.id} /> : null)}
          </Await>
        </Suspense>
      ) : null}
      <Suspense fallback={<div className="min-h-64" />}>
        <Await resolve={related} errorElement={null}>
          {(items) => (items?.length ? <RelatedSection items={items} /> : null)}
        </Await>
      </Suspense>
      <RecentlyViewed id={product.id} />
    </ProductPage>
    </>
  )
}
