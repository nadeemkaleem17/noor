// What every page tells a search engine or a link preview (plan/06-storefront/09-seo.md): one helper builds the whole set, so the rules are written once. Used by the `meta` export of each
// route, which gets the shop's name, its address and its languages from the root loader's data.
import { createI18n } from '@noor/i18n'
import { localePath } from '~/lib/paths'

/** @typedef {{ url: string, brand: string, locale: 'en' | 'ur', supported: readonly string[], priceDisplay: import('@noor/i18n').PriceDisplay }} Site */

/** The shop's identity for the meta of a page, from the root loader's data. @param {ReadonlyArray<{ id?: string, loaderData?: any } | undefined>} matches @returns {Site | undefined} */
export function siteOf(matches) {
  const d = matches.find((m) => m?.id === 'root')?.loaderData
  return d?.siteUrl ? { url: d.siteUrl, brand: d.config.brand.name, locale: d.locale, supported: d.config.locale.supported, priceDisplay: d.config.priceDisplay } : undefined
}

/** Markdown (or any text with a little markup) as the plain line a description wants. @param {string | undefined} text */
export function plainText(text) {
  return (text ?? '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>|~-]{1,}/g, ' ')
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** A description no longer than `max` characters, cut at a word, with no line break. @param {string} text @param {number} [max] */
export function clip(text, max = 155) {
  const one = text.replace(/\s+/g, ' ').trim()
  if (one.length <= max) return one
  const cut = one.slice(0, max - 1)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).trimEnd()}…`
}

/** The title of a page: its own words, then the shop (the shop's name is never cut, the rest is). @param {string} name @param {string} brand */
export function titleOf(name, brand) {
  const room = 60 - brand.length - 3
  return `${name.length > room ? `${name.slice(0, Math.max(room - 1, 1)).trimEnd()}…` : name} | ${brand}`
}

/** The name of a page that has no content of its own, in the visitor's language. @param {'en' | 'ur'} locale @param {string} key */
export const pageName = (locale, key) => createI18n(locale).t(`storefront:seo.${key}`)

/**
 * The head of a page that belongs to one visitor (the cart, an order, the wishlist ...): a title, and a request to be left out of every index.
 * @param {ReadonlyArray<{ id?: string, loaderData?: any } | undefined>} matches @param {string} key the name of the page, a key of `seo.*` in the catalog
 */
export function privateMeta(matches, key) {
  const site = siteOf(matches)
  return buildMeta({ site, title: site ? titleOf(pageName(site.locale, key), site.brand) : pageName('en', key), robots: 'noindex,nofollow' })
}

/**
 * Everything of `<head>` that is for machines, as the router's meta descriptors.
 * `canonical` is the path (without the language) this page counts as; leave it out for a page that is not to be indexed and has no better one. `robots` is only said when it is not the default.
 * @param {object} p
 * @param {Site | undefined} p.site
 * @param {string} p.title the whole title
 * @param {string} [p.ogTitle] the title without the shop's name, for the preview
 * @param {string} [p.description]
 * @param {string} [p.canonical]
 * @param {'noindex,follow' | 'noindex,nofollow'} [p.robots]
 * @param {{ src: string, alt?: string, width?: number, height?: number }} [p.image]
 * @param {'website' | 'product'} [p.type]
 * @param {{ amount: string, currency: string }} [p.price] a decimal string, for the product preview
 * @param {boolean} [p.alternates] the page exists in every language of the shop under the same path
 */
export function buildMeta({ site, title, ogTitle, description, canonical, robots, image, type = 'website', price, alternates = false }) {
  /** @type {Array<Record<string, unknown>>} */
  const tags = [{ title }]
  if (description) tags.push({ name: 'description', content: description })
  if (robots) tags.push({ name: 'robots', content: robots })
  if (!site) return tags
  const at = (/** @type {'en' | 'ur'} */ l, /** @type {string} */ path) => `${site.url}${localePath(l, path)}`
  if (canonical !== undefined) {
    const url = at(site.locale, canonical)
    tags.push({ tagName: 'link', rel: 'canonical', href: url })
    if (alternates && site.supported.length > 1) {
      tags.push({ tagName: 'link', rel: 'alternate', hrefLang: 'en-PK', href: at('en', canonical) })
      tags.push({ tagName: 'link', rel: 'alternate', hrefLang: 'ur-PK', href: at('ur', canonical) })
      tags.push({ tagName: 'link', rel: 'alternate', hrefLang: 'x-default', href: at('en', canonical) })
    }
    tags.push({ property: 'og:url', content: url })
  }
  tags.push({ property: 'og:type', content: type }, { property: 'og:site_name', content: site.brand }, { property: 'og:locale', content: site.locale === 'ur' ? 'ur_PK' : 'en_PK' }, { property: 'og:title', content: ogTitle ?? title })
  if (description) tags.push({ property: 'og:description', content: description })
  if (image) {
    tags.push({ property: 'og:image', content: image.src })
    if (image.width) tags.push({ property: 'og:image:width', content: String(image.width) })
    if (image.height) tags.push({ property: 'og:image:height', content: String(image.height) })
    if (image.alt) tags.push({ property: 'og:image:alt', content: image.alt })
  }
  if (price) tags.push({ property: 'product:price:amount', content: price.amount }, { property: 'product:price:currency', content: price.currency })
  tags.push({ name: 'twitter:card', content: 'summary_large_image' })
  return tags
}
