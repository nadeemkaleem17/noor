// M1-13: the seed builds a working shop, safely and repeatably (plan/14-devops.md section 5.2). Runs the real seed on a scratch database.
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { menus, pages, settings } from '../src/db/schema/content.js'
import { counters } from '../src/db/schema/platform.js'
import { couriers, cities, shippingMethods, shippingZoneCities, shippingZones } from '../src/db/schema/shipping.js'
import { products, collections } from '../src/db/schema/products.js'
import { productSearch, searchSynonyms } from '../src/db/schema/search.js'
import { sizeSystems } from '../src/db/schema/taxonomy.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { createServices } from '../src/modules/services.js'
import { runSeed } from '../src/seed/index.js'
import { app, closeHarness, config, createHarness, t } from './support/staff.js'
import { dbAvailable } from './support/db.js'

const tableCounts = async () => ({
  settings: (await t.db.select().from(settings)).length,
  menus: (await t.db.select().from(menus)).length,
  pages: (await t.db.select().from(pages)).length,
  cities: (await t.db.select().from(cities)).length,
  couriers: (await t.db.select().from(couriers)).length,
  zones: (await t.db.select().from(shippingZones)).length,
  zoneCities: (await t.db.select().from(shippingZoneCities)).length,
  sizeSystems: (await t.db.select().from(sizeSystems)).length,
  synonyms: (await t.db.select().from(searchSynonyms)).length,
  products: (await t.db.select().from(products)).length,
  collections: (await t.db.select().from(collections)).length,
  staff: (await t.db.select().from(staffUsers)).length,
  searchRows: (await t.db.select().from(productSearch)).length,
})
const get = (/** @type {string} */ url, ip = '10.55.0.1') => app.inject({ url: `/api/v1${url}`, remoteAddress: ip })

