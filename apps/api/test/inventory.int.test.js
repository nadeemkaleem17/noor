// M1-10: stock levels, the ledger, reservations and the rules of DOC-09.4 section 6, on a scratch database.
// There are no orders yet, so an "order" here is just an id handed to reserve/release/commit/restock.
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { auditLog } from '../src/db/schema/audit.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { inventoryLevels, inventoryMovements, reservations, stockSubscriptions } from '../src/db/schema/inventory.js'
import { media } from '../src/db/schema/media.js'
import { outboxEvents } from '../src/db/schema/platform.js'
import { products, variants } from '../src/db/schema/products.js'
import { categories } from '../src/db/schema/taxonomy.js'
import { advanceClock, setClock } from '../src/platform/clock.js'
import { transaction } from '../src/platform/db.js'
import { uuidv7 } from '../src/platform/ids.js'
import { createCatalogService } from '../src/modules/catalog/index.js'
import { createInventory } from '../src/modules/inventory/index.js'
import { closeHarness, config, createHarness, signedIn, t } from './support/staff.js'
import { dbAvailable } from './support/db.js'

const pkr = (/** @type {number} */ rupees) => ({ amount: rupees * 100, currency: 'PKR' })

/** @type {ReturnType<typeof createInventory>} */
let inv
/** @type {ReturnType<typeof createCatalogService>} */
let catalog
let cat = ''

/**
 * A product with one variant per name, counted unless said otherwise; returns the variant ids by name.
 * @template {string} const N
 * @param {Awaited<ReturnType<typeof signedIn>>['b']} b
 * @param {N[]} names
 * @param {{ mode?: string, handle?: string, initial?: Partial<Record<N, number>> }} [opts]
 */
async function makeProduct(b, names, { mode = 'counted', handle = `p-${uuidv7().slice(-8)}`, initial = {} } = {}) {
  const body = {
    handle, status: 'draft', kind: 'accessory', title: handle, primaryCategoryId: cat, categoryIds: [], attributes: [], media: [],
    options: names.length > 1 ? [{ name: 'Pack', role: 'other', display: 'select', values: names.map((n) => ({ key: n, label: n })) }] : [],
    variants: names.map((n) => ({ key: n, sku: `${handle}-${n}`.toUpperCase().slice(0, 40), optionValueKeys: names.length > 1 ? [n] : [], price: pkr(1000), stockMode: mode, ...(mode === 'preorder' ? { preorderShipsAt: '2027-01-01' } : {}), maxPerOrder: 10, enabled: true })),
    ...(Object.keys(initial).length ? { initialStock: Object.entries(initial).map(([variantKey, quantity]) => ({ variantKey, quantity })) } : {}),
  }
  const r = await b.call('POST', '/admin/products', { body })
  if (r.status !== 201) throw new Error(JSON.stringify(r.body))
  const ids = /** @type {Record<N, string>} */ ({})
  const keyOf = names.length > 1 ? r.body.options[0].values : []
  for (const v of r.body.variants) /** @type {Record<string, string>} */ (ids)[names.length > 1 ? keyOf.find((/** @type {{ id: string }} */ x) => x.id === v.optionValueKeys[0]).label : (names[0] ?? '')] = v.id
  return { productId: /** @type {string} */ (r.body.id), ids, body: r.body }
}

const level = async (/** @type {string} */ variantId) => (await t.db.select().from(inventoryLevels).where(eq(inventoryLevels.variantId, variantId)))[0]
const ledger = (/** @type {string} */ variantId) => t.db.select().from(inventoryMovements).where(eq(inventoryMovements.variantId, variantId)).orderBy(inventoryMovements.id)
const reserve = (/** @type {string} */ orderId, /** @type {{ variantId: string, quantity: number }[]} */ lines, /** @type {Date | null} */ expiresAt = null) =>
  transaction(t.db, (tx) => inv.reserve(tx, { orderId, lines: lines.map((l) => ({ orderLineId: uuidv7(), ...l })), expiresAt }))
const run = (/** @type {(tx: any) => Promise<unknown>} */ fn) => transaction(t.db, fn)

