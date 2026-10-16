// M5-10: the head of a page, structured data, which listing addresses are indexed, robots.txt and the sitemaps (plan/06-storefront/09-seo.md). Pure.
import { describe, expect, it } from 'vitest'
import { breadcrumbLd, faqLd, homeLd, itemListLd, productLd, serializeLd } from '../app/features/seo/jsonld'
import { listingIndex } from '../app/features/seo/listing'
import { buildMeta, clip, plainText, titleOf } from '../app/features/seo/meta'
import { isProductionHost, robotsTxt, sitemapIndexXml, sitemapXml } from '../app/lib/seo'

/** @type {import('../app/features/seo/meta').Site} */
const site = { url: 'https://rubaya.pk', brand: 'Rubaya', locale: 'en', supported: ['en', 'ur'], priceDisplay: /** @type {any} */ ('full') }
const money = (/** @type {number} */ amount) => ({ amount, currency: /** @type {const} */ ('PKR') })
const find = (/** @type {any[]} */ tags, /** @type {string} */ key, /** @type {string} */ name) => tags.find((t) => t[key] === name)

describe('text helpers', () => {
  it('plainText drops markup and tokens', () => {
    expect(plainText('## Care\n\n**Dry clean** only. ![x](a.jpg) See [guide](/size-guide) {{token}}')).toBe('Care Dry clean only. See guide')
    expect(plainText(undefined)).toBe('')
  })
  it('clip cuts at a word and adds one ellipsis, and leaves a short line alone', () => {
    expect(clip('short  line')).toBe('short line')
    const out = clip('word '.repeat(60), 155)
    expect(out.length).toBeLessThanOrEqual(155)
    expect(out.endsWith('…')).toBe(true)
  })
  it('titleOf is "name | brand", at most 60 characters, brand never cut', () => {
    expect(titleOf('Women', 'Rubaya')).toBe('Women | Rubaya')
    const long = titleOf('x'.repeat(100), 'Rubaya')
    expect(long.length).toBeLessThanOrEqual(60)
    expect(long.endsWith(' | Rubaya')).toBe(true)
  })
})

describe('buildMeta', () => {
  it('canonical, hreflang for both languages, og and twitter', () => {
    const tags = buildMeta({ site: { ...site, locale: 'ur' }, title: 'T', description: 'D', canonical: '/c/women', alternates: true, image: { src: 'https://x/i.jpg', width: 800, height: 600, alt: 'a' } })
    expect(find(tags, 'rel', 'canonical').href).toBe('https://rubaya.pk/ur/c/women')
    const langs = tags.filter((t) => t.rel === 'alternate').map((t) => [t.hrefLang, t.href])
    expect(langs).toEqual([
      ['en-PK', 'https://rubaya.pk/c/women'],
      ['ur-PK', 'https://rubaya.pk/ur/c/women'],
      ['x-default', 'https://rubaya.pk/c/women'],
    ])
    expect(find(tags, 'property', 'og:locale').content).toBe('ur_PK')
    expect(find(tags, 'property', 'og:image').content).toBe('https://x/i.jpg')
    expect(find(tags, 'name', 'twitter:card').content).toBe('summary_large_image')
    expect(find(tags, 'name', 'robots')).toBeUndefined()
  })
  it('a page with no canonical has none, and robots is said only when asked', () => {
    const tags = buildMeta({ site, title: 'T', robots: 'noindex,follow' })
    expect(tags.some((t) => t.rel === 'canonical')).toBe(false)
    expect(find(tags, 'name', 'robots').content).toBe('noindex,follow')
  })
  it('without the shop identity only title, description and robots', () => {
    expect(buildMeta({ site: undefined, title: 'T', description: 'D' })).toEqual([{ title: 'T' }, { name: 'description', content: 'D' }])
  })
  it('product pages carry the price tags', () => {
    const tags = buildMeta({ site, title: 'T', type: 'product', price: { amount: '6990.00', currency: 'PKR' } })
    expect(find(tags, 'property', 'og:type').content).toBe('product')
    expect(find(tags, 'property', 'product:price:amount').content).toBe('6990.00')
  })
})

