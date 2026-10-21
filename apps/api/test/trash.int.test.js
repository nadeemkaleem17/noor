// The trash (plan/17-owner-requests-2026-10.md item 6): a delete keeps a copy for 30 days and a restore makes the record again. On a scratch database, through HTTP.
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { auditLog } from '../src/db/schema/audit.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { pages, settings } from '../src/db/schema/content.js'
import { inventoryLevels } from '../src/db/schema/inventory.js'
import { products } from '../src/db/schema/products.js'
import { promos } from '../src/db/schema/promotions.js'
import { trashItems } from '../src/db/schema/trash.js'
import { categories, formSchemas } from '../src/db/schema/taxonomy.js'
import { setClock } from '../src/platform/clock.js'
import { pickInput } from '../src/platform/pick-input.js'
import { counters, outboxEvents, rateLimitHits } from '../src/db/schema/platform.js'
import { createServices } from '../src/modules/services.js'
import { closeHarness, config, createHarness, signedIn, t } from './support/staff.js'
import { createShop } from './support/shop.js'
import { dbAvailable } from './support/db.js'
import { z } from '@noor/contract'

describe('pickInput (no database)', () => {
  it('keeps what a schema names, all the way down, and nothing else', () => {
    const schema = z.strictObject({ a: z.string(), list: z.array(z.strictObject({ k: z.string(), id: z.string().optional() })), opt: z.strictObject({ x: z.int() }).optional(), nul: z.string().nullable() })
    const view = { a: 'x', extra: 1, list: [{ k: 'k1', id: 'i', more: true }, { k: 'k2' }], opt: { x: 1, y: 2 }, nul: null, version: 4 }
    expect(pickInput(schema, view)).toEqual({ a: 'x', list: [{ k: 'k1', id: 'i' }, { k: 'k2' }], opt: { x: 1 }, nul: null })
    expect(pickInput(schema, { a: 'x', list: [], nul: 'n' })).toEqual({ a: 'x', list: [], nul: 'n' })
  })
})

