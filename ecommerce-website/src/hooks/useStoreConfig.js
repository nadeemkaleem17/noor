import { STORE_CONFIG } from '../data/mockData'

// Read-only store configuration (name, theme, contact details).
// The storefront never writes this: the admin project owns it (doc 03 §8). Today it is a
// static mock; when the route-loader/BFF layer lands, only this hook's body changes
// (to read the root loader's data) — no call site needs to.
export function useStoreConfig() {
  return STORE_CONFIG
}
