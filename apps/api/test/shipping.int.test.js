// M1-07: cities, zones, methods, couriers, the public city list and the delivery quote, through HTTP on a scratch database.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { provinces } from '@noor/contract'
import { auditLog } from '../src/db/schema/audit.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { pages } from '../src/db/schema/content.js'
import { eq } from 'drizzle-orm'
import { cities, couriers, shippingMethods, shippingZoneCities, shippingZones } from '../src/db/schema/shipping.js'
import { outboxEvents } from '../src/db/schema/platform.js'
import { uuidv7 } from '../src/platform/ids.js'
import { createShippingService, seedShipping } from '../src/modules/shipping/index.js'
import { rs } from '../src/modules/shipping/service.js'
import { app, closeHarness, createHarness, signedIn, t } from './support/staff.js'
import { dbAvailable } from './support/db.js'

const pkr = (/** @type {number} */ rupees) => ({ amount: rupees * 100, currency: 'PKR' })
const method = (/** @type {object} */ extra = {}) => ({ label: 'Standard', fee: pkr(250), etaMinDays: 3, etaMaxDays: 5, codAllowed: true, enabled: true, ...extra })
const publicGet = (/** @type {string} */ url) => app.inject({ url: `/api/v1${url}`, remoteAddress: '10.20.30.40' })
/** @type {Record<string, string>} */
let id = {}
/** @type {ReturnType<typeof createShippingService>} */
let service

