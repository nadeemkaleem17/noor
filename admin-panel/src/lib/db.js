// Stand-in "admin API": every collection is persisted to localStorage behind
// the same shape the real admin API will return (doc 03 §12). Swapping this
// for real HTTP calls later is a one-file change, same adapter idea as the
// storefront's BFF plan (doc 06 §5) — components never touch localStorage directly.
import {
  seedCategories, seedCollections, seedAttributes, seedSizeSystems, seedSizeCharts,
  seedFormSchemas, seedProducts, seedPromos, seedOrders, seedReviews, seedMenus,
  seedPages, seedStoreConfig, seedTemplates,
} from '../contract/fixtures.js'
import { makeId } from './id.js'
import { syncedCollections } from './membership.js'
import { validateItem, validateSingleton, ContractError } from './validate.js'

const PREFIX = 'admin:'
const SCHEMA_VERSION = 1

const SEEDS = {
  products: seedProducts,
  categories: seedCategories,
  collectionsList: syncedCollections(seedProducts, seedCollections), // derived so seed data has one source of truth (F-17)
  attributes: seedAttributes,
  sizeSystems: seedSizeSystems,
  sizeCharts: seedSizeCharts,
  formSchemas: seedFormSchemas,
  promos: seedPromos,
  orders: seedOrders,
  reviews: seedReviews,
  menus: seedMenus,
  pages: seedPages,
  templates: seedTemplates,
}
const SINGLETON_SEEDS = { storeConfig: seedStoreConfig }

// In-memory snapshot cache, keyed by collection/singleton name. Required for
// useSyncExternalStore correctness: getSnapshot must return a referentially
// stable value when the underlying data hasn't changed, or React (19+) treats
// it as a tear and can loop re-rendering forever. Every read is served from
// here; only a write (writeRaw) or a cross-tab 'storage' event may replace it.
const cache = new Map()

function readRaw(key, fallback) {
  if (cache.has(key)) return cache.get(key)
  let value = fallback
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.v === SCHEMA_VERSION) value = parsed.data
    }
  } catch {
    value = fallback
  }
  cache.set(key, value)
  return value
}

function writeRaw(key, data) {
  cache.set(key, data)
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ v: SCHEMA_VERSION, data }))
  } catch {
    // storage blocked/full — app keeps working in memory for this session
  }
}

const listeners = new Map() // key -> Set<fn>
function notify(key) {
  listeners.get(key)?.forEach((fn) => fn())
}
export function subscribe(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set())
  listeners.get(key).add(fn)
  return () => listeners.get(key).delete(fn)
}

// Contract enforcement (WP2). Nothing that breaks the contract reaches storage: every write path below
// validates first and throws ContractError *before* touching the cache or localStorage, so a rejected
// save leaves the stored data exactly as it was. The UI layer (hooks/useCollection.js) catches the error
// and shows it; the data layer never swallows it.
function assertValid(name, items) {
  const failures = []
  for (const item of items) {
    const result = validateItem(name, item)
    if (!result.success) failures.push({ id: item?.id ?? '(new)', errors: result.errors })
  }
  if (failures.length) throw new ContractError(name, failures)
}
function assertValidSingleton(name, value) {
  const result = validateSingleton(name, value)
  if (!result.success) throw new ContractError(name, [{ id: name, errors: result.errors }])
}
function commit(name, data) {
  writeRaw(name, data)
  notify(name)
}

export function getCollection(name) {
  return readRaw(name, SEEDS[name] ? structuredClone(SEEDS[name]) : [])
}
// Replaces the whole collection. Every item must satisfy the contract.
export function setCollection(name, items) {
  assertValid(name, items)
  commit(name, items)
}
export function getSingleton(name) {
  return readRaw(name, SINGLETON_SEEDS[name] ? structuredClone(SINGLETON_SEEDS[name]) : null)
}
export function setSingleton(name, value) {
  assertValidSingleton(name, value)
  commit(name, value)
}

// Create / update validate only the record being written, so one legacy bad record already in
// storage can never block an unrelated save.
export function createItem(collection, item, idPrefix = collection.slice(0, 3)) {
  const withId = { ...item, id: item.id || makeId(idPrefix) }
  assertValid(collection, [withId])
  commit(collection, [withId, ...getCollection(collection)])
  return withId
}
export function updateItem(collection, id, patch) {
  const items = getCollection(collection)
  const current = items.find((it) => it.id === id)
  if (!current) return undefined
  const updated = { ...current, ...patch }
  assertValid(collection, [updated])
  commit(collection, items.map((it) => (it.id === id ? updated : it)))
  return updated
}
export function removeItem(collection, id) {
  // Deleting never adds a record, so there is nothing to validate.
  commit(collection, getCollection(collection).filter((it) => it.id !== id))
}

export const COLLECTION_NAMES = Object.keys(SEEDS)
export const SINGLETON_NAMES = Object.keys(SINGLETON_SEEDS)

// Everything the admin holds, in the shape the JSON bundle uses.
export function exportAll() {
  const out = { collections: {}, singletons: {} }
  COLLECTION_NAMES.forEach((k) => { out.collections[k] = getCollection(k) })
  SINGLETON_NAMES.forEach((k) => { out.singletons[k] = getSingleton(k) })
  return out
}
// All-or-nothing: the whole bundle is validated first; if any record is invalid nothing is written.
export function importAll({ collections = {}, singletons = {} }) {
  const failures = []
  const collect = (fn) => { try { fn() } catch (e) { if (e instanceof ContractError) failures.push(e); else throw e } }
  COLLECTION_NAMES.forEach((k) => { if (Array.isArray(collections[k])) collect(() => assertValid(k, collections[k])) })
  SINGLETON_NAMES.forEach((k) => { if (singletons[k]) collect(() => assertValidSingleton(k, singletons[k])) })
  if (failures.length) {
    const err = new ContractError(failures.map((f) => f.collection).join(', '), failures.flatMap((f) => f.failures.map((x) => ({ ...x, id: `${f.collection}/${x.id}` }))))
    throw err
  }
  COLLECTION_NAMES.forEach((k) => { if (Array.isArray(collections[k])) commit(k, collections[k]) })
  SINGLETON_NAMES.forEach((k) => { if (singletons[k]) commit(k, singletons[k]) })
}

// Restoring the shipped seeds must always work, so this bypasses validation on purpose.
export function resetAllData() {
  Object.keys(SEEDS).forEach((k) => commit(k, structuredClone(SEEDS[k])))
  Object.keys(SINGLETON_SEEDS).forEach((k) => commit(k, structuredClone(SINGLETON_SEEDS[k])))
}

// Sync across tabs
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (!e.key || !e.key.startsWith(PREFIX)) return
    const key = e.key.slice(PREFIX.length)
    cache.delete(key)
    notify(key)
  })
}