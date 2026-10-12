// The numbers beside menu items (orders needing action, reviews to moderate) and whether the store has reviews on at all: `reviewsPending` is not given when it is off, so the menu has no Reviews
// (plan/07-admin/08-reviews.md section 1). The server only counts what the role may read.
import { queryOptions, useQuery } from '@tanstack/react-query'
import { api } from './api'

export const navKeys = { counts: ['nav', 'counts'] }
export const navCountsQuery = queryOptions({ queryKey: navKeys.counts, queryFn: ({ signal }) => api('admin.nav.counts', { signal }), refetchInterval: 60_000, staleTime: 30_000 })

/** @returns {import('@noor/contract').z.infer<typeof import('@noor/contract').NavCounts> | undefined} undefined until the first answer */
export const useNavCounts = () => useQuery(navCountsQuery).data
