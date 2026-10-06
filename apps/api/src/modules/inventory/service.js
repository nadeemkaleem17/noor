// Stock (plan/09-data-model/04-inventory.md). On hand and reserved change only here, always inside the caller's transaction, always with the
// variants locked in ascending id order, and every change of on-hand leaves a row in the ledger.
//
//   reserve  an order is placed      reserved += q               (nothing leaves the shelf yet)
//   release  cancelled / expired     reserved -= q
//   commit   dispatched              on_hand -= q, reserved -= q, ledger "sale"
//   restock  returned                on_hand += q, ledger "return_restock" (or the damaged pair)
//   adjust   a person counted        on_hand = new value, ledger row with the reason
import { and, asc, count, desc, eq, gte, inArray, isNotNull, lt, lte, sql } from 'drizzle-orm'
import { DomainError } from '../../platform/errors.js'
import { transaction } from '../../platform/db.js'
import { now } from '../../platform/clock.js'
import { uuidv7 } from '../../platform/ids.js'
import { emit } from '../../platform/outbox.js'
import { record } from '../audit/index.js'
import { staffUsers } from '../../db/schema/auth.js'
import { inventoryLevels, inventoryMovements, reservations, stockSubscriptions } from '../../db/schema/inventory.js'
import { products, variants } from '../../db/schema/products.js'
import { variantStatus } from '../catalog/product-loader.js'

/** @typedef {import('../../platform/db.js').Executor} Db */
/** @typedef {{ staffId: string, name: string, role: string }} Staff */
/** @typedef {{ ip: string, userAgent: string, requestId: string }} RequestInfo */
/** @typedef {{ orderLineId: string, variantId: string, quantity: number }} Line */
/** @typedef {typeof inventoryLevels.$inferSelect} Level */

const DAY = 86_400_000

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {(x?: Db) => Promise<number>} deps.lowStockThreshold at or below this many units a variant is "low stock" (settings `thresholds.lowStock`)
 * @param {(tx: Db, productIds: string[]) => Promise<void>} [deps.onChanged] called inside the transaction with the products whose stock changed (they recompute their cached stock status)
 */
