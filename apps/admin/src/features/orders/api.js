import { routes } from '@noor/contract'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const orderKeys = {
  all: ['orders'],
  lists: () => [...orderKeys.all, 'list'],
  list: (/** @type {object} */ params) => [...orderKeys.lists(), params],
  counts: () => [...orderKeys.all, 'counts'],
  lookups: () => [...orderKeys.all, 'lookups'],
  detail: (/** @type {string} */ id) => [...orderKeys.all, 'detail', id],
  invoice: (/** @type {string} */ id) => [...orderKeys.all, 'invoice', id],
}

/** The address of the order list is parsed with the route's own query schema. */
export const orderListSchema = routes['admin.orders.list'].query

/** @typedef {import('@noor/contract').AdminOrder} AdminOrder */
/** @typedef {import('@noor/contract').z.infer<typeof routes['admin.orders.list']['response']>['items'][number]} OrderRow */

export const orderQueries = {
  /** @param {object} params parsed from the address with `orderListSchema` */
  list: (params) => queryOptions({ queryKey: orderKeys.list(params), queryFn: ({ signal }) => api('admin.orders.list', { query: /** @type {never} */ (params), signal }) }),
  counts: () => queryOptions({ queryKey: orderKeys.counts(), queryFn: ({ signal }) => api('admin.orders.counts', { signal }), refetchInterval: 60_000 }),
  /** The couriers and cities the dispatch dialog and the city filter choose from. */
  lookups: () => queryOptions({ queryKey: orderKeys.lookups(), queryFn: ({ signal }) => api('admin.orders.lookups', { signal }), staleTime: 5 * 60_000 }),
  /** Refetched when the window gets focus and every minute while the order is open (plan/07-admin/05-orders.md section 3). */
  detail: (/** @type {string} */ id) => queryOptions({ queryKey: orderKeys.detail(id), queryFn: ({ signal }) => api('admin.orders.get', { params: { id }, signal }), refetchInterval: 60_000, refetchOnWindowFocus: true }),
  invoice: (/** @type {string} */ id) => queryOptions({ queryKey: orderKeys.invoice(id), queryFn: ({ signal }) => api('admin.orders.invoice', { params: { id }, signal }) }),
}

/** What staff do to one order. Each puts the order the server answers with into the cache and refreshes the lists and tabs. */
export function useOrderMutations(/** @type {string} */ id) {
  const queryClient = useQueryClient()
  /** @param {AdminOrder} order */
  const remember = (order) => {
    // the screen may have been opened by the number (RB-10458) or by the id: every cached copy of this order gets the new one
    queryClient.setQueriesData({ queryKey: [...orderKeys.all, 'detail'] }, (/** @type {AdminOrder | undefined} */ old) => (old?.id === order.id ? order : old))
    void queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
    void queryClient.invalidateQueries({ queryKey: orderKeys.counts() })
  }
  const refetch = () => queryClient.invalidateQueries({ queryKey: [...orderKeys.all, 'detail'] })
  return {
    transition: useMutation({ mutationFn: (/** @type {import('@noor/contract').TransitionBody} */ body) => api('admin.orders.transition', { params: { id }, body }), onSuccess: remember }),
    edit: useMutation({ mutationFn: (/** @type {never} */ body) => api('admin.orders.edit', { params: { id }, body }), onSuccess: remember }),
    previewEdit: useMutation({ mutationFn: (/** @type {never} */ body) => api('admin.orders.previewEdit', { params: { id }, body }) }),
    tracking: useMutation({ mutationFn: (/** @type {never} */ body) => api('admin.orders.updateTracking', { params: { id }, body }), onSuccess: remember }),
    note: useMutation({ mutationFn: (/** @type {string} */ body) => api('admin.orders.addNote', { params: { id }, body: { body } }), onSuccess: refetch }),
    attempt: useMutation({ mutationFn: (/** @type {never} */ body) => api('admin.orders.logAttempt', { params: { id }, body }), onSuccess: refetch }),
    /** One key per dialog opening, so a double click cannot record the payment twice. */
    payment: useMutation({
      mutationFn: (/** @type {{ body: never, key: string }} */ v) => api('admin.orders.recordPayment', { params: { id }, body: v.body, idempotencyKey: v.key }),
      onSuccess: remember,
    }),
    refetch,
  }
}
