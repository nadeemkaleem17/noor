// Structured data (plan/06-storefront/09-seo.md section 4): plain objects built from the same data the page shows, and the one way they are written into a page. Nothing is marked up that the
// page does not show: no price, no rating, no stock that is not on it.
import { moneyToDecimalString } from '@noor/contract'
import { localePath } from '~/lib/paths'
import { plainText } from './meta'

/** @typedef {import('./meta').Site} Site */

/** A JSON-LD object as the text of a script: `<` and its friends are escaped so no value can end the script or open a tag. @param {unknown} data */
export const serializeLd = (data) => JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')

const availability = /** @type {const} */ ({
  in_stock: 'https://schema.org/InStock',
  low_stock: 'https://schema.org/InStock',
  sold_out: 'https://schema.org/OutOfStock',
  preorder: 'https://schema.org/PreOrder',
  made_to_order: 'https://schema.org/MadeToOrder',
})

/** The shop and its search, for the home page. @param {Site} site @param {{ logo?: string | undefined, socials: string[], phone?: string | undefined }} shop */
export function homeLd(site, shop) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: site.brand,
      url: site.url,
      ...(shop.logo ? { logo: shop.logo } : {}),
      ...(shop.socials.length ? { sameAs: shop.socials } : {}),
      ...(shop.phone ? { contactPoint: { '@type': 'ContactPoint', telephone: shop.phone, contactType: 'customer service' } } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: site.brand,
      url: site.url,
      potentialAction: { '@type': 'SearchAction', target: `${site.url}${localePath(site.locale, '/search')}?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
    },
  ]
}

/** The way up to a page. @param {Site} site @param {{ name: string, path?: string }[]} crumbs the last one has no path: it is this page */
export function breadcrumbLd(site, crumbs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, ...(c.path ? { item: `${site.url}${localePath(site.locale, c.path)}` } : {}) })),
  }
}

/** The first products of a listing. @param {Site} site @param {{ handle: string }[]} items */
export function itemListLd(site, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.slice(0, 24).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${site.url}${localePath(site.locale, `/p/${p.handle}`)}` })),
  }
}

/**
 * The product: one `Product` with one offer, or a `ProductGroup` with a `Product` for each size. The price is a decimal string made from whole paisa (`"6990.00"`), the availability the
 * variant's own, and a rating only when there are approved reviews.
 * @param {Site} site
 * @param {import('@noor/contract').ProductDetail} p
 */
export function productLd(site, p) {
  const url = `${site.url}${localePath(site.locale, `/p/${p.handle}`)}`
  const sizeOption = p.options.find((o) => o.role === 'size')
  const offer = (/** @type {import('@noor/contract').ProductDetail['variants'][number]} */ v) => ({
    '@type': 'Offer',
    url,
    price: moneyToDecimalString(v.price),
    priceCurrency: v.price.currency,
    availability: availability[v.stockStatus],
    itemCondition: 'https://schema.org/NewCondition',
    ...(v.compareAt && v.compareAt.amount > v.price.amount ? { priceSpecification: { '@type': 'UnitPriceSpecification', priceType: 'https://schema.org/StrikethroughPrice', price: moneyToDecimalString(v.compareAt), priceCurrency: v.compareAt.currency } } : {}),
  })
  const material = p.attributes.find((a) => /fabric|material/i.test(a.label))?.values[0]
  const common = {
    '@context': 'https://schema.org',
    name: p.colorway ? `${p.title} – ${p.colorway.label}` : p.title,
    description: plainText(p.descriptionMd) || p.subtitle || p.title,
    image: p.media.filter((m) => m.kind === 'image').map((m) => m.src),
    brand: { '@type': 'Brand', name: p.brand ?? site.brand },
    ...(p.colorway ? { color: p.colorway.label } : {}),
    ...(material ? { material } : {}),
    ...(p.rating && p.rating.count > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating.average.toFixed(1), reviewCount: String(p.rating.count) } } : {}),
  }
  if (p.variants.length === 1 && p.variants[0]) {
    const v = p.variants[0]
    return { ...common, '@type': 'Product', sku: v.sku, offers: offer(v) }
  }
  return {
    ...common,
    '@type': 'ProductGroup',
    productGroupID: p.id,
    ...(sizeOption ? { variesBy: ['https://schema.org/size'] } : {}),
    hasVariant: p.variants.map((v) => {
      const size = sizeOption?.values.find((x) => v.optionValueIds.includes(x.id))?.label
      return { '@type': 'Product', sku: v.sku, ...(size ? { size } : {}), offers: offer(v) }
    }),
  }
}

/** Markdown as plain words: links keep their text, emphasis marks go. @param {string} md */
const plain = (md) => md.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim()

/**
 * The questions and answers of a FAQ page written as `### Question` followed by its answer (plan/06-storefront/14-site-blueprint.md CM-05), as FAQPage data. Fewer than two
 * pairs is not a FAQ: nothing is returned.
 * @param {string} markdown
 */
export function faqLd(markdown) {
  /** @type {{ name: string, answer: string[] }[]} */
  const pairs = []
  for (const line of markdown.split('\n')) {
    const q = /^###\s+(.+)$/.exec(line)
    if (q) pairs.push({ name: plain(q[1] ?? ''), answer: [] })
    else if (/^#{1,2}\s/.test(line)) pairs.push({ name: '', answer: [] }) // a heading of its own ends the answer above it
    else if (pairs.length && line.trim()) pairs.at(-1)?.answer.push(line)
  }
  const mainEntity = pairs
    .filter((p) => p.name && p.answer.length)
    .map((p) => ({ '@type': 'Question', name: p.name, acceptedAnswer: { '@type': 'Answer', text: plain(p.answer.join(' ')) } }))
  return mainEntity.length >= 2 ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity } : undefined
}
