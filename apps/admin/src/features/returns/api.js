import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** @typedef {import('@noor/contract').ReturnRow} ReturnRow */

export const returnKeys = { all: ['returns'] }

export const returnQueries = {
  /** @param {{ status?: ReturnRow['status']; orderId?: string }} params */
  list: (params) => queryOptions({ queryKey: [...returnKeys.all, params], queryFn: ({ signal }) => api('admin.returns.list', { query: /** @type {never} */ ({ ...params, size: 100 }), signal }) }),
}

/** A decision on a request; the lists (and the counts above them) are read again. */
export function useReturnUpdate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (/** @type {{ id: string; body: import('@noor/contract').ReturnUpdateBody }} */ v) => api('admin.returns.update', { params: { id: v.id }, body: v.body }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: returnKeys.all }),
  })
}
