// M1-12: the public catalog through HTTP: listings and facets, cursors, product detail, categories, collections, charts, forms,
// back-in-stock requests and the sitemap (plan/10-api/02-catalog-public.md, acceptance in section 8).
import { eq, inArray, ne } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { auditLog } from '../src/db/schema/audit.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { pages } from '../src/db/schema/content.js'
import { media } from '../src/db/schema/media.js'
import { outboxEvents } from '../src/db/schema/platform.js'
import { collections, productSizes, products, variants } from '../src/db/schema/products.js'
import { stockSubscriptions } from '../src/db/schema/inventory.js'
import { cities, shippingZones } from '../src/db/schema/shipping.js'
import { attributes, categories, handleRedirects, sizeCharts, sizeSystemValues, sizeSystems } from '../src/db/schema/taxonomy.js'
import { advanceClock, setClock } from '../src/platform/clock.js'
import { uuidv7 } from '../src/platform/ids.js'
import { createCatalogService } from '../src/modules/catalog/index.js'
import { createInventory } from '../src/modules/inventory/index.js'
import { createShippingService, seedShipping } from '../src/modules/shipping/index.js'
import { app, closeHarness, config, createHarness, makeStaff, signedIn, t } from './support/staff.js'
import { transaction } from '../src/platform/db.js'
import { dbAvailable } from './support/db.js'

const REQ = { ip: '10.0.0.1', userAgent: 'vitest', requestId: '0190f2c0-0000-7000-8000-000000000001' }
const ACTOR = { staffId: '', name: 'Tester', role: 'owner', canPublish: true } // staffId is a real user, made in beforeAll (the ledger refers to it)
const pkr = (/** @type {number} */ rupees) => ({ amount: rupees * 100, currency: /** @type {const} */ ('PKR') })
let ipCounter = 0
/** A public GET from a fresh address, so the rate limits of one test never reach another. */
const get = (/** @type {string} */ url, /** @type {Record<string, string>} */ headers = {}) => app.inject({ url: `/api/v1${url}`, remoteAddress: `10.9.${Math.floor(ipCounter / 250) % 250}.${(ipCounter++ % 250) + 1}`, headers })
const json = async (/** @type {string} */ url) => (await get(url)).json()

/** @type {ReturnType<typeof createCatalogService>} */
let catalog
/** @type {ReturnType<typeof createInventory>} */
let inv
/** @type {ReturnType<typeof createShippingService>} */
let shipping
/** @type {Record<string, any>} */
const d = {}
/** Products made by a single test, removed afterwards. */
const extras = /** @type {string[]} */ ([])

async function pic() {
  const id = uuidv7()
  await t.db.insert(media).values({ id, kind: 'image', status: 'ready', objectKey: `media/2026/10/${id}.jpg`, contentType: 'image/jpeg', bytes: 1, width: 900, height: 1200, alt: 'Picture', createdAt: new Date() })
  return id
}

/** An active product. `sizes` makes a Size option with stock per size; otherwise one variant with `stock` (null: made to order). */
async function mk(/** @type {string} */ title, /** @type {Record<string, any>} */ o = {}) {
  const sku = (o.sku ?? title.replace(/[^A-Za-z0-9]/g, '').toUpperCase()).slice(0, 30)
  const sized = o.sizes ? d.sizes.values.filter((/** @type {{ label: string }} */ v) => o.sizes[v.label] !== undefined) : null
  const price = pkr(o.price ?? 3000)
  const variant = (/** @type {string} */ key, /** @type {string[]} */ optionValueKeys, /** @type {string} */ suffix, /** @type {object} */ extra = {}) => ({
    key, sku: `${sku}${suffix}`, optionValueKeys, price, ...(o.compareAt ? { compareAt: pkr(o.compareAt) } : {}), stockMode: o.stock === null ? 'made_to_order' : 'counted', maxPerOrder: o.maxPerOrder ?? 10, enabled: true, ...extra,
  })
  const body = {
    handle: o.handle ?? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    status: o.status ?? 'active', kind: o.kind ?? 'stitched', title, subtitle: o.subtitle, brand: o.brand, primaryCategoryId: o.category ?? d.stitched, categoryIds: o.categoryIds ?? [],
    attributes: o.fabric ? [{ attributeId: d.fabric.id, valueIds: [d.fabric.values.find((/** @type {{ code: string }} */ v) => v.code === o.fabric).id] }] : [],
    ...(o.style ? { styleId: o.style } : {}),
    ...(o.color ? { colorway: { label: o.colorwayLabel ?? o.color, family: o.color, swatch: { hex: [o.hex ?? '#CC0000'] } } } : {}),
    media: [{ mediaId: await pic(), alt: `${title} front` }, ...(o.twoPictures === false ? [] : [{ mediaId: await pic(), alt: `${title} back` }])],
    options: sized ? [{ name: 'Size', role: 'size', display: 'buttons', sizeSystemId: d.sizes.id, values: sized.map((/** @type {{ id: string, label: string }} */ v) => ({ key: v.label, label: v.label, sizeSystemValueId: v.id })) }] : [],
    variants: sized ? sized.map((/** @type {{ label: string }} */ v) => variant(v.label, [v.label], `-${v.label}`)) : [variant('v', [], '')],
    ...(o.kind === 'made_to_order' ? { madeToOrder: { leadMinDays: 15, leadMaxDays: 20, returnable: false, depositPercent: 30 } } : {}),
    ...(o.kind === 'unstitched' ? { components: [{ type: 'shirt', label: 'Shirt', fabric: 'Lawn', included: true }] } : {}),
    ...(o.i18n ? { i18n: o.i18n } : {}),
    ...(o.bundle ? { bundleProductIds: o.bundle } : {}),
    ...(o.related ? { relatedIds: o.related } : {}),
    ...(o.badges ? { badges: o.badges } : {}),
    ...(o.sizeChartId ? { sizeChartId: o.sizeChartId } : {}),
    initialStock: sized ? Object.entries(o.sizes).filter(([, n]) => n).map(([k, n]) => ({ variantKey: k, quantity: n })) : o.stock ? [{ variantKey: 'v', quantity: o.stock }] : [],
  }
  for (const k of Object.keys(body)) if (/** @type {any} */ (body)[k] === undefined) delete (/** @type {any} */ (body))[k]
  const made = await catalog.products.save(ACTOR, null, /** @type {never} */ (body), REQ)
  if (o.sales || o.at || o.rank) await t.db.update(products).set({ ...(o.sales ? { salesCount: o.sales } : {}), ...(o.at ? { publishedAt: new Date(o.at) } : {}), ...(o.rank ? { featuredRank: o.rank } : {}) }).where(eq(products.id, made.id))
  if (o.extra) extras.push(made.id)
  return made
}

