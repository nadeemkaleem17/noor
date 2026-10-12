// The pure part of robots.txt and the sitemaps (plan/06-storefront/09-seo.md section 6): no server, no API, so each rule is a test.

/** The shop's own domain, and www in front of it. Anywhere else (a laptop, a staging copy) is not to be indexed. @param {string} siteUrl */
export const isProductionHost = (siteUrl) => /(^|\.)rubaya\.pk$/.test(new URL(siteUrl).hostname)

/** What a crawler may not fetch: the visitor's own pages and the search results (never CSS or scripts). */
const disallowed = ['/cart', '/checkout', '/orders/', '/track', '/wishlist', '/search']

/** @param {string} siteUrl */
export function robotsTxt(siteUrl) {
  if (!isProductionHost(siteUrl)) return 'User-agent: *\nDisallow: /\n'
  return `User-agent: *\nAllow: /\n${disallowed.map((p) => `Disallow: ${p}`).join('\n')}\n\nSitemap: ${siteUrl}/sitemap.xml\n`
}

/** @param {string} s */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

/** The sitemaps are never more than this many addresses each. */
export const SITEMAP_SIZE = 5000

/** The shop's own addresses that no entry of the API stands for. */
export const fixedPaths = ['/new', '/sale', '/size-guide']

/** @param {string} siteUrl @param {number} count how many files there are */
export function sitemapIndexXml(siteUrl, count) {
  const items = Array.from({ length: count }, (_, i) => `  <sitemap><loc>${esc(`${siteUrl}/sitemap/${i + 1}.xml`)}</loc></sitemap>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`
}

/** @param {string} siteUrl @param {{ loc: string, lastmod?: string, image?: string }[]} entries */
export function sitemapXml(siteUrl, entries) {
  const urls = entries
    .map((e) => `  <url><loc>${esc(siteUrl + e.loc)}</loc>${e.lastmod ? `<lastmod>${esc(e.lastmod)}</lastmod>` : ''}${e.image ? `<image:image><image:loc>${esc(e.image)}</image:loc></image:image>` : ''}</url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls}\n</urlset>\n`
}
