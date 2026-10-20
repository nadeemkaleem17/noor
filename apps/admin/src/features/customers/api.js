import { routes } from '@noor/contract'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { customerByPhoneQuery, customerDetailQuery } from '@/lib/sales'

export const customerKeys = {
  all: ['customers'],
  lists: () => [...customerKeys.all, 'list'],
  list: (/** @type {object} */ params) => [...customerKeys.lists(), params],
  detail: (/** @type {string} */ id) => [...customerKeys.all, 'detail', id],
}

/** The address of the customer list is parsed with the route's own query schema. */
export const customerListSchema = routes['admin.customers.list'].query

/** @typedef {import('@noor/contract').AdminCustomer} AdminCustomer */
/** @typedef {import('@noor/contract').AdminCustomerRow} CustomerRow */

export const customerQueries = {
  /** @param {object} params parsed from the address with `customerListSchema` */
  list: (params) => queryOptions({ queryKey: customerKeys.list(params), queryFn: ({ signal }) => api('admin.customers.list', { query: /** @type {never} */ (params), signal }) }),
  detail: customerDetailQuery,
  byPhone: customerByPhoneQuery,
}

/** Edit, note and anonymise; each puts the answer into the cache and refreshes the lists. @param {string} id */
export function useCustomerMutations(id) {
  const queryClient = useQueryClient()
  const lists = () => queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
  return {
    update: useMutation({
      mutationFn: (/** @type {never} */ body) => api('admin.customers.update', { params: { id }, body }),
      onSuccess: (saved) => {
        queryClient.setQueryData(customerKeys.detail(id), saved)
        void lists()
      },
    }),
    note: useMutation({ mutationFn: (/** @type {string} */ body) => api('admin.customers.addNote', { params: { id }, body: { body } }), onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.detail(id) }) }),
    anonymise: useMutation({
      mutationFn: (/** @type {string} */ confirm) => api('admin.customers.anonymise', { params: { id }, body: { confirm } }),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: customerKeys.detail(id) })
        void lists()
      },
    }),
  }
}

/** The rules that colour customers (they change rarely: saving them refreshes this, not the clock). */
export const highlightRulesQuery = queryOptions({ queryKey: [...customerKeys.all, 'highlight-rules'], queryFn: ({ signal }) => api('admin.customers.highlightRules.list', { signal }), staleTime: 60_000 })

/** @param {{ from: string, to: string }} period */
export const visitSummaryQuery = (period) => queryOptions({ queryKey: [...customerKeys.all, 'visit-summary', period], queryFn: ({ signal }) => api('admin.customers.visits', { query: period, signal }), staleTime: 60_000 })

/** Saving the whole list; the customers' colours depend on it, so the lists are fetched again. */
export function useSaveHighlightRules() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (/** @type {never} */ rules) => api('admin.customers.highlightRules.save', { body: { rules } }),
    onSuccess: (saved) => {
      queryClient.setQueryData(highlightRulesQuery.queryKey, saved)
      void queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: [...customerKeys.all, 'detail'] })
    },
  })
}