describe.skipIf(!dbAvailable)('public catalog (MySQL, through HTTP)', () => {
  beforeAll(async () => {
    await createHarness()
    ACTOR.staffId = (await makeStaff('owner')).id
    inv = createInventory({ db: t.db, lowStockThreshold: async () => 3, onChanged: async (tx, ids) => catalog.products.recomputeMany(tx, ids) })
    catalog = createCatalogService({ db: t.db, config, media: { imagesFor: async () => ({}) }, stock: inv.stock })
    shipping = createShippingService({ db: t.db })
    // structure
    const cat = async (/** @type {string} */ handle, /** @type {string | null} */ parentId = null, extra = {}) => {
      const id = uuidv7()
      await t.db.insert(categories).values({ id, parentId, handle, name: handle[0]?.toUpperCase() + handle.slice(1), createdAt: new Date(), updatedAt: new Date(), ...extra })
      return id
    }
    d.women = await cat('women')
    d.unstitched = await cat('unstitched', d.women, { sortOrder: 0 })
    d.stitched = await cat('stitched', d.women, { sortOrder: 1 })
    d.bare = await cat('bare', null, { sortOrder: 9 }) // visible and empty: the tree leaves it out, its own page still opens
    d.men = await cat('men', null, { sortOrder: 1 })
    d.secret = await cat('secret', null, { visible: false })
    d.secretKid = await cat('secret-kid', d.secret)
    d.sizes = await (async () => {
      const id = uuidv7()
      await t.db.insert(sizeSystems).values({ id, name: 'Std', createdAt: new Date(), updatedAt: new Date() })
      const values = ['S', 'M', 'L'].map((label, i) => ({ id: uuidv7(), sizeSystemId: id, label, sortOrder: i }))
      await t.db.insert(sizeSystemValues).values(values)
      return { id, values }
    })()
    const staff = { staffId: ACTOR.staffId, name: 'x', role: 'owner' }
    d.fabric = await catalog.attributes.create(staff, { code: 'fabric', label: 'Fabric', type: 'enum', display: 'checkbox', filterable: true, values: [{ code: 'cotton', label: 'Cotton' }, { code: 'silk', label: 'Silk' }, { code: 'lawn', label: 'Lawn' }] }, REQ)
    await catalog.categories.update(staff, d.women, { name: 'Women', handle: 'women', visible: true, attributes: [{ attributeId: d.fabric.id, seoIndexable: true, required: false }], version: 1 }, REQ)
    d.chart = await catalog.sizes.createChart(staff, { title: 'Kameez', unit: 'in', tables: [{ id: 'k', title: 'Kameez', columns: ['Bust'], rows: [{ label: 'S', values: [34] }] }] }, REQ)
    d.form = await catalog.sizes.createForm(staff, { title: 'Custom', allowNotes: true, fields: [{ key: 'bust', label: 'Bust', type: 'number', required: true }] }, REQ)
    // products
    d.kurtaRed = await mk('Cotton kurta', { sizes: { S: 5, M: 0, L: 2 }, price: 3000, compareAt: 4000, color: 'red', fabric: 'cotton', style: 'kurta', colorwayLabel: 'Red', hex: '#CC0000', sales: 20, sizeChartId: d.chart.id, i18n: { ur: { title: 'کاٹن کرتا' } } })
    d.kurtaBlue = await mk('Cotton kurta blue', { sizes: { S: 3, M: 3 }, price: 3000, color: 'blue', fabric: 'cotton', style: 'kurta', colorwayLabel: 'Blue', hex: '#0000CC', sales: 5 })
    d.silk = await mk('Silk lawn suit', { kind: 'unstitched', category: d.unstitched, stock: 10, price: 9000, color: 'green', fabric: 'silk', sales: 50, rank: 5, badges: ['bestseller'] })
    d.lawn = await mk('Lawn suit 3pc', { kind: 'unstitched', category: d.unstitched, stock: 0, price: 6500, color: 'pink', fabric: 'lawn', sales: 1, twoPictures: false })
    d.bridal = await mk('Bridal gown', { kind: 'made_to_order', stock: null, price: 85000, color: 'white', fabric: 'silk', category: d.unstitched })
    d.shirt = await mk('Men shirt', { category: d.men, stock: 4, price: 2000, color: 'blue', maxPerOrder: 2 })
    d.draft = await mk('Draft dress', { status: 'draft', stock: 3 })
    d.archived = await mk('Archived dress', { status: 'archived', stock: 3, sku: 'ARCH' })
    for (const [p, at] of /** @type {const} */ ([['kurtaRed', '2026-09-01T10:00:00.000Z'], ['kurtaBlue', '2026-09-02T10:00:00.000Z'], ['silk', '2026-09-03T10:00:00.000Z'], ['lawn', '2026-09-04T10:00:00.000Z'], ['bridal', '2026-09-05T10:00:00.000Z'], ['shirt', '2026-09-06T10:00:00.000Z']])) {
      await t.db.update(products).set({ publishedAt: new Date(at) }).where(eq(products.id, d[p].id))
    }
    d.eid = (await catalog.collections.create(staff, { title: 'Eid drop', handle: 'eid', status: 'active', featured: true, productIds: [d.silk.id, d.kurtaRed.id, d.shirt.id] }, REQ)).id
    await catalog.collections.create(staff, { title: 'Hidden drop', handle: 'hidden-drop', status: 'draft', featured: false, productIds: [d.silk.id] }, REQ)
    await catalog.collections.create(staff, { title: 'Later drop', handle: 'later', status: 'active', featured: false, startsAt: '2099-01-01T00:00:00.000Z', productIds: [] }, REQ)
    await seedShipping(t.db)
    const lahore = (await t.db.select().from(cities).where(eq(cities.name, 'Lahore')))[0]
    await shipping.createZone(staff, { name: 'Major', cityIds: [lahore?.id ?? ''], methods: [{ label: 'Standard', fee: pkr(250), freeAbove: pkr(5000), etaMinDays: 3, etaMaxDays: 5, codAllowed: true, enabled: true }] }, REQ)
  }, 180_000)
  afterAll(closeHarness)
  afterEach(async () => {
    setClock(null)
    if (extras.length) {
      await t.migrate.pool.query('DELETE FROM inventory_movements WHERE variant_id IN (SELECT id FROM variants WHERE product_id IN (?))', [extras])
      await t.db.delete(products).where(inArray(products.id, extras.splice(0)))
    }
    await t.db.delete(stockSubscriptions)
    await t.db.delete(handleRedirects)
    await t.db.delete(outboxEvents)
    await t.migrate.db.delete(auditLog)
    await t.db.delete(staffUsers).where(ne(staffUsers.id, ACTOR.staffId))
  })

  const handles = (/** @type {{ items: { handle: string }[] }} */ r) => r.items.map((i) => i.handle)

  describe('listing', () => {
    it('shows live products as cards, newest first, cacheable, and never a draft or archived one', async () => {
      const r = await get('/products')
      expect(r.statusCode).toBe(200)
      expect(r.headers['cache-control']).toBe('public, s-maxage=60, stale-while-revalidate=600')
      const body = r.json()
      expect(handles(body)).toEqual(['men-shirt', 'bridal-gown', 'lawn-suit-3pc', 'silk-lawn-suit', 'cotton-kurta-blue', 'cotton-kurta'])
      expect(body.total).toBe(6)
      expect(body.nextCursor).toBeUndefined()
      const kurta = body.items.find((/** @type {{ handle: string }} */ i) => i.handle === 'cotton-kurta')
      expect(kurta).toMatchObject({
        id: d.kurtaRed.id, title: 'Cotton kurta', kind: 'stitched', priceFrom: pkr(3000), compareAtFrom: pkr(4000), stockStatus: 'in_stock',
        primaryImage: { alt: 'Cotton kurta front', width: 900 }, secondaryImage: { alt: 'Cotton kurta back' },
      })
      expect(kurta.badges).toEqual(expect.arrayContaining(['sale']))
      expect(kurta.colorways, 'by colour name').toEqual([{ handle: 'cotton-kurta-blue', label: 'Blue', swatch: { hex: ['#0000CC'] }, current: false }, { handle: 'cotton-kurta', label: 'Red', swatch: { hex: ['#CC0000'] }, current: true }])
      expect(kurta.priceTo).toBeUndefined()
      const lawn = body.items.find((/** @type {{ handle: string }} */ i) => i.handle === 'lawn-suit-3pc')
      expect(lawn).toMatchObject({ stockStatus: 'sold_out' })
      expect(lawn.badges).toContain('sold_out')
      expect(lawn.secondaryImage).toBeUndefined()
      expect(lawn.colorways).toEqual([])
      expect(body.items.find((/** @type {{ handle: string }} */ i) => i.handle === 'bridal-gown').badges).toEqual(expect.arrayContaining(['made_to_order']))
      expect(body.items.find((/** @type {{ handle: string }} */ i) => i.handle === 'silk-lawn-suit').badges).toContain('bestseller')
      const everything = JSON.stringify(body)
      for (const hidden of ['draft-dress', 'archived-dress', 'ARCH']) expect(everything).not.toContain(hidden)
    }, 60_000)

    it('a card shows the rating of a product that has approved reviews, and nothing for one that has none', async () => {
      await t.db.update(products).set({ ratingAvgX100: 450, ratingCount: 2 }).where(eq(products.id, d.kurtaRed.id))
      try {
        const body = (await get('/products')).json()
        expect(body.items.find((/** @type {{ handle: string }} */ i) => i.handle === 'cotton-kurta').rating).toEqual({ average: 4.5, count: 2 })
        expect(body.items.find((/** @type {{ handle: string }} */ i) => i.handle === 'lawn-suit-3pc').rating).toBeUndefined()
      } finally {
        await t.db.update(products).set({ ratingAvgX100: null, ratingCount: 0 }).where(eq(products.id, d.kurtaRed.id))
      }
    }, 60_000)

    it('filters by category with its descendants, by collection in the collection’s order, by kind, colour, price, sale, newness and stock', async () => {
      expect(handles(await json('/products?category=women'))).toHaveLength(5)
      expect(handles(await json('/products?category=unstitched&sort=newest'))).toEqual(['bridal-gown', 'lawn-suit-3pc', 'silk-lawn-suit'])
      expect(handles(await json('/products?category=men'))).toEqual(['men-shirt'])
      expect(handles(await json('/products?collection=eid'))).toEqual(['silk-lawn-suit', 'cotton-kurta', 'men-shirt'])
      expect(handles(await json('/products?kind=unstitched,made_to_order&sort=newest'))).toEqual(['bridal-gown', 'lawn-suit-3pc', 'silk-lawn-suit'])
      expect(handles(await json('/products?color=blue&sort=newest'))).toEqual(['men-shirt', 'cotton-kurta-blue'])
      expect(handles(await json('/products?priceMin=600000&priceMax=1000000&sort=price_asc'))).toEqual(['lawn-suit-3pc', 'silk-lawn-suit'])
      expect(handles(await json('/products?onlySale=1'))).toEqual(['cotton-kurta'])
      expect(handles(await json('/products?inStock=1&sort=newest'))).toEqual(['men-shirt', 'bridal-gown', 'silk-lawn-suit', 'cotton-kurta-blue', 'cotton-kurta'])
      setClock(new Date('2026-09-20T00:00:00.000Z'))
      expect(handles(await json('/products?onlyNew=1')), 'published in the last 30 days').toHaveLength(6)
      setClock(new Date('2026-10-04T00:00:00.000Z'))
      expect(handles(await json('/products?onlyNew=1&sort=newest')), '30 days before the fourth of October').toEqual(['men-shirt', 'bridal-gown', 'lawn-suit-3pc'])
    }, 90_000)

    it('a size filter matches only products with that size available', async () => {
      expect(handles(await json('/products?size=M&sort=newest')), 'kurta M is sold out; blue has M').toEqual(['cotton-kurta-blue'])
      expect(handles(await json('/products?size=S,L&sort=newest')).sort()).toEqual(['cotton-kurta', 'cotton-kurta-blue'])
      expect(handles(await json('/products?size=l'))).toEqual(['cotton-kurta'])
      expect(handles(await json('/products?size=XXL'))).toEqual([])
    }, 60_000)

    it('the size index follows stock: a size sold out leaves the filter, restocked comes back', async () => {
      const mVariant = (await t.db.select().from(variants).where(eq(variants.productId, d.kurtaRed.id))).find((v) => v.sku.endsWith('-M'))
      const inIndex = async () => (await t.db.select().from(productSizes).where(eq(productSizes.productId, d.kurtaRed.id))).length
      expect(await inIndex(), 'S, M and L are all sold in sizes').toBe(3)
      const ask = () => json('/products?size=M&sort=newest').then(handles)
      expect(await ask()).toEqual(['cotton-kurta-blue'])
      await transaction(t.db, (tx) => inv.adjust(tx, { variantId: /** @type {NonNullable<typeof mVariant>} */ (mVariant).id, mode: 'set', quantity: 4, reason: 'correction', staffId: ACTOR.staffId }))
      expect(await ask()).toEqual(['cotton-kurta-blue', 'cotton-kurta'])
      await transaction(t.db, (tx) => inv.adjust(tx, { variantId: /** @type {NonNullable<typeof mVariant>} */ (mVariant).id, mode: 'set', quantity: 0, reason: 'correction', staffId: ACTOR.staffId }))
      expect(await ask()).toEqual(['cotton-kurta-blue'])
      expect(await inIndex(), 'a sold-out size is still a size of the product').toBe(3)
    }, 60_000)

    it('attribute filters: values of one attribute are alternatives, attributes are all required', async () => {
      expect(handles(await json('/products?category=women&attr.fabric=cotton&sort=newest'))).toEqual(['cotton-kurta-blue', 'cotton-kurta'])
      expect(handles(await json('/products?attr.fabric=silk,lawn&sort=newest'))).toEqual(['bridal-gown', 'lawn-suit-3pc', 'silk-lawn-suit'])
      expect(handles(await json('/products?attr.fabric=silk&kind=made_to_order'))).toEqual(['bridal-gown'])
    }, 60_000)

    it('refuses what it does not know', async () => {
      const bad = async (/** @type {string} */ url) => { const r = await get(url); return [r.statusCode, r.json().issues] }
      expect(await bad('/products?attr.unknown=x')).toEqual([400, [{ path: 'attr.unknown', code: 'invalid_format' }]])
      expect(await bad('/products?sort=relevance')).toEqual([400, [{ path: 'sort', code: 'invalid_format' }]])
      expect((await bad('/products?sort=cheapest'))[0]).toBe(400)
      expect((await bad('/products?limit=49'))[0]).toBe(400)
      expect((await bad('/products?color=ochre'))[0]).toBe(400)
      expect((await bad('/products?whatever=1'))[0]).toBe(400)
      expect((await bad('/products?priceMin=900&priceMax=100'))[0]).toBe(400)
      expect((await bad('/products?cursor=!!!'))[0]).toBe(400)
      expect((await get('/products?category=nothing')).statusCode).toBe(404)
      expect((await get('/products?category=secret')).statusCode, 'a hidden category').toBe(404)
      expect((await get('/products?category=secret-kid')).statusCode, 'under a hidden one').toBe(404)
      expect((await get('/products?collection=hidden-drop')).statusCode, 'a draft collection').toBe(404)
      expect((await get('/products?collection=later')).statusCode, 'outside its window').toBe(404)
    }, 60_000)

    it('ids (the wishlist) come back in the order asked, live ones only, capped at 100', async () => {
      const r = await json(`/products?ids=${d.shirt.id},${d.draft.id},${d.kurtaRed.id},${uuidv7()}&sort=price_desc&category=nothing&priceMax=1`)
      expect(handles(r)).toEqual(['men-shirt', 'cotton-kurta'])
      expect(r.facets).toBeUndefined()
      expect((await get(`/products?ids=${Array.from({ length: 101 }, () => uuidv7()).join(',')}`)).statusCode).toBe(400)
    }, 60_000)
  })

  describe('text search', () => {
    it('finds products, never caches the answer, counts misses, and uses its own rate limit', async () => {
      const { createSearch } = await import('../src/modules/search/index.js')
      const search = createSearch({ db: t.db })
      await search.seedSynonyms()
      for (const p of [d.kurtaRed, d.kurtaBlue, d.silk, d.lawn, d.bridal, d.shirt]) await search.reindexProduct(p.id)
      const r = await get('/products?q=kurta')
      expect(r.headers['cache-control']).toBe('private, no-store')
      expect(handles(r.json()).sort()).toEqual(['cotton-kurta', 'cotton-kurta-blue'])
      expect(handles(await json('/products?q=cotton%20kurta%20bl'))).toEqual(['cotton-kurta-blue'])
      expect(handles(await json('/products?q=SILKLAWNSUIT')), 'an exact SKU').toEqual(['silk-lawn-suit'])
      expect(handles(await json('/products?q=kurti&category=women&sort=newest'))).toEqual(['cotton-kurta-blue', 'cotton-kurta'])
      expect((await json('/products?q=kurta&color=red')).items.map((/** @type {{ handle: string }} */ i) => i.handle)).toEqual(['cotton-kurta'])
      const none = await json('/products?q=chikankari')
      expect([none.items, none.total]).toEqual([[], 0])
      expect(none.facets.find((/** @type {{ key: string }} */ f) => f.key === 'kind').values).toEqual([])
      expect((await search.topMisses()).map((m) => m.query)).toEqual(['chikankari'])
      expect((await json('/products?q=%2B%2B%2B%22')).items).toEqual([])
      const ip = '10.77.0.1'
      let status = 0
      for (let i = 0; i < 61; i++) status = (await app.inject({ url: '/api/v1/products?q=kurta&facets=0', remoteAddress: ip })).statusCode
      expect(status, 'search allows 60 a minute').toBe(429)
      expect((await app.inject({ url: '/api/v1/products?facets=0', remoteAddress: ip })).statusCode, 'plain listings are another bucket').toBe(200)
    }, 120_000)

    it('relevance orders by the better match and pages by offset', async () => {
      const { createSearch } = await import('../src/modules/search/index.js')
      await createSearch({ db: t.db }).reindexAll()
      const first = await json('/products?q=suit&limit=1&facets=0')
      expect(first.items).toHaveLength(1)
      expect(first.nextCursor).toBeTruthy()
      const second = await json(`/products?q=suit&limit=1&facets=0&cursor=${first.nextCursor}`)
      expect(second.items).toHaveLength(1)
      expect(second.items[0].id).not.toBe(first.items[0].id)
      expect(second.nextCursor).toBeUndefined()
      expect(first.total).toBe(2)
    }, 60_000)
  })

  describe('facets', () => {
    const facet = (/** @type {any} */ r, /** @type {string} */ key) => r.facets.find((/** @type {{ key: string }} */ f) => f.key === key)
    const counts = (/** @type {any} */ f) => Object.fromEntries(f.values.map((/** @type {{ value: string, count: number }} */ v) => [v.value, v.count]))

    it('count what each other value would give, leaving out the facet’s own selection', async () => {
      const all = await json('/products')
      expect(counts(facet(all, 'kind'))).toEqual({ stitched: 3, unstitched: 2, made_to_order: 1 })
      const picked = await json('/products?kind=unstitched')
      expect(handles(picked)).toEqual(['lawn-suit-3pc', 'silk-lawn-suit'])
      expect(counts(facet(picked, 'kind')), 'the other kinds still show their counts').toEqual({ stitched: 3, unstitched: 2, made_to_order: 1 })
      expect(facet(picked, 'kind').values.find((/** @type {{ value: string }} */ v) => v.value === 'unstitched').selected).toBe(true)
      expect(counts(facet(picked, 'color')), 'colours of what is left').toEqual({ green: 1, pink: 1 })
      const sizes = await json('/products?color=red')
      expect(counts(facet(sizes, 'size'))).toEqual({ S: 1, L: 1 })
      expect(counts(facet(all, 'size')), 'M is available on one product only').toEqual({ S: 2, M: 1, L: 1 })
      expect(facet(all, 'size').values.map((/** @type {{ value: string }} */ v) => v.value)).toEqual(['S', 'M', 'L'])
      expect(counts(facet(all, 'inStock'))).toEqual({ 1: 5 })
      expect(facet(all, 'color').values.find((/** @type {{ value: string }} */ v) => v.value === 'red').swatch).toEqual({ hex: [expect.stringMatching(/^#/)] })
    }, 60_000)

    it('a category brings its own filters, in order, with zero counts kept; outside a category there are none', async () => {
      const women = await json('/products?category=women')
      const fabric = facet(women, 'attr.fabric')
      expect(fabric).toMatchObject({ label: 'Fabric', display: 'checkbox', seoIndexable: true })
      expect(counts(fabric)).toEqual({ cotton: 2, silk: 2, lawn: 1 })
      const chosen = await json('/products?category=women&attr.fabric=cotton')
      expect(counts(facet(chosen, 'attr.fabric')), 'its own selection is not applied to its own counts').toEqual({ cotton: 2, silk: 2, lawn: 1 })
      expect(facet(chosen, 'attr.fabric').values.find((/** @type {{ value: string }} */ v) => v.value === 'cotton').selected).toBe(true)
      const narrowed = await json('/products?category=women&kind=unstitched')
      expect(counts(facet(narrowed, 'attr.fabric')), 'lawn and silk remain, cotton drops to zero but stays listed').toEqual({ cotton: 0, silk: 1, lawn: 1 })
      const men = await json('/products?category=men')
      expect(men.facets.map((/** @type {{ key: string }} */ f) => f.key)).toEqual(['kind', 'size', 'color', 'inStock'])
      expect((await json('/products?collection=eid')).facets.some((/** @type {{ key: string }} */ f) => f.key.startsWith('attr.'))).toBe(false)
    }, 60_000)

    it('price presets are four ranges from the quartiles, rounded to Rs. 500', async () => {
      const r = await json('/products')
      expect(r.pricePresets).toHaveLength(4)
      expect(r.pricePresets[0]).toEqual({ max: expect.any(Number) })
      expect(r.pricePresets.at(-1)).toEqual({ min: expect.any(Number) })
      for (const p of r.pricePresets) for (const v of [p.min, p.max]) if (v !== undefined) expect(v % 50_000).toBe(0)
      expect((await json('/products?category=men')).pricePresets, 'too few products for ranges').toEqual([])
    }, 60_000)

    it('facets=0 leaves the facet queries out (fewer database queries)', async () => {
      await get('/products') // warm up
      const spy = vi.spyOn(t.pool, 'query')
      await get('/products?facets=0')
      const without = spy.mock.calls.length
      spy.mockClear()
      await get('/products?category=women')
      const withFacets = spy.mock.calls.length
      spy.mockRestore()
      expect(without).toBeGreaterThan(0)
      expect(withFacets - without).toBeGreaterThanOrEqual(6)
      const r = await json('/products?facets=0')
      expect(r.facets).toBeUndefined()
      expect(r.pricePresets).toBeUndefined()
      expect(r.total).toBe(6)
    }, 60_000)
  })

  describe('cursors', () => {
    /** Walks every page; returns the ids in order. @param {string} query @param {number} limit */
    async function walk(query, limit) {
      const seen = []
      let cursor = ''
      for (let i = 0; i < 40; i++) {
        const r = await json(`/products?${query}&limit=${limit}&facets=0${cursor ? `&cursor=${cursor}` : ''}`)
        seen.push(...r.items.map((/** @type {{ id: string }} */ x) => x.id))
        if (!r.nextCursor) return seen
        cursor = r.nextCursor
      }
      throw new Error('the walk did not end')
    }

    it('every sort visits every product exactly once, whatever the page size', async () => {
      for (const sort of ['newest', 'price_asc', 'price_desc', 'bestselling', 'featured']) {
        for (const limit of [1, 2, 4]) {
          const ids = await walk(`sort=${sort}`, limit)
          expect(new Set(ids).size, `${sort} ${limit}`).toBe(ids.length)
          expect(ids.length, `${sort} ${limit}`).toBe(6)
        }
      }
      expect((await walk('collection=eid', 1)).length).toBe(3)
      expect(await walk('collection=eid', 2), 'the collection’s own order').toEqual([d.silk.id, d.kurtaRed.id, d.shirt.id])
    }, 120_000)

    it('products with the same sort value are told apart by id, and the walk stays whole when a product is published mid-walk', async () => {
      const same = []
      for (const n of [1, 2, 3, 4]) same.push((await mk(`Tie ${n}`, { extra: true, stock: 3, price: 7777, at: '2026-08-01T00:00:00.000Z', sales: 3, category: d.men })).id)
      const first = await json('/products?sort=price_desc&limit=3&facets=0')
      const early = first.items.map((/** @type {{ id: string }} */ i) => i.id)
      const late = (await mk('Late arrival', { extra: true, stock: 3, price: 99999, at: '2026-09-30T00:00:00.000Z', category: d.men })).id
      const rest = []
      let cursor = first.nextCursor
      while (cursor) {
        const r = await json(`/products?sort=price_desc&limit=3&facets=0&cursor=${cursor}`)
        rest.push(...r.items.map((/** @type {{ id: string }} */ i) => i.id))
        cursor = r.nextCursor
      }
      const all = [...early, ...rest]
      expect(new Set(all).size).toBe(all.length)
      expect(all).not.toContain(late) // it belongs before the cursor: the walk neither repeats nor skips anything it had not reached
      for (const p of [d.kurtaRed, d.kurtaBlue, d.silk, d.lawn, d.bridal, d.shirt, ...same.map((id) => ({ id }))]) expect(all, p.id).toContain(p.id)
    }, 120_000)
  })

  describe('product detail', () => {
    it('answers by handle or id with everything the page needs', async () => {
      const r = await get('/products/cotton-kurta')
      expect(r.statusCode).toBe(200)
      expect(r.headers['cache-control']).toBe('public, s-maxage=60, stale-while-revalidate=600')
      const p = r.json()
      expect(p).toMatchObject({ id: d.kurtaRed.id, handle: 'cotton-kurta', kind: 'stitched', status: 'active', title: 'Cotton kurta', breadcrumb: [{ handle: 'women', name: 'Women' }, { handle: 'stitched', name: 'Stitched' }], sizeChartId: d.chart.id, colorway: { label: 'Red', family: 'red' } })
      expect(p.media.map((/** @type {{ alt: string }} */ m) => m.alt)).toEqual(['Cotton kurta front', 'Cotton kurta back'])
      expect(p.media[0]).toMatchObject({ kind: 'image', width: 900 })
      expect(p.options).toHaveLength(1)
      expect(p.options[0].values.map((/** @type {{ label: string }} */ v) => v.label)).toEqual(['S', 'M', 'L'])
      expect(p.variants.map((/** @type {{ sku: string }} */ v) => v.sku)).toEqual(['COTTONKURTA-S', 'COTTONKURTA-M', 'COTTONKURTA-L'])
      expect(p.variants.map((/** @type {{ stockStatus: string }} */ v) => v.stockStatus)).toEqual(['in_stock', 'sold_out', 'low_stock'])
      expect(p.variants[0]).toMatchObject({ price: pkr(3000), compareAt: pkr(4000), maxPerOrder: 10, available: 5, optionValueIds: [p.options[0].values[0].id] })
      expect(p.attributes).toEqual([{ label: 'Fabric', values: ['Cotton'] }])
      expect(p.siblings).toEqual([
        { handle: 'cotton-kurta-blue', label: 'Blue', swatch: { hex: ['#0000CC'] }, image: expect.objectContaining({ width: 900 }), current: false },
        { handle: 'cotton-kurta', label: 'Red', swatch: { hex: ['#CC0000'] }, image: expect.objectContaining({ width: 900 }), current: true },
      ])
      expect(p.delivery).toEqual({ etaMinDays: 3, etaMaxDays: 5, codAvailable: true, freeAbove: pkr(5000) })
      expect(p.badges).toContain('sale')
      expect(JSON.stringify(p)).not.toContain('onHand')
      expect(JSON.stringify(p)).not.toContain('reserved')
      expect((await json(`/products/${d.kurtaRed.id}`)).handle).toBe('cotton-kurta')
    }, 60_000)

    it('never says more than maxPerOrder is left, and shows enabled variants only', async () => {
      const shirt = await json('/products/men-shirt')
      expect(shirt.variants[0]).toMatchObject({ available: 2, maxPerOrder: 2 }) // four on hand
      const silk = await json('/products/silk-lawn-suit')
      expect(silk.variants[0]).toMatchObject({ available: 10, maxPerOrder: 10 })
      const made = await mk('Disabled variant', { extra: true, sizes: { S: 5, M: 5 }, category: d.men })
      const doc = await catalog.products.get(made.id)
      const input = { ...doc, variants: doc.variants.map((v, i) => ({ id: v.id, key: v.id, sku: v.sku, optionValueKeys: v.optionValueKeys, price: v.price, stockMode: v.stockMode, maxPerOrder: v.maxPerOrder, enabled: i === 0 })), media: doc.media.map((m) => ({ mediaId: m.mediaId, alt: m.alt })), options: doc.options.map((o) => ({ ...o, values: o.values.map((v) => ({ id: v.id, key: v.id, label: v.label, sizeSystemValueId: v.sizeSystemValueId })) })) }
      await catalog.products.save(ACTOR, made.id, /** @type {never} */ ({ ...input, categoryIds: [], attributes: [] }), REQ)
      expect((await json('/products/disabled-variant')).variants).toHaveLength(1)
    }, 90_000)

    it('a draft or archived product is 404; an unknown one too; an old handle says where it went', async () => {
      expect((await get('/products/draft-dress')).statusCode).toBe(404)
      expect((await get(`/products/${d.draft.id}`)).statusCode).toBe(404)
      expect((await get('/products/archived-dress')).statusCode).toBe(404)
      expect((await get('/products/no-such-thing')).statusCode).toBe(404)
      const made = await mk('Renamer', { extra: true, stock: 2, category: d.men })
      const doc = await catalog.products.get(made.id)
      await catalog.products.save(ACTOR, made.id, /** @type {never} */ ({ handle: 'renamed', status: 'active', kind: doc.kind, title: doc.title, primaryCategoryId: d.men, categoryIds: [], attributes: [], media: doc.media.map((m) => ({ mediaId: m.mediaId, alt: m.alt })), options: [], variants: doc.variants.map((v) => ({ id: v.id, key: v.id, sku: v.sku, optionValueKeys: [], price: v.price, stockMode: v.stockMode, maxPerOrder: v.maxPerOrder, enabled: true })), version: doc.version }), REQ)
      expect((await get('/products/renamer')).json()).toEqual({ redirectTo: 'renamed' })
      expect((await get('/products/renamed')).statusCode).toBe(200)
    }, 90_000)

    it('a preview token opens its own product in any status, for 15 minutes, uncached; it opens no other', async () => {
      setClock(new Date('2026-10-10T10:00:00.000Z'))
      const { url } = await catalog.products.previewLink(d.draft.id)
      const token = /** @type {string} */ (new URL(url).searchParams.get('preview'))
      const ok = await get(`/products/draft-dress?preview=${token}`)
      expect(ok.statusCode).toBe(200)
      expect(ok.headers['cache-control']).toBe('private, no-store')
      expect(ok.json()).toMatchObject({ handle: 'draft-dress', status: 'draft' })
      expect((await get(`/products/archived-dress?preview=${token}`)).statusCode, 'another product').toBe(404)
      expect((await get(`/products/draft-dress?preview=${token}x`)).statusCode).toBe(404)
      expect((await get('/products/draft-dress?preview=garbage')).statusCode).toBe(404)
      advanceClock(16 * 60_000)
      expect((await get(`/products/draft-dress?preview=${token}`)).statusCode).toBe(404)
    }, 60_000)

    it('a bundle carries its children in full; made-to-order says how long it takes; Urdu is used when asked', async () => {
      const bundle = await mk('Wedding set', { extra: true, kind: 'bundle', stock: 2, price: 20000, bundle: [d.silk.id, d.shirt.id], category: d.men })
      const b = await json('/products/wedding-set')
      expect(b.bundle.items.map((/** @type {{ product: { handle: string } }} */ i) => i.product.handle)).toEqual(['silk-lawn-suit', 'men-shirt'])
      expect(b.bundle.items[0].variants[0]).toMatchObject({ sku: 'SILKLAWNSUIT' })
      expect(b.bundle.items[0].options).toEqual([])
      expect(bundle.id).toBe(b.id)
      const mto = await json('/products/bridal-gown')
      expect(mto.madeToOrder).toEqual({ leadMinDays: 15, leadMaxDays: 20, label: 'Made for you in 15–20 days', returnable: false, depositPercent: 30 })
      expect(mto.variants[0].available).toBeUndefined()
      expect(mto.variants[0].stockStatus).toBe('made_to_order')
      expect((await json('/products/cotton-kurta?locale=ur')).title).toBe('کاٹن کرتا')
      expect((await json('/products/cotton-kurta?locale=en')).title).toBe('Cotton kurta')
      expect((await json('/products?locale=ur')).items.find((/** @type {{ handle: string }} */ i) => i.handle === 'cotton-kurta').title).toBe('کاٹن کرتا')
      expect((await get('/products/cotton-kurta?locale=fr')).statusCode).toBe(400)
    }, 90_000)

    it('related: the chosen ones first, then the best sellers of the category; no drafts, no self', async () => {
      const made = await mk('Has relations', { extra: true, stock: 2, category: d.unstitched, related: [d.shirt.id, d.draft.id] })
      const r = await json(`/products/${made.id}/related?limit=4`)
      expect(handles(r)).toEqual(['men-shirt', 'silk-lawn-suit', 'lawn-suit-3pc', 'bridal-gown'])
      expect(r.items.map((/** @type {{ id: string }} */ i) => i.id)).not.toContain(made.id)
      expect(handles(await json(`/products/${d.silk.id}/related?limit=8`))).toEqual(['lawn-suit-3pc', 'bridal-gown'].slice(0, 2).concat(handles(await json(`/products/${d.silk.id}/related?limit=8`)).slice(2)))
      expect((await get(`/products/${uuidv7()}/related`)).statusCode).toBe(404)
      expect((await get(`/products/${d.draft.id}/related`)).statusCode).toBe(404)
      expect((await get(`/products/${d.silk.id}/related?limit=3`)).statusCode).toBe(400)
    }, 90_000)
  })

  describe('archiving takes a product out of everything', () => {
    it('listing, related, siblings, sitemap and detail', async () => {
      const style = await mk('Twin one', { extra: true, stock: 2, category: d.men, style: 'twin', colorwayLabel: 'One', color: 'red' })
      const twin = await mk('Twin two', { extra: true, stock: 2, category: d.men, style: 'twin', colorwayLabel: 'Two', color: 'blue', sku: 'TWO' })
      expect((await json('/products/twin-one')).siblings.map((/** @type {{ handle: string }} */ s) => s.handle)).toEqual(['twin-one', 'twin-two'])
      const doc = await catalog.products.get(twin.id)
      await catalog.products.save(ACTOR, twin.id, /** @type {never} */ ({
        handle: doc.handle, status: 'archived', kind: doc.kind, title: doc.title, primaryCategoryId: d.men, categoryIds: [], attributes: [], styleId: 'twin', colorway: doc.colorway,
        media: doc.media.map((m) => ({ mediaId: m.mediaId, alt: m.alt })), options: [], variants: doc.variants.map((v) => ({ id: v.id, key: v.id, sku: v.sku, optionValueKeys: [], price: v.price, stockMode: v.stockMode, maxPerOrder: v.maxPerOrder, enabled: true })), version: doc.version,
      }), REQ)
      expect((await json('/products/twin-one')).siblings.map((/** @type {{ handle: string }} */ s) => s.handle)).toEqual(['twin-one'])
      expect(handles(await json('/products?category=men'))).not.toContain('twin-two')
      expect((await get('/products/twin-two')).statusCode).toBe(404)
      expect(handles(await json(`/products/${style.id}/related?limit=8`))).not.toContain('twin-two')
      const entries = (await json('/sitemap-entries')).items.map((/** @type {{ loc: string }} */ e) => e.loc)
      expect(entries).toContain('/p/twin-one')
      expect(entries).not.toContain('/p/twin-two')
    }, 90_000)
  })

  describe('categories', () => {
    it('serve the visible tree with live product counts, in order, hiding a hidden branch whole', async () => {
      const tree = (await json('/categories')).items
      expect(tree.map((/** @type {{ handle: string }} */ c) => c.handle)).toEqual(['women', 'men'])
      expect(tree[0]).toMatchObject({ handle: 'women', name: 'Women', productCount: 5 })
      expect(tree[0].children.map((/** @type {{ handle: string, productCount: number }} */ c) => [c.handle, c.productCount])).toEqual([['unstitched', 3], ['stitched', 2]])
      expect(tree[1].productCount).toBe(1)
      expect(JSON.stringify(tree)).not.toContain('secret')
      expect(JSON.stringify(tree), 'a branch with no live product is not offered').not.toContain('bare')
      expect((await get('/categories/bare')).statusCode, 'but its own page opens by address').toBe(200)
    }, 60_000)

    it('a category page knows its path, its children and its SEO text; hidden and unknown are 404; an old handle redirects', async () => {
      await t.db.update(categories).set({ seoTitle: 'Women’s clothing', description: 'All of it' }).where(eq(categories.id, d.women))
      const w = await json('/categories/women')
      expect(w).toMatchObject({ handle: 'women', description: 'All of it', breadcrumb: [{ handle: 'women', name: 'Women' }], children: [{ handle: 'unstitched', name: 'Unstitched' }, { handle: 'stitched', name: 'Stitched' }], seo: { title: 'Women’s clothing' } })
      expect((await json('/categories/stitched')).breadcrumb).toEqual([{ handle: 'women', name: 'Women' }, { handle: 'stitched', name: 'Stitched' }])
      expect((await get('/categories/secret')).statusCode).toBe(404)
      expect((await get('/categories/secret-kid')).statusCode).toBe(404)
      expect((await get('/categories/nothing')).statusCode).toBe(404)
      await t.db.insert(handleRedirects).values({ entityType: 'category', oldHandle: 'ladies', entityId: d.women, createdAt: new Date() })
      expect((await json('/categories/ladies'))).toEqual({ redirectTo: 'women' })
    }, 60_000)
  })

  describe('collections', () => {
    it('list the live ones, featured first, and filter featured', async () => {
      expect((await json('/collections')).items.map((/** @type {{ handle: string }} */ c) => c.handle)).toEqual(['eid'])
      expect((await json('/collections?featured=1')).items).toHaveLength(1)
      expect((await get('/collections?limit=25')).statusCode).toBe(400)
    }, 60_000)

    it('a collection page: details, a redirect for an old handle, 404 for draft or out-of-window ones', async () => {
      expect(await json('/collections/eid')).toMatchObject({ id: d.eid, handle: 'eid', title: 'Eid drop', seo: {} })
      expect((await get('/collections/hidden-drop')).statusCode).toBe(404)
      expect((await get('/collections/later')).statusCode).toBe(404)
      await t.db.insert(handleRedirects).values({ entityType: 'collection', oldHandle: 'eid-old', entityId: d.eid, createdAt: new Date() })
      expect(await json('/collections/eid-old')).toEqual({ redirectTo: 'eid' })
      setClock(new Date('2100-01-01T00:00:00.000Z'))
      expect((await get('/collections/later')).statusCode, 'its window has opened').toBe(200)
      expect((await json('/collections')).items.map((/** @type {{ handle: string }} */ c) => c.handle)).toContain('later')
    }, 60_000)
  })

  describe('size charts and forms', () => {
    it('are readable by anyone, and unknown ones are 404', async () => {
      expect((await json('/size-charts')).items).toEqual([expect.objectContaining({ id: d.chart.id, title: 'Kameez', unit: 'in' })])
      expect(await json(`/size-charts/${d.chart.id}`)).toMatchObject({ tables: [{ id: 'k', columns: ['Bust'], rows: [{ label: 'S', values: [34] }] }] })
      expect(await json(`/form-schemas/${d.form.id}`)).toMatchObject({ id: d.form.id, title: 'Custom', allowNotes: true, fields: [{ key: 'bust', label: 'Bust', type: 'number', required: true }] })
      expect((await get(`/size-charts/${uuidv7()}`)).statusCode).toBe(404)
      expect((await get(`/form-schemas/${uuidv7()}`)).statusCode).toBe(404)
      expect(JSON.stringify(await json('/size-charts'))).not.toContain('version')
    }, 60_000)
  })

  describe('back in stock', () => {
    const post = (/** @type {string} */ variantId, /** @type {object} */ body, ip = `10.88.${ipCounter++ % 250}.1`) => app.inject({ method: 'POST', url: `/api/v1/variants/${variantId}/stock-subscriptions`, payload: body, remoteAddress: ip })
    const store = async (/** @type {boolean} */ notifyMe) => {
      const { b } = await signedIn('owner')
      const cur = (await b.call('GET', '/admin/settings/store')).body
      const r = await b.call('PUT', '/admin/settings/store', { body: { value: { ...cur.value, features: { ...cur.value.features, notifyMe } }, version: cur.version } })
      expect(r.status, JSON.stringify(r.body)).toBe(200)
    }

    it('takes a phone for a sold-out variant, answers 204 each time, keeps one row, and refuses what has no point', async () => {
      await store(true)
      const lawnVariant = (await catalog.products.get(d.lawn.id)).variants[0]?.id ?? ''
      const inStock = (await catalog.products.get(d.silk.id)).variants[0]?.id ?? ''
      const mto = (await catalog.products.get(d.bridal.id)).variants[0]?.id ?? ''
      expect((await post(lawnVariant, { phone: '0300 1234567' })).statusCode).toBe(204)
      expect((await post(lawnVariant, { phone: '+92 300 1234567', locale: 'ur' })).statusCode).toBe(204)
      expect((await t.db.select().from(stockSubscriptions)).map((s) => s.phone)).toEqual(['+923001234567'])
      expect((await post(inStock, { phone: '0300 1111111' })).statusCode, 'in stock').toBe(409)
      expect((await post(mto, { phone: '0300 2222222' })).statusCode, 'made to order').toBe(409)
      expect((await post(uuidv7(), { phone: '0300 3333333' })).statusCode).toBe(404)
      expect((await post(lawnVariant, { phone: '12345' })).statusCode).toBe(400)
      expect((await post(lawnVariant, { phone: '0300 4444444', extra: 1 })).statusCode).toBe(400)
      const draftVariant = (await catalog.products.get(d.draft.id)).variants[0]?.id ?? ''
      expect((await post(draftVariant, { phone: '0300 5555555' })).statusCode, 'not a live product').toBe(404)
    }, 90_000)

    it('is switched off by the store setting, and a phone can ask for three variants a day', async () => {
      await store(false)
      const lawnVariant = (await catalog.products.get(d.lawn.id)).variants[0]?.id ?? ''
      expect((await post(lawnVariant, { phone: '0300 7654321' })).statusCode).toBe(404)
      await store(true)
      const sold = []
      for (const n of [1, 2, 3, 4]) sold.push((await mk(`Sold out ${n}`, { extra: true, stock: 0, category: d.men, sku: `SO${n}` })).id)
      const variantIds = await Promise.all(sold.map(async (id) => (await catalog.products.get(id)).variants[0]?.id ?? ''))
      const codes = []
      for (const v of variantIds) codes.push((await post(v, { phone: '0300 7654321' })).statusCode)
      expect(codes).toEqual([204, 204, 204, 429])
    }, 90_000)
  })

  describe('sitemap', () => {
    it('lists the live pages of the shop and nothing else, with the second-level pages paged', async () => {
      const { b } = await signedIn('owner')
      await b.call('POST', '/admin/pages', { body: { title: 'About', slug: 'about', bodyMd: 'Hi', status: 'active' } })
      await b.call('POST', '/admin/pages', { body: { title: 'Secret', slug: 'secret-page', bodyMd: 'Hi', status: 'draft' } })
      const r = await get('/sitemap-entries')
      expect(r.headers['cache-control']).toBe('public, s-maxage=3600')
      const entries = r.json().items
      const byType = (/** @type {string} */ type) => entries.filter((/** @type {{ type: string }} */ e) => e.type === type).map((/** @type {{ loc: string }} */ e) => e.loc)
      expect(byType('home')).toEqual(['/'])
      expect(byType('category').sort()).toEqual(['/c/men', '/c/stitched', '/c/unstitched', '/c/women'])
      expect(byType('collection')).toEqual(['/collections/eid'])
      expect(byType('product')).toEqual(['/p/bridal-gown', '/p/cotton-kurta', '/p/cotton-kurta-blue', '/p/lawn-suit-3pc', '/p/men-shirt', '/p/silk-lawn-suit'])
      expect(byType('page')).toEqual(['/pages/about'])
      expect(byType('facet').sort()).toEqual(['/c/women?attr.fabric=cotton', '/c/women?attr.fabric=lawn', '/c/women?attr.fabric=silk'])
      expect(entries.find((/** @type {{ loc: string }} */ e) => e.loc === '/p/cotton-kurta')).toMatchObject({ type: 'product', image: expect.stringContaining('/img/'), lastmod: expect.stringMatching(/Z$/) })
      expect(JSON.stringify(entries)).not.toMatch(/secret|draft|archived/)
      const first = await json('/sitemap-entries?limit=5')
      expect(first.items).toHaveLength(5)
      const rest = await json(`/sitemap-entries?limit=5000&cursor=${first.nextCursor}`)
      expect([...first.items, ...rest.items]).toEqual(entries)
      expect(rest.nextCursor).toBeUndefined()
      expect((await get('/sitemap-entries?limit=5001')).statusCode).toBe(400)
      await t.db.delete(pages)
    }, 90_000)
  })

  it('every public route is in the contract table with auth public (the storefront never needs a session)', async () => {
    const { routes } = await import('@noor/contract')
    for (const key of ['catalog.listProducts', 'catalog.getProduct', 'catalog.listRelated', 'catalog.listCategories', 'catalog.getCategory', 'catalog.listCollections', 'catalog.getCollection', 'catalog.listSizeCharts', 'catalog.getSizeChart', 'catalog.getFormSchema', 'catalog.subscribeBackInStock', 'seo.listSitemapEntries']) {
      expect(/** @type {Record<string, { auth: string }>} */ (routes)[key]?.auth, key).toBe('public')
    }
    expect(attributes).toBeTruthy()
    expect(sizeCharts).toBeTruthy()
    expect(shippingZones).toBeTruthy()
    expect(collections).toBeTruthy()
  })
})
