// The admin's data layer — the one module that knows where data lives (doc 03 §12).
// Components never touch localStorage or fetch; they go through this file (via hooks/useCollection.js).
//
// Two modes:
//  - Local (VITE_API_URL unset): every collection is persisted to localStorage, as before.
//  - API (VITE_API_URL set): the collections the store API serves — products, categories, orders and
//    siteSettings — are read from and written to the API (lib/api.js), so the storefront sees them.
//    Everything else (promos, pages, menus, …) stays in localStorage until the API grows those routes.
//
// Reads are always synchronous from an in-memory cache (useSyncExternalStore needs that); remote
// collections fill the cache in the background and expose a { state, error } status for the UI.
// Writes validate against the contract first and throw ContractError before anything is stored;
// remote writes then return a Promise that resolves to the saved record or rejects with ApiError.
import {
  seedCategories, seedCollections, seedAttributes, seedSizeSystems, seedSizeCharts,
  seedFormSchemas, seedProducts, seedPromos, seedOrders, seedReviews, seedMenus,
  seedPages, seedStoreConfig, seedTemplates, seedSiteSettings,
} from '../contract/fixtures.js'
import { makeId } from './id.js'
import { syncedCollections } from './membership.js'
import { validateItem, validateSingleton, ContractError } from './validate.js'
import { api, apiEnabled, ApiError } from './api.js'
import { checkImageFile, prepareImage, blobToDataUrl } from './imageFile.js'

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
const SINGLETON_SEEDS = { storeConfig: seedStoreConfig, siteSettings: seedSiteSettings }

// What the API serves, and which writes it supports (orders are created by the storefront's checkout).
const REMOTE = apiEnabled ? {
  products: { path: '/api/admin/products', create: true, update: true, remove: true },
  categories: { path: '/api/admin/categories', create: true, update: true, remove: true },
  orders: { path: '/api/admin/orders', create: false, update: true, remove: false },
} : {}
const REMOTE_SINGLETONS = apiEnabled ? {
  siteSettings: { get: '/api/public/settings', put: '/api/admin/settings' },
} : {}
const isRemote = (key) => key in REMOTE || key in REMOTE_SINGLETONS
export const API_MODE = apiEnabled
export const isRemoteKey = isRemote
// Where an uploaded image goes, in one short line for form hints.
export const UPLOAD_DESTINATION = apiEnabled
  ? 'Images are resized in your browser, then uploaded to the API server.'
  : 'No API connected: images are resized and stored in this browser only.'

// In-memory snapshot cache, keyed by collection/singleton name. Required for
// useSyncExternalStore correctness: getSnapshot must return a referentially
// stable value when the underlying data hasn't changed, or React (19+) treats
// it as a tear and can loop re-rendering forever. Every read is served from
// here; only a write, a remote load, or a cross-tab 'storage' event may replace it.
const cache = new Map()

const storageErrorListeners = new Set()
// Called once per failed localStorage write (quota exceeded, storage blocked). Returns an unsubscribe.
export function onStorageError(fn) {
  storageErrorListeners.add(fn)
  return () => storageErrorListeners.delete(fn)
}

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
  if (isRemote(key)) return // the API is the source of truth; don't shadow it in localStorage
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ v: SCHEMA_VERSION, data }))
  } catch (error) {
    // Storage full/blocked: the app keeps working in memory for this session, but say so —
    // uploaded images are big and are the usual cause.
    storageErrorListeners.forEach((fn) => fn(error))
  }
}

const listeners = new Map() // key -> Set<fn>
function notify(key) {
  listeners.get(key)?.forEach((fn) => fn())
}
export function subscribe(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set())
  listeners.get(key).add(fn)
  if (isRemote(key) && !loaded.has(key) && !inflight.has(key)) load(key)
  return () => listeners.get(key).delete(fn)
}

// ---------------------------------------------------------------- remote status + loading
const READY = Object.freeze({ state: 'ready', error: null })
const LOADING = Object.freeze({ state: 'loading', error: null })
const statuses = new Map()
const loaded = new Set()
const inflight = new Map()

// { state: 'ready' | 'loading' | 'error', error } — always READY for local collections.
export function getStatus(key) {
  if (!isRemote(key)) return READY
  return statuses.get(key) ?? LOADING
}
function setStatus(key, status) {
  statuses.set(key, status)
}

// Hero slides need stable ids for the admin's reorder UI; the API may not have stored any yet.
function fromRemote(key, data) {
  if (key === 'siteSettings' && data) {
    return { ...data, heroSlides: (data.heroSlides || []).map((s, i) => ({ ...s, id: s.id || `slide_${i + 1}` })) }
  }
  return data
}

