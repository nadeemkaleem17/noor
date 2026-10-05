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

export function useAttributeMutations() {
  const refresh = useRefresh()
  const done = () => refresh(catalogKeys.attributes)
  return {
    create: useMutation({ mutationFn: (/** @type {never} */ body) => api('admin.attributes.create', { body }), onSuccess: done }),
    update: useMutation({ mutationFn: (/** @type {{ id: string; body: never; }} */ v) => api('admin.attributes.update', { params: { id: v.id }, body: v.body }), onSuccess: done }),
    remove: useMutation({ mutationFn: (/** @type {string} */ id) => api('admin.attributes.delete', { params: { id } }), onSuccess: done }),
    /** Moves every product from one value to another, so the first can be deleted. */
    merge: useMutation({
      mutationFn: (/** @type {{ id: string; valueId: string; intoValueId: string; }} */ v) => api('admin.attributes.mergeValue', { params: { id: v.id, valueId: v.valueId }, body: { intoValueId: v.intoValueId } }),
      onSuccess: done,
    }),
  }
}

/** Size systems, size charts and custom-size forms share one shape of mutations. @param {string} base a route key prefix, for example `admin.sizeSystems` @param {readonly string[]} key */
function useStructureMutations(base, key) {
  const refresh = useRefresh()
  const done = () => refresh(key)
  // the key is built from the prefix, so the typed client cannot check it here; the three callers pass real route prefixes
  const call = /** @type {(key: string, input: object) => Promise<any>} */ (/** @type {unknown} */ (api))
  return {
    create: useMutation({ mutationFn: (/** @type {object} */ body) => call(`${base}.create`, { body }), onSuccess: done }),
    update: useMutation({ mutationFn: (/** @type {{ id: string; body: object; }} */ v) => call(`${base}.update`, { params: { id: v.id }, body: v.body }), onSuccess: done }),
    remove: useMutation({ mutationFn: (/** @type {string} */ id) => call(`${base}.delete`, { params: { id } }), onSuccess: done }),
  }
}

export const useSizeSystemMutations = () => useStructureMutations('admin.sizeSystems', catalogKeys.sizeSystems)
export const useSizeChartMutations = () => useStructureMutations('admin.sizeCharts', catalogKeys.sizeCharts)
export const useFormSchemaMutations = () => useStructureMutations('admin.formSchemas', catalogKeys.formSchemas)
