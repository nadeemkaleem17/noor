import { Id, routes } from '@noor/contract'
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** The address of the audit screen: the route's own filters, plus the open entry. `limit` and `cursor` belong to loading, not to the address. */
export const auditParamsSchema = routes['admin.audit.list'].query.omit({ limit: true, cursor: true }).extend({ entry: Id.optional() })

/** @param {Record<string, unknown>} params the filters, without `entry` */
export const auditListQuery = (params) =>
  infiniteQueryOptions({
    queryKey: ['audit', 'list', params],
    queryFn: ({ pageParam, signal }) => api('admin.audit.list', { query: /** @type {never} */ ({ ...params, ...(pageParam ? { cursor: pageParam } : {}) }), signal }),
    initialPageParam: /** @type {string | undefined} */ (undefined),
    getNextPageParam: (last) => last.nextCursor,
  })

export const auditEntryQuery = (/** @type {string} */ id) => queryOptions({ queryKey: ['audit', 'entry', id], queryFn: ({ signal }) => api('admin.audit.get', { params: { id }, signal }) })

