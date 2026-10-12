import { routes } from '@noor/contract'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const promoKeys = {
  all: ['promos'],
  lists: () => [...promoKeys.all, 'list'],
  list: (/** @type {object} */ params) => [...promoKeys.lists(), params],
  detail: (/** @type {string} */ id) => [...promoKeys.all, 'detail', id],
}

/** The address of the promo list is parsed with the route's own query schema. */
export const promoListSchema = routes['admin.promos.list'].query

/** @typedef {import('@noor/contract').AdminPromo} AdminPromo */

export const promoQueries = {
  /** @param {object} params parsed from the address with `promoListSchema` */
  list: (params) => queryOptions({ queryKey: promoKeys.list(params), queryFn: ({ signal }) => api('admin.promos.list', { query: /** @type {never} */ (params), signal }) }),
  detail: (/** @type {string} */ id) => queryOptions({ queryKey: promoKeys.detail(id), queryFn: ({ signal }) => api('admin.promos.get', { params: { id }, signal }) }),
}

/** Create, save, delete, switch on or off, and try a code on a cart. Each refreshes the lists. */
export function usePromoMutations() {
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: promoKeys.lists() })
  return {
    create: useMutation({ mutationFn: (/** @type {never} */ body) => api('admin.promos.create', { body }), onSuccess: refresh }),
    update: useMutation({
      mutationFn: (/** @type {{ id: string; body: never }} */ v) => api('admin.promos.update', { params: { id: v.id }, body: v.body }),
      onSuccess: (saved) => {
        queryClient.setQueryData(promoKeys.detail(saved.id), saved)
        void refresh()
      },
    }),
    remove: useMutation({ mutationFn: (/** @type {string} */ id) => api('admin.promos.delete', { params: { id } }), onSuccess: refresh }),
    bulk: useMutation({ mutationFn: (/** @type {{ ids: string[]; action: 'enable' | 'disable' }} */ body) => api('admin.promos.bulk', { body }), onSuccess: refresh }),
    /** The server works the discount out, not the browser. */
    preview: useMutation({ mutationFn: (/** @type {never} */ body) => api('admin.promos.preview', { body }) }),
  }
}
