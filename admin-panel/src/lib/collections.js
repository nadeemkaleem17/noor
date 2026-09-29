// Collection membership (F-17): storage-aware wrapper around lib/membership.js.
import { getCollection, setCollection } from './db.js'
import { syncedCollections } from './membership.js'
export { applyMembership, derivedProductIds, membershipDrift, syncedCollections } from './membership.js'

// Rewrite Collection.productIds from the products currently in storage. from the products currently in storage.
export function syncCollectionMembership() {
  const next = syncedCollections(getCollection('products'), getCollection('collectionsList'))
  if (next.some((c, i) => c !== getCollection('collectionsList')[i])) setCollection('collectionsList', next)
}
