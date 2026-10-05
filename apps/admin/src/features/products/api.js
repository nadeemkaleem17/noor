import { routes } from '@noor/contract'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const productKeys = {
  all: ['products'],
  lists: () => [...productKeys.all, 'list'],
  list: (/** @type {object} */ params) => [...productKeys.lists(), params],
  detail: (/** @type {string} */ id) => [...productKeys.all, 'detail', id],
  checks: (/** @type {string} */ body) => [...productKeys.all, 'checks', body],
}

/** The address of the product list is parsed with the route's own query schema. */
export const productListSchema = routes['admin.products.list'].query

/** @typedef {import('@noor/contract').z.infer<typeof routes['admin.products.get']['response']>} AdminProduct */

export const productQueries = {
  /** @param {object} params parsed from the address with `productListSchema` */
  list: (params) => queryOptions({ queryKey: productKeys.list(params), queryFn: ({ signal }) => api('admin.products.list', { query: /** @type {never} */ (params), signal }) }),
  detail: (/** @type {string} */ id) => queryOptions({ queryKey: productKeys.detail(id), queryFn: ({ signal }) => api('admin.products.get', { params: { id }, signal }) }),
  /** The publish checks of a document as it is in the form. `body` is the JSON of the pruned form values. */
  checks: (/** @type {string} */ body) =>
    queryOptions({ queryKey: productKeys.checks(body), queryFn: ({ signal }) => api('admin.products.checks', { body: JSON.parse(body), signal }), staleTime: 10_000, retry: false }),
}

/** Saving, duplicating and deleting; each invalidates the product lists and puts a returned document in the cache. */
export function useProductMutations() {
  const queryClient = useQueryClient()
  /** @param {AdminProduct} saved */
  const remember = (saved) => {
    queryClient.setQueryData(productKeys.detail(saved.id), saved)
    void queryClient.invalidateQueries({ queryKey: productKeys.lists() })
  }
  return {
    create: useMutation({ mutationFn: (/** @type {never} */ body) => api('admin.products.create', { body }), onSuccess: remember }),
    update: useMutation({ mutationFn: (/** @type {{ id: string; body: never; }} */ v) => api('admin.products.update', { params: { id: v.id }, body: v.body }), onSuccess: remember }),
    duplicate: useMutation({ mutationFn: (/** @type {string} */ id) => api('admin.products.duplicate', { params: { id } }), onSuccess: remember }),
    remove: useMutation({
      mutationFn: (/** @type {string} */ id) => api('admin.products.delete', { params: { id } }),
      onSuccess: (_, id) => {
        queryClient.removeQueries({ queryKey: productKeys.detail(id) })
        void queryClient.invalidateQueries({ queryKey: productKeys.lists() })
      },
    }),
    previewLink: useMutation({ mutationFn: (/** @type {string} */ id) => api('admin.products.previewLink', { params: { id } }) }),
  }
}
