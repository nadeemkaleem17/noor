import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as F from '../../contract/fixtures.js'
import { collections, StoreConfig } from '../../contract/schemas.js'
import { createItem, getCollection, resetAllData, updateItem } from '../db.js'
import { slugify, slugifyLoose } from '../id.js'
import { validateItem } from '../validate.js'
import { cartesianOptionValueIds, comboKey } from '../variants.js'

// Seed data for each contract collection, keyed the way contract/schemas.js `collections` is keyed.
const SEEDS = {
  products: F.seedProducts,
  categories: F.seedCategories,
  collectionsList: F.seedCollections,
  attributes: F.seedAttributes,
  sizeSystems: F.seedSizeSystems,
  sizeCharts: F.seedSizeCharts,
  promos: F.seedPromos,
  orders: F.seedOrders,
  reviews: F.seedReviews,
  menus: F.seedMenus,
  pages: F.seedPages,
  templates: F.seedTemplates,
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {}) // db.js warns on contract violations in dev
  resetAllData()
})

describe('contract: seed fixtures match the Zod schemas (F-03)', () => {
  for (const [name, items] of Object.entries(SEEDS)) {
    it(`${name}: every seed item is valid`, () => {
      const schema = collections[name]
      expect(schema, `no schema registered for "${name}"`).toBeTruthy()
      for (const item of items) {
        const r = schema.safeParse(item)
        expect(r.success, `${name}/${item.id}: ${r.success ? '' : JSON.stringify(r.error.issues[0])}`).toBe(true)
      }
    })
  }
  it('StoreConfig seed is valid', () => {
    expect(StoreConfig.safeParse(F.seedStoreConfig).success).toBe(true)
  })
})

describe('validateItem', () => {
  const product = () => structuredClone(F.seedProducts[0])

  it('accepts every seed product', () => {
    for (const p of F.seedProducts) expect(validateItem('products', p).success).toBe(true)
  })
  it('lets a draft be incomplete (no media yet)', () => {
    const p = { ...product(), status: 'draft', media: [] }
    expect(validateItem('products', p).success).toBe(true)
  })
  it('holds an active product to the full contract', () => {
    const p = { ...product(), status: 'active', media: [] }
    const r = validateItem('products', p)
    expect(r.success).toBe(false)
    expect(r.errors.some((e) => e.path === 'media')).toBe(true)
  })
  it('rejects an active product with no variants', () => {
    const r = validateItem('products', { ...product(), status: 'active', variants: [] })
    expect(r.success).toBe(false)
  })
  it('rejects a bad handle and a blank category, even for drafts', () => {
    const r = validateItem('products', { ...product(), status: 'draft', handle: 'Bad Handle', primaryCategoryId: '' })
    expect(r.errors.map((e) => e.path)).toEqual(expect.arrayContaining(['handle', 'primaryCategoryId']))
  })
  it('reports each path once', () => {
    const r = validateItem('products', { ...product(), status: 'active', primaryCategoryId: undefined })
    const paths = r.errors.map((e) => e.path)
    expect(new Set(paths).size).toBe(paths.length)
  })
  it('passes collections it has no rules for', () => {
    expect(validateItem('nope', {}).success).toBe(true)
  })
})

describe('db: createItem / updateItem (F-02)', () => {
  it('generates an id when the item carries id: undefined (product duplicate)', () => {
    const src = F.seedProducts[0]
    const copy = createItem('products', { ...src, id: undefined, title: 'Copy' }, 'p')
    expect(copy.id).toBeTruthy()
    expect(copy.id).not.toBe(src.id)
    expect(getCollection('products')[0].id).toBe(copy.id)
  })
  it('keeps an explicit id', () => {
    expect(createItem('categories', { id: 'fixed-id', name: 'X', handle: 'x' }).id).toBe('fixed-id')
  })
  it('updateItem patches only the target item', () => {
    const [a, b] = getCollection('products')
    updateItem('products', a.id, { title: 'Changed' })
    const after = getCollection('products')
    expect(after.find((p) => p.id === a.id).title).toBe('Changed')
    expect(after.find((p) => p.id === b.id).title).toBe(b.title)
  })
})

describe('slugs (F-07)', () => {
  it('slugifyLoose keeps a hand-typed hyphen while typing', () => {
    expect(slugifyLoose('red-')).toBe('red-')
    expect(slugifyLoose('a-b')).toBe('a-b')
  })
  it('slugify trims trailing hyphens on blur', () => {
    expect(slugify('red-')).toBe('red')
    expect(slugify('Red Shirt!')).toBe('red-shirt')
  })
})

