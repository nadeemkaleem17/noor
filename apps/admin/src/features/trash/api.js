import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const trashKey = ['trash']
export const trashQuery = queryOptions({ queryKey: trashKey, queryFn: ({ signal }) => api('admin.trash.list', { signal }), staleTime: 15_000 })

/** Put one back, or empty one for good: the list is read again, and so are the lists the restored thing belongs to. */
export function useTrashMutations() {
  const queryClient = useQueryClient()
  const refresh = () => {
    void queryClient.invalidateQueries()
  }
  return {
    restore: useMutation({ mutationFn: (/** @type {string} */ id) => api('admin.trash.restore', { params: { id } }), onSuccess: refresh }),
    purge: useMutation({ mutationFn: (/** @type {string} */ id) => api('admin.trash.purge', { params: { id } }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: trashKey }) }),
  }
}