describe('structured data', () => {
  const product = (/** @type {any} */ over = {}) => ({
    id: 'p1',
    handle: 'lawn',
    title: 'Lawn',
    subtitle: 'Printed',
    descriptionMd: '**Soft** lawn',
    brand: undefined,
    colorway: undefined,
    attributes: [{ label: 'Fabric', values: ['Lawn'] }],
    options: [{ role: 'size', values: [{ id: 's', label: 'S' }, { id: 'm', label: 'M' }] }],
    media: [{ kind: 'image', src: 'https://x/a.jpg' }, { kind: 'video', src: 'https://x/v.mp4' }],
    rating: { average: 4.5, count: 2 },
    variants: [
      { sku: 'A-S', price: money(699000), compareAt: money(899000), stockStatus: 'in_stock', optionValueIds: ['s'] },
      { sku: 'A-M', price: money(699000), stockStatus: 'sold_out', optionValueIds: ['m'] },
    ],
    ...over,
  })

  it('a product with sizes is a ProductGroup with one Product each, decimal prices, own availability', () => {
    const ld = /** @type {any} */ (productLd(site, /** @type {any} */ (product())))
    expect(ld['@type']).toBe('ProductGroup')
    expect(ld.image).toEqual(['https://x/a.jpg'])
    expect(ld.material).toBe('Lawn')
    expect(ld.aggregateRating).toEqual({ '@type': 'AggregateRating', ratingValue: '4.5', reviewCount: '2' })
    const [s, m] = ld.hasVariant
    expect(s.size).toBe('S')
    expect(s.offers.price).toBe('6990.00')
    expect(s.offers.availability).toBe('https://schema.org/InStock')
    expect(s.offers.priceSpecification.price).toBe('8990.00')
    expect(m.offers.availability).toBe('https://schema.org/OutOfStock')
    expect(m.offers.priceSpecification).toBeUndefined()
  })
  it('a single variant is a plain Product; no reviews means no rating', () => {
    const one = product({ rating: { average: 0, count: 0 }, variants: [{ sku: 'A', price: money(100), stockStatus: 'preorder', optionValueIds: [] }] })
    const ld = /** @type {any} */ (productLd(site, /** @type {any} */ (one)))
    expect(ld['@type']).toBe('Product')
    expect(ld.aggregateRating).toBeUndefined()
    expect(ld.offers.price).toBe('1.00')
    expect(ld.offers.availability).toBe('https://schema.org/PreOrder')
  })
  it('breadcrumbs, item lists and the home page', () => {
    const b = /** @type {any} */ (breadcrumbLd({ ...site, locale: 'ur' }, [{ name: 'Home', path: '/' }, { name: 'Women' }]))
    expect(b.itemListElement[0].item).toBe('https://rubaya.pk/ur')
    expect(b.itemListElement[1]).toEqual({ '@type': 'ListItem', position: 2, name: 'Women' })
    const l = /** @type {any} */ (itemListLd(site, Array.from({ length: 30 }, (_, i) => ({ handle: `h${i}` }))))
    expect(l.itemListElement).toHaveLength(24)
    const [org, web] = /** @type {any[]} */ (homeLd(site, { socials: [], phone: undefined }))
    expect(org['@type']).toBe('Organization')
    expect(org.sameAs).toBeUndefined()
    expect(web.potentialAction.target).toBe('https://rubaya.pk/search?q={search_term_string}')
  })
  it('a hostile value cannot end the script', () => {
    const text = serializeLd({ name: '</script><script>alert(1)</script> & \u2028' })
    expect(text).not.toMatch(/[<>&\u2028]/)
    expect(JSON.parse(text).name).toBe('</script><script>alert(1)</script> & \u2028')
  })
})

