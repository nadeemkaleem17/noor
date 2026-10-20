// What the order screens and the customer screens both read: the couriers and cities to choose from, and a customer by id or by phone. Features do not import each other (plan/03 section 5.3),
// so the keys and queries live here, like `lib/catalog.js`.
import { queryOptions } from '@tanstack/react-query'
import { api } from './api'

/** The enabled couriers and every city: for the dispatch dialog, the city filters and a staff-typed order. Open to everyone who reads orders. */
export const orderLookupsQuery = queryOptions({ queryKey: ['orders', 'lookups'], queryFn: ({ signal }) => api('admin.orders.lookups', { signal }), staleTime: 5 * 60_000 })

export const customerDetailQuery = (/** @type {string} */ id) => queryOptions({ queryKey: ['customers', 'detail', id], queryFn: ({ signal }) => api('admin.customers.get', { params: { id }, signal }) })

/** Visits to the website over whole Pakistan days, without any name: the customer screens and the dashboard both show it. @param {{ from: string, to: string }} period */
export const visitSummaryQuery = (period) => queryOptions({ queryKey: ['customers', 'visit-summary', period], queryFn: ({ signal }) => api('admin.customers.visits', { query: period, signal }), staleTime: 60_000 })

/** The customer of a phone number typed by staff, when there is one (a staff-created order). */
export const customerByPhoneQuery = (/** @type {string} */ phone) =>
  queryOptions({ queryKey: ['customers', 'by-phone', phone], queryFn: ({ signal }) => api('admin.customers.lookup', { query: { phone }, signal }), staleTime: 30_000, retry: false })
