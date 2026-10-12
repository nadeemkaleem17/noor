// What needs the API: the sitemap's addresses, gathered once for a while. Never imported by browser code.
import { api } from './api.server'
import { fixedPaths, SITEMAP_SIZE } from './seo'
import { cached } from './shell.server'

/**
 * Every address worth a search engine's time, in files of at most 5,000: the API's entries (the home page, categories, collections, active products with their picture, active pages and the
 * filter pages that are meant for the index) and the few pages the shop has of its own.
 * @returns {Promise<{ loc: string, lastmod?: string, image?: string }[][]>}
 */
export function sitemapFiles() {
  return cached('sitemap', async () => {
    /** @type {{ loc: string, lastmod?: string, image?: string }[]} */
    const all = fixedPaths.map((loc) => ({ loc }))
    /** @type {string | undefined} */
    let cursor
    do {
      const page = await api('seo.listSitemapEntries', { query: { limit: SITEMAP_SIZE, ...(cursor ? { cursor } : {}) } })
      for (const e of page.items) all.push({ loc: e.loc, lastmod: e.lastmod, ...(e.image ? { image: e.image } : {}) })
      cursor = page.nextCursor
    } while (cursor)
    const files = []
    for (let i = 0; i < all.length; i += SITEMAP_SIZE) files.push(all.slice(i, i + SITEMAP_SIZE))
    return files.length ? files : [[]]
  })
}

