// Handlers for the public catalog routes of the contract (plan/10-api/02-catalog-public.md).
const NO_STORE = 'private, no-store'

/**
 * @param {ReturnType<typeof import('./public.js').createPublicCatalog>} pub
 * @param {ReturnType<typeof import('./public-listing.js').createListing>} listing
 * @returns {Partial<import('../../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>>}
 */
export function publicCatalogHandlers(pub, listing) {
  return {
    'catalog.listProducts': async ({ query, http, limit }) => {
      if (query.q) {
        await limit('search', 'ip', http.ip) // text search is dearer than a listing: its own, tighter bucket
        http.setHeader('cache-control', NO_STORE) // and never cached (DOC-10.2 section 2)
      }
      return listing.list(query, { ...(query.locale ? { locale: query.locale } : {}) })
    },
    'catalog.getProduct': async ({ params, query, http }) => {
      const r = await pub.getProduct({ handleOrId: params.handleOrId, ...(query.preview ? { preview: query.preview } : {}), ...(query.locale ? { locale: query.locale } : {}) })
      if (r.redirect) return { redirectTo: r.redirect }
      if (r.previewing) http.setHeader('cache-control', NO_STORE)
      return /** @type {NonNullable<typeof r.product>} */ (r.product)
    },
    'catalog.listRelated': async ({ params, query }) => pub.listRelated(params.id, query.limit, query.locale),
    'catalog.listCategories': async ({ query }) => pub.listCategories(query.locale),
    'catalog.getCategory': async ({ params, query }) => pub.getCategory(params.handle, query.locale),
    'catalog.listCollections': async ({ query }) => pub.listCollections({ featured: query.featured, limit: query.limit, locale: query.locale }),
    'catalog.getCollection': async ({ params, query }) => pub.getCollection(params.handle, query.locale),
    'catalog.listSizeCharts': async () => pub.listSizeCharts(),
    'catalog.getSizeChart': async ({ params }) => pub.getSizeChart(params.id),
    'catalog.getFormSchema': async ({ params }) => pub.getFormSchema(params.id),
    'catalog.subscribeBackInStock': async ({ params, body, limit }) => {
      await pub.subscribeBackInStock({ variantId: params.id, phone: body.phone, ...(body.locale ? { locale: body.locale } : {}) }, limit)
    },
    'seo.listSitemapEntries': async ({ query, http }) => {
      http.setHeader('cache-control', 'public, s-maxage=3600')
      return pub.sitemapEntries(query)
    },
  }
}