describe.skipIf(!dbAvailable)('trash (MySQL, through HTTP)', () => {
  const S = createShop()
  beforeAll(createHarness, 60_000)
  afterAll(closeHarness)
  afterEach(async () => {
    setClock(null)
    await t.migrate.db.delete(auditLog)
    await t.db.delete(trashItems)
    await t.db.delete(outboxEvents)
    await t.db.delete(rateLimitHits)
    await t.db.delete(promos)
    await t.migrate.pool.query('DELETE FROM inventory_movements')
    await t.db.delete(inventoryLevels)
    await t.db.delete(products)
    await t.db.delete(formSchemas)
    await t.db.delete(settings)
    await t.db.delete(pages)
    await t.db.delete(counters)
    await t.migrate.pool.query('DELETE FROM collections')
    await t.migrate.pool.query('DELETE FROM attributes')
    await t.migrate.pool.query('DELETE FROM categories WHERE parent_id IS NOT NULL')
    await t.db.delete(categories)
    await t.db.delete(staffUsers)
  })
  const items = async () => (await S.owner.call('GET', '/admin/trash')).body.items
  const attr = { code: 'fabric', label: 'Fabric', type: 'enum', display: 'checkbox', filterable: true, values: [{ code: 'a', label: 'Cotton' }, { code: 'b', label: 'Lawn' }] }

  it('keeps a promo code, a page, a collection and an attribute when they are deleted, and puts each back with the same words', async () => {
    await S.setup()
    const promo = (await S.promo('KEEPME', { percent: 15 })).body
    const page = (await S.owner.call('POST', '/admin/pages', { body: { title: 'Care guide', slug: 'care-guide', bodyMd: 'Wash cold.', status: 'active' } })).body
    const coll = (await S.owner.call('POST', '/admin/collections', { body: { title: 'Eid drop', handle: 'eid-drop', status: 'draft', featured: false, productIds: [] } })).body
    const attribute = (await S.owner.call('POST', '/admin/attributes', { body: attr })).body
    expect((await S.owner.call('DELETE', `/admin/promos/${promo.id}`)).status).toBe(204)
    expect((await S.owner.call('DELETE', `/admin/pages/${page.id}`)).status).toBe(204)
    expect((await S.owner.call('DELETE', `/admin/collections/${coll.id}`)).status).toBe(204)
    expect((await S.owner.call('DELETE', `/admin/attributes/${attribute.id}`)).status).toBe(204)
    expect(await t.db.select().from(promos)).toEqual([])

    const kept = await items()
    expect(kept.map((/** @type {{ kind: string, label: string }} */ k) => `${k.kind}:${k.label}`).sort()).toEqual(['attribute:Fabric', 'collection:Eid drop', 'page:Care guide', 'promo:KEEPME'])
    expect(kept[0]).toMatchObject({ deletedBy: expect.any(String), expiresAt: expect.any(String) })
    expect(new Date(kept[0].expiresAt).getTime() - new Date(kept[0].deletedAt).getTime()).toBe(30 * 86_400_000)

    for (const k of kept) {
      const r = await S.owner.call('POST', `/admin/trash/${k.id}/restore`)
      expect(r.status, JSON.stringify(r.body)).toBe(200)
      expect(r.body).toMatchObject({ kind: k.kind, label: k.label })
    }
    expect(await items()).toEqual([]) // restored copies leave the trash
    const again = (await S.owner.call('GET', '/admin/promos')).body.items.find((/** @type {{ code: string }} */ p) => p.code === 'KEEPME')
    expect(again).toMatchObject({ percent: 15, enabled: true })
    expect((await S.owner.call('GET', '/admin/pages')).body.items.some((/** @type {{ slug: string }} */ p) => p.slug === 'care-guide')).toBe(true)
    expect((await S.owner.call('GET', '/admin/attributes')).body.items.find((/** @type {{ code: string }} */ a) => a.code === 'fabric').values.map((/** @type {{ label: string }} */ v) => v.label)).toEqual(['Cotton', 'Lawn'])
    const log = (await t.db.select().from(auditLog)).filter((a) => a.action === 'trash.restored')
    expect(log).toHaveLength(4)
  }, 120_000)

  it('keeps a deleted product as a draft, and does not put it live by itself', async () => {
    await S.setup()
    const p = await S.product({ price: 350000, stock: 0, title: 'Lawn Suit', status: 'active' })
    expect((await S.owner.call('DELETE', `/admin/products/${p.productId}`)).status).toBe(204)
    const [kept] = await items()
    expect(kept).toMatchObject({ kind: 'product', label: expect.stringContaining('Lawn Suit') })
    const r = await S.owner.call('POST', `/admin/trash/${kept.id}/restore`)
    expect(r.status, JSON.stringify(r.body)).toBe(200)
    const back = (await S.owner.call('GET', `/admin/products/${r.body.id}`)).body
    expect(back).toMatchObject({ title: 'Lawn Suit', status: 'draft' })
    expect(back.variants[0]).toMatchObject({ price: { amount: 350000 } })
    expect(back.id).not.toBe(p.productId) // a new record, the same words
  }, 120_000)

  it('keeps nothing for a delete that was refused, and keeps one copy for each of a bulk delete', async () => {
    await S.setup()
    const make = async (/** @type {string} */ name, /** @type {string | null} */ parentId = null) =>
      (await S.owner.call('POST', '/admin/categories', { body: { name, handle: name.toLowerCase(), parentId, visible: true, attributes: [] } })).body.id
    const parent = await make('Parent')
    const child = await make('Child', parent)
    const free = await make('Free')
    const res = await S.owner.call('POST', '/admin/categories/bulk-delete', { body: { ids: [parent, child, free] } })
    expect(res.body.succeeded).toEqual([child, free])
    expect((await items()).map((/** @type {{ label: string }} */ i) => i.label).sort()).toEqual(['Child', 'Free']) // the parent was refused: nothing kept
    // the child comes back under its parent; the parent being gone later would refuse it
    const childItem = (await items()).find((/** @type {{ label: string }} */ i) => i.label === 'Child')
    expect((await S.owner.call('POST', `/admin/trash/${childItem.id}/restore`)).status).toBe(200)
  }, 120_000)

  it('says why a restore cannot be done and leaves the copy in the trash: the name is taken now', async () => {
    await S.setup()
    const page = (await S.owner.call('POST', '/admin/pages', { body: { title: 'About', slug: 'about-us', bodyMd: 'Hi', status: 'active' } })).body
    await S.owner.call('DELETE', `/admin/pages/${page.id}`)
    await S.owner.call('POST', '/admin/pages', { body: { title: 'About again', slug: 'about-us', bodyMd: 'New', status: 'active' } })
    const [kept] = await items()
    const r = await S.owner.call('POST', `/admin/trash/${kept.id}/restore`)
    expect(r.status).toBeGreaterThanOrEqual(400)
    expect((await items())).toHaveLength(1)
    expect((await S.owner.call('POST', `/admin/trash/${kept.id}/restore`)).status).toBeGreaterThanOrEqual(400)
  }, 120_000)

  it('is seen and restored only by those who may change that kind, emptied only by those who may delete it', async () => {
    await S.setup()
    const promo = (await S.promo('ONLYPROMO')).body
    await S.owner.call('DELETE', `/admin/promos/${promo.id}`)
    const [kept] = await items()
    const { b: viewer } = await signedIn('viewer')
    expect((await viewer.call('GET', '/admin/trash')).body.items).toEqual([]) // a viewer sees none of it
    expect((await viewer.call('POST', `/admin/trash/${kept.id}/restore`)).status).toBe(403)
    expect((await viewer.call('DELETE', `/admin/trash/${kept.id}`)).status).toBe(403)
    const { b: support } = await signedIn('support') // promos:read only
    expect((await support.call('GET', '/admin/trash')).body.items).toEqual([])
    const { b: manager } = await signedIn('manager')
    expect((await manager.call('GET', '/admin/trash')).body.items).toHaveLength(1)
    expect((await manager.call('DELETE', `/admin/trash/${kept.id}`)).status).toBe(204) // gone for good
    expect(await items()).toEqual([])
    expect((await S.owner.call('POST', `/admin/trash/${kept.id}/restore`)).status).toBe(404)
    expect((await t.db.select().from(auditLog)).some((a) => a.action === 'trash.purged')).toBe(true)
  }, 120_000)

  it('keeps a copy for 30 days: after that it is not listed, cannot be restored, and the nightly job removes it', async () => {
    await S.setup()
    const promo = (await S.promo('SHORTLIVED')).body
    await S.owner.call('DELETE', `/admin/promos/${promo.id}`)
    const [kept] = await items()
    // the signed-in session runs out with the clock, so this goes straight to the service
    const trash = createServices({ db: t.db, config }).trash
    const actor = { staffId: 'x', name: 'Owner', role: 'owner', permissions: new Set(['promos:write', 'promos:delete']) }
    expect((await trash.list(actor)).items).toHaveLength(1)
    setClock(new Date(Date.now() + 31 * 86_400_000))
    expect((await trash.list(actor)).items).toEqual([])
    await expect(trash.restore(actor, kept.id, { ip: '1.1.1.1', userAgent: 't', requestId: 'r' })).rejects.toMatchObject({ code: 'not_found' })
    await trash.cleanup()
    expect(await t.db.select().from(trashItems).where(eq(trashItems.id, kept.id))).toEqual([])
  }, 120_000)
})