describe('variants', () => {
  it('cartesian product covers every combination once', () => {
    const options = [
      { values: [{ id: 's' }, { id: 'm' }] },
      { values: [{ id: 'red' }, { id: 'blue' }, { id: 'green' }] },
    ]
    const combos = cartesianOptionValueIds(options)
    expect(combos).toHaveLength(6)
    expect(new Set(combos.map(comboKey)).size).toBe(6)
  })
  it('no options -> a single default combination', () => {
    expect(cartesianOptionValueIds([])).toEqual([[]])
  })
})
describe('invoice escaping (F-13)', () => {
  it('neutralises HTML in customer-supplied text', async () => {
    const { esc } = await import('../invoice.js')
    expect(esc('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;')
    expect(esc(`O'Neil & "Co"`)).toBe('O&#39;Neil &amp; &quot;Co&quot;')
    expect(esc(undefined)).toBe('')
  })
})

// ---- Pass 5 additions ------------------------------------------------------------------------
import { applyMembership, derivedProductIds, membershipDrift, syncedCollections, syncCollectionMembership } from '../collections.js'
import { transitionPatch, historyOf } from '../orders.js'
import { runHealthCheck } from '../health.js'
import { buildBundle, parseBundle } from '../bundle.js'
import { exportAll, importAll } from '../db.js'
import { isoToLocalInput, localInputToIso } from '../format.js'

describe('collections membership (F-17)', () => {
  const prods = [{ id: 'a', collectionIds: [] }, { id: 'b', collectionIds: ['c1'] }, { id: 'c' }]
  it('adds and removes only the changed products', () => {
    const next = applyMembership(prods, 'c1', ['a'])
    expect(next[0].collectionIds).toEqual(['c1'])
    expect(next[1].collectionIds).toEqual([])
    expect(next[2]).toBe(prods[2]) // untouched keeps its reference
  })
  it('derives productIds from the products and detects drift', () => {
    expect(derivedProductIds(prods, 'c1')).toEqual(['b'])
    expect(membershipDrift(prods, [{ id: 'c1', productIds: [] }])).toEqual(['c1'])
    expect(syncedCollections(prods, [{ id: 'c1', productIds: [] }])[0].productIds).toEqual(['b'])
  })
  it('syncCollectionMembership rewrites stored collections', () => {
    const p = getCollection('products')[0]
    updateItem('products', p.id, { collectionIds: ['col_new'] })
    syncCollectionMembership()
    expect(getCollection('collectionsList').find((c) => c.id === 'col_new').productIds).toContain(p.id)
  })
})

describe('order transitions', () => {
  const order = { id: 'o', status: 'confirmed', createdAt: '2026-09-01T00:00:00Z' }
  const now = new Date('2026-09-02T10:00:00Z')
  it('dispatch records courier, tracking, invoice and history', () => {
    const p = transitionPatch(order, 'dispatched', { courier: 'TCS', trackingNo: ' 123 ' }, now)
    expect(p.dispatch).toEqual({ courier: 'TCS', trackingNo: '123', dispatchedAt: now.toISOString() })
    expect(p.invoiceNo).toMatch(/^INV-/)
    expect(p.history.at(-1)).toMatchObject({ status: 'dispatched', note: 'TCS · 123' })
    expect(p.history[0]).toMatchObject({ status: 'pending', at: order.createdAt })
  })
  it('cancel keeps the reason and does not invent dispatch data', () => {
    const p = transitionPatch(order, 'cancelled', { reason: 'Customer asked' }, now)
    expect(p.dispatch).toBeUndefined()
    expect(p.history.at(-1).note).toBe('Customer asked')
  })
  it('keeps an existing invoice number', () => {
    expect(transitionPatch({ ...order, invoiceNo: 'INV-1' }, 'dispatched', {}, now).invoiceNo).toBeUndefined()
  })
  it('legacy orders show a starting entry', () => {
    expect(historyOf(order)).toHaveLength(1)
  })
  it('orders produced by a transition still satisfy the contract', () => {
    const seed = getCollection('orders').find((o) => o.status === 'confirmed') || getCollection('orders')[0]
    const next = { ...seed, ...transitionPatch(seed, 'dispatched', { courier: 'TCS' }, now) }
    expect(validateItem('orders', next)).toEqual({ success: true })
  })
})

describe('health check', () => {
  it('reports the seed data as clean', () => {
    const r = runHealthCheck(exportAll())
    expect(r.issues).toEqual([])
  })
  it('catches broken references, duplicate handles and drift', () => {
    const data = exportAll()
    data.collections.products[0].primaryCategoryId = 'nope'
    data.collections.products[0].collectionIds = ['col_new']
    data.collections.categories.push({ ...data.collections.categories[0], id: 'dup' })
    const r = runHealthCheck(data)
    expect(r.issues.some((i) => /missing primary category/.test(i.message))).toBe(true)
    expect(r.issues.some((i) => i.area === 'Handles')).toBe(true)
    expect(r.issues.some((i) => i.fix === 'sync-collections')).toBe(true)
  })
})

describe('JSON bundle', () => {
  it('round-trips through export and import', () => {
    const text = JSON.stringify(buildBundle(exportAll()))
    const parsed = parseBundle(text)
    expect(parsed.ok).toBe(true)
    updateItem('products', getCollection('products')[0].id, { title: 'Changed' })
    importAll(parsed.bundle)
    expect(getCollection('products')[0].title).not.toBe('Changed')
  })
  it('rejects junk with a readable message', () => {
    expect(parseBundle('nope').error).toMatch(/not valid JSON/)
    expect(parseBundle('{"a":1}').error).toMatch(/not an admin bundle/)
    expect(parseBundle(JSON.stringify({ format: 'noor-admin-bundle', version: 9, collections: {} })).error).toMatch(/not supported/)
    expect(parseBundle(JSON.stringify({ format: 'noor-admin-bundle', version: 1, collections: { products: 'x' } })).error).toMatch(/must be a list/)
  })
})

describe('product extras', () => {
  it('a scheduled product needs a publish date', () => {
    const p = { ...getCollection('products')[0], status: 'scheduled', publishedAt: undefined }
    expect(validateItem('products', p).errors.map((e) => e.path)).toContain('publishedAt')
  })
  it('datetime-local round-trips', () => {
    const iso = '2026-10-01T08:30:00.000Z'
    expect(localInputToIso(isoToLocalInput(iso))).toBe(iso)
    expect(localInputToIso('')).toBeUndefined()
  })
})

// ---- WP2: contract enforced on save -----------------------------------------------------------
import { ContractError, summarizeErrors } from '../validate.js'
import { getSingleton, setCollection, setSingleton, removeItem } from '../db.js'

describe('WP2: writes that break the contract are rejected', () => {
  it('createItem throws ContractError and stores nothing', () => {
    const before = getCollection('categories').length
    expect(() => createItem('categories', { name: 'No handle' })).toThrow(ContractError)
    expect(getCollection('categories')).toHaveLength(before)
  })
  it('updateItem throws and leaves the stored record untouched', () => {
    const cat = getCollection('categories')[0]
    expect(() => updateItem('categories', cat.id, { name: 123 })).toThrow(ContractError)
    expect(getCollection('categories')[0]).toEqual(cat)
  })
  it('setCollection rejects the whole list if any item is invalid', () => {
    const cats = getCollection('categories')
    expect(() => setCollection('categories', [...cats, { id: 'bad' }])).toThrow(ContractError)
    expect(getCollection('categories')).toEqual(cats)
  })
  it('an active product with no media is rejected; a draft is not', () => {
    const p = getCollection('products')[0]
    expect(() => updateItem('products', p.id, { status: 'active', media: [] })).toThrow(ContractError)
    expect(() => updateItem('products', p.id, { status: 'draft', media: [] })).not.toThrow()
  })
  it('every stored collection has a contract (incl. formSchemas)', () => {
    for (const name of Object.keys(SEEDS).concat('formSchemas')) expect(collections[name], name).toBeTruthy()
    for (const item of F.seedFormSchemas) expect(collections.formSchemas.safeParse(item).success).toBe(true)
  })
  it('setSingleton rejects an invalid storeConfig', () => {
    const good = getSingleton('storeConfig')
    expect(() => setSingleton('storeConfig', { ...good, locale: undefined })).toThrow(ContractError)
    expect(getSingleton('storeConfig')).toEqual(good)
  })
  it('a legacy bad record does not block saving a different record', () => {
    const [a, b] = getCollection('categories')
    a.name = 5 // simulate legacy bad data already sitting in storage (the cache hands out the stored array)
    expect(() => updateItem('categories', b.id, { name: 'Fine' })).not.toThrow()
  })
  it('removeItem is never blocked by validation', () => {
    const c = getCollection('categories')[0]
    expect(() => removeItem('categories', c.id)).not.toThrow()
  })
  it('importAll is all-or-nothing', () => {
    const data = exportAll()
    data.collections.categories = [{ id: 'bad' }]
    data.collections.pages = []
    const pagesBefore = getCollection('pages')
    expect(() => importAll(data)).toThrow(ContractError)
    expect(getCollection('pages')).toEqual(pagesBefore)
  })
  it('summarizeErrors gives a one-line message', () => {
    expect(summarizeErrors([{ path: 'a', message: 'x' }, { path: 'b', message: 'y' }])).toBe('a: x (+1 more)')
  })
})
