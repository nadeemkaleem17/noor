import { useSyncExternalStore } from 'react'

/**
 * Whether a media query matches now, and again when it changes. A browser without `matchMedia` (a test) says no.
 * @param {string} query
 */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia?.(query)
      list?.addEventListener('change', notify)
      return () => list?.removeEventListener('change', notify)
    },
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  )
}