export function createInventory({ db, lowStockThreshold, onChanged = async () => {} }) {

  /** The ids among `ids` whose variant counts stock. @param {Db} x @param {string[]} ids */
  async function countedAmong(x, ids) {
    if (!ids.length) return new Set(/** @type {string[]} */ ([]))
    return new Set((await x.select({ id: variants.id }).from(variants).where(and(inArray(variants.id, ids), eq(variants.stockMode, 'counted')))).map((v) => v.id))
  }

  /** Makes sure each of the (counted) variants has a level row. @param {Db} tx @param {string[]} ids */
  async function ensureLevels(tx, ids) {
    const counted = [...(await countedAmong(tx, ids))]
    if (!counted.length) return
    await tx.insert(inventoryLevels).values(counted.map((variantId) => ({ variantId, updatedAt: now() }))).onDuplicateKeyUpdate({ set: { variantId: sql`variant_id` } })
  }

  /**
   * Locks the level rows of `ids` in ascending id order (the one lock order of the shop, ADR-0020) and returns them.
   * @param {Db} tx @param {string[]} ids
   * @returns {Promise<Map<string, Level>>}
   */
  async function lock(tx, ids) {
    const sorted = [...new Set(ids)].sort()
    if (!sorted.length) return new Map()
    await ensureLevels(tx, sorted)
    const rows = await tx.select().from(inventoryLevels).where(inArray(inventoryLevels.variantId, sorted)).orderBy(asc(inventoryLevels.variantId)).for('update')
    return new Map(rows.map((r) => [r.variantId, r]))
  }

  /** @param {Level | undefined} l */
  const availableOf = (l) => (l ? l.onHand - l.reserved : 0)

  /**
   * Tells the rest of the shop what changed: the ids, the cached stock status of their products, and which variants came back in stock.
   * @param {Db} tx @param {Map<string, { before: number, after: number }>} changes available units before and after, by variant
   */
  async function announce(tx, changes) {
    const ids = [...changes.keys()]
    if (!ids.length) return
    const owners = [...new Set((await tx.select({ id: variants.productId }).from(variants).where(inArray(variants.id, ids))).map((r) => r.id))]
    await onChanged(tx, owners)
    await emit(tx, { type: 'inventory.changed', payload: { variantIds: ids } })
    for (const [variantId, { before, after }] of changes) if (before <= 0 && after > 0) await emit(tx, { type: 'variant.back_in_stock', payload: { variantId } })
  }

  /** @param {Db} tx @param {{ variantId: string, delta: number, reason: string, note?: string | null, orderId?: string | null, staffId?: string | null, onHandAfter: number }} m */
  const movement = (tx, m) =>
    tx.insert(inventoryMovements).values({ id: uuidv7(), variantId: m.variantId, delta: m.delta, reason: m.reason, note: m.note ?? null, orderId: m.orderId ?? null, staffUserId: m.staffId ?? null, onHandAfter: m.onHandAfter, createdAt: now() })

  /** @param {Db} tx @param {string} variantId @param {number} onHand @param {number} reserved */
  const setLevel = (tx, variantId, onHand, reserved) => tx.update(inventoryLevels).set({ onHand, reserved, updatedAt: now() }).where(eq(inventoryLevels.variantId, variantId))

  /** Total per variant, over lines. @param {{ variantId: string, quantity: number }[]} lines */
  const perVariant = (lines) => {
    /** @type {Map<string, number>} */
    const out = new Map()
    for (const l of lines) out.set(l.variantId, (out.get(l.variantId) ?? 0) + l.quantity)
    return out
  }

  /** Active reservations of an order. @param {Db} tx @param {string} orderId */
  const activeOf = (tx, orderId) => tx.select().from(reservations).where(and(eq(reservations.orderId, orderId), eq(reservations.status, 'active')))

  // ================================ the operations ================================
  const ops = {
    /**
     * Holds stock for an order, all lines together: two lines of one variant are added up before the check (K10). Made-to-order and preorder
     * variants hold nothing. Bundle lines must already be expanded to their child variants by the caller.
     * @param {Db} tx @param {{ orderId: string, lines: Line[], expiresAt?: Date | null }} order
     */
    async reserve(tx, { orderId, lines, expiresAt = null }) {
      const counted = await countedAmong(tx, lines.map((l) => l.variantId))
      const mine = lines.filter((l) => counted.has(l.variantId))
      const wanted = perVariant(mine)
      const levels = await lock(tx, [...wanted.keys()])
      for (const [variantId, quantity] of [...wanted].sort(([a], [b]) => (a < b ? -1 : 1))) {
        const available = availableOf(levels.get(variantId))
        if (available < quantity) throw new DomainError('insufficient_stock', { variantId, available: Math.max(0, available) })
      }
      /** @type {Map<string, { before: number, after: number }>} */
      const changes = new Map()
      for (const [variantId, quantity] of wanted) {
        const l = /** @type {Level} */ (levels.get(variantId))
        await setLevel(tx, variantId, l.onHand, l.reserved + quantity)
        changes.set(variantId, { before: availableOf(l), after: availableOf(l) - quantity })
      }
      const at = now()
      if (mine.length) {
        await tx.insert(reservations).values(mine.map((l) => ({ id: uuidv7(), orderId, orderLineId: l.orderLineId, variantId: l.variantId, quantity: l.quantity, status: 'active', expiresAt, createdAt: at, updatedAt: at })))
      }
      await announce(tx, changes)
    },

    /** Gives the held stock back (cancelled order, expired reservation). Nothing was taken off the shelf, so there is no movement. @param {Db} tx @param {string} orderId */
    async release(tx, orderId) {
      const held = await activeOf(tx, orderId)
      if (!held.length) return 0
      const levels = await lock(tx, held.map((r) => r.variantId))
      /** @type {Map<string, { before: number, after: number }>} */
      const changes = new Map()
      for (const [variantId, quantity] of perVariant(held)) {
        const l = /** @type {Level} */ (levels.get(variantId))
        await setLevel(tx, variantId, l.onHand, l.reserved - quantity)
        changes.set(variantId, { before: availableOf(l), after: availableOf(l) + quantity })
      }
      await tx.update(reservations).set({ status: 'released', updatedAt: now() }).where(and(eq(reservations.orderId, orderId), eq(reservations.status, 'active')))
      await announce(tx, changes)
      return held.length
    },

    /** The goods leave: on hand and reserved both go down, and the ledger records the sale. @param {Db} tx @param {string} orderId */
    async commit(tx, orderId) {
      const held = await activeOf(tx, orderId)
      if (!held.length) return 0
      const levels = await lock(tx, held.map((r) => r.variantId))
      /** @type {Map<string, { before: number, after: number }>} */
      const changes = new Map()
      for (const [variantId, quantity] of [...perVariant(held)].sort(([a], [b]) => (a < b ? -1 : 1))) {
        const l = /** @type {Level} */ (levels.get(variantId))
        await setLevel(tx, variantId, l.onHand - quantity, l.reserved - quantity)
        await movement(tx, { variantId, delta: -quantity, reason: 'sale', orderId, onHandAfter: l.onHand - quantity })
        changes.set(variantId, { before: availableOf(l), after: availableOf(l) })
      }
      await tx.update(reservations).set({ status: 'committed', updatedAt: now() }).where(and(eq(reservations.orderId, orderId), eq(reservations.status, 'active')))
      await announce(tx, changes)
      return held.length
    },

    /**
     * Returned goods: put back on the shelf, or written off as damaged (then the ledger shows the unit arriving and leaving).
     * @param {Db} tx @param {string} orderId @param {{ variantId: string, quantity: number, restock: boolean }[]} lines
     */
    async restock(tx, orderId, lines) {
      const levels = await lock(tx, lines.map((l) => l.variantId))
      /** @type {Map<string, { before: number, after: number }>} */
      const changes = new Map()
      /** @type {Map<string, number>} */
      const onHand = new Map([...levels].map(([id, l]) => [id, l.onHand]))
      for (const { variantId, quantity, restock } of [...lines].sort((a, b) => (a.variantId < b.variantId ? -1 : 1))) {
        const l = /** @type {Level} */ (levels.get(variantId))
        const before = onHand.get(variantId) ?? 0
        if (restock) {
          await movement(tx, { variantId, delta: quantity, reason: 'return_restock', orderId, onHandAfter: before + quantity })
          onHand.set(variantId, before + quantity)
        } else {
          await movement(tx, { variantId, delta: quantity, reason: 'return_damaged', orderId, onHandAfter: before + quantity })
          await movement(tx, { variantId, delta: -quantity, reason: 'damaged', note: 'returned damaged', orderId, onHandAfter: before })
        }
        const start = changes.get(variantId)?.before ?? availableOf(l)
        changes.set(variantId, { before: start, after: (onHand.get(variantId) ?? 0) - l.reserved })
      }
      for (const [variantId, value] of onHand) await setLevel(tx, variantId, value, /** @type {Level} */ (levels.get(variantId)).reserved)
      await announce(tx, changes)
    },

    /**
     * Replaces what an order holds with a new set of lines in one locked pass (an order edited before dispatch).
     * @param {Db} tx @param {{ orderId: string, lines: Line[] }} change
     */
    async editReserved(tx, { orderId, lines }) {
      const old = await activeOf(tx, orderId)
      const counted = await countedAmong(tx, lines.map((l) => l.variantId))
      const mine = lines.filter((l) => counted.has(l.variantId))
      const levels = await lock(tx, [...old.map((r) => r.variantId), ...mine.map((l) => l.variantId)])
      const oldBy = perVariant(old)
      const newBy = perVariant(mine)
      for (const [variantId, quantity] of [...newBy].sort(([a], [b]) => (a < b ? -1 : 1))) {
        const l = levels.get(variantId)
        const available = availableOf(l) + (oldBy.get(variantId) ?? 0)
        if (available < quantity) throw new DomainError('insufficient_stock', { variantId, available: Math.max(0, available) })
      }
      /** @type {Map<string, { before: number, after: number }>} */
      const changes = new Map()
      for (const variantId of new Set([...oldBy.keys(), ...newBy.keys()])) {
        const l = /** @type {Level} */ (levels.get(variantId))
        const reserved = l.reserved - (oldBy.get(variantId) ?? 0) + (newBy.get(variantId) ?? 0)
        await setLevel(tx, variantId, l.onHand, reserved)
        changes.set(variantId, { before: availableOf(l), after: l.onHand - reserved })
      }
      const at = now()
      if (old.length) await tx.update(reservations).set({ status: 'released', updatedAt: at }).where(and(eq(reservations.orderId, orderId), eq(reservations.status, 'active')))
      if (mine.length) await tx.insert(reservations).values(mine.map((l) => ({ id: uuidv7(), orderId, orderLineId: l.orderLineId, variantId: l.variantId, quantity: l.quantity, status: 'active', expiresAt: old[0]?.expiresAt ?? null, createdAt: at, updatedAt: at })))
      await announce(tx, changes)
    },

    /**
     * A person changes the count: add, remove, or set it to what they counted. Refused if it would leave less on hand than is promised to orders.
     * @param {Db} tx @param {{ variantId: string, mode: 'add' | 'remove' | 'set', quantity: number, reason: 'restock' | 'correction' | 'damaged' | 'return_restock' | 'other' | 'initial', note?: string | null, staffId?: string | null }} a
     */
    async adjust(tx, { variantId, mode, quantity, reason, note, staffId }) {
      if (!(await countedAmong(tx, [variantId])).has(variantId)) throw new DomainError('variant_unavailable')
      if ((reason === 'damaged' || reason === 'other') && !note?.trim()) throw new DomainError('validation_failed', { issues: [{ path: 'note', code: 'required' }] })
      const l = /** @type {Level} */ ((await lock(tx, [variantId])).get(variantId))
      const target = mode === 'add' ? l.onHand + quantity : mode === 'remove' ? l.onHand - quantity : quantity
      if (target < l.reserved) throw new DomainError('stock_below_reserved', { reserved: l.reserved })
      const delta = target - l.onHand
      if (delta !== 0) {
        await setLevel(tx, variantId, target, l.reserved)
        await movement(tx, { variantId, delta, reason, note: note?.trim() || null, staffId, onHandAfter: target })
        await announce(tx, new Map([[variantId, { before: availableOf(l), after: target - l.reserved }]]))
      }
      return { variantId, onHand: target, reserved: l.reserved, available: target - l.reserved, before: l.onHand, delta }
    },
  }

  // ================================ what the catalog uses ================================
  /** @param {Db} x @param {string[]} ids */
  const levelsOf = async (x, ids) => {
    if (!ids.length) return new Map()
    const rows = await x.select().from(inventoryLevels).where(inArray(inventoryLevels.variantId, ids))
    return new Map(rows.map((r) => [r.variantId, { onHand: r.onHand, reserved: r.reserved }]))
  }

  /** @type {import('../catalog/product-loader.js').Stock} */
  const stock = {
    async available(x, ids) {
      const levels = await levelsOf(x, ids)
      return new Map(ids.map((id) => [id, (levels.get(id)?.onHand ?? 0) - (levels.get(id)?.reserved ?? 0)]))
    },
    levels: levelsOf,
    lowStockThreshold,
    ensureLevels,
    /** First quantities entered when a product is created. */
    async initial(tx, rows, staffId) {
      for (const r of rows) if (r.quantity > 0) await ops.adjust(tx, { variantId: r.variantId, mode: 'set', quantity: r.quantity, reason: 'initial', staffId })
    },
  }

  return {
    ...ops,
    stock,
    ensureLevels,

    /** @param {Staff} actor @param {Parameters<typeof ops.adjust>[1] extends infer A ? Omit<A & object, 'staffId'> : never} input @param {RequestInfo} req */
    async adjustByStaff(actor, input, req) {
      return transaction(db, async (tx) => {
        const r = await ops.adjust(tx, { ...input, staffId: actor.staffId })
        const v = (await tx.select({ sku: variants.sku, stockMode: variants.stockMode }).from(variants).where(eq(variants.id, input.variantId)))[0]
        if (r.delta !== 0) {
          await record(tx, {
            actor: { type: 'staff', id: actor.staffId, label: actor.name, role: actor.role },
            action: 'inventory.adjusted', entityType: 'variant', entityId: input.variantId, entityLabel: v?.sku,
            diff: { onHand: [r.before, r.onHand] }, reason: `${input.reason}${input.note ? `: ${input.note}` : ''}`.slice(0, 500), ip: req.ip, userAgent: req.userAgent, requestId: req.requestId,
          })
        }
        const low = await lowStockThreshold(tx)
        return { variantId: r.variantId, onHand: r.onHand, reserved: r.reserved, available: r.available, stockStatus: variantStatus(v?.stockMode ?? 'counted', r.available, low) }
      })
    },

    /** Newest first. @param {{ variantId?: string, productId?: string, reason?: string, from?: string, to?: string, page: number, size: number }} f */
    async listMovements(f) {
      const where = and(
        f.variantId ? eq(inventoryMovements.variantId, f.variantId) : undefined,
        f.reason ? eq(inventoryMovements.reason, f.reason) : undefined,
        f.productId ? inArray(inventoryMovements.variantId, db.select({ id: variants.id }).from(variants).where(eq(variants.productId, f.productId))) : undefined,
        f.from ? gte(inventoryMovements.createdAt, new Date(f.from)) : undefined,
        f.to ? lte(inventoryMovements.createdAt, new Date(f.to)) : undefined,
      )
      const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(inventoryMovements).where(where)
      const rows = await db
        .select({ m: inventoryMovements, sku: variants.sku, productTitle: products.title, staffName: staffUsers.name })
        .from(inventoryMovements)
        .innerJoin(variants, eq(variants.id, inventoryMovements.variantId))
        .innerJoin(products, eq(products.id, variants.productId))
        .leftJoin(staffUsers, eq(staffUsers.id, inventoryMovements.staffUserId))
        .where(where)
        .orderBy(desc(inventoryMovements.id))
        .limit(f.size)
        .offset((f.page - 1) * f.size)
      return {
        items: rows.map(({ m, sku, productTitle, staffName }) => ({
          id: m.id, variantId: m.variantId, sku, productTitle, delta: m.delta, onHandAfter: m.onHandAfter, reason: /** @type {import('@noor/contract').EnumValue<'movementReason'>} */ (m.reason),
          ...(m.note ? { note: m.note } : {}), ...(staffName ? { staffName } : {}), createdAt: m.createdAt.toISOString(),
        })),
        total, page: f.page, size: f.size,
      }
    },

    // ---- jobs ----
    /** Job `inventory.expire_reservations`: unpaid online orders give their stock back after 30 minutes (idle while only cash on delivery exists). */
    async expireReservations() {
      const due = await db.selectDistinct({ orderId: reservations.orderId }).from(reservations).where(and(eq(reservations.status, 'active'), isNotNull(reservations.expiresAt), lte(reservations.expiresAt, now()))).limit(200)
      for (const { orderId } of due) await transaction(db, (tx) => ops.release(tx, orderId))
      return due.length
    },

    /** Job `inventory.verify` (nightly): the ledger and the reservations must add up. Reports, never repairs. @returns {Promise<{ variantId: string, problem: string }[]>} */
    async verify() {
      const problems = []
      const levels = await db.select().from(inventoryLevels)
      const ledger = new Map((await db.select({ id: inventoryMovements.variantId, total: sum2(inventoryMovements.delta) }).from(inventoryMovements).groupBy(inventoryMovements.variantId)).map((r) => [r.id, Number(r.total)]))
      const held = new Map((await db.select({ id: reservations.variantId, total: sum2(reservations.quantity) }).from(reservations).where(eq(reservations.status, 'active')).groupBy(reservations.variantId)).map((r) => [r.id, Number(r.total)]))
      for (const l of levels) {
        if ((ledger.get(l.variantId) ?? 0) !== l.onHand) problems.push({ variantId: l.variantId, problem: `on_hand ${l.onHand} but the ledger adds up to ${ledger.get(l.variantId) ?? 0}` })
        if ((held.get(l.variantId) ?? 0) !== l.reserved) problems.push({ variantId: l.variantId, problem: `reserved ${l.reserved} but active reservations add up to ${held.get(l.variantId) ?? 0}` })
      }
      return problems
    },

    // ---- back-in-stock subscriptions ----
    /** Asking twice is the same as asking once. @param {{ variantId: string, phone: string, locale?: 'en' | 'ur' }} s */
    async subscribe({ variantId, phone, locale = 'en' }) {
      const v = (await db.select({ mode: variants.stockMode, enabled: variants.enabled }).from(variants).where(eq(variants.id, variantId)))[0]
      if (!v) throw new DomainError('not_found')
      if (v.mode !== 'counted' || !v.enabled) throw new DomainError('variant_unavailable')
      const available = availableOf((await db.select().from(inventoryLevels).where(eq(inventoryLevels.variantId, variantId)))[0])
      if (available > 0) throw new DomainError('variant_unavailable') // it is in stock: nothing to wait for
      await db.insert(stockSubscriptions).values({ id: uuidv7(), variantId, phone, locale, createdAt: now() }).onDuplicateKeyUpdate({ set: { variantId: sql`variant_id` } })
    },
    /** Who is waiting for this variant and has not been told. @param {string} variantId */
    waiting: (variantId) => db.select().from(stockSubscriptions).where(and(eq(stockSubscriptions.variantId, variantId), sql`${stockSubscriptions.notifiedAt} is null`)).orderBy(asc(stockSubscriptions.createdAt)),
    /** @param {string[]} ids */
    markNotified: (ids) => (ids.length ? db.update(stockSubscriptions).set({ notifiedAt: now() }).where(inArray(stockSubscriptions.id, ids)) : Promise.resolve()),
    /** Job `inventory.cleanup_subscriptions` (daily): told 7 days ago, or never told in 90 days (DOC-11 section 8.1). */
    async cleanupSubscriptions() {
      const at = now().getTime()
      await db.delete(stockSubscriptions).where(and(isNotNull(stockSubscriptions.notifiedAt), lt(stockSubscriptions.notifiedAt, new Date(at - 7 * DAY))))
      await db.delete(stockSubscriptions).where(and(sql`${stockSubscriptions.notifiedAt} is null`, lt(stockSubscriptions.createdAt, new Date(at - 90 * DAY))))
    },
  }
}

/** SUM() as a number-ish column. @param {import('drizzle-orm').SQLWrapper} column */
const sum2 = (column) => sql`coalesce(sum(${column}), 0)`.mapWith(Number)
