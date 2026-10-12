import { queryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'

const MIN = 60_000

export const dashboardKeys = {
  todo: ['dashboard', 'todo'],
  summary: (/** @type {string} */ from, /** @type {string} */ to) => ['dashboard', 'summary', from, to],
  top: (/** @type {string} */ from, /** @type {string} */ to) => ['dashboard', 'top', from, to],
  zero: (/** @type {string} */ from, /** @type {string} */ to) => ['dashboard', 'zero', from, to],
  recent: ['dashboard', 'recent'],
}

/** Each panel has its own query and so its own loading and failure (plan/07-admin/02-dashboard.md section 6). */
export const dashboardQueries = {
  /** Every minute while the page is open, and when the window gets focus. */
  todo: () => queryOptions({ queryKey: dashboardKeys.todo, queryFn: ({ signal }) => api('admin.dashboard.todo', { signal }), refetchInterval: MIN, refetchOnWindowFocus: true }),
  summary: (/** @type {string} */ from, /** @type {string} */ to) => queryOptions({ queryKey: dashboardKeys.summary(from, to), queryFn: ({ signal }) => api('admin.dashboard.summary', { query: { from, to }, signal }), staleTime: MIN }),
  top: (/** @type {string} */ from, /** @type {string} */ to) => queryOptions({ queryKey: dashboardKeys.top(from, to), queryFn: ({ signal }) => api('admin.dashboard.topProducts', { query: /** @type {never} */ ({ from, to, limit: 10 }), signal }), staleTime: 5 * MIN }),
  zero: (/** @type {string} */ from, /** @type {string} */ to) => queryOptions({ queryKey: dashboardKeys.zero(from, to), queryFn: ({ signal }) => api('admin.dashboard.zeroSearches', { query: /** @type {never} */ ({ from, to, limit: 10 }), signal }), staleTime: 5 * MIN }),
  /** The last 25 orders, 10 of them shown. */
  recent: () => queryOptions({ queryKey: dashboardKeys.recent, queryFn: ({ signal }) => api('admin.orders.list', { query: /** @type {never} */ ({ sort: '-placedAt', size: 25, page: 1 }), signal }), refetchInterval: MIN }),
}
