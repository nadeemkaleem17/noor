// The catalog structure a product refers to (categories, attributes, size systems, charts, custom-size forms). Read by the product editor now and by the
// structure screens (M3-04) later, so the keys live here and not in a feature.
import { queryOptions } from '@tanstack/react-query'
import { api } from './api'

export const catalogKeys = {
  categories: ['catalog', 'categories'],
  attributes: ['catalog', 'attributes'],
  sizeSystems: ['catalog', 'size-systems'],
  sizeCharts: ['catalog', 'size-charts'],
  formSchemas: ['catalog', 'form-schemas'],
}

const stale = 60_000
export const categoriesQuery = queryOptions({ queryKey: catalogKeys.categories, queryFn: ({ signal }) => api('admin.categories.list', { signal }), staleTime: stale })
export const attributesQuery = queryOptions({ queryKey: catalogKeys.attributes, queryFn: ({ signal }) => api('admin.attributes.list', { signal }), staleTime: stale })
export const sizeSystemsQuery = queryOptions({ queryKey: catalogKeys.sizeSystems, queryFn: ({ signal }) => api('admin.sizeSystems.list', { signal }), staleTime: stale })
export const sizeChartsQuery = queryOptions({ queryKey: catalogKeys.sizeCharts, queryFn: ({ signal }) => api('admin.sizeCharts.list', { signal }), staleTime: stale })
export const formSchemasQuery = queryOptions({ queryKey: catalogKeys.formSchemas, queryFn: ({ signal }) => api('admin.formSchemas.list', { signal }), staleTime: stale })

/**
 * Categories as options with their path ("Women > Stitched"), parents first.
 * @param {{ id: string; name: string; parentId?: string | null; sortOrder: number; }[]} categories
 */
export function categoryOptions(categories) {
  /** @type {Map<string, typeof categories>} */
  const byParent = new Map()
  for (const c of categories) byParent.set(c.parentId ?? '', [...(byParent.get(c.parentId ?? '') ?? []), c])
  /** @type {{ value: string; label: string; }[]} */
  const out = []
  /** @param {string} parent @param {string[]} path */
  const walk = (parent, path) => {
    for (const c of (byParent.get(parent) ?? []).toSorted((a, b) => a.sortOrder - b.sortOrder)) {
      out.push({ value: c.id, label: [...path, c.name].join(' › ') })
      walk(c.id, [...path, c.name])
    }
  }
  walk('', [])
  return out
}

/**
 * The attributes a product in `categoryId` is described by: the category's own filters, or those of its nearest ancestor that has any (plan/09-data-model/03-catalog.md).
 * @param {{ id: string; parentId?: string | null; attributes: { attributeId: string; required: boolean; }[]; }[]} categories
 * @param {string} categoryId
 */
export function attributesOf(categories, categoryId) {
  const byId = new Map(categories.map((c) => [c.id, c]))
  for (let c = byId.get(categoryId), hops = 0; c && hops < 10; c = c.parentId ? byId.get(c.parentId) : undefined, hops++) {
    if (c.attributes.length > 0) return c.attributes
  }
  return []
}
