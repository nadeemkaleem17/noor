
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
})

/** Which job each event starts (DOC-08 section 8). */
/** @type {Record<string, string[]>} */
export const searchEvents = ({
  'product.updated': ['search.reindex_product'],
  'catalog.structure_changed': ['search.reindex_all'],
})
