// What both the Orders list (assigning orders to a rider) and the Delivery screens read: the delivery people, and the call that puts orders on a run.
// It lives here because a feature does not import another (lint rule).
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const deliveryKeys = {
  all: ['delivery'],
  people: ['delivery', 'people'],
  runs: ['delivery', 'runs'],
  run: (/** @type {string} */ id) => ['delivery', 'runs', 'detail', id],
  ledger: (/** @type {string} */ id, /** @type {object} */ range) => ['delivery', 'people', id, 'ledger', range],
  receipts: ['delivery', 'receipts'],
  ofOrder: (/** @type {string} */ id) => ['delivery', 'order', id],
}

export const deliveryPeopleQuery = queryOptions({ queryKey: deliveryKeys.people, queryFn: ({ signal }) => api('admin.delivery.people.list', { signal }), staleTime: 30_000 })

/** Puts orders on a run of one person. The answer lists the orders that could not go, with the reason of each. */
export function useAssignOrders() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (/** @type {{ personId: string; orderIds: string[]; runDate?: string; note?: string }} */ body) => api('admin.delivery.assign', { body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: deliveryKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}