describe.skipIf(!dbAvailable)('seed (MySQL)', () => {
  /** @type {Awaited<ReturnType<typeof runSeed>>} */
  let first
  beforeAll(createHarness, 60_000)
  afterAll(closeHarness)

  describe('base layer', () => {
    it('creates what a shop needs, and nothing twice', async () => {
      const r = await runSeed({ db: t.migrate.db, config, flags: { baseOnly: true } })
      expect(r.owner).toBeUndefined()
      expect(r.base).toMatchObject({ settings: 5, pages: 5, zones: 2, sizeSystems: 2, couriers: 6 })
      const n = await tableCounts()
      expect(n).toMatchObject({ settings: 5, menus: 2, pages: 5, couriers: 6, zones: 2, sizeSystems: 2, products: 0, staff: 0 })
      expect(n.cities).toBeGreaterThanOrEqual(200)
      expect(n.zoneCities, 'every city is in a zone').toBe(n.cities)
      expect(n.synonyms).toBeGreaterThan(40)
      expect((await t.db.select().from(counters)).map((c) => [c.name, c.value]).sort()).toEqual([[`invoice_${new Date().getUTCFullYear()}`, 0], ['order_number', 10_000]])
      const locked = (await t.db.select().from(pages)).filter((p) => p.locked).map((p) => p.slug).sort()
      expect(locked).toEqual(['contact', 'privacy', 'shipping-returns', 'terms'])
      const zoneNames = (await t.db.select().from(shippingZones)).map((z) => z.name).sort()
      expect(zoneNames.every((z) => z.endsWith('(review fees before launch)'))).toBe(true)
      expect((await t.db.select().from(shippingMethods)).map((m) => [m.feeMinor, m.freeAboveMinor, m.etaMinDays, m.etaMaxDays]).sort()).toEqual([[25_000, 500_000, 3, 5], [35_000, 800_000, 4, 7]])

      const again = await runSeed({ db: t.migrate.db, config, flags: { baseOnly: true } })
      expect(again.base).toEqual({ settings: 0, pages: 0, zones: 0, sizeSystems: 0, cities: 0, couriers: 0, synonyms: 0 })
      expect(await tableCounts()).toEqual(n)
    }, 120_000)

    it('never overwrites what staff changed', async () => {
      await t.db.update(pages).set({ title: 'Our story' }).where(eq(pages.slug, 'about'))
      await t.db.update(settings).set({ version: 7 }).where(eq(settings.key, 'store'))
      await t.db.delete(menus).where(eq(menus.handle, 'footer'))
      await runSeed({ db: t.migrate.db, config, flags: { baseOnly: true } })
      expect((await t.db.select().from(pages).where(eq(pages.slug, 'about')))[0]?.title).toBe('Our story')
      expect((await t.db.select().from(settings).where(eq(settings.key, 'store')))[0]?.version).toBe(7)
      expect(await t.db.select().from(menus).where(eq(menus.handle, 'footer')), 'only what is missing is put back').toHaveLength(1)
    }, 60_000)

    it('is the only layer production accepts', async () => {
      const prod = { ...config, APP_ENV: /** @type {const} */ ('production') }
      await expect(runSeed({ db: t.migrate.db, config: prod })).rejects.toThrow(/refusing to seed demo data in production/)
      await expect(runSeed({ db: t.migrate.db, config: prod, flags: { perf: true } })).rejects.toThrow(/production/)
      expect((await runSeed({ db: t.migrate.db, config: prod, flags: { baseOnly: true } })).base).toBeDefined()
    }, 60_000)
  })

  describe('demo layer', () => {
    it('builds a shop that runs through the real services, and a second run changes nothing', async () => {
      first = await runSeed({ db: t.migrate.db, config })
      const owner = /** @type {{ email: string, password: string | null }} */ (first.owner)
      expect(owner.email).toBe('owner@rubaya.test')
      expect(owner.password).toMatch(/^[A-Za-z0-9_-]{16}$/)
      expect(first.demo).toMatchObject({ attributes: 4, categories: 8, sizeSystems: 2, charts: 1, forms: 1, collections: 3 })
      expect(/** @type {Record<string, number>} */ (first.demo).products).toBeGreaterThanOrEqual(20)

      const n = await tableCounts()
      expect(n.products).toBe(/** @type {Record<string, number>} */ (first.demo).products)
      expect(n.staff).toBe(1)
      expect(n.searchRows, 'every live product is searchable').toBe(n.products)
      const again = await runSeed({ db: t.migrate.db, config })
      expect(/** @type {{ password: string | null }} */ (again.owner).password).toBeNull()
      expect(Object.values(again.demo ?? {}).every((v) => v === 0)).toBe(true)
      expect(await tableCounts()).toEqual(n)
    }, 240_000)

    it('the owner can sign in (and is asked to set up two-factor)', async () => {
      const owner = /** @type {{ email: string, password: string }} */ (first.owner)
      const res = await app.inject({ method: 'POST', url: '/api/v1/admin/auth/login', headers: { origin: 'http://localhost:5173' }, remoteAddress: '10.55.0.2', payload: { email: owner.email, password: owner.password } })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ next: 'enrol_two_factor' })
    }, 60_000)

    it('stock adds up: every level equals its ledger', async () => {
      const services = createServices({ db: t.db, config })
      expect(await services.inventory.verify()).toEqual([])
    }, 60_000)

    it('the storefront reads it all through the public API', async () => {
      const list = (await get('/products?limit=10')).json()
      expect(list.total).toBeGreaterThanOrEqual(20)
      expect(list.items).toHaveLength(10)
      expect(list.nextCursor).toBeTruthy()
      expect(list.facets.map((/** @type {{ key: string }} */ f) => f.key)).toEqual(['kind', 'size', 'color', 'inStock'])
      const women = (await get('/products?category=women')).json()
      expect(women.facets.map((/** @type {{ key: string }} */ f) => f.key)).toEqual(expect.arrayContaining(['attr.fabric', 'attr.piece', 'attr.occasion']))
      const tree = (await get('/categories')).json().items
      expect(tree.map((/** @type {{ handle: string }} */ c) => c.handle)).toEqual(expect.arrayContaining(['women', 'footwear', 'men', 'kids']))
      expect(tree.find((/** @type {{ handle: string }} */ c) => c.handle === 'women').children.map((/** @type {{ handle: string }} */ c) => c.handle).sort()).toEqual(['bridal', 'stitched', 'unstitched'])
      const config_ = (await get('/store/config')).json()
      expect(config_).toMatchObject({ brand: { name: 'Rubaya' }, contact: { phone: '+92 300 1234567' }, shipping: { freeAboveFrom: { amount: 500_000 }, defaultEta: { minDays: 3, maxDays: 7 } } })
      const home = (await get('/content/home')).json()
      expect(home.heroSlides).toHaveLength(2)
      expect(home.heroSlides[0].image.src).toContain('/img/')
      const policy = (await get('/content/pages/shipping-returns')).json()
      expect(policy.bodyMd).toContain('Delivery from Rs. 250')
      expect(policy.bodyMd).toContain('over Rs. 5,000')
      expect(policy.bodyMd).toContain('within 7 days')
      expect((await get('/content/pages/contact')).json().bodyMd).toContain('+92 300 1234567')
      const menu = (await get('/content/menus/footer')).json()
      expect(menu.items.map((/** @type {{ href: string }} */ i) => i.href)).toContain('/pages/privacy')
      expect((await get('/collections')).json().items.map((/** @type {{ handle: string }} */ c) => c.handle).sort()).toEqual(['eid-edit', 'new-in', 'sale'])
      expect((await get('/collections/sale')).statusCode).toBe(200)
      expect((await get('/products?q=kurti')).json().total, 'a Roman-Urdu spelling finds the kurtas').toBeGreaterThan(2)
      expect((await get('/products?collection=eid-edit')).json().total).toBeGreaterThan(2)
      expect((await get('/cities-not-a-route')).statusCode).toBe(404)
      expect((await get('/shipping/cities')).json().items.length).toBeGreaterThanOrEqual(200)
    }, 60_000)

    it('the products look like a shop: sizes with stock, colourways, made to order with a custom size, unstitched sets with parts', async () => {
      const kurta = (await get('/products/cotton-kurta')).json()
      expect(kurta.options[0].values.map((/** @type {{ label: string }} */ v) => v.label)).toEqual(['XS', 'S', 'M', 'L', 'XL'])
      expect(kurta.variants.every((/** @type {{ available: number }} */ v) => v.available >= 0)).toBe(true)
      expect(kurta.sizeChartId).toBeTruthy()
      const lawn = (await get('/products/embroidered-lawn-3-piece')).json()
      expect(lawn.siblings.map((/** @type {{ label: string }} */ s) => s.label)).toEqual(['Maroon', 'Teal'])
      expect(lawn.components.map((/** @type {{ type: string }} */ c) => c.type)).toEqual(['shirt', 'trouser', 'dupatta'])
      const bridal = (await get('/products/bridal-lehnga-ivory')).json()
      expect(bridal.madeToOrder).toMatchObject({ leadMinDays: 15, depositPercent: 30 })
      expect(bridal.options[0].values.map((/** @type {{ kind: string }} */ v) => v.kind)).toContain('custom')
      expect(bridal.customSizeSchemaId).toBeTruthy()
      const sold = (await get('/products/khaddar-winter-3-piece')).json()
      expect(sold.variants[0].stockStatus).toBe('sold_out')
      const img = await app.inject({ url: new URL(kurta.media[0].src).pathname })
      expect(img.statusCode).toBe(200)
      expect(img.headers['content-type']).toMatch(/^image\//)
    }, 60_000)
  })
})