function load(key) {
  if (inflight.has(key)) return inflight.get(key)
  const spec = REMOTE[key] || REMOTE_SINGLETONS[key]
  if (!loaded.has(key)) { setStatus(key, LOADING); notify(key) }
  const request = api.get(spec.path || spec.get)
    .then((data) => {
      const next = fromRemote(key, data)
      loaded.add(key)
      const changed = JSON.stringify(next) !== JSON.stringify(cache.get(key))
      if (changed) cache.set(key, next) // keep the old reference when nothing changed (no re-render churn)
      const statusChanged = getStatus(key) !== READY
      setStatus(key, READY)
      if (changed || statusChanged) notify(key)
    })
    .catch((error) => {
      setStatus(key, { state: 'error', error: error.message || 'Could not load from the API' })
      notify(key)
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, request)
  return request
}

// Re-fetch one remote collection/singleton (no-op for local ones). Returns a Promise.
export function refresh(key) {
  return isRemote(key) ? load(key) : Promise.resolve()
}

// Keep the admin current with the storefront (new orders, stock changes) while it's open:
// re-fetch whatever is on screen when the tab regains focus, and every 15 s while visible.
if (apiEnabled && typeof window !== 'undefined') {
  const refreshVisible = () => {
    if (document.visibilityState !== 'visible') return
    for (const [key, fns] of listeners) if (fns.size && isRemote(key)) load(key)
  }
  window.addEventListener('focus', refreshVisible)
  document.addEventListener('visibilitychange', refreshVisible)
  setInterval(refreshVisible, 15000)
}

// Contract enforcement (WP2). Nothing that breaks the contract reaches storage: every write path below
// validates first and throws ContractError *before* touching the cache, localStorage or the API, so a
// rejected save leaves the stored data exactly as it was. The UI layer (hooks/useCollection.js) catches
// the error and shows it; the data layer never swallows it.
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
const itemPath = (spec, id) => `${spec.path}/${encodeURIComponent(id)}`
const unsupported = (what, name) => Promise.reject(new ApiError(`${what} ${name} isn't supported by the API`))

export function getCollection(name) {
  if (REMOTE[name]) {
    if (!cache.has(name)) cache.set(name, []) // stable empty list until the first load lands
    return cache.get(name)
  }
  return readRaw(name, SEEDS[name] ? structuredClone(SEEDS[name]) : [])
}
// Replaces the whole collection. Every item must satisfy the contract.
// Remote collections are synced item by item (create/update/delete) and then re-read from the API.
export function setCollection(name, items) {
  assertValid(name, items)
  if (REMOTE[name]) return syncRemoteCollection(name, items)
  commit(name, items)
}
export function getSingleton(name) {
  if (REMOTE_SINGLETONS[name]) return cache.get(name) ?? null // null = still loading
  return readRaw(name, SINGLETON_SEEDS[name] ? structuredClone(SINGLETON_SEEDS[name]) : null)
}
export function setSingleton(name, value) {
  assertValidSingleton(name, value)
  const spec = REMOTE_SINGLETONS[name]
  if (spec) {
    return api.put(spec.put, value).then((saved) => {
      const next = fromRemote(name, saved)
      commit(name, next)
      return next
    })
  }
  commit(name, value)
}

// Create / update validate only the record being written, so one legacy bad record already in
// storage can never block an unrelated save.
export function createItem(collection, item, idPrefix = collection.slice(0, 3)) {
  const withId = { ...item, id: item.id || makeId(idPrefix) }
  assertValid(collection, [withId])
  const spec = REMOTE[collection]
  if (spec) {
    if (!spec.create) return unsupported('Creating', collection)
    return api.post(spec.path, withId).then((saved) => {
      commit(collection, [saved, ...getCollection(collection).filter((it) => it.id !== saved.id)])
      return saved
    })
  }
  commit(collection, [withId, ...getCollection(collection)])
  return withId
}
export function updateItem(collection, id, patch) {
  const items = getCollection(collection)
  const current = items.find((it) => it.id === id)
  if (!current) return undefined
  const updated = { ...current, ...patch }
  assertValid(collection, [updated])
  const spec = REMOTE[collection]
  if (spec) {
    if (!spec.update) return unsupported('Updating', collection)
    return api.put(itemPath(spec, id), updated).then((saved) => {
      commit(collection, getCollection(collection).map((it) => (it.id === id ? saved : it)))
      return saved
    })
  }
  commit(collection, items.map((it) => (it.id === id ? updated : it)))
  return updated
}
export function removeItem(collection, id) {
  // Deleting never adds a record, so there is nothing to validate.
  const spec = REMOTE[collection]
  if (spec) {
    if (!spec.remove) return unsupported('Deleting', collection)
    return api.del(itemPath(spec, id)).then(() => {
      commit(collection, getCollection(collection).filter((it) => it.id !== id))
      return true
    })
  }
  commit(collection, getCollection(collection).filter((it) => it.id !== id))
}

// Push a whole list to the API as individual creates/updates/deletes, then re-read the server's view
// (also on failure, so the cache never shows a half-applied state as if it were saved).
async function syncRemoteCollection(name, next) {
  const spec = REMOTE[name]
  const current = getCollection(name)
  const before = new Map(current.map((it) => [it.id, it]))
  const nextIds = new Set(next.map((it) => it.id))
  try {
    for (const item of next) {
      const old = before.get(item.id)
      if (!old) { if (spec.create) await api.post(spec.path, item) }
      else if (old !== item && JSON.stringify(old) !== JSON.stringify(item)) { if (spec.update) await api.put(itemPath(spec, item.id), item) }
    }
    for (const item of current) {
      if (!nextIds.has(item.id) && spec.remove) await api.del(itemPath(spec, item.id))
    }
  } finally {
    await load(name)
  }
  return getCollection(name)
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
// All-or-nothing validation: the whole bundle is checked first; if any record is invalid nothing is
// written. In API mode, remote collections are then synced to the server (returns a Promise); orders
// can't be created through the API, so imported orders only update ones the server already has.
export function importAll({ collections = {}, singletons = {} }) {
  const failures = []
  const collect = (fn) => { try { fn() } catch (e) { if (e instanceof ContractError) failures.push(e); else throw e } }
  COLLECTION_NAMES.forEach((k) => { if (Array.isArray(collections[k])) collect(() => assertValid(k, collections[k])) })
  SINGLETON_NAMES.forEach((k) => { if (singletons[k]) collect(() => assertValidSingleton(k, singletons[k])) })
  if (failures.length) {
    const err = new ContractError(failures.map((f) => f.collection).join(', '), failures.flatMap((f) => f.failures.map((x) => ({ ...x, id: `${f.collection}/${x.id}` }))))
    throw err
  }
  COLLECTION_NAMES.forEach((k) => { if (Array.isArray(collections[k]) && !REMOTE[k]) commit(k, collections[k]) })
  SINGLETON_NAMES.forEach((k) => { if (singletons[k] && !REMOTE_SINGLETONS[k]) commit(k, singletons[k]) })
  if (!apiEnabled) return
  return (async () => {
    for (const k of Object.keys(REMOTE)) if (Array.isArray(collections[k])) await syncRemoteCollection(k, collections[k])
    for (const k of Object.keys(REMOTE_SINGLETONS)) if (singletons[k]) await setSingleton(k, singletons[k])
  })()
}

// Restoring the shipped seeds must always work, so this bypasses validation on purpose.
// In API mode the server is reset to its own seed data too (returns a Promise), unless
// `{ includeApi: false }` — the crash-recovery screen only clears this browser.
export function resetAllData({ includeApi = true } = {}) {
  Object.keys(SEEDS).forEach((k) => { if (!REMOTE[k]) commit(k, structuredClone(SEEDS[k])) })
  Object.keys(SINGLETON_SEEDS).forEach((k) => { if (!REMOTE_SINGLETONS[k]) commit(k, structuredClone(SINGLETON_SEEDS[k])) })
  if (!apiEnabled || !includeApi) return
  return api.post('/api/admin/reset').then(() => Promise.all([...Object.keys(REMOTE), ...Object.keys(REMOTE_SINGLETONS)].map(load)))
}

// Turn an image picked from the device into a URL a product/setting can store: validated, downscaled
// in the browser, then uploaded to the API (API mode) or inlined as a data: URL (local mode — kept
// smaller, since localStorage only holds a few MB). Resolves to { url, width, height }.
export async function uploadImage(file, { maxSide = 1600 } = {}) {
  const problem = checkImageFile(file)
  if (problem) throw new Error(problem)
  const { blob, width, height, type } = await prepareImage(file, { maxSide: apiEnabled ? maxSide : Math.min(maxSide, 1000) })
  if (!apiEnabled) return { url: await blobToDataUrl(blob), width, height }
  const ext = type.split('/')[1] || 'img'
  const base = (file.name || 'image').replace(/\.[^.]+$/, '').slice(0, 60) || 'image'
  const { url } = await api.upload(blob, `${base}.${ext}`)
  return { url, width, height }
}

// Sync across tabs (local collections only; remote ones refresh on focus instead)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (!e.key || !e.key.startsWith(PREFIX)) return
    const key = e.key.slice(PREFIX.length)
    if (isRemote(key)) return
    cache.delete(key)
    notify(key)
  })
}