describe.skipIf(!dbAvailable)('inventory (MySQL)', () => {
  beforeAll(async () => {
    await createHarness()
    inv = createInventory({ db: t.db, lowStockThreshold: async () => 3, onChanged: async (tx, ids) => catalog.products.recomputeMany(tx, ids) })
    catalog = createCatalogService({ db: t.db, config, media: { imagesFor: async () => ({}) }, stock: inv.stock })
  }, 60_000)
  afterAll(closeHarness)
  afterEach(async () => {
    setClock(null)
    await t.migrate.db.delete(auditLog)
    await t.db.delete(outboxEvents)
    await t.db.delete(reservations)
    await t.db.delete(stockSubscriptions)
    await t.migrate.pool.query('DELETE FROM inventory_movements') // the ledger has no delete for the app user in spirit; tests clean it as the migration user
    await t.db.delete(products)
    await t.db.delete(media)
    await t.db.delete(categories)
    await t.db.delete(staffUsers)
  })
  const setup = async () => {
    cat = uuidv7()
    await t.db.insert(categories).values({ id: cat, handle: `c-${cat.slice(-6)}`, name: 'Women', createdAt: new Date(), updatedAt: new Date() })
  }
  const asStaff = async (/** @type {string} */ role = 'catalog') => {
    await setup()
    return signedIn(role)
  }

  describe('reserving', () => {
    it('adds up the lines of one variant before checking: 2 + 2 of 3 is refused and nothing is held (K10)', async () => {
      const { b } = await asStaff()
      const { ids } = await makeProduct(b, ['one'], { initial: { one: 3 } })
      const variantId = /** @type {string} */ (ids.one)
      await expect(reserve(uuidv7(), [{ variantId, quantity: 2 }, { variantId, quantity: 2 }])).rejects.toMatchObject({ code: 'insufficient_stock', details: { variantId, available: 3 } })
      expect(await level(variantId)).toMatchObject({ onHand: 3, reserved: 0 })
      expect(await t.db.select().from(reservations)).toEqual([])
      await reserve(uuidv7(), [{ variantId, quantity: 2 }, { variantId, quantity: 1 }])
      expect(await level(variantId)).toMatchObject({ onHand: 3, reserved: 3 })
    }, 60_000)

    it('refuses the whole order if one variant is short, and holds nothing for the others', async () => {
      const { b } = await asStaff()
      const { ids } = await makeProduct(b, ['a', 'b'], { initial: { a: 5, b: 1 } })
      await expect(reserve(uuidv7(), [{ variantId: /** @type {string} */ (ids.a), quantity: 2 }, { variantId: /** @type {string} */ (ids.b), quantity: 2 }])).rejects.toMatchObject({ code: 'insufficient_stock', details: { variantId: ids.b, available: 1 } })
      expect((await level(/** @type {string} */ (ids.a)))?.reserved).toBe(0)
    }, 60_000)

    it('50 buyers for the last unit: exactly one wins, and reserved never passes on hand', async () => {
      const { b } = await asStaff()
      const { ids } = await makeProduct(b, ['last'], { initial: { last: 1 } })
      const variantId = /** @type {string} */ (ids.last)
      const results = await Promise.allSettled(Array.from({ length: 50 }, () => reserve(uuidv7(), [{ variantId, quantity: 1 }])))
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      for (const r of results) if (r.status === 'rejected') expect(r.reason).toMatchObject({ code: 'insufficient_stock' })
      expect(await level(variantId)).toMatchObject({ onHand: 1, reserved: 1 })
      expect(await t.db.select().from(reservations)).toHaveLength(1)
    }, 120_000)

    it('orders that name the same variants in opposite order never deadlock (locks are taken in id order)', async () => {
      const { b } = await asStaff()
      const { ids } = await makeProduct(b, ['x', 'y', 'z'], { initial: { x: 100, y: 100, z: 100 } })
      const { x, y, z } = ids
      const orders = Array.from({ length: 30 }, (_, i) => {
        const lines = i % 2 ? [x, y, z] : [z, y, x]
        return reserve(uuidv7(), lines.map((variantId) => ({ variantId, quantity: 1 })))
      })
      const settled = await Promise.allSettled(orders)
      expect(settled.filter((s) => s.status === 'rejected')).toEqual([])
      expect((await level(x))?.reserved).toBe(30)
    }, 120_000)

    it('holds nothing for made-to-order and preorder variants, and never refuses them', async () => {
      const { b } = await asStaff()
      const mto = await makeProduct(b, ['m'], { mode: 'made_to_order' })
      const pre = await makeProduct(b, ['p'], { mode: 'preorder' })
      await reserve(uuidv7(), [{ variantId: /** @type {string} */ (mto.ids.m), quantity: 50 }, { variantId: /** @type {string} */ (pre.ids.p), quantity: 50 }])
      expect(await t.db.select().from(reservations)).toEqual([])
      expect(await t.db.select().from(inventoryLevels).where(eq(inventoryLevels.variantId, /** @type {string} */ (mto.ids.m)))).toEqual([])
    }, 60_000)

    it('the database itself refuses reserved above on hand', async () => {
      const { b } = await asStaff()
      const { ids } = await makeProduct(b, ['one'], { initial: { one: 2 } })
      await expect(t.migrate.pool.query('UPDATE inventory_levels SET reserved = on_hand + 1 WHERE variant_id = ?', [ids.one])).rejects.toMatchObject({ errno: 3819 })
      await expect(t.migrate.pool.query('UPDATE inventory_levels SET on_hand = -1 WHERE variant_id = ?', [ids.one])).rejects.toMatchObject({ errno: 3819 })
    }, 60_000)
  })

  describe('releasing, committing and returning', () => {
    it('place then cancel leaves stock as it was and writes no movement', async () => {
      const { b } = await asStaff()
      const { ids } = await makeProduct(b, ['one'], { initial: { one: 4 } })
      const variantId = /** @type {string} */ (ids.one)
      const order = uuidv7()
      await reserve(order, [{ variantId, quantity: 3 }])
      expect(await level(variantId)).toMatchObject({ onHand: 4, reserved: 3 })
      expect(await run((tx) => inv.release(tx, order))).toBe(1)
      expect(await level(variantId)).toMatchObject({ onHand: 4, reserved: 0 })
      expect((await ledger(variantId)).map((m) => m.reason)).toEqual(['initial'])
      expect(await run((tx) => inv.release(tx, order)), 'a second release does nothing').toBe(0)
      expect((await level(variantId))?.reserved).toBe(0)
    }, 60_000)

    it('place, dispatch, return restocked: the ledger nets to zero and on hand is what it was', async () => {
      const { b } = await asStaff()
      const { ids } = await makeProduct(b, ['one'], { initial: { one: 5 } })
      const variantId = /** @type {string} */ (ids.one)
      const order = uuidv7()
      await reserve(order, [{ variantId, quantity: 2 }])
      expect(await run((tx) => inv.commit(tx, order))).toBe(1)
      expect(await level(variantId)).toMatchObject({ onHand: 3, reserved: 0 })
      expect(await run((tx) => inv.commit(tx, order)), 'a second dispatch does nothing').toBe(0)
      await run((tx) => inv.restock(tx, order, [{ variantId, quantity: 2, restock: true }]))
      expect(await level(variantId)).toMatchObject({ onHand: 5, reserved: 0 })
      const rows = await ledger(variantId)
      expect(rows.map((m) => [m.reason, m.delta, m.onHandAfter, m.orderId])).toEqual([['initial', 5, 5, null], ['sale', -2, 3, order], ['return_restock', 2, 5, order]])
      expect(rows.slice(1).reduce((n, m) => n + m.delta, 0)).toBe(0)
      expect((await t.db.select().from(reservations))[0]?.status).toBe('committed')
    }, 60_000)

    it('a damaged return shows the unit arriving and leaving, and on hand does not move', async () => {
      const { b } = await asStaff()
      const { ids } = await makeProduct(b, ['one'], { initial: { one: 5 } })
      const variantId = /** @type {string} */ (ids.one)
      const order = uuidv7()
      await reserve(order, [{ variantId, quantity: 1 }])
      await run((tx) => inv.commit(tx, order))
      await run((tx) => inv.restock(tx, order, [{ variantId, quantity: 1, restock: false }]))
      expect(await level(variantId)).toMatchObject({ onHand: 4 })
      expect((await ledger(variantId)).slice(2).map((m) => [m.reason, m.delta, m.onHandAfter])).toEqual([['return_damaged', 1, 5], ['damaged', -1, 4]])
    }, 60_000)

    it('editing an order replaces what it holds in one pass, counting its own units as free', async () => {
      const { b } = await asStaff()
      const { ids } = await makeProduct(b, ['a', 'b'], { initial: { a: 3, b: 3 } })
      const { a, b: bb } = ids
      const order = uuidv7()
      await reserve(order, [{ variantId: a, quantity: 3 }])
      const edit = (/** @type {{ variantId: string, quantity: number }[]} */ lines) => run((tx) => inv.editReserved(tx, { orderId: order, lines: lines.map((l) => ({ orderLineId: uuidv7(), ...l })) }))
      await edit([{ variantId: a, quantity: 3 }]) // same again: fine, although only 0 are free apart from its own
      await edit([{ variantId: a, quantity: 1 }, { variantId: bb, quantity: 2 }])
      expect([(await level(a))?.reserved, (await level(bb))?.reserved]).toEqual([1, 2])
      await expect(edit([{ variantId: bb, quantity: 4 }])).rejects.toMatchObject({ code: 'insufficient_stock', details: { variantId: bb, available: 3 } })
      expect([(await level(a))?.reserved, (await level(bb))?.reserved], 'a refused edit changes nothing').toEqual([1, 2])
      const active = await t.db.select().from(reservations).where(eq(reservations.status, 'active'))
      expect(active.map((r) => r.quantity).sort()).toEqual([1, 2])
    }, 60_000)

    it('expired reservations of unpaid online orders are released; cash-on-delivery holds have no expiry', async () => {
      setClock(new Date('2026-10-10T10:00:00.000Z')) // before signing in: sessions expire by the same clock
      const { b } = await asStaff()
      const { ids } = await makeProduct(b, ['one'], { initial: { one: 5 } })
      const variantId = /** @type {string} */ (ids.one)
      await reserve(uuidv7(), [{ variantId, quantity: 1 }], new Date('2026-10-10T10:30:00.000Z'))
      await reserve(uuidv7(), [{ variantId, quantity: 2 }]) // COD: no expiry
      expect(await inv.expireReservations()).toBe(0)
      advanceClock(31 * 60_000)
      expect(await inv.expireReservations()).toBe(1)
      expect((await level(variantId))?.reserved).toBe(2)
      expect(await inv.expireReservations()).toBe(0)
    }, 60_000)
  })

  describe('adjusting', () => {
    it('add, remove and set write one ledger row each, and a count that changes nothing writes none', async () => {
      const { b } = await asStaff()
      const { ids } = await makeProduct(b, ['one'])
      const variantId = /** @type {string} */ (ids.one)
      const adjust = (/** @type {'add' | 'remove' | 'set'} */ mode, /** @type {number} */ quantity, reason = /** @type {'restock' | 'correction'} */ ('correction'), note = undefined) =>
        run((tx) => inv.adjust(tx, { variantId, mode, quantity, reason, note, staffId: null }))
      expect(await adjust('add', 10, 'restock')).toMatchObject({ onHand: 10, available: 10, delta: 10 })
      expect(await adjust('remove', 3)).toMatchObject({ onHand: 7, delta: -3 })
      expect(await adjust('set', 12)).toMatchObject({ onHand: 12, delta: 5 })
      expect(await adjust('set', 12)).toMatchObject({ delta: 0 })
      expect((await ledger(variantId)).map((m) => [m.reason, m.delta, m.onHandAfter])).toEqual([['restock', 10, 10], ['correction', -3, 7], ['correction', 5, 12]])
    }, 60_000)

    it('refuses to take stock below what open orders hold (remove 5 of 6 with 3 reserved)', async () => {
      const { b } = await asStaff()
      const { ids } = await makeProduct(b, ['one'], { initial: { one: 6 } })
      const variantId = /** @type {string} */ (ids.one)
      await reserve(uuidv7(), [{ variantId, quantity: 3 }])
      const adjust = (/** @type {'add' | 'remove' | 'set'} */ mode, /** @type {number} */ quantity) => run((tx) => inv.adjust(tx, { variantId, mode, quantity, reason: 'correction' }))
      await expect(adjust('remove', 5)).rejects.toMatchObject({ code: 'stock_below_reserved', details: { reserved: 3 } })
      await expect(adjust('set', 2)).rejects.toMatchObject({ code: 'stock_below_reserved', details: { reserved: 3 } })
      await expect(adjust('remove', 100)).rejects.toMatchObject({ code: 'stock_below_reserved' })
      expect(await adjust('remove', 3)).toMatchObject({ onHand: 3, available: 0 })
      expect(await level(variantId)).toMatchObject({ onHand: 3, reserved: 3 })
    }, 60_000)

    it('needs a note for damaged and other, and only works on counted variants', async () => {
      const { b } = await asStaff()
      const { ids } = await makeProduct(b, ['one'], { initial: { one: 6 } })
      const mto = await makeProduct(b, ['m'], { mode: 'made_to_order' })
      const variantId = /** @type {string} */ (ids.one)
      for (const reason of /** @type {const} */ (['damaged', 'other'])) {
        await expect(run((tx) => inv.adjust(tx, { variantId, mode: 'remove', quantity: 1, reason }))).rejects.toMatchObject({ code: 'validation_failed', details: { issues: [{ path: 'note', code: 'required' }] } })
        await expect(run((tx) => inv.adjust(tx, { variantId, mode: 'remove', quantity: 1, reason, note: '  ' }))).rejects.toMatchObject({ code: 'validation_failed' })
      }
      await run((tx) => inv.adjust(tx, { variantId, mode: 'remove', quantity: 1, reason: 'damaged', note: 'torn' }))
      await expect(run((tx) => inv.adjust(tx, { variantId: /** @type {string} */ (mto.ids.m), mode: 'add', quantity: 1, reason: 'restock' }))).rejects.toMatchObject({ code: 'variant_unavailable' })
      await expect(run((tx) => inv.adjust(tx, { variantId: uuidv7(), mode: 'add', quantity: 1, reason: 'restock' }))).rejects.toMatchObject({ code: 'variant_unavailable' })
    }, 60_000)
  })

  describe('what the rest of the shop hears', () => {
    it('announces every change, and a variant that returns to stock once', async () => {
      const { b } = await asStaff()
      const { ids } = await makeProduct(b, ['one'])
      const variantId = /** @type {string} */ (ids.one)
      await t.db.delete(outboxEvents)
      await run((tx) => inv.adjust(tx, { variantId, mode: 'add', quantity: 5, reason: 'restock' }))
      const events = async () => (await t.db.select().from(outboxEvents)).map((e) => [e.type, JSON.stringify(e.payload)]).sort()
      expect(await events()).toEqual([['inventory.changed', JSON.stringify({ variantIds: [variantId] })], ['variant.back_in_stock', JSON.stringify({ variantId })]])
      await t.db.delete(outboxEvents)
      await run((tx) => inv.adjust(tx, { variantId, mode: 'add', quantity: 5, reason: 'restock' }))
      expect((await events()).map((e) => e[0]), 'already in stock: not "back" in stock').toEqual(['inventory.changed'])
      await t.db.delete(outboxEvents)
      await reserve(uuidv7(), [{ variantId, quantity: 10 }]) // sold out
      const order = (await t.db.select().from(reservations))[0]?.orderId ?? ''
      await t.db.delete(outboxEvents)
      await run((tx) => inv.release(tx, order))
      expect((await events()).map((e) => e[0]).sort()).toEqual(['inventory.changed', 'variant.back_in_stock'])
    }, 60_000)

    it('keeps the product’s cached stock status in step, in the same transaction', async () => {
      const { b } = await asStaff()
      const { productId, ids } = await makeProduct(b, ['one'])
      const variantId = /** @type {string} */ (ids.one)
      const status = async () => (await t.db.select().from(products).where(eq(products.id, productId)))[0]?.stockStatus
      expect(await status()).toBe('sold_out')
      await run((tx) => inv.adjust(tx, { variantId, mode: 'add', quantity: 10, reason: 'restock' }))
      expect(await status()).toBe('in_stock')
      const order = uuidv7()
      await reserve(order, [{ variantId, quantity: 8 }])
      expect(await status(), 'two left is low stock').toBe('low_stock')
      await reserve(uuidv7(), [{ variantId, quantity: 2 }])
      expect(await status()).toBe('sold_out')
      await run((tx) => inv.release(tx, order))
      expect(await status()).toBe('in_stock')
    }, 60_000)
  })

  describe('the checks that must always hold', () => {
    it('after a randomised run, on hand is the sum of the ledger and reserved the sum of active reservations', async () => {
      const { b } = await asStaff()
      const { ids } = await makeProduct(b, ['a', 'b', 'c'], { initial: { a: 30, b: 30, c: 30 } })
      const all = Object.values(ids)
      /** @type {string[]} */
      const open = []
      let seed = 12345
      const rnd = (/** @type {number} */ n) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n)
      for (let i = 0; i < 120; i++) {
        const op = rnd(6)
        try {
          if (op <= 1) {
            const order = uuidv7()
            await reserve(order, Array.from({ length: 1 + rnd(3) }, () => ({ variantId: /** @type {string} */ (all[rnd(all.length)]), quantity: 1 + rnd(4) })))
            open.push(order)
          } else if (op === 2 && open.length) await run((tx) => inv.release(tx, /** @type {string} */ (open.splice(rnd(open.length), 1)[0])))
          else if (op === 3 && open.length) {
            const order = /** @type {string} */ (open.splice(rnd(open.length), 1)[0])
            await run((tx) => inv.commit(tx, order))
            if (rnd(2)) await run((tx) => inv.restock(tx, order, [{ variantId: /** @type {string} */ (all[rnd(all.length)]), quantity: 1, restock: rnd(2) === 0 }]))
          } else await run((tx) => inv.adjust(tx, { variantId: /** @type {string} */ (all[rnd(all.length)]), mode: rnd(2) ? 'add' : 'remove', quantity: 1 + rnd(5), reason: 'correction' }))
        } catch (e) {
          if (!['insufficient_stock', 'stock_below_reserved'].includes(/** @type {{ code?: string }} */ (e).code ?? '')) throw e
        }
      }
      expect(await inv.verify()).toEqual([])
      for (const id of all) {
        const l = await level(/** @type {string} */ (id))
        expect(l?.onHand).toBe((await ledger(/** @type {string} */ (id))).reduce((n, m) => n + m.delta, 0))
        expect(l?.reserved).toBeLessThanOrEqual(l?.onHand ?? 0)
      }
    }, 180_000)

    it('verify reports a mismatch and does not repair it', async () => {
      const { b } = await asStaff()
      const { ids } = await makeProduct(b, ['one'], { initial: { one: 4 } })
      const variantId = /** @type {string} */ (ids.one)
      await reserve(uuidv7(), [{ variantId, quantity: 1 }])
      expect(await inv.verify()).toEqual([])
      await t.migrate.pool.query('UPDATE inventory_levels SET on_hand = 9, reserved = 2 WHERE variant_id = ?', [variantId])
      const problems = await inv.verify()
      expect(problems.map((p) => p.variantId)).toEqual([variantId, variantId])
      expect(problems[0]?.problem).toContain('on_hand 9')
      expect(problems[1]?.problem).toContain('reserved 2')
      expect(await level(variantId)).toMatchObject({ onHand: 9, reserved: 2 })
    }, 60_000)
  })

  describe('back-in-stock subscriptions', () => {
    it('are kept once per phone, only for sold-out counted variants, and can be read and marked told', async () => {
      const { b } = await asStaff()
      const { ids } = await makeProduct(b, ['one'])
      const mto = await makeProduct(b, ['m'], { mode: 'made_to_order' })
      const variantId = /** @type {string} */ (ids.one)
      await inv.subscribe({ variantId, phone: '+923001234567' })
      await inv.subscribe({ variantId, phone: '+923001234567', locale: 'ur' })
      await inv.subscribe({ variantId, phone: '+923007654321' })
      expect(await t.db.select().from(stockSubscriptions)).toHaveLength(2)
      await expect(inv.subscribe({ variantId: /** @type {string} */ (mto.ids.m), phone: '+923001234567' })).rejects.toMatchObject({ code: 'variant_unavailable' })
      await expect(inv.subscribe({ variantId: uuidv7(), phone: '+923001234567' })).rejects.toMatchObject({ code: 'not_found' })
      const waiting = await inv.waiting(variantId)
      expect(waiting.map((w) => w.phone)).toEqual(['+923001234567', '+923007654321'])
      await inv.markNotified([waiting[0]?.id ?? ''])
      expect((await inv.waiting(variantId)).map((w) => w.phone)).toEqual(['+923007654321'])
      await run((tx) => inv.adjust(tx, { variantId, mode: 'add', quantity: 2, reason: 'restock' }))
      await expect(inv.subscribe({ variantId, phone: '+923009999999' }), 'in stock: nothing to wait for').rejects.toMatchObject({ code: 'variant_unavailable' })
    }, 60_000)

    it('are deleted 7 days after they were told, or 90 days after they were made', async () => {
      const { b } = await asStaff()
      const { ids } = await makeProduct(b, ['one'])
      const variantId = /** @type {string} */ (ids.one)
      const day = 86_400_000
      const base = new Date('2026-10-10T10:00:00.000Z').getTime()
      const row = (/** @type {string} */ phone, /** @type {number} */ createdDaysAgo, /** @type {number | null} */ notifiedDaysAgo) =>
        t.db.insert(stockSubscriptions).values({ id: uuidv7(), variantId, phone, createdAt: new Date(base - createdDaysAgo * day), notifiedAt: notifiedDaysAgo === null ? null : new Date(base - notifiedDaysAgo * day) })
      await row('+923000000001', 100, 8) // told 8 days ago: goes
      await row('+923000000002', 100, 6) // told 6 days ago: stays
      await row('+923000000003', 91, null) // never told, 91 days: goes
      await row('+923000000004', 89, null) // never told, 89 days: stays
      setClock(new Date(base))
      await inv.cleanupSubscriptions()
      expect((await t.db.select().from(stockSubscriptions)).map((s) => s.phone).sort()).toEqual(['+923000000002', '+923000000004'])
    }, 60_000)
  })

  describe('through the admin API', () => {
    it('first quantities on create become opening movements, and the product reads on hand and reserved', async () => {
      const { b } = await asStaff()
      const made = await makeProduct(b, ['a', 'b'], { initial: { a: 7 } })
      const read = (await b.call('GET', `/admin/products/${made.productId}`)).body
      const byId = Object.fromEntries(read.variants.map((/** @type {{ id: string }} */ v) => [v.id, v]))
      expect(byId[/** @type {string} */ (made.ids.a)]).toMatchObject({ onHand: 7, reserved: 0, stockStatus: 'in_stock' })
      expect(byId[/** @type {string} */ (made.ids.b)]).toMatchObject({ onHand: 0, reserved: 0, stockStatus: 'sold_out' })
      expect((await ledger(/** @type {string} */ (made.ids.a))).map((m) => [m.reason, m.delta])).toEqual([['initial', 7]])
      expect((await b.call('GET', '/admin/products')).body.items[0].stockStatus).toBe('in_stock')
      const bad = await b.call('POST', '/admin/products', { body: { ...made.body, handle: 'other', variants: made.body.variants.map((/** @type {{ sku: string }} */ v) => ({ ...v, sku: `${v.sku}X` })), initialStock: [{ variantKey: 'nope', quantity: 1 }] } })
      expect(bad.status).toBe(400)
    }, 90_000)

    it('adjust changes the count, answers with the new numbers, and is audited with its reason', async () => {
      const { b } = await asStaff('fulfilment')
      const { b: catalog_ } = await signedIn('catalog')
      const made = await makeProduct(catalog_, ['one'])
      const variantId = /** @type {string} */ (made.ids.one)
      const r = await b.call('POST', '/admin/inventory/adjustments', { body: { variantId, mode: 'add', quantity: 6, reason: 'restock' } })
      expect(r.body).toEqual({ variantId, onHand: 6, reserved: 0, available: 6, stockStatus: 'in_stock' })
      const low = await b.call('POST', '/admin/inventory/adjustments', { body: { variantId, mode: 'remove', quantity: 4, reason: 'damaged', note: 'water damage' } })
      expect(low.body).toMatchObject({ onHand: 2, stockStatus: 'low_stock' })
      expect((await b.call('POST', '/admin/inventory/adjustments', { body: { variantId, mode: 'remove', quantity: 1, reason: 'other' } })).body.issues).toEqual([{ path: 'note', code: 'required' }])
      await reserve(uuidv7(), [{ variantId, quantity: 2 }])
      const refused = await b.call('POST', '/admin/inventory/adjustments', { body: { variantId, mode: 'remove', quantity: 1, reason: 'correction' } })
      expect([refused.status, refused.body.code, refused.body.reserved]).toEqual([409, 'stock_below_reserved', 2])
      const entries = (await t.db.select().from(auditLog)).filter((e) => e.action === 'inventory.adjusted')
      expect(entries).toHaveLength(2)
      expect(entries.find((e) => e.reason?.startsWith('damaged'))).toMatchObject({ reason: 'damaged: water damage', diff: { onHand: [6, 2] }, entityType: 'variant' })
      expect((await b.call('POST', '/admin/inventory/adjustments', { body: { variantId: uuidv7(), mode: 'add', quantity: 1, reason: 'restock' } })).body.code).toBe('variant_unavailable')
      const { b: viewer } = await signedIn('viewer')
      expect((await viewer.call('POST', '/admin/inventory/adjustments', { body: { variantId, mode: 'add', quantity: 1, reason: 'restock' } })).status).toBe(403)
    }, 90_000)

    it('the movement list is newest first and filters by variant, product, reason and time', async () => {
      const { b } = await asStaff()
      const one = await makeProduct(b, ['one'], { initial: { one: 10 } })
      const two = await makeProduct(b, ['two'], { initial: { two: 4 } })
      const v1 = /** @type {string} */ (one.ids.one)
      await b.call('POST', '/admin/inventory/adjustments', { body: { variantId: v1, mode: 'remove', quantity: 2, reason: 'correction' } })
      await b.call('POST', '/admin/inventory/adjustments', { body: { variantId: v1, mode: 'add', quantity: 5, reason: 'restock' } })
      const all = (await b.call('GET', '/admin/inventory/movements')).body
      expect(all.total).toBe(4)
      expect(all.items.map((/** @type {{ reason: string, delta: number }} */ m) => `${m.reason}${m.delta}`)).toEqual(['restock5', 'correction-2', 'initial4', 'initial10'].concat([]))
      expect(all.items[0]).toMatchObject({ variantId: v1, sku: expect.any(String), productTitle: expect.any(String), onHandAfter: 13, delta: 5, reason: 'restock', staffName: expect.any(String) })
      expect((await b.call('GET', `/admin/inventory/movements?variantId=${v1}`)).body.total).toBe(3)
      expect((await b.call('GET', `/admin/inventory/movements?productId=${two.productId}`)).body.total).toBe(1)
      expect((await b.call('GET', '/admin/inventory/movements?reason=initial')).body.total).toBe(2)
      expect((await b.call('GET', `/admin/inventory/movements?from=${new Date(Date.now() + 3_600_000).toISOString()}`)).body.total).toBe(0)
      expect((await b.call('GET', '/admin/inventory/movements?size=25&page=2')).body).toMatchObject({ page: 2, size: 25, items: [], total: 4 })
      expect((await b.call('GET', '/admin/inventory/movements?size=7')).status).toBe(400)
      const { b: support } = await signedIn('support')
      expect((await support.call('GET', '/admin/inventory/movements')).status, 'products:read is enough').toBe(200)
    }, 90_000)
  })

  it('a variant with history cannot be removed; one without can', async () => {
    const { b } = await asStaff()
    const made = await makeProduct(b, ['a', 'b'], { initial: { a: 3 } })
    const read = made.body
    const gone = made.ids.a
    const keep = read.variants.find((/** @type {{ id: string }} */ v) => v.id !== gone)
    const option = read.options[0]
    const save = (/** @type {{ id: string, optionValueKeys: string[], sku: string, price: object }} */ only) => {
      const value = option.values.find((/** @type {{ id: string }} */ v) => v.id === only.optionValueKeys[0])
      return b.call('PUT', `/admin/products/${made.productId}`, {
        body: {
          handle: read.handle, status: 'draft', kind: read.kind, title: read.title, primaryCategoryId: cat, categoryIds: [], attributes: [], media: [], version: read.version,
          options: [{ id: option.id, name: option.name, role: option.role, display: option.display, values: [{ id: value.id, key: value.id, label: value.label }] }],
          variants: [{ id: only.id, key: only.id, sku: only.sku, optionValueKeys: only.optionValueKeys, price: only.price, stockMode: 'counted', maxPerOrder: 10, enabled: true }],
        },
      })
    }
    // the variant whose count was entered has ledger rows: removing it would erase history
    const refused = await save(keep)
    expect(refused.body.code).toBe('in_use')
    expect(await t.db.select().from(variants).where(eq(variants.id, gone))).toHaveLength(1)
    const withHistory = read.variants.find((/** @type {{ id: string }} */ v) => v.id === gone)
    const ok = await save(withHistory)
    expect(ok.status, JSON.stringify(ok.body)).toBe(200)
    expect(ok.body.variants).toHaveLength(1)
    expect(await level(/** @type {string} */ (made.ids.b))).toBeUndefined()
  }, 90_000)
})
