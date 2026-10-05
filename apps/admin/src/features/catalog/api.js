import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { catalogKeys } from '@/lib/catalog'

/** A change to the catalog structure refreshes what depends on it: the lookups and the product lists. */
function useRefresh() {
  const queryClient = useQueryClient()
  return (/** @type {readonly string[]} */ key) => {
    void queryClient.invalidateQueries({ queryKey: key })
    void queryClient.invalidateQueries({ queryKey: ['products'] })
  }
}

export function useCategoryMutations() {
  const queryClient = useQueryClient()
  const refresh = useRefresh()
  const done = () => refresh(catalogKeys.categories)
  return {
    create: useMutation({ mutationFn: (/** @type {never} */ body) => api('admin.categories.create', { body }), onSuccess: done }),
    update: useMutation({ mutationFn: (/** @type {{ id: string; body: never; }} */ v) => api('admin.categories.update', { params: { id: v.id }, body: v.body }), onSuccess: done }),
    remove: useMutation({ mutationFn: (/** @type {string} */ id) => api('admin.categories.delete', { params: { id } }), onSuccess: done }),
    /** Moves a category within its siblings at once and puts it back if the server says no (plan/05-react-patterns.md section 9). */
    reorder: useMutation({
      mutationFn: (/** @type {{ parentId: string | null; orderedIds: string[]; }} */ body) => api('admin.categories.reorder', { body }),
      onMutate: async (body) => {
        await queryClient.cancelQueries({ queryKey: catalogKeys.categories })
        const before = queryClient.getQueryData(catalogKeys.categories)
        queryClient.setQueryData(catalogKeys.categories, (/** @type {{ items: { id: string; sortOrder: number; }[]; } | undefined} */ old) =>
          old ? { ...old, items: old.items.map((c) => (body.orderedIds.includes(c.id) ? { ...c, sortOrder: body.orderedIds.indexOf(c.id) } : c)) } : old,
        )
        return { before }
      },
      onError: (_error, _body, context) => queryClient.setQueryData(catalogKeys.categories, context?.before),
      onSettled: done,
    }),
  }
}
