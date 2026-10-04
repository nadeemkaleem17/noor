// M1-08: categories, attributes, size systems, size charts and custom-size forms, through HTTP on a scratch database.
// Products do not exist yet, so "in use by products" is tested with a stand-in `usage` handed to the service directly.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { auditLog } from '../src/db/schema/audit.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { media } from '../src/db/schema/media.js'
import { outboxEvents } from '../src/db/schema/platform.js'
import { attributes, formSchemas, handleRedirects, sizeCharts, sizeSystems } from '../src/db/schema/taxonomy.js'
import { uuidv7 } from '../src/platform/ids.js'
import { createCatalogService } from '../src/modules/catalog/index.js'
import { noUsage } from '../src/modules/catalog/common.js'
import { closeHarness, createHarness, signedIn, t } from './support/staff.js'
import { dbAvailable } from './support/db.js'

const REQ = { ip: '10.0.0.1', userAgent: 'vitest', requestId: '0190f2c0-0000-7000-8000-000000000001' }
const noMedia = { imagesFor: async () => ({}) }
const category = (/** @type {string} */ handle, /** @type {object} */ extra = {}) => ({ name: handle[0]?.toUpperCase() + handle.slice(1), handle, visible: true, attributes: [], ...extra })
const attribute = (/** @type {string} */ code, /** @type {object} */ extra = {}) => ({ code, label: code, type: /** @type {'enum' | 'number' | 'boolean' | 'color'} */ ('enum'), display: /** @type {'checkbox' | 'swatch' | 'buttons' | 'range'} */ ('checkbox'), filterable: true, values: [{ code: 'a', label: 'A' }, { code: 'b', label: 'B' }], ...extra })

