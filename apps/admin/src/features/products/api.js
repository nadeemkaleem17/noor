import { routes } from '@noor/contract'
import { queryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const productKeys = {
  all: ['products'],
  lists: () => [...productKeys.all, 'list'],
  list: (/** @type {object} */ params) => [...productKeys.lists(), params],
}

/** The address of the product list is parsed with the route's own query schema. */
export const productListSchema = routes['admin.products.list'].query

export const productQueries = {
  /** @param {object} params parsed from the address with `productListSchema` */
  list: (params) => queryOptions({ queryKey: productKeys.list(params), queryFn: ({ signal }) => api('admin.products.list', { query: /** @type {never} */ (params), signal }) }),
}
