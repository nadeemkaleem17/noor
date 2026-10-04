// M1-09: products with options and variants, publish checks, the derived columns, duplicate, preview links, scheduled publish,
// collections, and the real "who uses this" counts, through HTTP on a scratch database.
import { and, eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { auditLog } from '../src/db/schema/audit.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { media } from '../src/db/schema/media.js'
import { outboxEvents } from '../src/db/schema/platform.js'
import { bundleItems, collections, products, variants } from '../src/db/schema/products.js'
import { attributes, categories, formSchemas, handleRedirects, sizeCharts, sizeSystemValues, sizeSystems } from '../src/db/schema/taxonomy.js'
import { advanceClock, setClock } from '../src/platform/clock.js'
import { uuidv7 } from '../src/platform/ids.js'
import { createCatalogService } from '../src/modules/catalog/index.js'
import { publishChecks } from '../src/modules/catalog/product-checks.js'
import { closeHarness, config, createHarness, signedIn, t } from './support/staff.js'
import { dbAvailable } from './support/db.js'

const pkr = (/** @type {number} */ rupees) => ({ amount: Math.round(rupees * 100), currency: 'PKR' })
const REQ = { ip: '10.0.0.1', userAgent: 'vitest', requestId: '0190f2c0-0000-7000-8000-000000000001' }
const noMedia = { imagesFor: async () => ({}) }
/** Freezing the clock must come before signing in: sessions expire by the same clock. */
const clock = { freeze: (/** @type {string} */ iso) => setClock(new Date(iso)), advance: (/** @type {number} */ ms) => advanceClock(ms), reset: () => setClock(null) }

/** A category row, directly. */
async function newCategory(/** @type {string} */ handle, /** @type {string | null} */ parentId = null) {
  const id = uuidv7()
  await t.db.insert(categories).values({ id, parentId, handle, name: handle, createdAt: new Date(), updatedAt: new Date() })
  return id
}
/** A ready picture, directly. */
async function newMedia(alt = 'A picture') {
  const id = uuidv7()
  await t.db.insert(media).values({ id, kind: 'image', status: 'ready', objectKey: `media/2026/10/${id}.jpg`, contentType: 'image/jpeg', bytes: 10, width: 1600, height: 2000, alt, createdAt: new Date() })
  return id
}
/** A size system with its values, directly. */
async function newSizes(/** @type {string[]} */ labels = ['S', 'M', 'L']) {
  const id = uuidv7()
  await t.db.insert(sizeSystems).values({ id, name: `Sizes ${id.slice(-6)}`, createdAt: new Date(), updatedAt: new Date() })
  const values = labels.map((label, i) => ({ id: uuidv7(), sizeSystemId: id, label, sortOrder: i }))
  await t.db.insert(sizeSystemValues).values(values)
  return { id, values }
}

/** An admin read turned back into a save body. @param {any} p */
const stripForSave = (p) => {
  const { id, createdAt, updatedAt, publishedAt, siblings, collections: _c, checks, storefrontUrl, primaryCategoryName, ...rest } = p
  void [id, createdAt, updatedAt, publishedAt, siblings, _c, checks, storefrontUrl, primaryCategoryName]
  return {
    ...rest,
    media: p.media.map((/** @type {any} */ m) => ({ mediaId: m.mediaId, alt: m.alt, ...(m.role ? { role: m.role } : {}), ...(m.optionValueKey ? { optionValueKey: m.optionValueKey } : {}) })),
    variants: p.variants.map((/** @type {any} */ v) => ({ id: v.id, key: v.key, sku: v.sku, optionValueKeys: v.optionValueKeys, price: v.price, ...(v.compareAt ? { compareAt: v.compareAt } : {}), stockMode: v.stockMode, maxPerOrder: v.maxPerOrder, enabled: v.enabled })),
  }
}

let cat = ''
let pic = ''

/** A draft product with one variant and no options; `extra` overrides any field. */
const draft = (/** @type {object} */ extra = {}) => ({
  handle: 'lawn-suit', status: 'draft', kind: 'accessory', title: 'Lawn suit', primaryCategoryId: cat, categoryIds: [], attributes: [], media: [], options: [],
  variants: [{ key: 'v', sku: 'LS-1', optionValueKeys: [], price: pkr(5000), stockMode: 'counted', maxPerOrder: 10, enabled: true }],
  ...extra,
})
/** The same, ready to go live. */
const live = (/** @type {object} */ extra = {}) => draft({ status: 'active', media: [{ mediaId: pic, alt: 'Front view' }], ...extra })

describe.skipIf(!dbAvailable)('products and collections (MySQL, through HTTP)', () => {
  beforeAll(createHarness, 60_000)
  afterAll(closeHarness)
  afterEach(async () => {
    clock.reset()
    await t.migrate.db.delete(auditLog)
    await t.db.delete(outboxEvents)
    await t.db.delete(handleRedirects)
    await t.db.delete(collections)
    await t.db.delete(bundleItems)
    await t.db.delete(products) // options, variants, pictures, attribute values and related items go with them
    await t.db.delete(media)
    for (let i = 0; i < 4; i++) await t.migrate.pool.query('DELETE c FROM categories c LEFT JOIN categories k ON k.parent_id = c.id WHERE k.id IS NULL')
    for (const table of [attributes, sizeCharts, sizeSystems, formSchemas]) await t.db.delete(table)
    await t.db.delete(staffUsers)
  })
  const setup = async () => {
    cat = await newCategory('women')
    pic = await newMedia()
  }

  describe('saving a product', () => {
    it('creates a draft with one variant and derives its price columns', async () => {
      const { b } = await signedIn('catalog')
      await setup()
      const r = await b.call('POST', '/admin/products', { body: draft({ title: 'Lawn suit', variants: [{ key: 'v', sku: 'ls-1', optionValueKeys: [], price: pkr(5000), compareAt: pkr(6500), stockMode: 'counted', maxPerOrder: 5, enabled: true }] }) })
      expect(r.status, JSON.stringify(r.body)).toBe(201)
      expect(r.body).toMatchObject({ handle: 'lawn-suit', status: 'draft', version: 1, primaryCategoryId: cat, categoryIds: [] })
      expect(r.body.variants).toHaveLength(1)
      expect(r.body.variants[0]).toMatchObject({ sku: 'LS-1', price: pkr(5000), compareAt: pkr(6500), maxPerOrder: 5, enabled: true, stockStatus: 'sold_out', hasOrders: false })
      expect(r.body.variants[0].id).toBe(r.body.variants[0].key)
      const [row] = await t.db.select().from(products)
      expect(row).toMatchObject({ priceMinMinor: 500000, priceMaxMinor: 500000, compareAtMinMinor: 650000, stockStatus: 'sold_out', publishedAt: null })
    }, 60_000)

    it('stores sizes, pictures, attributes, components, made-to-order terms and Urdu text, and reads them back', async () => {
      const { b } = await signedIn('catalog')
      await setup()
      const sizes = await newSizes()
      const [fabric] = await Promise.all([b.call('POST', '/admin/attributes', { body: { code: 'fabric', label: 'Fabric', type: 'enum', display: 'checkbox', filterable: true, values: [{ code: 'lawn', label: 'Lawn' }, { code: 'silk', label: 'Silk' }] } })])
      const pieces = await b.call('POST', '/admin/attributes', { body: { code: 'pieces', label: 'Pieces', type: 'number', display: 'range', filterable: true, values: [] } })
      const embroidered = await b.call('POST', '/admin/attributes', { body: { code: 'embroidered', label: 'Embroidered', type: 'boolean', display: 'checkbox', filterable: true, values: [] } })
      const second = await newCategory('unstitched')
      const form = (await b.call('POST', '/admin/form-schemas', { body: { title: 'Custom', allowNotes: false, fields: [{ key: 'bust', label: 'Bust', type: 'number' }] } })).body
      const body = draft({
        kind: 'made_to_order', handle: 'bridal-gown', title: 'Bridal gown', subtitle: 'Hand finished', brand: 'Rubaya', descriptionMd: 'Made for you.', highlights: ['Silk'], care: ['Dry clean'],
        components: [{ type: 'shirt', label: 'Shirt', fabric: 'Silk', included: true }],
        categoryIds: [second],
        attributes: [{ attributeId: fabric.body.id, valueIds: [fabric.body.values[0].id, fabric.body.values[1].id] }, { attributeId: pieces.body.id, number: 3 }, { attributeId: embroidered.body.id, valueIds: [embroidered.body.values[0].id] }],
        styleId: 'bridal-2026', colorway: { label: 'Ivory', family: 'white', swatch: { hex: ['#FFFFF0'] } },
        media: [{ mediaId: pic, alt: 'Front', role: 'model' }],
        options: [{ name: 'Size', role: 'size', display: 'buttons', sizeSystemId: sizes.id, values: [...sizes.values.map((v) => ({ key: `s${v.label}`, label: v.label, sizeSystemValueId: v.id })), { key: 'custom', label: 'Custom', kind: 'custom' }] }],
        variants: [...sizes.values.map((v) => ({ key: `v${v.label}`, sku: `BG-${v.label}`, optionValueKeys: [`s${v.label}`], price: pkr(85000), stockMode: 'made_to_order', maxPerOrder: 2, enabled: true })), { key: 'vc', sku: 'BG-C', optionValueKeys: ['custom'], price: pkr(95000), stockMode: 'made_to_order', maxPerOrder: 1, enabled: true }],
        customSizeSchemaId: form.id,
        fit: { note: 'true_to_size', cut: 'A-line', modelHeightCm: 170, modelWears: 'S' },
        madeToOrder: { leadMinDays: 15, leadMaxDays: 20, label: 'Made for you in 15-20 days', returnable: false, depositPercent: 30 },
        badges: ['limited'], featuredRank: 5, seo: { title: 'Bridal gown', description: 'Silk' }, i18n: { ur: { title: 'دلہن کا جوڑا' } },
      })
      const r = await b.call('POST', '/admin/products', { body })
      expect(r.status, JSON.stringify(r.body)).toBe(201)
      const p = r.body
      expect(p.categoryIds).toEqual([second])
      expect(p.options[0].values.map((/** @type {{ label: string }} */ v) => v.label)).toEqual(['S', 'M', 'L', 'Custom'])
      expect(p.options[0].values[3].kind).toBe('custom')
      expect(p.variants.map((/** @type {{ sku: string }} */ v) => v.sku)).toEqual(['BG-S', 'BG-M', 'BG-L', 'BG-C'])
      expect(p.variants[0].optionValueKeys).toEqual([p.options[0].values[0].id])
      expect(p.variants.every((/** @type {{ stockStatus: string }} */ v) => v.stockStatus === 'made_to_order')).toBe(true)
      expect(p.attributes).toEqual(expect.arrayContaining([{ attributeId: pieces.body.id, number: 3 }, { attributeId: embroidered.body.id, valueIds: [embroidered.body.values[0].id] }]))
      expect(p.attributes.find((/** @type {{ attributeId: string }} */ a) => a.attributeId === fabric.body.id).valueIds).toHaveLength(2)
      expect(p).toMatchObject({ colorway: { label: 'Ivory', family: 'white' }, styleId: 'bridal-2026', madeToOrder: { leadMinDays: 15, leadMaxDays: 20, depositPercent: 30, returnable: false }, fit: { cut: 'A-line' }, badges: ['limited'], featuredRank: 5, i18n: { ur: { title: 'دلہن کا جوڑا' } }, customSizeSchemaId: form.id })
      expect(p.media[0]).toMatchObject({ mediaId: pic, alt: 'Front', role: 'model', image: { width: 1600 } })
      // a read of it can be sent back as it is
      const back = await b.call('PUT', `/admin/products/${p.id}`, { body: stripForSave(p) })
      expect(back.status, JSON.stringify(back.body)).toBe(200)
      expect(back.body.version).toBe(2)
      expect(back.body.variants.map((/** @type {{ id: string }} */ v) => v.id)).toEqual(p.variants.map((/** @type {{ id: string }} */ v) => v.id))
    }, 90_000)

    it('keeps every variant and option id when a size is added, and lets two SKUs swap', async () => {
      const { b } = await signedIn('catalog')
      await setup()
      const sizes = await newSizes(['S', 'M', 'L', 'XL'])
      const opt = (/** @type {number} */ n, /** @type {object[]} */ extraValues = []) => ({ name: 'Size', role: 'size', display: 'buttons', sizeSystemId: sizes.id, values: [...sizes.values.slice(0, n).map((v) => ({ key: v.label, label: v.label, sizeSystemValueId: v.id })), ...extraValues] })
      const variant = (/** @type {string} */ label, /** @type {string} */ sku) => ({ key: label, sku, optionValueKeys: [label], price: pkr(4000), stockMode: 'counted', maxPerOrder: 10, enabled: true })
      const made = (await b.call('POST', '/admin/products', { body: draft({ options: [opt(2)], variants: [variant('S', 'SK-S'), variant('M', 'SK-M')] }) })).body
      const [s, m] = made.variants
      const optionId = made.options[0].id
      const valueIds = made.options[0].values.map((/** @type {{ id: string }} */ v) => v.id)

      const grown = stripForSave(made)
      grown.options = [{ ...grown.options[0], values: [...grown.options[0].values, { key: 'L', label: 'L', sizeSystemValueId: sizes.values[2]?.id }] }]
      grown.variants = [...grown.variants, variant('L', 'SK-L')]
      const r = await b.call('PUT', `/admin/products/${made.id}`, { body: grown })
      expect(r.status, JSON.stringify(r.body)).toBe(200)
      expect(r.body.variants.slice(0, 2).map((/** @type {{ id: string }} */ v) => v.id)).toEqual([s.id, m.id])
      expect(r.body.options[0].id).toBe(optionId)
      expect(r.body.options[0].values.slice(0, 2).map((/** @type {{ id: string }} */ v) => v.id)).toEqual(valueIds)
      expect(r.body.variants).toHaveLength(3)

      const swapped = stripForSave(r.body)
      swapped.variants[0].sku = 'SK-M'
      swapped.variants[1].sku = 'SK-S'
      swapped.options[0].values[0].label = 'M'
      swapped.options[0].values[0].sizeSystemValueId = sizes.values[1]?.id
      swapped.options[0].values[1].label = 'S'
      swapped.options[0].values[1].sizeSystemValueId = sizes.values[0]?.id
      const sw = await b.call('PUT', `/admin/products/${made.id}`, { body: swapped })
      expect(sw.status, JSON.stringify(sw.body)).toBe(200)
      expect(sw.body.variants.map((/** @type {{ id: string, sku: string }} */ v) => [v.id, v.sku]).slice(0, 2)).toEqual([[s.id, 'SK-M'], [m.id, 'SK-S']])
      expect(sw.body.options[0].values.slice(0, 2).map((/** @type {{ label: string }} */ v) => v.label)).toEqual(['M', 'S'])

      const shrunk = stripForSave(sw.body)
      shrunk.variants = shrunk.variants.slice(0, 2)
      shrunk.options[0].values = shrunk.options[0].values.slice(0, 2)
      const sh = await b.call('PUT', `/admin/products/${made.id}`, { body: shrunk })
      expect(sh.body.variants).toHaveLength(2)
      expect((await t.db.select().from(variants)).length).toBe(2)
    }, 90_000)

    it('refuses a stale version, a handle or SKU somebody has, and says what a redirect is for', async () => {
      const { b } = await signedIn('catalog')
      await setup()
      const a = (await b.call('POST', '/admin/products', { body: draft() })).body
      expect((await b.call('POST', '/admin/products', { body: draft() })).body.code).toBe('handle_taken')
      expect((await b.call('POST', '/admin/products', { body: draft({ handle: 'other' }) })).body.code).toBe('sku_taken')
      const other = (await b.call('POST', '/admin/products', { body: draft({ handle: 'other', variants: [{ ...draft().variants[0], sku: 'OT-1' }] }) })).body
      const base = stripForSave(a)
      expect((await b.call('PUT', `/admin/products/${a.id}`, { body: { ...base, title: 'Changed' } })).body).toMatchObject({ title: 'Changed', version: 2 })
      const stale = await b.call('PUT', `/admin/products/${a.id}`, { body: base })
      expect([stale.status, stale.body.code, stale.body.currentVersion]).toEqual([409, 'stale_write', 2])
      expect((await b.call('PUT', `/admin/products/${a.id}`, { body: { ...base, version: 2, handle: 'other' } })).body.code).toBe('handle_taken')
      expect((await b.call('PUT', `/admin/products/${a.id}`, { body: { ...base, version: 2, variants: [{ ...base.variants[0], sku: 'ot-1' }] } })).body.code).toBe('sku_taken')
      const renamed = await b.call('PUT', `/admin/products/${a.id}`, { body: { ...base, version: 2, handle: 'lawn-suit-2026' } })
      expect(renamed.status).toBe(200)
      expect(await t.db.select().from(handleRedirects)).toMatchObject([{ entityType: 'product', oldHandle: 'lawn-suit', entityId: a.id }])
      expect((await b.call('POST', '/admin/products', { body: draft({ variants: [{ ...draft().variants[0], sku: 'NEW-1' }] }) })).status, 'the old handle is free again').toBe(201)
      expect(await t.db.select().from(handleRedirects)).toEqual([])
      expect(other.id).toBeTruthy()
      expect((await b.call('PUT', `/admin/products/${uuidv7()}`, { body: { ...base, version: 1 } })).status).toBe(404)
    }, 90_000)

    it('names every problem of a document at once', async () => {
      const { b } = await signedIn('catalog')
      await setup()
      const sizes = await newSizes()
      const post = (/** @type {object} */ body) => b.call('POST', '/admin/products', { body })
      const paths = async (/** @type {object} */ body) => (await post(body)).body.issues?.map((/** @type {{ path: string, code: string }} */ i) => `${i.path}:${i.code}`)
      const v = (/** @type {object} */ extra = {}) => ({ key: 'v', sku: 'A-1', optionValueKeys: [], price: pkr(10), stockMode: 'counted', maxPerOrder: 1, enabled: true, ...extra })
      expect(await paths(draft({ primaryCategoryId: uuidv7(), categoryIds: [uuidv7()] }))).toEqual(['primaryCategoryId:invalid_format', 'categoryIds.0:invalid_format'])
      expect(await paths(draft({ variants: [v(), v({ key: 'w', sku: 'a-1' })] }))).toEqual(['variants.1.sku:not_unique', 'variants.1.optionValueKeys:not_unique'])
      expect(await paths(draft({ variants: [v({ compareAt: pkr(10) })] }))).toEqual(['variants.0.compareAt:too_small'])
      expect(await paths(draft({ variants: [v({ stockMode: 'preorder' })] }))).toEqual(['variants.0.preorderShipsAt:required'])
      expect(await paths(draft({ variants: [v({ preorderShipsAt: '2026-12-01' })] }))).toEqual(['variants.0.preorderShipsAt:invalid_format'])
      expect(await paths(draft({ variants: [v({ optionValueKeys: ['nope'] })] }))).toEqual(['variants.0.optionValueKeys:invalid_format'])
      expect(await paths(draft({ status: 'scheduled' }))).toEqual(['publishAt:required'])
      expect(await paths(draft({ styleId: 'style-1' }))).toEqual(['colorway:required'])
      expect(await paths(draft({ madeToOrder: { leadMinDays: 1, leadMaxDays: 2, returnable: true } }))).toEqual(['madeToOrder:invalid_format'])
      expect(await paths(draft({ kind: 'made_to_order', madeToOrder: { leadMinDays: 5, leadMaxDays: 2, returnable: true } }))).toEqual(['madeToOrder.leadMinDays:too_big'])
      expect(await paths(draft({ bundleProductIds: [uuidv7()] }))).toEqual(['bundleProductIds:invalid_format', 'bundleProductIds.0:invalid_format'])
      expect(await paths(draft({ badges: ['new', 'new'] }))).toEqual(['badges:not_unique'])
      expect(await paths(draft({ media: [{ mediaId: pic, alt: 'a' }, { mediaId: pic, alt: 'b' }] }))).toEqual(['media.1.mediaId:not_unique'])
      expect(await paths(draft({ media: [{ mediaId: pic, alt: 'a', optionValueKey: 'x' }] }))).toEqual(['media.0.optionValueKey:invalid_format'])
      expect((await post(draft({ media: [{ mediaId: uuidv7(), alt: 'a' }] }))).body.code).toBe('media_not_ready')
      const colour = { name: 'Colour', role: 'color', display: 'swatch', values: [{ key: 'red', label: 'Red', swatch: { hex: ['#CC0000'] } }] }
      expect(await paths(draft({ styleId: 'style-1', colorway: { label: 'Red', family: 'red', swatch: { hex: ['#CC0000'] } }, options: [colour], variants: [v({ optionValueKeys: ['red'] })] }))).toEqual(['options.0.role:invalid_format'])
      expect(await paths(draft({ options: [{ name: 'Size', role: 'size', display: 'buttons', values: [{ key: 'a', label: 'S', kind: 'custom' }] }], variants: [v({ optionValueKeys: ['a'] })] }))).toEqual(['options.0.values.0.kind:invalid_format'])
      expect(await paths(draft({ options: [{ name: 'Fabric', role: 'material', display: 'buttons', sizeSystemId: sizes.id, values: [{ key: 'a', label: 'Lawn' }] }], variants: [v({ optionValueKeys: ['a'] })] }))).toEqual(['options.0.sizeSystemId:invalid_format'])
      expect(await paths(draft({ options: [{ name: 'Size', role: 'size', display: 'buttons', sizeSystemId: sizes.id, values: [{ key: 'a', label: 'S', sizeSystemValueId: uuidv7() }] }], variants: [v({ optionValueKeys: ['a'] })] }))).toEqual(['options.0.values.0.sizeSystemValueId:invalid_format'])
      expect(await paths(draft({ options: [{ name: 'Size', role: 'size', display: 'buttons', values: [{ key: 'a', label: 'S' }, { key: 'a', label: 's' }] }], variants: [v({ optionValueKeys: ['a'] })] }))).toEqual(['options.0.values.1.key:not_unique', 'options.0.values.1.label:not_unique'])
      expect((await post(draft({ variants: [v(), v({ key: 'w', sku: 'B-1' })] }))).body.issues, 'two variants without options would be the same combination').toEqual([{ path: 'variants.1.optionValueKeys', code: 'not_unique' }])
      expect((await b.call('GET', '/admin/products')).body.total).toBe(0)
    }, 90_000)

    it('checks attribute values, bundle children and related products', async () => {
      const { b } = await signedIn('catalog')
      await setup()
      const fabric = (await b.call('POST', '/admin/attributes', { body: { code: 'fabric', label: 'Fabric', type: 'enum', display: 'checkbox', filterable: true, values: [{ code: 'lawn', label: 'Lawn' }] } })).body
      const flag = (await b.call('POST', '/admin/attributes', { body: { code: 'flag', label: 'Flag', type: 'boolean', display: 'checkbox', filterable: true, values: [] } })).body
      const pieces = (await b.call('POST', '/admin/attributes', { body: { code: 'pieces', label: 'Pieces', type: 'number', display: 'range', filterable: true, values: [] } })).body
      const paths = async (/** @type {object} */ extra) => (await b.call('POST', '/admin/products', { body: draft(extra) })).body.issues?.map((/** @type {{ path: string, code: string }} */ i) => `${i.path}:${i.code}`)
      expect(await paths({ attributes: [{ attributeId: fabric.id }] })).toEqual(['attributes.0.valueIds:invalid_format'])
      expect(await paths({ attributes: [{ attributeId: fabric.id, valueIds: [flag.values[0].id] }] })).toEqual(['attributes.0.valueIds:invalid_format'])
      expect(await paths({ attributes: [{ attributeId: flag.id, valueIds: flag.values.map((/** @type {{ id: string }} */ v) => v.id) }] })).toEqual(['attributes.0.valueIds:invalid_format'])
      expect(await paths({ attributes: [{ attributeId: pieces.id }] })).toEqual(['attributes.0.number:required'])
      expect(await paths({ attributes: [{ attributeId: fabric.id, number: 1, valueIds: [fabric.values[0].id] }] })).toEqual(['attributes.0.number:invalid_format'])
      expect(await paths({ attributes: [{ attributeId: uuidv7(), valueIds: [] }] })).toEqual(['attributes.0.attributeId:invalid_format'])
      expect(await paths({ attributes: [{ attributeId: fabric.id, valueIds: [fabric.values[0].id] }, { attributeId: fabric.id, valueIds: [fabric.values[0].id] }] })).toEqual(['attributes.1.attributeId:not_unique'])

      const child = (await b.call('POST', '/admin/products', { body: draft({ handle: 'child', variants: [{ ...draft().variants[0], sku: 'CH-1' }] }) })).body
      const bundleBody = (/** @type {object} */ extra) => draft({ kind: 'bundle', handle: 'set', variants: [{ ...draft().variants[0], sku: 'SET-1' }], ...extra })
      const nested = (await b.call('POST', '/admin/products', { body: bundleBody({ bundleProductIds: [child.id], handle: 'inner', variants: [{ ...draft().variants[0], sku: 'IN-1' }] }) })).body
      const bad = await b.call('POST', '/admin/products', { body: bundleBody({ bundleProductIds: [nested.id, child.id, child.id] }) })
      expect(bad.body.issues.map((/** @type {{ path: string, code: string }} */ i) => `${i.path}:${i.code}`)).toEqual(['bundleProductIds.0:invalid_format', 'bundleProductIds:not_unique'])
      expect((await b.call('POST', '/admin/products', { body: bundleBody({ variants: [draft().variants[0], { ...draft().variants[0], key: 'x', sku: 'S2' }] }) })).body.issues.map((/** @type {{ path: string, code: string }} */ i) => `${i.path}:${i.code}`)).toContain('variants:too_big')
      expect((await b.call('POST', '/admin/products', { body: draft({ handle: 'rel', variants: [{ ...draft().variants[0], sku: 'R-1' }], relatedIds: [uuidv7()] }) })).body.issues).toEqual([{ path: 'relatedIds.0', code: 'invalid_format' }])
      const rel = await b.call('POST', '/admin/products', { body: draft({ handle: 'rel', variants: [{ ...draft().variants[0], sku: 'R-1' }], relatedIds: [child.id] }) })
      expect(rel.body.relatedIds).toEqual([child.id])
      const withChild = await b.call('GET', `/admin/products/${nested.id}`)
      expect(withChild.body.bundleProductIds).toEqual([child.id])
    }, 90_000)
  })

  describe('publish checks', () => {
    it('let a draft be saved with anything missing and list the failures; going live needs them to pass', async () => {
      const { b } = await signedIn('catalog')
      await setup()
      const made = (await b.call('POST', '/admin/products', { body: draft() })).body
      expect(made.checks.filter((/** @type {{ ok: boolean }} */ c) => !c.ok).map((/** @type {{ code: string }} */ c) => c.code)).toEqual(['images'])
      const refused = await b.call('POST', '/admin/products', { body: draft({ handle: 'live-1', status: 'active', variants: [{ ...draft().variants[0], sku: 'L-1' }] }) })
      expect([refused.status, refused.body.code]).toEqual([409, 'publish_checks_failed'])
      expect(refused.body.checks).toEqual([{ code: 'images', ok: false, path: 'media' }])
      const noAlt = await b.call('POST', '/admin/products', { body: live({ handle: 'live-1', media: [{ mediaId: pic, alt: '  ' }], variants: [{ ...draft().variants[0], sku: 'L-1' }] }) })
      expect(noAlt.body.checks).toEqual([{ code: 'image_alt', ok: false, path: 'media.0.alt' }])
      const ok = await b.call('POST', '/admin/products', { body: live({ handle: 'live-1', variants: [{ ...draft().variants[0], sku: 'L-1' }] }) })
      expect(ok.status, JSON.stringify(ok.body)).toBe(201)
      expect(ok.body).toMatchObject({ status: 'active', storefrontUrl: '/p/live-1' })
      expect(ok.body.publishedAt).toBeTruthy()
      expect(ok.body.checks.every((/** @type {{ ok: boolean }} */ c) => c.ok)).toBe(true)
      expect((await b.call('PUT', `/admin/products/${ok.body.id}`, { body: { ...stripForSave(ok.body), media: [] } })).body.code).toBe('publish_checks_failed')
    }, 90_000)

    it('the checks endpoint and the pure function agree, kind by kind', async () => {
      const { b } = await signedIn('catalog')
      await setup()
      const failing = async (/** @type {object} */ extra) => (await b.call('POST', '/admin/products/publish-checks', { body: live(extra) })).body.checks.filter((/** @type {{ ok: boolean }} */ c) => !c.ok).map((/** @type {{ code: string }} */ c) => c.code)
      expect(await failing({})).toEqual([])
      expect(await failing({ kind: 'unstitched' })).toEqual(['components'])
      expect(await failing({ kind: 'unstitched', components: [{ type: 'shirt', label: 'Shirt', included: true }] })).toEqual([])
      expect(await failing({ kind: 'made_to_order' })).toEqual(['lead_time'])
      expect(await failing({ kind: 'bundle' })).toEqual(['bundle_children'])
      expect(await failing({ variants: [{ ...draft().variants[0], enabled: false }] })).toEqual(['variant_enabled'])
      expect(await failing({ variants: [{ ...draft().variants[0], compareAt: pkr(4000) }] })).toEqual(['compare_at'])
      const a = (await b.call('POST', '/admin/attributes', { body: { code: 'fabric', label: 'Fabric', type: 'enum', display: 'checkbox', filterable: true, values: [{ code: 'lawn', label: 'Lawn' }] } })).body
      const categoryRow = (await t.db.select().from(categories))[0]
      await b.call('PUT', `/admin/categories/${categoryRow?.id}`, { body: { name: 'women', handle: 'women', visible: true, attributes: [{ attributeId: a.id, seoIndexable: false, required: true }], version: 1 } })
      expect(await failing({})).toEqual(['required_attributes'])
      expect(await failing({ attributes: [{ attributeId: a.id, valueIds: [a.values[0].id] }] })).toEqual([])
      const pure = publishChecks(/** @type {never} */ (live()), { bundleChildStatus: new Map(), requiredAttributeIds: new Set() })
      expect(pure.every((c) => c.ok)).toBe(true)
    }, 90_000)

    it('a bundle is complete only when it holds at least two children, all live', async () => {
      const { b } = await signedIn('catalog')
      await setup()
      const make = async (/** @type {string} */ handle, /** @type {string} */ status) => (await b.call('POST', '/admin/products', { body: (status === 'active' ? live : draft)({ handle, status, variants: [{ ...draft().variants[0], sku: handle.toUpperCase() }] }) })).body
      const one = await make('one', 'active')
      const two = await make('two', 'draft')
      const three = await make('three', 'active')
      const set = (/** @type {string[]} */ ids) => live({ kind: 'bundle', handle: 'set', bundleProductIds: ids, variants: [{ ...draft().variants[0], sku: 'SET' }] })
      expect((await b.call('POST', '/admin/products', { body: set([one.id]) })).body.code).toBe('publish_checks_failed')
      expect((await b.call('POST', '/admin/products', { body: set([one.id, two.id]) })).body.code).toBe('publish_checks_failed')
      const ok = await b.call('POST', '/admin/products', { body: set([one.id, three.id]) })
      expect(ok.status, JSON.stringify(ok.body)).toBe(201)
      const { b: manager } = await signedIn('manager') // deleting products is for managers and owners
      expect((await manager.call('DELETE', `/admin/products/${one.id}`)).body.code, 'a child of a bundle cannot be deleted').toBe('in_use')
    }, 90_000)

    it('going live, scheduling and archiving belong to people who may publish', async () => {
      const { user } = await signedIn('catalog')
      await setup()
      const svc = createCatalogService({ db: t.db, config, media: noMedia })
      const writer = { staffId: user.id, name: 'W', role: 'viewer', canPublish: false }
      await expect(svc.products.save(writer, null, /** @type {never} */ (live()), REQ)).rejects.toMatchObject({ code: 'forbidden' })
      const made = await svc.products.save(writer, null, /** @type {never} */ (draft()), REQ)
      expect(made.status).toBe('draft')
      await expect(svc.products.save(writer, made.id, /** @type {never} */ ({ ...stripForSave(made), status: 'archived' }), REQ)).rejects.toMatchObject({ code: 'forbidden' })
      const published = await svc.products.save({ ...writer, canPublish: true }, made.id, /** @type {never} */ ({ ...stripForSave(made), status: 'archived' }), REQ)
      expect(published.status).toBe('archived')
      await expect(svc.products.save(writer, made.id, /** @type {never} */ ({ ...stripForSave(published), status: 'draft' }), REQ)).rejects.toMatchObject({ code: 'forbidden' })
    }, 60_000)
  })

  describe('derived values', () => {
    it('price range, compare-at of the cheapest variant and stock status follow the enabled variants', async () => {
      const { user } = await signedIn('catalog')
      await setup()
      /** @type {Map<string, number>} */
      const stockOf = new Map()
      const stock = { available: async (/** @type {unknown} */ _db, /** @type {string[]} */ ids) => new Map(ids.map((id) => [id, stockOf.get(id) ?? 0])), lowStockThreshold: async () => 3 }
      const svc = createCatalogService({ db: t.db, config, media: noMedia, stock })
      const actor = { staffId: user.id, name: 'x', role: 'owner', canPublish: true }
      const v = (/** @type {string} */ sku, /** @type {number} */ price, /** @type {object} */ extra = {}) => ({ key: sku, sku, optionValueKeys: [sku], price: pkr(price), stockMode: 'counted', maxPerOrder: 10, enabled: true, ...extra })
      const options = [{ name: 'Pack', role: 'other', display: 'select', values: ['a', 'b', 'c', 'd'].map((k) => ({ key: k.toUpperCase(), label: k })) }]
      const body = draft({ options, variants: [v('A', 5000, { compareAt: pkr(7000) }), v('B', 3000, { compareAt: pkr(4000) }), v('C', 9000), v('D', 100, { enabled: false })] })
      const made = await svc.products.save(actor, null, /** @type {never} */ (body), REQ)
      const column = async () => (await t.db.select().from(products).where(eq(products.id, made.id)))[0]
      expect(await column()).toMatchObject({ priceMinMinor: 300000, priceMaxMinor: 900000, compareAtMinMinor: 400000, stockStatus: 'sold_out' })
      const [a, bb, c] = made.variants
      stockOf.set(/** @type {string} */ (c?.id), 2)
      await svc.products.save(actor, made.id, /** @type {never} */ ({ ...stripForSave(made) }), REQ)
      expect((await column())?.stockStatus, 'two left is low stock').toBe('low_stock')
      stockOf.set(/** @type {string} */ (a?.id), 50)
      await svc.products.recompute(t.db, made.id)
      expect((await column())?.stockStatus).toBe('in_stock')
      const viewed = await svc.products.get(made.id)
      expect(viewed.variants.map((x) => x.stockStatus)).toEqual(['in_stock', 'sold_out', 'low_stock', 'sold_out'])
      expect(bb).toBeTruthy()
      const mto = await svc.products.save(actor, made.id, /** @type {never} */ ({ ...stripForSave(viewed), version: viewed.version, variants: stripForSave(viewed).variants.map((/** @type {any} */ x) => ({ ...x, stockMode: 'made_to_order' })) }), REQ)
      expect(mto.variants.every((x) => x.stockStatus === 'made_to_order')).toBe(true)
      expect((await column())?.stockStatus).toBe('made_to_order')
    }, 90_000)
  })

  describe('listing', () => {
    it('filters and sorts, pages, and flags products whose checks fail', async () => {
      const { b } = await signedIn('catalog')
      await setup()
      const sub = await newCategory('lawn', cat)
      const make = async (/** @type {string} */ handle, /** @type {object} */ extra = {}) => (await b.call('POST', '/admin/products', { body: draft({ handle, title: handle.toUpperCase(), variants: [{ ...draft().variants[0], sku: `SK-${handle}`, price: pkr(1000) }], ...extra }) })).body
      const a = await make('alpha')
      await make('bravo', { primaryCategoryId: sub, status: 'archived', variants: [{ ...draft().variants[0], sku: 'SK-bravo', price: pkr(3000) }] })
      await make('charlie', { kind: 'stitched', variants: [{ ...draft().variants[0], sku: 'SK-charlie', price: pkr(2000) }] })
      const list = async (/** @type {string} */ q) => (await b.call('GET', `/admin/products${q}`)).body
      expect((await list('')).items).toHaveLength(3)
      expect((await list('?sort=title')).items.map((/** @type {{ handle: string }} */ p) => p.handle)).toEqual(['alpha', 'bravo', 'charlie'])
      expect((await list('?sort=-price')).items.map((/** @type {{ handle: string }} */ p) => p.handle)).toEqual(['bravo', 'charlie', 'alpha'])
      expect((await list('?status=archived')).items.map((/** @type {{ handle: string }} */ p) => p.handle)).toEqual(['bravo'])
      expect((await list('?kind=stitched')).total).toBe(1)
      expect((await list(`?category=${cat}`)).total, 'the parent shows its children’s products too').toBe(3)
      expect((await list(`?category=${sub}`)).total).toBe(1)
      expect((await list('?q=ALP')).items.map((/** @type {{ handle: string }} */ p) => p.handle)).toEqual(['alpha'])
      expect((await list('?q=sk-cha')).items.map((/** @type {{ handle: string }} */ p) => p.handle), 'search by SKU').toEqual(['charlie'])
      expect((await list('?stock=sold_out')).total).toBe(3)
      expect((await list('?stock=in')).total).toBe(0)
      expect(await list('?size=25&page=2')).toMatchObject({ items: [], total: 3, page: 2, size: 25 })
      expect((await b.call('GET', '/admin/products?sort=bodyMd')).status).toBe(400)
      const row = (await list('?q=ALP')).items[0]
      expect(row).toMatchObject({ id: a.id, title: 'ALPHA', status: 'draft', variantCount: 1, stockStatus: 'sold_out', priceFrom: pkr(1000), primaryCategory: { id: cat, name: 'women' }, hasIssues: true })
      expect(row.priceTo).toBeUndefined()
    }, 90_000)

    it('shows a price range and the first picture on the row', async () => {
      const { b } = await signedIn('catalog')
      await setup()
      const opt = { name: 'Pack', role: 'other', display: 'select', values: [{ key: 'a', label: 'a' }, { key: 'b', label: 'b' }] }
      const made = (await b.call('POST', '/admin/products', { body: live({ options: [opt], variants: [{ key: 'a', sku: 'P-A', optionValueKeys: ['a'], price: pkr(1000), stockMode: 'counted', maxPerOrder: 5, enabled: true }, { key: 'b', sku: 'P-B', optionValueKeys: ['b'], price: pkr(2500), stockMode: 'counted', maxPerOrder: 5, enabled: true }] }) })).body
      const row = (await b.call('GET', '/admin/products')).body.items[0]
      expect(row).toMatchObject({ id: made.id, priceFrom: pkr(1000), priceTo: pkr(2500), image: { width: 1600 }, hasIssues: false })
    }, 60_000)
  })

  describe('deleting, duplicating, previewing', () => {
    it('delete removes the product and everything it owns', async () => {
      const { b } = await signedIn('manager')
      await setup()
      const made = (await b.call('POST', '/admin/products', { body: live({ options: [{ name: 'Pack', role: 'other', display: 'select', values: [{ key: 'a', label: 'a' }] }], variants: [{ key: 'a', sku: 'P-A', optionValueKeys: ['a'], price: pkr(1000), stockMode: 'counted', maxPerOrder: 5, enabled: true }] }) })).body
      expect((await b.call('DELETE', `/admin/products/${made.id}`)).status).toBe(204)
      expect((await b.call('GET', `/admin/products/${made.id}`)).status).toBe(404)
      expect(await t.db.select().from(variants)).toEqual([])
      expect((await t.db.select().from(auditLog)).map((e) => e.action)).toContain('product.deleted')
      expect((await b.call('DELETE', `/admin/products/${made.id}`)).status).toBe(404)
    }, 60_000)

    it('duplicate makes a draft copy with a free handle and SKUs of its own', async () => {
      const { b } = await signedIn('catalog')
      await setup()
      const sizes = await newSizes(['S', 'M'])
      const original = (await b.call('POST', '/admin/products', {
        body: live({
          options: [{ name: 'Size', role: 'size', display: 'buttons', sizeSystemId: sizes.id, values: sizes.values.map((v) => ({ key: v.label, label: v.label, sizeSystemValueId: v.id })) }],
          variants: sizes.values.map((v) => ({ key: v.label, sku: `ORIG-${v.label}`, optionValueKeys: [v.label], price: pkr(2000), stockMode: 'counted', maxPerOrder: 3, enabled: true })),
          highlights: ['Soft'], relatedIds: [],
        }),
      })).body
      const copy = await b.call('POST', `/admin/products/${original.id}/duplicate`)
      expect(copy.status, JSON.stringify(copy.body)).toBe(201)
      expect(copy.body).toMatchObject({ handle: 'lawn-suit-copy', status: 'draft', version: 1, highlights: ['Soft'] })
      expect(copy.body.publishedAt).toBeUndefined()
      expect(copy.body.variants.map((/** @type {{ sku: string }} */ v) => v.sku)).toEqual(['ORIG-S-COPY', 'ORIG-M-COPY'])
      expect(copy.body.variants.map((/** @type {{ id: string }} */ v) => v.id)).not.toContain(original.variants[0].id)
      expect(copy.body.options[0].values.map((/** @type {{ label: string }} */ v) => v.label)).toEqual(['S', 'M'])
      const again = await b.call('POST', `/admin/products/${original.id}/duplicate`)
      expect(again.body.handle).toBe('lawn-suit-copy-2')
      expect(again.body.variants[0].sku).toBe('ORIG-S-COPY2')
      expect((await b.call('POST', `/admin/products/${uuidv7()}/duplicate`)).status).toBe(404)
    }, 90_000)

    it('a preview link opens one product for fifteen minutes and cannot be altered', async () => {
      clock.freeze('2026-10-10T10:00:00.000Z')
      const { b } = await signedIn('catalog')
      await setup()
      const made = (await b.call('POST', '/admin/products', { body: draft() })).body
      const svc = createCatalogService({ db: t.db, config, media: noMedia })
      const link = await b.call('POST', `/admin/products/${made.id}/preview-link`)
      expect(link.body.expiresAt).toBe('2026-10-10T10:15:00.000Z')
      const token = /** @type {string} */ (new URL(link.body.url).searchParams.get('preview'))
      expect(link.body.url.startsWith(`${config.STOREFRONT_URL.replace(/\/$/, '')}/p/lawn-suit?preview=`)).toBe(true)
      expect(svc.products.verifyPreview(token)).toBe(made.id)
      const [id, exp, mac] = token.split('.')
      expect(svc.products.verifyPreview(`${uuidv7()}.${exp}.${mac}`)).toBeNull()
      expect(svc.products.verifyPreview(`${id}.${Number(exp) + 60_000}.${mac}`)).toBeNull()
      expect(svc.products.verifyPreview('garbage')).toBeNull()
      clock.advance(16 * 60_000)
      expect(svc.products.verifyPreview(token)).toBeNull()
      expect((await b.call('POST', `/admin/products/${uuidv7()}/preview-link`)).status).toBe(404)
    }, 60_000)

    it('checkSku says whether a SKU is free, ignoring the variant being edited', async () => {
      const { b } = await signedIn('catalog')
      await setup()
      const made = (await b.call('POST', '/admin/products', { body: draft() })).body
      expect((await b.call('GET', '/admin/products/sku-available?sku=ls-1')).body).toEqual({ available: false })
      expect((await b.call('GET', '/admin/products/sku-available?sku=free-1')).body).toEqual({ available: true })
      expect((await b.call('GET', `/admin/products/sku-available?sku=LS-1&exceptVariantId=${made.variants[0].id}`)).body).toEqual({ available: true })
    }, 60_000)
  })

  describe('scheduled publishing', () => {
    it('publishes what is due and passes its checks, leaves the rest, and writes it down', async () => {
      clock.freeze('2026-10-10T10:00:00.000Z')
      const { user } = await signedIn('catalog')
      await setup()
      const svc = createCatalogService({ db: t.db, config, media: noMedia })
      const actor = { staffId: user.id, name: 'x', role: 'owner', canPublish: true }
      const sched = (/** @type {string} */ handle, /** @type {string} */ at, /** @type {object} */ extra = {}) =>
        svc.products.save(actor, null, /** @type {never} */ (live({ handle, status: 'scheduled', publishAt: at, variants: [{ ...draft().variants[0], sku: handle.toUpperCase() }], ...extra })), REQ)
      await sched('due', '2026-10-10T09:00:00.000Z')
      const later = await sched('later', '2026-10-11T09:00:00.000Z')
      const broken = await sched('broken', '2026-10-10T09:30:00.000Z')
      // the picture of "broken" is removed behind its back, so its checks fail when its time comes
      await t.migrate.pool.query('DELETE FROM product_media WHERE product_id = ?', [broken.id])
      expect(await svc.products.publishDue()).toBe(1)
      const state = Object.fromEntries((await t.db.select().from(products)).map((p) => [p.handle, p]))
      expect(state.due).toMatchObject({ status: 'active', publishAt: null })
      expect(state.due?.publishedAt?.toISOString()).toBe('2026-10-10T10:00:00.000Z')
      expect(state.later?.status).toBe('scheduled')
      expect(state.broken?.status).toBe('scheduled')
      const entry = (await t.db.select().from(auditLog)).find((e) => e.action === 'product.published')
      expect(entry).toMatchObject({ entityLabel: 'due', actorType: 'system' })
      expect(await svc.products.publishDue(), 'nothing is published twice').toBe(0)
      clock.advance(24 * 3_600_000)
      expect(await svc.products.publishDue()).toBe(1)
      expect(later.id).toBeTruthy()
      const [event] = (await t.db.select().from(outboxEvents)).filter((e) => e.type === 'catalog.updated' && JSON.stringify(e.payload).includes('product:due'))
      expect(event).toBeTruthy()
    }, 90_000)
  })

  describe('collections', () => {
    const collection = (/** @type {object} */ extra = {}) => ({ title: 'Eid drop', handle: 'eid-drop', status: 'draft', featured: false, productIds: [], ...extra })

    it('hold products in the order given, show them as rows, and change with the version', async () => {
      const { b } = await signedIn('catalog')
      await setup()
      const ids = []
      for (const h of ['a', 'b', 'c']) ids.push((await b.call('POST', '/admin/products', { body: draft({ handle: h, variants: [{ ...draft().variants[0], sku: h.toUpperCase() }] }) })).body.id)
      const made = await b.call('POST', '/admin/collections', { body: collection({ productIds: [ids[2], ids[0]], description: 'Festive', seo: { title: 'Eid' }, i18n: { ur: { title: 'عید' } } }) })
      expect(made.status, JSON.stringify(made.body)).toBe(201)
      expect(made.body).toMatchObject({ title: 'Eid drop', version: 1, productIds: [ids[2], ids[0]], i18n: { ur: { title: 'عید' } } })
      expect(made.body.products.map((/** @type {{ handle: string }} */ p) => p.handle)).toEqual(['c', 'a'])
      const next = await b.call('PUT', `/admin/collections/${made.body.id}`, { body: { ...collection({ productIds: [ids[0], ids[1], ids[2]], status: 'active' }), version: 1 } })
      expect(next.body).toMatchObject({ version: 2, status: 'active', productIds: [ids[0], ids[1], ids[2]] })
      expect((await b.call('PUT', `/admin/collections/${made.body.id}`, { body: { ...collection(), version: 1 } })).body.code).toBe('stale_write')
      expect((await b.call('GET', `/admin/products?collection=${made.body.id}`)).body.total).toBe(3)
      expect((await b.call('GET', `/admin/products/${ids[0]}`)).body.collections).toEqual([{ id: made.body.id, title: 'Eid drop' }])
      const list = await b.call('GET', '/admin/collections?status=active')
      expect(list.body).toMatchObject({ total: 1, items: [{ id: made.body.id, handle: 'eid-drop', productCount: 3, featured: false }] })
      expect((await b.call('GET', '/admin/collections?sort=bogus')).status).toBe(400)
      expect((await b.call('POST', '/admin/collections', { body: collection({ title: 'Other' }) })).body.code).toBe('handle_taken')
      expect((await b.call('POST', '/admin/collections', { body: collection({ handle: 'x', productIds: [ids[0], ids[0]] }) })).body.issues).toEqual([{ path: 'productIds', code: 'not_unique' }])
      expect((await b.call('POST', '/admin/collections', { body: collection({ handle: 'x', productIds: [uuidv7()] }) })).body.issues).toEqual([{ path: 'productIds.0', code: 'invalid_format' }])
      expect((await b.call('POST', '/admin/collections', { body: collection({ handle: 'x', startsAt: '2026-10-10T10:00:00.000Z', endsAt: '2026-10-09T10:00:00.000Z' }) })).body.issues).toEqual([{ path: 'endsAt', code: 'invalid_format' }])
      expect((await b.call('DELETE', `/admin/collections/${made.body.id}`)).status).toBe(204)
      expect((await b.call('GET', `/admin/products/${ids[0]}`)).status, 'the products stay').toBe(200)
    }, 90_000)

    it('feature at most three; a fourth must say which one makes room', async () => {
      const { b } = await signedIn('catalog')
      await setup()
      const ids = []
      for (const h of ['one', 'two', 'three']) ids.push((await b.call('POST', '/admin/collections', { body: collection({ handle: h, title: h, featured: true }) })).body.id)
      const fourth = await b.call('POST', '/admin/collections', { body: collection({ handle: 'four', title: 'four', featured: true }) })
      expect([fourth.status, fourth.body.issues, fourth.body.featured?.length]).toEqual([400, [{ path: 'featured', code: 'too_big' }], 3])
      const swapped = await b.call('POST', '/admin/collections', { body: collection({ handle: 'four', title: 'four', featured: true, replaceFeaturedId: ids[1] }) })
      expect(swapped.status, JSON.stringify(swapped.body)).toBe(201)
      const featured = (await b.call('GET', '/admin/collections')).body.items.filter((/** @type {{ featured: boolean }} */ c) => c.featured).map((/** @type {{ handle: string }} */ c) => c.handle).sort()
      expect(featured).toEqual(['four', 'one', 'three'])
      expect((await b.call('POST', '/admin/collections', { body: collection({ handle: 'five', featured: true, replaceFeaturedId: uuidv7() }) })).status).toBe(400)
    }, 90_000)

    it('leave a redirect when the handle changes', async () => {
      const { b } = await signedIn('catalog')
      await setup()
      const made = (await b.call('POST', '/admin/collections', { body: collection() })).body
      await b.call('PUT', `/admin/collections/${made.id}`, { body: { ...collection({ handle: 'eid-2026' }), version: 1 } })
      expect(await t.db.select().from(handleRedirects).where(and(eq(handleRedirects.entityType, 'collection'), eq(handleRedirects.oldHandle, 'eid-drop')))).toHaveLength(1)
    }, 60_000)
  })

  describe('who uses what (real counts)', () => {
    it('the structure screens now count products, and refuse deletes that would orphan them', async () => {
      const { b } = await signedIn('catalog')
      await setup()
      const sub = await newCategory('lawn', cat)
      const sizes = await newSizes(['S', 'M'])
      const attr = (await b.call('POST', '/admin/attributes', { body: { code: 'fabric', label: 'Fabric', type: 'enum', display: 'checkbox', filterable: true, values: [{ code: 'lawn', label: 'Lawn' }, { code: 'silk', label: 'Silk' }] } })).body
      const chart = (await b.call('POST', '/admin/size-charts', { body: { title: 'Kameez', unit: 'in', tables: [{ id: 'k', title: 'K', columns: ['Bust'], rows: [{ label: 'S', values: [34] }] }] } })).body
      const form = (await b.call('POST', '/admin/form-schemas', { body: { title: 'Custom', allowNotes: false, fields: [{ key: 'bust', label: 'Bust', type: 'number' }] } })).body
      const made = (await b.call('POST', '/admin/products', {
        body: draft({
          primaryCategoryId: sub, sizeChartId: chart.id, customSizeSchemaId: form.id,
          attributes: [{ attributeId: attr.id, valueIds: [attr.values[0].id] }],
          options: [{ name: 'Size', role: 'size', display: 'buttons', sizeSystemId: sizes.id, values: sizes.values.map((v) => ({ key: v.label, label: v.label, sizeSystemValueId: v.id })) }],
          variants: sizes.values.map((v) => ({ key: v.label, sku: `U-${v.label}`, optionValueKeys: [v.label], price: pkr(1000), stockMode: 'counted', maxPerOrder: 5, enabled: true })),
        }),
      })).body
      expect(made.id).toBeTruthy()
      const cats = (await b.call('GET', '/admin/categories')).body.items
      expect(cats.find((/** @type {{ id: string }} */ c) => c.id === cat).productCount, 'the parent counts the child’s product').toBe(1)
      expect(cats.find((/** @type {{ id: string }} */ c) => c.id === sub).productCount).toBe(1)
      const del = await b.call('DELETE', `/admin/categories/${sub}`)
      expect([del.status, del.body.code, del.body.usedBy]).toEqual([409, 'in_use', { children: 0, products: 1 }])
      const a = (await b.call('GET', '/admin/attributes')).body.items[0]
      expect([a.usedByProducts, a.values.map((/** @type {{ usedByProducts: number }} */ v) => v.usedByProducts)]).toEqual([1, [1, 0]])
      expect((await b.call('DELETE', `/admin/attributes/${attr.id}`)).body.usedBy).toEqual({ products: 1, categories: 0 })
      const removeValue = await b.call('PUT', `/admin/attributes/${attr.id}`, { body: { code: 'fabric', label: 'Fabric', type: 'enum', display: 'checkbox', filterable: true, values: [{ id: attr.values[1].id, code: 'silk', label: 'Silk' }] } })
      expect([removeValue.status, removeValue.body.code, removeValue.body.values]).toEqual([409, 'in_use', [{ id: attr.values[0].id, code: 'lawn', usedByProducts: 1 }]])
      expect((await b.call('DELETE', `/admin/size-systems/${sizes.id}`)).body.usedBy).toEqual({ options: 1 })
      const dropS = await b.call('PUT', `/admin/size-systems/${sizes.id}`, { body: { name: 'Sizes', values: [{ id: sizes.values[1]?.id, label: 'M' }] } })
      expect([dropS.status, dropS.body.code, dropS.body.values.map((/** @type {{ label: string, usedByVariants: number }} */ v) => [v.label, v.usedByVariants])]).toEqual([409, 'in_use', [['S', 1]]])
      expect((await b.call('DELETE', `/admin/form-schemas/${form.id}`)).body.usedBy).toEqual({ products: 1 })
      expect((await b.call('GET', `/admin/size-charts/${chart.id}`)).body.usedBy).toBe(1)
      expect((await b.call('GET', '/admin/form-schemas')).body.items[0].usedBy).toBe(1)

      // merging moves the product to the other value
      expect((await b.call('POST', `/admin/attributes/${attr.id}/values/${attr.values[0].id}/merge`, { body: { intoValueId: attr.values[1].id } })).status).toBe(204)
      const after = (await b.call('GET', `/admin/products/${made.id}`)).body
      expect(after.attributes).toEqual([{ attributeId: attr.id, valueIds: [attr.values[1].id] }])
      // and a size chart goes without taking the product with it
      expect((await b.call('DELETE', `/admin/size-charts/${chart.id}`)).status).toBe(204)
      expect((await b.call('GET', `/admin/products/${made.id}`)).body.sizeChartId).toBeUndefined()
    }, 120_000)
  })
})
