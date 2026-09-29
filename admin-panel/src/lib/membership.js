// Pure collection-membership logic (F-17). Product.collectionIds is the single source of truth;
// Collection.productIds is derived from it. No storage access here, so db.js can use it for seeding.

// Returns a new products array where exactly `memberIds` belong to `collectionId`.
// Unchanged products keep their reference so React does not re-render them.
export function applyMembership(products, collectionId, memberIds) {
  const members = new Set(memberIds)
  return products.map((p) => {
    const has = (p.collectionIds || []).includes(collectionId)
    const should = members.has(p.id)
    if (has === should) return p
    const ids = p.collectionIds || []
    return { ...p, collectionIds: should ? [...ids, collectionId] : ids.filter((c) => c !== collectionId) }
  })
}

export const derivedProductIds = (products, collectionId) =>
  products.filter((p) => (p.collectionIds || []).includes(collectionId)).map((p) => p.id)

const sameSet = (a = [], b = []) => a.length === b.length && a.every((x) => b.includes(x))

// Collections whose stored productIds disagree with the products' collectionIds.
export function membershipDrift(products, collections) {
  return collections.filter((c) => !sameSet(c.productIds, derivedProductIds(products, c.id))).map((c) => c.id)
}

export function syncedCollections(products, collections) {
  return collections.map((c) => {
    const ids = derivedProductIds(products, c.id)
    return sameSet(c.productIds, ids) ? c : { ...c, productIds: ids }
  })
}

