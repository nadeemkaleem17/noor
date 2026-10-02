// Cache-Control per route class (ADR-0004). Every route module exports `headers` using one of these, so caching is never implicit.
export const cacheControl = {
  /** Home, category, collection, product: short CDN cache, purged on publish. */
  listing: 'public, s-maxage=60, stale-while-revalidate=600',
  /** CMS pages, policies, size guide. */
  content: 'public, s-maxage=3600, stale-while-revalidate=86400',
  /** Cart, checkout, order pages. */
  private: 'private, no-store',
  /** sitemap.xml, robots.txt, feeds. */
  resource: 'public, s-maxage=3600',
} as const
