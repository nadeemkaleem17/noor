import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
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
    mutationFn: async (/** @type {Record<string, unknown>} */ slice) => {
      const latest = await queryClient.fetchQuery({ ...storeQuery, staleTime: 0 })
      return api('admin.settings.updateStore', { body: /** @type {never} */ ({ value: { ...latest.value, ...slice }, version: latest.version }) })
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
