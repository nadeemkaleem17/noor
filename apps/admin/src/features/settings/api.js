import { queryOptions, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const settingsKeys = {
  store: ['settings', 'store'],
  checkout: ['settings', 'checkout'],
  payments: ['settings', 'payments'],
  theme: ['settings', 'theme'],
  presets: ['settings', 'theme', 'presets'],
  translation: ['settings', 'translation-status'],
  shipping: ['settings', 'shipping'],
  system: ['settings', 'system'],
}

export const storeQuery = queryOptions({ queryKey: settingsKeys.store, queryFn: ({ signal }) => api('admin.settings.getStore', { signal }) })
export const checkoutQuery = queryOptions({ queryKey: settingsKeys.checkout, queryFn: ({ signal }) => api('admin.settings.getCheckout', { signal }) })
export const translationQuery = queryOptions({ queryKey: settingsKeys.translation, queryFn: ({ signal }) => api('admin.settings.translationStatus', { signal }) })

/**
 * The store settings are one document saved whole with a version, but each card of the screen saves on its own (plan/07-admin/11-settings.md section 2):
 * a card's save reads the latest document, replaces only its own keys and writes it back, so cards never overwrite each other.
 */
export function useSaveStoreSlice() {
  const queryClient = useQueryClient()
  return useMutation({
    // `slice` is the keys to replace, or a function from the latest value to them (for a card that owns only part of a key)
    mutationFn: async (/** @type {Record<string, unknown> | ((latest: any) => Record<string, unknown>)} */ slice) => {
      const latest = await queryClient.fetchQuery({ ...storeQuery, staleTime: 0 })
      const keys = typeof slice === 'function' ? slice(latest.value) : slice
      return api('admin.settings.updateStore', { body: /** @type {never} */ ({ value: { ...latest.value, ...keys }, version: latest.version }) })
    },
    onSuccess: (doc) => queryClient.setQueryData(settingsKeys.store, doc),
  })
}

export function useSaveCheckout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (/** @type {Record<string, unknown>} */ value) => {
      const latest = await queryClient.fetchQuery({ ...checkoutQuery, staleTime: 0 })
      return api('admin.settings.updateCheckout', { body: /** @type {never} */ ({ value, version: latest.version }) })
    },
    onSuccess: (doc) => queryClient.setQueryData(settingsKeys.checkout, doc),
  })
}

// ---- shipping (plan/07-admin/10-shipping-payments.md) ------------------------------------------------------------------------

export const zonesQuery = queryOptions({ queryKey: [...settingsKeys.shipping, 'zones'], queryFn: ({ signal }) => api('admin.shipping.listZones', { signal }) })
export const couriersQuery = queryOptions({ queryKey: [...settingsKeys.shipping, 'couriers'], queryFn: ({ signal }) => api('admin.couriers.list', { signal }) })

export const cityQueries = {
  /** @param {object} params the route query: page, size, q, province, unassigned */
  list: (params) => queryOptions({ queryKey: [...settingsKeys.shipping, 'cities', params], queryFn: ({ signal }) => api('admin.shipping.listCities', { query: /** @type {never} */ (params), signal }) }),
}

/** Every city of the master list with the zone it is in, read in pages of 100: the zone form needs them all to pick from. */
export function useAllCities() {
  const first = useQuery({ ...cityQueries.list({ page: 1, size: 100 }), staleTime: 30_000 })
  const pages = Math.ceil((first.data?.total ?? 0) / 100)
  const rest = useQueries({ queries: Array.from({ length: Math.max(0, pages - 1) }, (_, i) => ({ ...cityQueries.list({ page: i + 2, size: 100 }), staleTime: 30_000 })) })
  const all = [first.data, ...rest.map((r) => r.data)]
  return { cities: all.flatMap((p) => p?.items ?? []), loading: first.isPending || rest.some((r) => r.isPending), error: first.isError || rest.some((r) => r.isError) }
}

/** Zones, cities and couriers refresh each other: a city's zone shows in the city list. */
function useRefreshShipping() {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: settingsKeys.shipping })
}

export function useZoneMutations() {
  const refresh = useRefreshShipping()
  return {
    create: useMutation({ mutationFn: (/** @type {any} */ body) => api('admin.shipping.createZone', { body }), onSuccess: refresh }),
    update: useMutation({ mutationFn: (/** @type {{ id: string; body: any; }} */ v) => api('admin.shipping.updateZone', { params: { id: v.id }, body: v.body }), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (/** @type {string} */ id) => api('admin.shipping.deleteZone', { params: { id } }), onSuccess: refresh }),
    impact: useMutation({ mutationFn: (/** @type {{ id: string; body: any; }} */ v) => api('admin.shipping.zoneImpact', { params: { id: v.id }, body: v.body }) }),
    match: useMutation({ mutationFn: (/** @type {string[]} */ names) => api('admin.shipping.matchCities', { body: { names } }) }),
  }
}

export function useCityMutations() {
  const refresh = useRefreshShipping()
  return {
    create: useMutation({ mutationFn: (/** @type {any} */ body) => api('admin.shipping.createCity', { body }), onSuccess: refresh }),
    update: useMutation({ mutationFn: (/** @type {{ id: string; body: any; }} */ v) => api('admin.shipping.updateCity', { params: { id: v.id }, body: v.body }), onSuccess: refresh }),
  }
}

export function useCourierMutations() {
  const refresh = useRefreshShipping()
  return {
    create: useMutation({ mutationFn: (/** @type {any} */ body) => api('admin.couriers.create', { body }), onSuccess: refresh }),
    update: useMutation({ mutationFn: (/** @type {{ id: string; body: any; }} */ v) => api('admin.couriers.update', { params: { id: v.id }, body: v.body }), onSuccess: refresh }),
  }
}