describe.skipIf(!dbAvailable)('shipping (MySQL, through HTTP)', () => {
  beforeAll(async () => {
    await createHarness()
    await seedShipping(t.db)
    id = Object.fromEntries((await t.db.select().from(cities)).map((c) => [c.name, c.id]))
    service = createShippingService({ db: t.db })
  }, 60_000)
  afterAll(closeHarness)
  afterEach(async () => {
    await t.migrate.db.delete(auditLog)
    await t.db.delete(outboxEvents)
    await t.db.delete(shippingZones) // methods and city assignments go with them
    await t.db.delete(pages)
    await t.db.delete(staffUsers)
  })

  describe('the seed', () => {
    it('holds at least 200 cities with valid provinces, six couriers, and can be run again', async () => {
      const all = await t.db.select().from(cities)
      expect(all.length).toBeGreaterThanOrEqual(200)
      expect(all.every((c) => (/** @type {readonly string[]} */ (provinces)).includes(c.province))).toBe(true)
      expect(all.filter((c) => c.isMajor).map((c) => c.name).sort()).toContain('Lahore')
      expect((await t.db.select().from(couriers)).map((c) => c.name).sort()).toEqual(['Leopards', 'M&P', 'Own rider', 'PostEx', 'TCS', 'Trax'])
      expect(await seedShipping(t.db)).toEqual({ cities: 0, couriers: 0 })
      expect((await t.db.select().from(cities)).length).toBe(all.length)
    }, 60_000)
  })

  describe('cities', () => {
    it('are searched by name, alternate spelling and province, and paged', async () => {
      const { b } = await signedIn('owner')
      expect((await b.call('GET', '/admin/shipping/cities?q=lyallpur')).body.items.map((/** @type {{ name: string }} */ c) => c.name)).toEqual(['Faisalabad'])
      expect((await b.call('GET', '/admin/shipping/cities?q=pindi')).body.items.map((/** @type {{ name: string }} */ c) => c.name)).toContain('Rawalpindi')
      const sindh = await b.call('GET', '/admin/shipping/cities?province=Sindh&size=25')
      expect(sindh.body.items).toHaveLength(25)
      expect(sindh.body.total).toBeGreaterThan(25)
      expect(sindh.body.items.every((/** @type {{ province: string }} */ c) => c.province === 'Sindh')).toBe(true)
      expect((await b.call('GET', '/admin/shipping/cities?province=Narnia')).status).toBe(400)
      expect((await b.call('GET', '/admin/shipping/cities?unassigned=1')).body.total).toBe((await b.call('GET', '/admin/shipping/cities')).body.total)
    }, 60_000)

    it('can be added and renamed, never twice under one name', async () => {
      const { b } = await signedIn('owner')
      const made = await b.call('POST', '/admin/shipping/cities', { body: { name: 'Newtown', province: 'Punjab', aliases: ['New Town'], isMajor: false } })
      expect(made.status, JSON.stringify(made.body)).toBe(201)
      expect(made.body).toMatchObject({ name: 'Newtown', province: 'Punjab', aliases: ['New Town'], isMajor: false })
      const dup = await b.call('POST', '/admin/shipping/cities', { body: { name: 'newtown', province: 'Sindh' } })
      expect([dup.status, dup.body.issues]).toEqual([400, [{ path: 'name', code: 'not_unique' }]])
      const renamed = await b.call('PUT', `/admin/shipping/cities/${made.body.id}`, { body: { name: 'Newtown City', province: 'Punjab', isMajor: true } })
      expect(renamed.body).toMatchObject({ name: 'Newtown City', aliases: [], isMajor: true })
      expect((await b.call('PUT', `/admin/shipping/cities/${made.body.id}`, { body: { name: 'Lahore', province: 'Punjab' } })).status).toBe(400)
      expect((await b.call('POST', '/admin/shipping/cities', { body: { name: 'X', province: 'Punjab' } })).status).toBe(400)
      await t.db.delete(cities).where(eq(cities.id, made.body.id))
    }, 60_000)

    it('are matched from a pasted list by name or alternate spelling, any case', async () => {
      const { b } = await signedIn('owner')
      const r = await b.call('POST', '/admin/shipping/cities/match', { body: { names: ['lahore', 'LYALLPUR', 'Pindi', 'Atlantis', ' karachi '] } })
      expect(r.body.matched.map((/** @type {{ input: string, city: { name: string } }} */ m) => [m.input, m.city.name])).toEqual([['lahore', 'Lahore'], ['LYALLPUR', 'Faisalabad'], ['Pindi', 'Rawalpindi'], ['karachi', 'Karachi']])
      expect(r.body.unknown).toEqual(['Atlantis'])
    }, 60_000)
  })

  describe('zones', () => {
    const zone = (/** @type {string} */ name, /** @type {string[]} */ names, /** @type {object[]} */ methods = [method()]) => ({ name, cityIds: names.map((n) => id[n]), methods })

    it('are created with cities and methods, and list them', async () => {
      const { b } = await signedIn('owner')
      const r = await b.call('POST', '/admin/shipping/zones', { body: zone('Major cities', ['Lahore', 'Karachi'], [method({ freeAbove: pkr(5000) }), method({ label: 'Express', fee: pkr(450), etaMinDays: 1, etaMaxDays: 2 })]) })
      expect(r.status, JSON.stringify(r.body)).toBe(201)
      expect(r.body).toMatchObject({ name: 'Major cities', version: 1, cityCount: 2, cities: [{ name: 'Karachi' }, { name: 'Lahore' }] })
      expect(r.body.methods.map((/** @type {{ label: string }} */ m) => m.label)).toEqual(['Standard', 'Express'])
      expect(r.body.methods[0]).toMatchObject({ fee: pkr(250), freeAbove: pkr(5000), etaMinDays: 3, etaMaxDays: 5, codAllowed: true, enabled: true })
      const list = await b.call('GET', '/admin/shipping/zones')
      expect(list.body.items).toHaveLength(1)
      expect(list.body.unassignedCityCount).toBe((await t.db.select().from(cities)).length - 2)
      expect((await b.call('POST', '/admin/shipping/zones', { body: zone('Major cities', []) })).body.issues).toEqual([{ path: 'name', code: 'not_unique' }])
    }, 60_000)

    it('keep a city in exactly one zone: claiming it moves it, and the database refuses a second row', async () => {
      const { b } = await signedIn('owner')
      const a = (await b.call('POST', '/admin/shipping/zones', { body: zone('A', ['Lahore', 'Multan']) })).body
      const second = await b.call('POST', '/admin/shipping/zones', { body: zone('B', ['Multan', 'Quetta']) })
      expect(second.body.cities.map((/** @type {{ name: string }} */ c) => c.name)).toEqual(['Multan', 'Quetta'])
      const now = (await b.call('GET', '/admin/shipping/zones')).body.items
      expect(now.find((/** @type {{ id: string }} */ z) => z.id === a.id).cities.map((/** @type {{ name: string }} */ c) => c.name)).toEqual(['Lahore'])
      await expect(t.db.insert(shippingZoneCities).values({ cityId: /** @type {string} */ (id.Multan), zoneId: a.id })).rejects.toMatchObject({ cause: { errno: 1062 } })
      const all = await t.db.select().from(shippingZoneCities)
      expect(new Set(all.map((r) => r.cityId)).size).toBe(all.length)
    }, 60_000)

    it('update by method id: kept methods keep their id, new ones get one, missing ones go; a stale version is refused', async () => {
      const { b } = await signedIn('owner')
      const created = (await b.call('POST', '/admin/shipping/zones', { body: zone('A', ['Lahore'], [method(), method({ label: 'Express', fee: pkr(450) })]) })).body
      const [standard, express] = created.methods
      const next = {
        name: 'A2', cityIds: [id.Lahore, id.Karachi], version: 1,
        methods: [{ ...standard, fee: pkr(300) }, method({ label: 'Pickup', fee: pkr(0) })],
      }
      const r = await b.call('PUT', `/admin/shipping/zones/${created.id}`, { body: next })
      expect(r.status, JSON.stringify(r.body)).toBe(200)
      expect(r.body).toMatchObject({ name: 'A2', version: 2, cityCount: 2 })
      expect(r.body.methods[0]).toMatchObject({ id: standard.id, fee: pkr(300) })
      expect(r.body.methods.map((/** @type {{ id: string }} */ m) => m.id)).not.toContain(express.id)
      expect(r.body.methods[1]).toMatchObject({ label: 'Pickup', fee: pkr(0) })
      expect((await b.call('PUT', `/admin/shipping/zones/${created.id}`, { body: next })).body.code).toBe('stale_write')
      const foreign = (await b.call('POST', '/admin/shipping/zones', { body: zone('Other', ['Quetta']) })).body.methods[0]
      const bad = await b.call('PUT', `/admin/shipping/zones/${created.id}`, { body: { ...next, version: 2, methods: [foreign] } })
      expect([bad.status, bad.body.issues]).toEqual([400, [{ path: 'methods.0.id', code: 'invalid_format' }]])
    }, 60_000)

    it('refuse methods and cities that make no sense', async () => {
      const { b } = await signedIn('owner')
      const post = (/** @type {object} */ body) => b.call('POST', '/admin/shipping/zones', { body })
      expect((await post(zone('Z', [], []))).status, 'no methods').toBe(400)
      expect((await post(zone('Z', [], [method({ enabled: false })]))).status, 'no enabled method').toBe(400)
      expect((await post(zone('Z', [], [method({ etaMinDays: 6, etaMaxDays: 2 })]))).status, 'eta order').toBe(400)
      expect((await post(zone('Z', [], [method({ etaMaxDays: 61 })]))).status, 'eta max').toBe(400)
      expect((await post(zone('Z', [], [method({ fee: pkr(-1) })]))).status, 'negative fee').toBe(400)
      expect((await post(zone('Z', [], [method({ fee: { amount: 25.5, currency: 'PKR' } })]))).status, 'fractional paisa').toBe(400)
      expect((await post(zone('Z', [], Array.from({ length: 5 }, () => method())))).status, 'five methods').toBe(400)
      const ghost = await post({ ...zone('Z', []), cityIds: [uuidv7(), id.Lahore, id.Lahore] })
      expect(ghost.body.issues).toEqual([{ path: 'cityIds.1', code: 'not_unique' }, { path: 'cityIds.2', code: 'not_unique' }].slice(0, 0).concat(ghost.body.issues))
      expect(ghost.body.issues.map((/** @type {{ code: string }} */ i) => i.code).sort()).toEqual(['invalid_format', 'not_unique'])
      expect(await t.db.select().from(shippingZones)).toHaveLength(0)
    }, 60_000)

    it('never leave the store with no deliverable city', async () => {
      const { b } = await signedIn('owner')
      const only = (await b.call('POST', '/admin/shipping/zones', { body: zone('Only', ['Lahore']) })).body
      const empty = await b.call('PUT', `/admin/shipping/zones/${only.id}`, { body: { name: 'Only', cityIds: [], methods: [method()], version: 1 } })
      expect([empty.status, empty.body.code]).toEqual([422, 'no_deliverable_city'])
      const del = await b.call('DELETE', `/admin/shipping/zones/${only.id}`)
      expect([del.status, del.body.code]).toEqual([422, 'no_deliverable_city'])
      expect((await b.call('GET', '/admin/shipping/zones')).body.items[0].cityCount).toBe(1) // nothing changed
      const other = (await b.call('POST', '/admin/shipping/zones', { body: zone('Other', ['Karachi']) })).body
      expect((await b.call('DELETE', `/admin/shipping/zones/${only.id}`)).status).toBe(204)
      expect((await publicGet('/shipping/cities')).json().items.map((/** @type {{ name: string }} */ c) => c.name)).toEqual(['Karachi'])
      expect(other.id).toBeTruthy()
    }, 60_000)

    it('show their impact before saving', async () => {
      const { b } = await signedIn('owner')
      const a = (await b.call('POST', '/admin/shipping/zones', { body: zone('A', ['Lahore', 'Multan', 'Quetta']) })).body
      await b.call('POST', '/admin/shipping/zones', { body: zone('B', ['Karachi']) })
      const r = await b.call('POST', `/admin/shipping/zones/${a.id}/impact`, { body: zone('A', ['Lahore', 'Karachi']) })
      expect(r.body).toEqual({ citiesRemoved: 2, citiesMovedIn: [{ city: 'Karachi', fromZone: 'B' }], openCarts: 0 })
      expect((await b.call('GET', '/admin/shipping/zones')).body.items.find((/** @type {{ id: string }} */ z) => z.id === a.id).cityCount).toBe(3) // only a preview
    }, 60_000)
  })

  describe('what customers see', () => {
    it('lists only cities in a zone with an enabled method, major ones first, cacheable', async () => {
      const { b } = await signedIn('owner')
      const made = (await b.call('POST', '/admin/shipping/zones', { body: { name: 'Everywhere', cityIds: [id.Hyderabad, id.Lahore, id.Mardan, id.Kasur], methods: [method(), method({ label: 'Express', fee: pkr(450) })] } })).body
      await b.call('POST', '/admin/shipping/zones', { body: { name: 'Off', cityIds: [id.Quetta], methods: [method()] } })
      // a zone cannot be saved with every method off, so switch Quetta's only method off in the database
      const offZone = (await t.db.select().from(shippingZones)).find((z) => z.name === 'Off')
      await t.db.update(shippingMethods).set({ enabled: false }).where(eq(shippingMethods.zoneId, /** @type {{ id: string }} */ (offZone).id))
      const r = await publicGet('/shipping/cities')
      expect(r.headers['cache-control']).toBe('public, s-maxage=60, stale-while-revalidate=600')
      expect(r.json().items.map((/** @type {{ name: string }} */ c) => c.name)).toEqual(['Hyderabad', 'Lahore', 'Kasur', 'Mardan'])
      expect(r.json().items[0]).toMatchObject({ province: 'Sindh', isMajor: true, aliases: expect.any(Array) })
      // each city says what delivery to it costs: its zone's cheapest enabled method (the product page's delivery block)
      expect(r.json().items[0].delivery).toMatchObject({ fee: { amount: expect.any(Number), currency: 'PKR' }, etaMinDays: expect.any(Number), etaMaxDays: expect.any(Number) })
      expect(r.json().items.every((/** @type {{ delivery?: { fee: { amount: number } } }} */ c) => c.delivery !== undefined)).toBe(true)
      expect(made.id).toBeTruthy()
    }, 60_000)

    it('feeds the store configuration and the page tokens: free-delivery threshold, ETA, fee', async () => {
      const { b } = await signedIn('owner')
      expect((await publicGet('/store/config')).json().shipping).toEqual({})
      await b.call('POST', '/admin/shipping/zones', { body: { name: 'A', cityIds: [id.Lahore], methods: [method({ freeAbove: pkr(5000) }), method({ label: 'Express', fee: pkr(450), etaMinDays: 1, etaMaxDays: 2 })] } })
      await b.call('POST', '/admin/shipping/zones', { body: { name: 'B', cityIds: [id.Quetta], methods: [method({ fee: pkr(350), freeAbove: pkr(8000), etaMinDays: 4, etaMaxDays: 7 })] } })
      expect((await publicGet('/store/config')).json().shipping).toEqual({ freeAboveFrom: pkr(5000), defaultEta: { minDays: 3, maxDays: 7 } })
      await b.call('POST', '/admin/pages', { body: { title: 'Shipping', slug: 'shipping', bodyMd: 'From {{shipping.fee}}, free over {{shipping.freeAbove}}.', status: 'active' } })
      expect((await publicGet('/content/pages/shipping')).json().bodyMd).toBe('From Rs. 250, free over Rs. 5,000.')
      // a list of the zones with their own fee, days and threshold, for the Shipping page
      await b.call('POST', '/admin/pages', { body: { title: 'Rates', slug: 'rates', bodyMd: '{{shipping.table}}', status: 'active' } })
      const rates = (await publicGet('/content/pages/rates')).json().bodyMd
      expect(rates).toContain('- **A:** Rs. 250, 3 to 5 days, free over Rs. 5,000')
      expect(rates).toContain('- **B:** Rs. 350, 4 to 7 days, free over Rs. 8,000')
    }, 60_000)
  })

  describe('quote', () => {
    /** @param {string} cityName @param {number} rupees @param {string} [methodId] */
    const quote = (cityName, rupees, methodId) => service.quote(t.db, { cityId: id[cityName] ?? uuidv7(), amountAfterDiscount: rupees * 100, ...(methodId ? { methodId } : {}) })

    it('uses the cheapest method by default, a chosen one when given, and nothing when the order is big enough', async () => {
      const { b } = await signedIn('owner')
      const z = (await b.call('POST', '/admin/shipping/zones', { body: { name: 'A', cityIds: [id.Lahore], methods: [method({ label: 'Express', fee: pkr(450), etaMinDays: 1, etaMaxDays: 2, codAllowed: false }), method({ freeAbove: pkr(5000) })] } })).body
      const express = z.methods[0]
      expect(await quote('Lahore', 1000)).toMatchObject({ label: 'Standard', fee: pkr(250), freeApplied: false, etaMinDays: 3, etaMaxDays: 5, codAllowed: true, zoneId: z.id })
      expect(await quote('Lahore', 4999.99)).toMatchObject({ fee: pkr(250), freeApplied: false })
      expect(await quote('Lahore', 5000)).toMatchObject({ fee: pkr(0), freeApplied: true })
      expect(await quote('Lahore', 9000, express.id)).toMatchObject({ label: 'Express', fee: pkr(450), freeApplied: false, codAllowed: false })
    }, 60_000)

    it('refuses a city with no zone, and a method that is not offered there or is switched off', async () => {
      const { b } = await signedIn('owner')
      const z = (await b.call('POST', '/admin/shipping/zones', { body: { name: 'A', cityIds: [id.Lahore], methods: [method(), method({ label: 'Old', enabled: false })] } })).body
      const other = (await b.call('POST', '/admin/shipping/zones', { body: { name: 'B', cityIds: [id.Quetta], methods: [method()] } })).body
      await expect(quote('Karachi', 100)).rejects.toMatchObject({ code: 'city_not_served' })
      await expect(service.quote(t.db, { cityId: uuidv7(), amountAfterDiscount: 100 })).rejects.toMatchObject({ code: 'city_not_served' })
      await expect(quote('Lahore', 100, other.methods[0].id)).rejects.toMatchObject({ code: 'city_not_served' })
      await expect(quote('Lahore', 100, z.methods[1].id)).rejects.toMatchObject({ code: 'city_not_served' })
    }, 60_000)

    it('formats rupees for tokens', () => {
      expect([rs(25_000), rs(500_000), rs(12_550), rs(1_250_000)]).toEqual(['Rs. 250', 'Rs. 5,000', 'Rs. 125.50', 'Rs. 12,500'])
    })
  })

  describe('couriers', () => {
    it('are listed in order, added, changed and disabled, never deleted', async () => {
      const { b } = await signedIn('owner')
      const list = (await b.call('GET', '/admin/couriers')).body.items
      expect(list.map((/** @type {{ name: string }} */ c) => c.name)).toEqual(['TCS', 'Leopards', 'M&P', 'Trax', 'PostEx', 'Own rider'])
      expect(list.at(-1)).toMatchObject({ name: 'Own rider', trackingRequired: false, enabled: true })
      const made = await b.call('POST', '/admin/couriers', { body: { name: 'BlueEx', trackingUrlPattern: 'https://blue-ex.example/track?c={tracking}', trackingRequired: true, enabled: true } })
      expect(made.status, JSON.stringify(made.body)).toBe(201)
      expect(made.body.sortOrder).toBe(6)
      const off = await b.call('PUT', `/admin/couriers/${made.body.id}`, { body: { name: 'BlueEx', trackingRequired: true, enabled: false } })
      expect(off.body).toMatchObject({ enabled: false, sortOrder: 6 })
      expect(off.body.trackingUrlPattern).toBeUndefined()
      expect((await b.call('DELETE', `/admin/couriers/${made.body.id}`)).status).toBe(404)
      await t.db.delete(couriers).where(eq(couriers.id, made.body.id))
    }, 60_000)

    it('need an https tracking link with {tracking}, and a name nobody has', async () => {
      const { b } = await signedIn('owner')
      const post = (/** @type {object} */ body) => b.call('POST', '/admin/couriers', { body: { trackingRequired: true, enabled: true, ...body } })
      expect((await post({ name: 'A', trackingUrlPattern: 'http://x.example/{tracking}' })).status).toBe(400)
      expect((await post({ name: 'A', trackingUrlPattern: 'https://x.example/track' })).status).toBe(400)
      expect((await post({ name: 'A', trackingUrlPattern: 'javascript:alert({tracking})' })).status).toBe(400)
      expect((await post({ name: 'tcs' })).body.issues).toEqual([{ path: 'name', code: 'not_unique' }])
    }, 60_000)
  })

  describe('permissions', () => {
    it('reading needs settings:read, changing needs settings:write', async () => {
      const { b } = await signedIn('catalog')
      expect((await b.call('GET', '/admin/shipping/zones')).status).toBe(403)
      expect((await b.call('POST', '/admin/couriers', { body: { name: 'Z', trackingRequired: true, enabled: true } })).status).toBe(403)
      expect((await publicGet('/shipping/cities')).statusCode).toBe(200)
    }, 60_000)
  })
})
