
export { createSearch } from './service.js'

/**
 * Job handlers of the module. The outbox gives each job `{ eventId, type, payload }`.
 * @param {ReturnType<typeof import('./service.js').createSearch>} search
 * @returns {import('../../platform/worker.js').JobHandlers}
 */
export const searchJobs = (search) => ({
  'search.reindex_product': async ({ job }) => search.reindexProduct(job.payload.payload.productId),
  'search.reindex_all': async () => void (await search.reindexAll()),
  'search.cleanup_misses': async () => search.cleanupMisses(),
  'search.reconcile': async () => void (await search.reconcile()),
})

/**
 * The admin's search-index routes.
 * @param {ReturnType<typeof import('./service.js').createSearch>} search
 * @returns {Partial<import('../../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>>}
 */
export const searchHandlers = (search) => ({
  'admin.searchIndex.status': async () => search.health(),
  'admin.searchIndex.rebuild': async ({ actor, http, requestId }) => search.requestRebuild(/** @type {never} */ (actor), { ip: http.ip, userAgent: http.userAgent, requestId }),
})

/** Which job each event starts (DOC-08 section 8). */
/** @type {Record<string, string[]>} */
export const searchEvents = ({
  'product.updated': ['search.reindex_product'],
  'catalog.structure_changed': ['search.reindex_all'],
})