describe('which listing addresses are indexed', () => {
  const facets = [{ key: 'attr.fabric', seoIndexable: true, values: [{ value: 'lawn', selected: true }] }, { key: 'attr.colour', values: [{ value: 'red', selected: true }] }]
  const q = (/** @type {string} */ s) => new URLSearchParams(s)
  it('the plain listing is, and "load more" does not change that', () => {
    expect(listingIndex(q(''))).toEqual({ index: true, query: '' })
    expect(listingIndex(q('chunk=2'))).toEqual({ index: true, query: '' })
  })
  it('one value of a facet marked for the index is its own page', () => {
    expect(listingIndex(q('attr.fabric=lawn'), facets)).toEqual({ index: true, query: '?attr.fabric=lawn' })
  })
  it('sorting, a facet not marked, two parameters or two values are not', () => {
    expect(listingIndex(q('sort=newest'), facets).index).toBe(false)
    expect(listingIndex(q('attr.colour=red'), facets).index).toBe(false)
    expect(listingIndex(q('attr.fabric=lawn&sort=newest'), facets).index).toBe(false)
    expect(listingIndex(q('attr.fabric=lawn,silk'), facets).index).toBe(false)
    expect(listingIndex(q('attr.fabric=lawn'), []).index).toBe(false)
  })
})

describe('robots.txt and sitemaps', () => {
  it('only the shop\'s own domain is indexable', () => {
    expect(isProductionHost('https://rubaya.pk')).toBe(true)
    expect(isProductionHost('https://www.rubaya.pk')).toBe(true)
    expect(isProductionHost('https://staging.rubaya.pk')).toBe(true)
    expect(isProductionHost('http://localhost:5174')).toBe(false)
    expect(isProductionHost('https://rubaya.pk.evil.com')).toBe(false)
    expect(isProductionHost('https://notrubaya.pk')).toBe(false)
  })
  it('robots.txt shuts everyone out of a copy, and in production hides private pages and names the sitemap', () => {
    expect(robotsTxt('http://localhost:5174')).toBe('User-agent: *\nDisallow: /\n')
    const prod = robotsTxt('https://rubaya.pk')
    for (const p of ['/cart', '/checkout', '/orders/', '/track', '/wishlist', '/search']) expect(prod).toContain(`Disallow: ${p}\n`)
    expect(prod).toContain('Sitemap: https://rubaya.pk/sitemap.xml')
    expect(prod).not.toContain('Disallow: /\n')
  })
  it('the index lists each file; a file escapes its addresses and adds a picture and a date', () => {
    expect(sitemapIndexXml('https://rubaya.pk', 2)).toContain('<loc>https://rubaya.pk/sitemap/2.xml</loc>')
    const xml = sitemapXml('https://rubaya.pk', [{ loc: '/p/a&b', lastmod: '2026-10-01T00:00:00Z', image: 'https://x/i.jpg?a=1&b=2' }, { loc: '/new' }])
    expect(xml).toContain('<loc>https://rubaya.pk/p/a&amp;b</loc><lastmod>2026-10-01T00:00:00Z</lastmod>')
    expect(xml).toContain('<image:loc>https://x/i.jpg?a=1&amp;b=2</image:loc>')
    expect(xml).toContain('<url><loc>https://rubaya.pk/new</loc></url>')
  })
})

describe('faqLd (DOC-06.14 CM-05)', () => {
  const md = '## Ordering\n\n### How do I order?\nChoose a piece, then **check out**.\n\n### Can I cancel?\nYes, until it is [dispatched](/track).\n\n## Paying\n\nNot a question.\n'
  it('makes a question of each third-level heading with the lines under it as the answer, in plain words', () => {
    expect(faqLd(md)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'How do I order?', acceptedAnswer: { '@type': 'Answer', text: 'Choose a piece, then check out.' } },
        { '@type': 'Question', name: 'Can I cancel?', acceptedAnswer: { '@type': 'Answer', text: 'Yes, until it is dispatched.' } },
      ],
    })
  })
  it('says nothing for a page with fewer than two questions', () => {
    expect(faqLd('### Only one?\nYes.')).toBeUndefined()
    expect(faqLd('Just text')).toBeUndefined()
  })
})
