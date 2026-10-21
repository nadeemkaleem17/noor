// The trash (plan/17-owner-requests-2026-10.md item 6): a delete is still a real delete (the shop no longer lists, searches or sells the record), but a copy of what it was made from is kept for 30
// days, so staff can put it back. A restore is a `create` again, with every rule of a create (a name taken since, a category that is gone, a stock rule) checked as new: if it cannot be put
// back, it says why and stays in the trash. The copy is taken by `guard`, which wraps a service's delete: no delete path of the six kinds can skip it, single or in bulk.
import { and, desc, eq, isNull, lt, gt, or, isNotNull } from 'drizzle-orm'
import { trashItems } from '../../db/schema/trash.js'
import { now } from '../../platform/clock.js'
import { transaction } from '../../platform/db.js'
import { DomainError } from '../../platform/errors.js'
import { uuidv7 } from '../../platform/ids.js'
import { pickInput } from '../../platform/pick-input.js'
import { record } from '../audit/index.js'

const KEEP_MS = 30 * 86_400_000

/**
 * @typedef {'product' | 'category' | 'attribute' | 'collection' | 'promo' | 'page'} Kind
 * @typedef {{ staffId: string, name: string, role: string, permissions: ReadonlySet<string> }} Actor
 * @typedef {{ ip: string, userAgent: string, requestId: string }} RequestInfo
 * @typedef {object} KindDef
 * @property {import('@noor/contract').z.ZodType} input what `create` takes
 * @property {(view: any) => string} label
 * @property {string} write the permission a restore needs
 * @property {string} remove the permission a delete (and an emptying of the trash) needs
 * @property {(actor: Actor, input: any, req: RequestInfo) => Promise<{ id: string }>} create
 * @property {(view: any, input: any) => any} [prepare] last changes to what is kept or put back (stock, status)
 */

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {Record<Kind, KindDef>} deps.kinds
 * @param {{ error: (o: object, msg: string) => void }} [deps.log]
 */
export function createTrash({ db, kinds, log }) {
  /** @param {Actor} a @param {RequestInfo} req */
  const audit = (a, req) => ({ actor: { type: /** @type {const} */ ('staff'), id: a.staffId, label: a.name, role: a.role }, ip: req.ip, userAgent: req.userAgent, requestId: req.requestId })

  /** @param {Kind} kind @param {any} view @param {Actor} actor */
  async function keep(kind, view, actor) {
    const def = kinds[kind]
    const at = now()
    const input = def.prepare ? def.prepare(view, pickInput(def.input, view)) : pickInput(def.input, view)
    await db.insert(trashItems).values({
      id: uuidv7(), kind, label: def.label(view).slice(0, 160), payload: input, deletedAt: at, deletedById: actor.staffId, deletedByName: actor.name.slice(0, 100), expiresAt: new Date(at.getTime() + KEEP_MS),
    })
  }

  return {
    /**
     * Makes a service's delete keep a copy. The copy is read before the delete and written after it succeeded: a delete that is refused (the record is in use) keeps nothing, and a copy that cannot be
     * written never stops a delete that already happened (it is logged).
     * @param {Record<string, any>} service @param {string} method @param {Kind} kind @param {(id: string) => Promise<any>} snapshot
     */
    guard(service, method, kind, snapshot) {
      const original = service[method]
      service[method] = async (/** @type {Actor} */ actor, /** @type {string} */ id, /** @type {unknown[]} */ ...rest) => {
        const view = await snapshot(id).catch(() => undefined)
        const out = await original.call(service, actor, id, ...rest)
        if (view) await keep(kind, view, actor).catch((e) => log?.error({ err: e, kind, id }, 'the trash could not keep a deleted record'))
        return out
      }
    },

    /** What is in the trash and may still be put back, newest first, only of the kinds this person may restore. @param {Actor} actor */
    async list(actor) {
      const rows = await db
        .select()
        .from(trashItems)
        .where(and(isNull(trashItems.restoredAt), gt(trashItems.expiresAt, now())))
        .orderBy(desc(trashItems.deletedAt))
        .limit(500)
      return { items: rows.filter((r) => actor.permissions.has(kinds[/** @type {Kind} */ (r.kind)].write)).map((r) => ({ id: r.id, kind: /** @type {Kind} */ (r.kind), label: r.label, deletedAt: r.deletedAt.toISOString(), ...(r.deletedByName ? { deletedBy: r.deletedByName } : {}), expiresAt: r.expiresAt.toISOString() })) }
    },

    /**
     * Puts it back: the record is made again from the kept copy (a new id, the same words). It must pass every rule of a create now. On success the copy leaves the trash.
     * @param {Actor} actor @param {string} id @param {RequestInfo} req
     */
    async restore(actor, id, req) {
      const [row] = await db.select().from(trashItems).where(eq(trashItems.id, id))
      if (!row || row.restoredAt || row.expiresAt <= now()) throw new DomainError('not_found')
      const kind = /** @type {Kind} */ (row.kind)
      const def = kinds[kind]
      if (!actor.permissions.has(def.write)) throw new DomainError('forbidden')
      const made = await def.create(actor, row.payload, req)
      await transaction(db, async (tx) => {
        await tx.update(trashItems).set({ restoredAt: now() }).where(eq(trashItems.id, id))
        await record(tx, { ...audit(actor, req), action: 'trash.restored', entityType: kind, entityId: made.id, entityLabel: row.label, category: 'general' })
      })
      return { kind, id: made.id, label: row.label }
    },

    /** Gone for good, now: the same permission as deleting it. @param {Actor} actor @param {string} id @param {RequestInfo} req */
    async purge(actor, id, req) {
      await transaction(db, async (tx) => {
        const [row] = await tx.select().from(trashItems).where(eq(trashItems.id, id)).for('update')
        if (!row || row.restoredAt) throw new DomainError('not_found')
        if (!actor.permissions.has(kinds[/** @type {Kind} */ (row.kind)].remove)) throw new DomainError('forbidden')
        await tx.delete(trashItems).where(eq(trashItems.id, id))
        await record(tx, { ...audit(actor, req), action: 'trash.purged', entityType: row.kind, entityId: id, entityLabel: row.label, category: 'general' })
      })
    },

    /** Copies past their 30 days, and restored ones a week after. */
    async cleanup() {
      const at = now()
      await db.delete(trashItems).where(or(lt(trashItems.expiresAt, at), and(isNotNull(trashItems.restoredAt), lt(trashItems.restoredAt, new Date(at.getTime() - 7 * 86_400_000)))))
    },
  }
}
