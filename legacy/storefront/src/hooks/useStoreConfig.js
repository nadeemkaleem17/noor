import { useContext } from 'react'
import { StoreConfigContext } from '../context/storeConfig'

// Read-only store configuration (name, logo, favicon, hero slides, theme, contact details).
// Served by StoreConfigProvider: mock values, overridden by /api/public/settings when
// VITE_API_URL is set. Call sites don't need to know which.
export function useStoreConfig() {
  const ctx = useContext(StoreConfigContext)
  if (!ctx) throw new Error('useStoreConfig must be used within StoreConfigProvider')
  return ctx
}