describe.skipIf(!dbAvailable)('catalog structure (MySQL, through HTTP)', () => {
  beforeAll(createHarness, 60_000)
  afterAll(closeHarness)
  afterEach(async () => {
    await t.migrate.db.delete(auditLog)
    await t.db.delete(outboxEvents)
    await t.db.delete(handleRedirects)
    // leaves first: a category points at its parent
    for (let i = 0; i < 4; i++) await t.migrate.pool.query('DELETE c FROM categories c LEFT JOIN categories k ON k.parent_id = c.id WHERE k.id IS NULL')
    await t.db.delete(attributes)
    await t.db.delete(sizeCharts)
    await t.db.delete(sizeSystems)
    await t.db.delete(formSchemas)
    await t.db.delete(media)
    await t.db.delete(staffUsers)
  })

  describe('categories', () => {
    it('are created in a tree no deeper than three levels, in sibling order, with their filters', async () => {
      const { b } = await signedIn('catalog')
      const filter = (await b.call('POST', '/admin/attributes', { body: attribute('fabric') })).body
      const women = await b.call('POST', '/admin/categories', { body: category('women', { description: 'Everything', seo: { title: 'Women' }, attributes: [{ attributeId: filter.id, seoIndexable: true, required: false }] }) })
      expect(women.status, JSON.stringify(women.body)).toBe(201)
      expect(women.body).toMatchObject({ handle: 'women', parentId: null, sortOrder: 0, productCount: 0, version: 1, attributes: [{ attributeId: filter.id, seoIndexable: true, required: false }] })
      const unstitched = (await b.call('POST', '/admin/categories', { body: category('unstitched', { parentId: women.body.id }) })).body
      const lawn = (await b.call('POST', '/admin/categories', { body: category('lawn', { parentId: unstitched.id }) })).body
      const second = (await b.call('POST', '/admin/categories', { body: category('men') })).body
      expect(second.sortOrder).toBe(1)
      const tooDeep = await b.call('POST', '/admin/categories', { body: category('summer', { parentId: lawn.id }) })
      expect([tooDeep.status, tooDeep.body.issues]).toEqual([400, [{ path: 'parentId', code: 'too_big' }]])
      expect((await b.call('POST', '/admin/categories', { body: category('women') })).body.code).toBe('handle_taken')
      expect((await b.call('POST', '/admin/categories', { body: category('x', { parentId: uuidv7() }) })).body.issues).toEqual([{ path: 'parentId', code: 'invalid_format' }])
      const list = (await b.call('GET', '/admin/categories')).body.items
      expect(list.map((/** @type {{ handle: string }} */ c) => c.handle)).toEqual(['lawn', 'unstitched', 'women', 'men']) // by sort order, then name; the client builds the tree from parentId
      expect(Object.fromEntries(list.map((/** @type {{ handle: string, parentId: string | null }} */ c) => [c.handle, c.parentId]))).toEqual({ women: null, men: null, unstitched: women.body.id, lawn: unstitched.id })
    }, 60_000)

    it('accept only filterable attributes, each once, and an image that is ready', async () => {
      const { b } = await signedIn('catalog')
      const filterable = (await b.call('POST', '/admin/attributes', { body: attribute('fabric') })).body
      const plain = (await b.call('POST', '/admin/attributes', { body: attribute('note', { filterable: false }) })).body
      const entry = (/** @type {string} */ id) => ({ attributeId: id, seoIndexable: false, required: false })
      expect((await b.call('POST', '/admin/categories', { body: category('a', { attributes: [entry(plain.id)] }) })).body.issues).toEqual([{ path: 'attributes.0.attributeId', code: 'invalid_format' }])
      expect((await b.call('POST', '/admin/categories', { body: category('a', { attributes: [entry(filterable.id), entry(filterable.id)] }) })).body.issues).toEqual([{ path: 'attributes.1.attributeId', code: 'not_unique' }])
      expect((await b.call('POST', '/admin/categories', { body: category('a', { attributes: [entry(uuidv7())] }) })).status).toBe(400)
      const pending = uuidv7()
      await t.db.insert(media).values({ id: pending, kind: 'image', status: 'pending', objectKey: `media/2026/10/${pending}.jpg`, contentType: 'image/jpeg', bytes: 1, alt: '', createdAt: new Date() })
      const notReady = await b.call('POST', '/admin/categories', { body: category('a', { imageMediaId: pending }) })
      expect([notReady.status, notReady.body.code]).toEqual([409, 'media_not_ready'])
      const ready = uuidv7()
      await t.db.insert(media).values({ id: ready, kind: 'image', status: 'ready', objectKey: `media/2026/10/${ready}.jpg`, contentType: 'image/jpeg', bytes: 1, width: 800, height: 600, alt: 'Tile', createdAt: new Date() })
      const ok = await b.call('POST', '/admin/categories', { body: category('a', { imageMediaId: ready }) })
      expect(ok.body.image).toMatchObject({ width: 800, alt: 'Tile' })
    }, 60_000)

    it('are edited with the version; a new handle leaves a redirect; moving never makes a cycle or a fourth level', async () => {
      const { b } = await signedIn('catalog')
      const a = (await b.call('POST', '/admin/categories', { body: category('a') })).body
      const child = (await b.call('POST', '/admin/categories', { body: category('child', { parentId: a.id }) })).body
      const grand = (await b.call('POST', '/admin/categories', { body: category('grand', { parentId: child.id }) })).body
      const other = (await b.call('POST', '/admin/categories', { body: category('other') })).body
      const renamed = await b.call('PUT', `/admin/categories/${a.id}`, { body: { ...category('a2'), version: 1 } })
      expect(renamed.body).toMatchObject({ handle: 'a2', version: 2 })
      expect(await t.db.select().from(handleRedirects)).toMatchObject([{ entityType: 'category', oldHandle: 'a', entityId: a.id }])
      expect((await b.call('PUT', `/admin/categories/${a.id}`, { body: { ...category('a2'), version: 1 } })).body.code).toBe('stale_write')
      const cycle = await b.call('PUT', `/admin/categories/${a.id}`, { body: { ...category('a2'), parentId: grand.id, version: 2 } })
      expect(cycle.body.issues).toEqual([{ path: 'parentId', code: 'invalid_format' }])
      const self = await b.call('PUT', `/admin/categories/${a.id}`, { body: { ...category('a2'), parentId: a.id, version: 2 } })
      expect(self.status).toBe(400)
      const deep = await b.call('PUT', `/admin/categories/${other.id}`, { body: { ...category('other'), parentId: grand.id, version: 1 } })
      expect(deep.body.issues).toEqual([{ path: 'parentId', code: 'too_big' }])
      const subtree = await b.call('PUT', `/admin/categories/${a.id}`, { body: { ...category('a2'), parentId: other.id, version: 2 } })
      expect(subtree.status, 'a three-level subtree under a top-level parent is four levels').toBe(400)
      const moved = await b.call('PUT', `/admin/categories/${grand.id}`, { body: { ...category('grand'), parentId: other.id, version: 1 } })
      expect(moved.body).toMatchObject({ parentId: other.id, sortOrder: 0 })
      const taking = await b.call('POST', '/admin/categories', { body: category('a') }) // the old handle is free again, and the redirect goes
      expect(taking.status).toBe(201)
      expect(await t.db.select().from(handleRedirects)).toEqual([])
    }, 60_000)

    it('are reordered among their siblings only, and the order sticks', async () => {
      const { b } = await signedIn('catalog')
      const ids = []
      for (const h of ['a', 'b', 'c']) ids.push((await b.call('POST', '/admin/categories', { body: category(h) })).body.id)
      const reversed = [...ids].reverse()
      expect((await b.call('POST', '/admin/categories/reorder', { body: { parentId: null, orderedIds: reversed } })).status).toBe(204)
      expect((await b.call('GET', '/admin/categories')).body.items.map((/** @type {{ handle: string }} */ c) => c.handle)).toEqual(['c', 'b', 'a'])
      for (const bad of [[ids[0]], [...ids, uuidv7()], [ids[0], ids[0], ids[1]]]) expect((await b.call('POST', '/admin/categories/reorder', { body: { parentId: null, orderedIds: bad } })).status).toBe(400)
      const kid = (await b.call('POST', '/admin/categories', { body: category('kid', { parentId: ids[0] }) })).body.id
      expect((await b.call('POST', '/admin/categories/reorder', { body: { parentId: ids[0], orderedIds: [ids[1]] } })).status, 'not a child of that parent').toBe(400)
      expect((await b.call('POST', '/admin/categories/reorder', { body: { parentId: ids[0], orderedIds: [kid] } })).status).toBe(204)
    }, 60_000)

    it('cannot be deleted with children or products; the answer says how many', async () => {
      const { b, user } = await signedIn('catalog')
      const a = (await b.call('POST', '/admin/categories', { body: category('a') })).body
      const kid = (await b.call('POST', '/admin/categories', { body: category('kid', { parentId: a.id }) })).body
      const withKids = await b.call('DELETE', `/admin/categories/${a.id}`)
      expect([withKids.status, withKids.body.code, withKids.body.usedBy]).toEqual([409, 'in_use', { children: 1, products: 0 }])
      const stocked = createCatalogService({ db: t.db, media: noMedia, usage: { ...noUsage, categoryPrimary: async () => 3 } })
      await expect(stocked.categories.remove({ staffId: user.id, name: 'x', role: 'owner' }, kid.id, REQ)).rejects.toMatchObject({ code: 'in_use', details: { usedBy: { children: 0, products: 3 } } })
      expect((await b.call('DELETE', `/admin/categories/${kid.id}`)).status).toBe(204)
      expect((await b.call('DELETE', `/admin/categories/${a.id}`)).status).toBe(204)
      expect((await b.call('DELETE', `/admin/categories/${a.id}`)).status).toBe(404)
    }, 60_000)

    it('show the product count their usage reports, and filters are inherited from the nearest ancestor that has some', async () => {
      const { b } = await signedIn('catalog')
      const attr = (await b.call('POST', '/admin/attributes', { body: attribute('fabric') })).body
      const top = (await b.call('POST', '/admin/categories', { body: category('top', { attributes: [{ attributeId: attr.id, seoIndexable: false, required: true }] }) })).body
      const mid = (await b.call('POST', '/admin/categories', { body: category('mid', { parentId: top.id }) })).body
      const leaf = (await b.call('POST', '/admin/categories', { body: category('leaf', { parentId: mid.id }) })).body
      const svc = createCatalogService({ db: t.db, media: noMedia, usage: { ...noUsage, categoryProducts: async (ids) => new Map(ids.map((id) => [id, id === top.id ? 7 : 0])) } })
      expect((await svc.categories.list()).items.find((c) => c.id === top.id)?.productCount).toBe(7)
      expect(await svc.categories.effectiveFilters(leaf.id)).toEqual([{ attributeId: attr.id, seoIndexable: false, required: true }])
      const other = (await b.call('POST', '/admin/attributes', { body: attribute('occasion') })).body
      await b.call('PUT', `/admin/categories/${mid.id}`, { body: { ...category('mid', { parentId: top.id, attributes: [{ attributeId: other.id, seoIndexable: false, required: false }] }), version: 1 } })
      expect((await svc.categories.effectiveFilters(leaf.id)).map((f) => f.attributeId)).toEqual([other.id])
    }, 60_000)
  })

  describe('attributes', () => {
    it('are created with values; yes/no and number attributes get their fixed values from the server', async () => {
      const { b } = await signedIn('catalog')
      const fabric = await b.call('POST', '/admin/attributes', { body: attribute('fabric', { group: 'Fabric', i18n: { ur: { label: 'کپڑا' } }, values: [{ code: 'lawn', label: 'Lawn' }, { code: 'silk', label: 'Silk', i18n: { ur: { label: 'ریشم' } } }] }) })
      expect(fabric.status, JSON.stringify(fabric.body)).toBe(201)
      expect(fabric.body).toMatchObject({ code: 'fabric', type: 'enum', group: 'Fabric', usedByProducts: 0, usedByCategories: 0 })
      expect(fabric.body.values.map((/** @type {{ code: string }} */ v) => v.code)).toEqual(['lawn', 'silk'])
      const embroidered = (await b.call('POST', '/admin/attributes', { body: attribute('embroidered', { type: 'boolean', display: 'checkbox', values: [] }) })).body
      expect(embroidered.values.map((/** @type {{ code: string }} */ v) => v.code)).toEqual(['yes', 'no'])
      const pieces = (await b.call('POST', '/admin/attributes', { body: attribute('pieces', { type: 'number', display: 'range', values: [] }) })).body
      expect(pieces.values).toHaveLength(1)
      const colour = await b.call('POST', '/admin/attributes', { body: attribute('shade', { type: 'color', display: 'swatch', values: [{ code: 'red', label: 'Red', swatch: { hex: ['#CC0000'] } }] }) })
      expect(colour.body.values[0].swatch).toEqual({ hex: ['#CC0000'] })
    }, 60_000)

    it('refuse a repeated code, bad combinations and values that do not fit the type', async () => {
      const { b } = await signedIn('catalog')
      const post = (/** @type {object} */ body) => b.call('POST', '/admin/attributes', { body })
      await post(attribute('fabric'))
      expect((await post(attribute('fabric'))).body.code).toBe('code_taken')
      expect((await post(attribute('Bad Code'))).body.issues).toEqual([{ path: 'code', code: 'code_invalid' }])
      expect((await post(attribute('a1', { display: 'range' }))).status, 'range needs number').toBe(400)
      expect((await post(attribute('a2', { display: 'swatch' }))).status, 'swatch needs color').toBe(400)
      expect((await post(attribute('a3', { values: [] }))).body.issues).toEqual([{ path: 'values', code: 'required' }])
      expect((await post(attribute('a4', { values: [{ code: 'x', label: 'X' }, { code: 'x', label: 'Y' }] }))).body.issues).toEqual([{ path: 'values.1.code', code: 'not_unique' }])
      expect((await post(attribute('a5', { type: 'boolean', values: [{ code: 'x', label: 'X' }] }))).body.issues).toEqual([{ path: 'values', code: 'invalid_format' }])
      expect((await post(attribute('a6', { type: 'color', display: 'swatch', values: [{ code: 'x', label: 'X' }] }))).body.issues).toEqual([{ path: 'values', code: 'required' }])
      expect((await post(attribute('a7', { values: [{ code: 'x', label: 'X', swatch: { hex: ['#000000'] } }] }))).status).toBe(400)
    }, 60_000)

    it('change by id: labels and order move freely, code and type never, removing a value used by products is refused with the count', async () => {
      const { b, user } = await signedIn('catalog')
      const made = (await b.call('POST', '/admin/attributes', { body: attribute('fabric') })).body
      const [a, v] = made.values
      const edited = await b.call('PUT', `/admin/attributes/${made.id}`, {
        body: { ...attribute('fabric', { label: 'Material', group: 'Fabric' }), values: [{ id: v.id, code: 'b', label: 'Bee' }, { id: a.id, code: 'a', label: 'Ay' }, { code: 'c', label: 'See' }] },
      })
      expect(edited.status, JSON.stringify(edited.body)).toBe(200)
      expect(edited.body.label).toBe('Material')
      expect(edited.body.values.map((/** @type {{ code: string, id: string }} */ x) => [x.code, x.id === v.id || x.id === a.id])).toEqual([['b', true], ['a', true], ['c', false]])
      expect((await b.call('PUT', `/admin/attributes/${made.id}`, { body: { ...attribute('other'), values: edited.body.values.map((/** @type {{ id: string, code: string, label: string }} */ x) => ({ id: x.id, code: x.code, label: x.label })) } })).body.issues).toEqual([{ path: 'code', code: 'invalid_format' }])
      expect((await b.call('PUT', `/admin/attributes/${made.id}`, { body: { ...attribute('fabric', { type: 'color', display: 'swatch' }), values: [{ code: 'a', label: 'A', swatch: { hex: ['#000000'] } }] } })).body.issues).toEqual([{ path: 'type', code: 'invalid_format' }])
      expect((await b.call('PUT', `/admin/attributes/${made.id}`, { body: { ...attribute('fabric'), values: [{ id: a.id, code: 'renamed', label: 'A' }, { code: 'z', label: 'Z' }] } })).body.issues).toEqual([{ path: 'values.0.code', code: 'invalid_format' }])
      const busy = createCatalogService({ db: t.db, media: noMedia, usage: { ...noUsage, valueProducts: async (id) => (id === v.id ? 4 : 0) } })
      const blocked = busy.attributes.update({ staffId: user.id, name: 'x', role: 'owner' }, made.id, { ...attribute('fabric'), values: [{ id: a.id, code: 'a', label: 'A' }] }, REQ)
      await expect(blocked).rejects.toMatchObject({ code: 'in_use', details: { values: [{ id: v.id, code: 'b', usedByProducts: 4 }] } })
      const kept = (await b.call('GET', '/admin/attributes')).body.items[0].values
      expect(kept).toHaveLength(3)
    }, 60_000)

    it('merge one value into another: products move over (stand-in), the old value goes, and only values of the same attribute qualify', async () => {
      const { b, user } = await signedIn('catalog')
      const made = (await b.call('POST', '/admin/attributes', { body: attribute('fabric') })).body
      const other = (await b.call('POST', '/admin/attributes', { body: attribute('occasion') })).body
      const [a, v] = made.values
      expect((await b.call('POST', `/admin/attributes/${made.id}/values/${a.id}/merge`, { body: { intoValueId: a.id } })).status).toBe(400)
      expect((await b.call('POST', `/admin/attributes/${made.id}/values/${a.id}/merge`, { body: { intoValueId: other.values[0].id } })).status).toBe(404)
      expect((await b.call('POST', `/admin/attributes/${made.id}/values/${uuidv7()}/merge`, { body: { intoValueId: v.id } })).status).toBe(404)
      const moved = /** @type {string[][]} */ ([])
      const svc = createCatalogService({ db: t.db, media: noMedia, usage: { ...noUsage, moveValue: async (_tx, from, into) => void moved.push([from, into]) } })
      await svc.attributes.mergeValue({ staffId: user.id, name: 'x', role: 'owner' }, made.id, a.id, v.id, REQ)
      expect(moved).toEqual([[a.id, v.id]])
      expect((await b.call('GET', '/admin/attributes')).body.items.find((/** @type {{ id: string }} */ x) => x.id === made.id).values.map((/** @type {{ id: string }} */ x) => x.id)).toEqual([v.id])
      const bool = (await b.call('POST', '/admin/attributes', { body: attribute('flag', { type: 'boolean', values: [] }) })).body
      expect((await b.call('POST', `/admin/attributes/${bool.id}/values/${bool.values[0].id}/merge`, { body: { intoValueId: bool.values[1].id } })).status).toBe(400)
    }, 60_000)

    it('cannot be deleted while a category lists it or products use it', async () => {
      const { b, user } = await signedIn('catalog')
      const made = (await b.call('POST', '/admin/attributes', { body: attribute('fabric') })).body
      const cat = (await b.call('POST', '/admin/categories', { body: category('top', { attributes: [{ attributeId: made.id, seoIndexable: false, required: false }] }) })).body
      expect((await b.call('GET', '/admin/attributes')).body.items[0].usedByCategories).toBe(1)
      const listed = await b.call('DELETE', `/admin/attributes/${made.id}`)
      expect([listed.status, listed.body.code, listed.body.usedBy]).toEqual([409, 'in_use', { products: 0, categories: 1 }])
      await b.call('PUT', `/admin/categories/${cat.id}`, { body: { ...category('top'), version: 1 } })
      const stocked = createCatalogService({ db: t.db, media: noMedia, usage: { ...noUsage, attributeProducts: async () => 9 } })
      await expect(stocked.attributes.remove({ staffId: user.id, name: 'x', role: 'owner' }, made.id, REQ)).rejects.toMatchObject({ code: 'in_use', details: { usedBy: { products: 9, categories: 0 } } })
      expect((await b.call('DELETE', `/admin/attributes/${made.id}`)).status).toBe(204)
    }, 60_000)
  })

  describe('sizes', () => {
    const system = (/** @type {string} */ name, /** @type {string[]} */ labels) => ({ name, values: labels.map((label) => ({ label })) })

    it('systems keep an order, let labels swap places, refuse repeats and removal of a size variants use', async () => {
      const { b, user } = await signedIn('catalog')
      const made = await b.call('POST', '/admin/size-systems', { body: system("Women's stitched", ['XS', 'S', 'M', 'L']) })
      expect(made.status, JSON.stringify(made.body)).toBe(201)
      expect(made.body.values.map((/** @type {{ label: string }} */ v) => v.label)).toEqual(['XS', 'S', 'M', 'L'])
      const [xs, s, m, l] = made.body.values
      const swapped = await b.call('PUT', `/admin/size-systems/${made.body.id}`, { body: { name: "Women's", values: [{ id: xs.id, label: 'XS' }, { id: m.id, label: 'S' }, { id: s.id, label: 'M' }, { id: l.id, label: 'L' }, { label: 'XL' }] } })
      expect(swapped.status, JSON.stringify(swapped.body)).toBe(200)
      expect(swapped.body.values.map((/** @type {{ label: string, id: string }} */ v) => [v.label, v.id])).toEqual([['XS', xs.id], ['S', m.id], ['M', s.id], ['L', l.id], ['XL', expect.any(String)]])
      expect((await b.call('POST', '/admin/size-systems', { body: system("Women's", ['S']) })).body.issues).toEqual([{ path: 'name', code: 'not_unique' }])
      expect((await b.call('POST', '/admin/size-systems', { body: system('Dup', ['S', 's']) })).body.issues).toEqual([{ path: 'values.1.label', code: 'not_unique' }])
      expect((await b.call('PUT', `/admin/size-systems/${made.body.id}`, { body: { name: 'X', values: [{ id: uuidv7(), label: 'S' }] } })).status).toBe(400)
      const busy = createCatalogService({ db: t.db, media: noMedia, usage: { ...noUsage, sizeValueVariants: async (id) => (id === l.id ? 5 : 0), sizeSystemOptions: async () => 2 } })
      const a = { staffId: user.id, name: 'x', role: 'owner' }
      await expect(busy.sizes.updateSystem(a, made.body.id, { name: "Women's", values: [{ id: xs.id, label: 'XS' }] }, REQ)).rejects.toMatchObject({ code: 'in_use', details: { values: [{ id: l.id, label: 'L', usedByVariants: 5 }].map((x) => expect.objectContaining(x)) } })
      await expect(busy.sizes.removeSystem(a, made.body.id, REQ)).rejects.toMatchObject({ code: 'in_use', details: { usedBy: { options: 2 } } })
      expect((await b.call('DELETE', `/admin/size-systems/${made.body.id}`)).status).toBe(204)
    }, 60_000)

    const chart = (/** @type {object} */ extra = {}) => ({
      title: 'Kameez', unit: 'in',
      tables: [{ id: 'kameez', title: 'Kameez', columns: ['Bust', 'Waist'], rows: [{ label: 'S', values: [34, 28] }, { label: 'M', values: [36, 30] }] }],
      ...extra,
    })

    it('charts hold up to four tables of numbers, link to a size system and a guide image, and are saved with a version', async () => {
      const { b } = await signedIn('catalog')
      const sys = (await b.call('POST', '/admin/size-systems', { body: system('Std', ['S', 'M']) })).body
      const made = await b.call('POST', '/admin/size-charts', { body: chart({ sizeSystemId: sys.id, notes: 'Measure flat' }) })
      expect(made.status, JSON.stringify(made.body)).toBe(201)
      expect(made.body).toMatchObject({ title: 'Kameez', unit: 'in', sizeSystemId: sys.id, version: 1, usedBy: 0, notes: 'Measure flat' })
      expect((await b.call('GET', `/admin/size-charts/${made.body.id}`)).body.tables[0].rows[1]).toEqual({ label: 'M', values: [36, 30] })
      const edited = await b.call('PUT', `/admin/size-charts/${made.body.id}`, { body: { ...chart({ title: 'Kameez v2' }), version: 1 } })
      expect(edited.body).toMatchObject({ title: 'Kameez v2', version: 2, sizeSystemId: null })
      expect((await b.call('PUT', `/admin/size-charts/${made.body.id}`, { body: { ...chart(), version: 1 } })).body.code).toBe('stale_write')
      expect((await b.call('GET', '/admin/size-charts')).body.items).toHaveLength(1)
      expect((await b.call('DELETE', `/admin/size-charts/${made.body.id}`)).status).toBe(204)
      expect((await b.call('GET', `/admin/size-charts/${made.body.id}`)).status).toBe(404)
    }, 60_000)

    it('charts refuse rows that do not match the columns, repeated table ids, unknown systems and unready images', async () => {
      const { b } = await signedIn('catalog')
      const post = (/** @type {object} */ body) => b.call('POST', '/admin/size-charts', { body })
      const table = (/** @type {object} */ extra = {}) => ({ id: 't1', title: 'T', columns: ['A'], rows: [{ label: 'S', values: [1] }], ...extra })
      expect((await post(chart({ tables: [table({ rows: [{ label: 'S', values: [1, 2] }] })] }))).body.issues).toEqual([{ path: 'tables.0.rows.0.values', code: 'invalid_format' }])
      expect((await post(chart({ tables: [table(), table()] }))).body.issues).toEqual([{ path: 'tables.1.id', code: 'not_unique' }])
      expect((await post(chart({ tables: [] }))).status).toBe(400)
      expect((await post(chart({ tables: Array.from({ length: 5 }, (_, i) => table({ id: `t${i}` })) }))).status).toBe(400)
      expect((await post(chart({ unit: 'ft' }))).status).toBe(400)
      expect((await post(chart({ sizeSystemId: uuidv7() }))).body.issues).toEqual([{ path: 'sizeSystemId', code: 'invalid_format' }])
      expect((await post(chart({ guideMediaId: uuidv7() }))).body.code).toBe('media_not_ready')
      expect((await post(chart({ tables: [table({ rows: [{ label: 'S', values: [-1] }] })] }))).status).toBe(400)
    }, 60_000)

    const form = (/** @type {object} */ extra = {}) => ({
      title: 'Custom size', allowNotes: true,
      fields: [{ key: 'bust', label: 'Bust', type: 'number', required: true, unit: 'in', min: 20, max: 60 }, { key: 'sleeve', label: 'Sleeve', type: 'select', options: [{ value: 'long', label: 'Long' }] }],
      ...extra,
    })

    it('forms keep their fields in order, validate them, and are saved with a version', async () => {
      const { b } = await signedIn('catalog')
      const made = await b.call('POST', '/admin/form-schemas', { body: form() })
      expect(made.status, JSON.stringify(made.body)).toBe(201)
      expect(made.body).toMatchObject({ title: 'Custom size', allowNotes: true, version: 1, usedBy: 0 })
      expect(made.body.fields.map((/** @type {{ key: string }} */ f) => f.key)).toEqual(['bust', 'sleeve'])
      const post = (/** @type {object} */ body) => b.call('POST', '/admin/form-schemas', { body })
      expect((await post(form({ fields: [{ key: 'a', label: 'A', type: 'text' }, { key: 'a', label: 'B', type: 'text' }] }))).body.issues).toEqual([{ path: 'fields.1.key', code: 'not_unique' }])
      expect((await post(form({ fields: [{ key: 'a', label: 'A', type: 'select' }] }))).body.issues).toEqual([{ path: 'fields.0.options', code: 'required' }])
      expect((await post(form({ fields: [{ key: 'a', label: 'A', type: 'number', min: 10, max: 5 }] }))).body.issues).toEqual([{ path: 'fields.0.min', code: 'too_big' }])
      expect((await post(form({ fields: [{ key: 'Bad Key', label: 'A', type: 'text' }] }))).body.issues[0].code).toBe('handle_invalid')
      expect((await post(form({ fields: [] }))).status).toBe(400)
      const edited = await b.call('PUT', `/admin/form-schemas/${made.body.id}`, { body: { ...form({ title: 'Custom' }), fields: [{ key: 'waist', label: 'Waist', type: 'number' }], version: 1 } })
      expect(edited.body).toMatchObject({ title: 'Custom', version: 2 })
      expect((await b.call('PUT', `/admin/form-schemas/${made.body.id}`, { body: { ...form(), version: 1 } })).body.code).toBe('stale_write')
      expect((await b.call('DELETE', `/admin/form-schemas/${made.body.id}`)).status).toBe(204)
    }, 60_000)

    it('a form in use may gain fields but never lose one, and cannot be deleted', async () => {
      const { b, user } = await signedIn('catalog')
      const made = (await b.call('POST', '/admin/form-schemas', { body: form() })).body
      const used = createCatalogService({ db: t.db, media: noMedia, usage: { ...noUsage, formSchemaProducts: async () => 2 } })
      const a = { staffId: user.id, name: 'x', role: 'owner' }
      const grown = { ...form(), fields: [...made.fields, { key: 'hip', label: 'Hip', type: 'number', required: false }], version: 1 }
      expect((await used.sizes.updateForm(a, made.id, grown, REQ)).fields).toHaveLength(3)
      await expect(used.sizes.updateForm(a, made.id, { ...form(), fields: [made.fields[0]], version: 2 }, REQ)).rejects.toMatchObject({ code: 'validation_failed' })
      await expect(used.sizes.removeForm(a, made.id, REQ)).rejects.toMatchObject({ code: 'in_use', details: { usedBy: { products: 2 } } })
    }, 60_000)
  })

  describe('permissions', () => {
    it('reading needs catalog:read, writing catalog:write, deleting catalog:delete', async () => {
      const { b: viewer } = await signedIn('viewer')
      expect((await viewer.call('GET', '/admin/categories')).status).toBe(200)
      expect((await viewer.call('POST', '/admin/categories', { body: category('x') })).status).toBe(403)
      const { b: catalog } = await signedIn('catalog')
      const made = (await catalog.call('POST', '/admin/categories', { body: category('x') })).body
      expect((await catalog.call('DELETE', `/admin/categories/${made.id}`)).status).toBe(204)
      const { b: fulfilment } = await signedIn('fulfilment')
      expect((await fulfilment.call('GET', '/admin/attributes')).status).toBe(200)
      expect((await fulfilment.call('POST', '/admin/attributes', { body: attribute('x') })).status).toBe(403)
    }, 120_000)
  })
})
