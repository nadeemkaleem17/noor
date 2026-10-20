// Delivery people, runs, the cash they hold and the receipts (plan/18-delivery-assignment-ledger-receipts.md).
// This module never writes an order: it dispatches, delivers and returns through `orders.transition` (the only writer of `orders.status`, which also records the
// cash on delivery). It writes its own tables only, and the ledger only by appending.
import { and, asc, count, desc, eq, gte, inArray, isNotNull, lt, sql, sum } from 'drizzle-orm'
import { normalizePkMobile } from '@noor/contract'
import { orderLines, orders } from '../../db/schema/orders.js'
import { couriers } from '../../db/schema/shipping.js'
import { deliveryAssignments, deliveryPeople, deliveryRuns, receipts, riderLedger } from '../../db/schema/delivery.js'
import { staffUsers } from '../../db/schema/auth.js'
import { now } from '../../platform/clock.js'
import { ensureCounter, nextValue } from '../../platform/counters.js'
import { transaction } from '../../platform/db.js'
import { DomainError } from '../../platform/errors.js'
import { uuidv7 } from '../../platform/ids.js'
import { record } from '../audit/index.js'

/**
 * @typedef {{ staffId: string, name: string, role: string }} Staff
 * @typedef {{ ip: string, userAgent: string, requestId: string }} RequestInfo
 * @typedef {import('../../platform/db.js').Executor} Db
 * @typedef {import('../../platform/db.js').Transaction} Tx
 */

const OWN_COURIER = 'Own delivery'
const PKT_MS = 5 * 3_600_000
const money = (/** @type {number} */ amount) => ({ amount, currency: /** @type {const} */ ('PKR') })
const pad = (/** @type {number} */ n, /** @type {number} */ width) => String(n).padStart(width, '0')
const runNumber = (/** @type {number} */ n) => `RUN-${pad(n, 4)}`
const receiptPrefix = /** @type {const} */ ({ customer: 'RC', deposit: 'DP', fee: 'FP' })
const iso = (/** @type {Date | null} */ d) => (d ? d.toISOString() : undefined)
const refuse = (/** @type {string} */ path, /** @type {'required' | 'invalid_format' | 'too_big'} */ code) => new DomainError('validation_failed', { issues: [{ path, code }] })
const orderNumberOf = (/** @type {{ numberPrefix: string, number: number }} */ o) => `${o.numberPrefix}-${o.number}`
/** The moment a Pakistani day begins. @param {string} day */
const dayStart = (day) => new Date(`${day}T00:00:00+05:00`)
const today = () => new Date(now().getTime() + PKT_MS).toISOString().slice(0, 10)

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {{ transition: (tx: Tx, orderId: string, input: any, actor: any, req?: any) => Promise<unknown> }} deps.orders
 * @param {{ get: (key: 'store') => Promise<{ value: import('@noor/contract').StoreSettings }> }} deps.settings
 */
export function createDeliveryService({ db, orders: orderService, settings }) {
  /** The shop's name, address and phone, for the top of a printout. */
  const shopInfo = async () => {
    const v = (await settings.get('store')).value
    return { name: v.brand.name, ...(v.contact.address ? { address: v.contact.address } : {}), ...(v.contact.phone ? { phone: v.contact.phone } : {}) }
  }
  /** @param {Staff} a @param {RequestInfo} req */
  const audit = (a, req) => ({ actor: { type: /** @type {const} */ ('staff'), id: a.staffId, label: a.name, role: a.role }, ip: req.ip, userAgent: req.userAgent, requestId: req.requestId })
  /** @param {Staff} a */
  const orderActor = (a) => ({ type: /** @type {const} */ ('staff'), id: a.staffId, label: a.name, role: a.role })

  // ---------------------------------------------------------------------------------------------------------------- people
  /** @param {Db} x */
  async function balances(x) {
    const rows = await x.select({ personId: riderLedger.personId, total: sum(riderLedger.amountMinor) }).from(riderLedger).groupBy(riderLedger.personId)
    return new Map(rows.map((r) => [r.personId, Number(r.total ?? 0)]))
  }
  /** @param {Db} x */
  async function outCounts(x) {
    const rows = await x.select({ personId: deliveryRuns.personId, n: count() }).from(deliveryAssignments).innerJoin(deliveryRuns, eq(deliveryRuns.id, deliveryAssignments.runId)).where(inArray(deliveryAssignments.status, ['out', 'failed'])).groupBy(deliveryRuns.personId)
    return new Map(rows.map((r) => [r.personId, r.n]))
  }
  /** @param {typeof deliveryPeople.$inferSelect} p @param {Map<string, number>} bal @param {Map<string, number>} out */
  const personView = (p, bal, out) => ({
    id: p.id,
    name: p.name,
    phone: p.phone,
    kind: p.kind,
    ...(p.courierId ? { courierId: p.courierId } : {}),
    ...(p.feeMinor ? { fee: money(p.feeMinor) } : {}),
    active: p.active,
    ...(p.note ? { note: p.note } : {}),
    balance: money(bal.get(p.id) ?? 0),
    ordersOut: out.get(p.id) ?? 0,
    version: p.version,
  })
  /** @param {Db} x @param {string} id */
  async function loadPerson(x, id) {
    const [p] = await x.select().from(deliveryPeople).where(eq(deliveryPeople.id, id))
    if (!p) throw new DomainError('not_found')
    const [bal, out] = await Promise.all([balances(x), outCounts(x)])
    return personView(p, bal, out)
  }
  /** @param {import('@noor/contract').z.infer<typeof import('@noor/contract').DeliveryPersonInput>} input */
  function personFields(input) {
    const phone = normalizePkMobile(input.phone)
    if (!phone) throw refuse('phone', 'invalid_format')
    return { name: input.name, phone, kind: input.kind, courierId: input.courierId ?? null, feeMinor: input.fee?.amount ?? 0, active: input.active, note: input.note ?? null }
  }

  // ---------------------------------------------------------------------------------------------------------------- ledger and receipts
  /** @param {Tx} tx @param {{ personId: string, kind: typeof riderLedger.$inferInsert['kind'], amount: number, orderId?: string, assignmentId?: string, runId?: string, receiptId?: string, reversesId?: string, note?: string, actorId?: string }} e */
  async function append(tx, e) {
    const id = uuidv7()
    await tx.insert(riderLedger).values({
      id, personId: e.personId, kind: e.kind, amountMinor: e.amount,
      orderId: e.orderId ?? null, assignmentId: e.assignmentId ?? null, runId: e.runId ?? null, receiptId: e.receiptId ?? null, reversesId: e.reversesId ?? null,
      note: e.note ?? null, actorId: e.actorId ?? null, createdAt: now(),
    })
    return id
  }
  /** @param {Tx} tx @param {'customer' | 'deposit' | 'fee'} kind @param {{ personId: string, orderId?: string, amount: number, actorId: string }} r */
  async function issueReceipt(tx, kind, r) {
    const counter = `receipt_${kind}`
    await ensureCounter(tx, counter, 0)
    const number = `${receiptPrefix[kind]}-${pad(await nextValue(tx, counter), 6)}`
    const id = uuidv7()
    await tx.insert(receipts).values({ id, number, kind, personId: r.personId, orderId: r.orderId ?? null, amountMinor: r.amount, issuedBy: r.actorId, issuedAt: now() })
    return { id, number }
  }
  /** @param {Db} x @param {string} id */
  async function receiptView(x, id) {
    const [r] = await x
      .select({ r: receipts, personName: deliveryPeople.name, issuer: staffUsers.name, num: orders.number, prefix: orders.numberPrefix, customer: orders.customerName })
      .from(receipts)
      .innerJoin(deliveryPeople, eq(deliveryPeople.id, receipts.personId))
      .leftJoin(staffUsers, eq(staffUsers.id, receipts.issuedBy))
      .leftJoin(orders, eq(orders.id, receipts.orderId))
      .where(eq(receipts.id, id))
    if (!r) throw new DomainError('not_found')
    return { ...receiptFull(r), shop: await shopInfo() }
  }
  /** @param {{ r: typeof receipts.$inferSelect, personName: string, issuer: string | null, num: number | null, prefix: string | null, customer: string | null }} r */
  const receiptRow = (r) => ({
    id: r.r.id, number: r.r.number, kind: r.r.kind, personId: r.r.personId, personName: r.personName,
    ...(r.num !== null && r.prefix ? { orderNumber: orderNumberOf({ number: r.num, numberPrefix: r.prefix }) } : {}),
    amount: money(r.r.amountMinor), status: r.r.status, ...(r.r.voidReason ? { voidReason: r.r.voidReason } : {}), issuedAt: r.r.issuedAt.toISOString(),
  })
  /** The receipt itself: the row, and who issued it, when it was voided and who it was for. @param {Parameters<typeof receiptRow>[0]} r */
  const receiptFull = (r) => ({ ...receiptRow(r), ...(r.issuer ? { issuedBy: r.issuer } : {}), ...(r.r.voidedAt ? { voidedAt: r.r.voidedAt.toISOString() } : {}), ...(r.customer ? { customerName: r.customer } : {}) })

  /** @param {Db} x @param {string} personId @param {{ from?: string, to?: string }} range */
  async function statement(x, personId, range) {
    const person = await loadPerson(x, personId)
    const from = range.from ? dayStart(range.from) : undefined
    const to = range.to ? new Date(dayStart(range.to).getTime() + 86_400_000) : undefined
    const openingRow = from ? await x.select({ total: sum(riderLedger.amountMinor) }).from(riderLedger).where(and(eq(riderLedger.personId, personId), lt(riderLedger.createdAt, from))) : []
    const opening = Number(openingRow[0]?.total ?? 0)
    const rows = await x
      .select({ e: riderLedger, num: orders.number, prefix: orders.numberPrefix, runNo: deliveryRuns.number, receiptNo: receipts.number, actor: staffUsers.name })
      .from(riderLedger)
      .leftJoin(orders, eq(orders.id, riderLedger.orderId))
      .leftJoin(deliveryRuns, eq(deliveryRuns.id, riderLedger.runId))
      .leftJoin(receipts, eq(receipts.id, riderLedger.receiptId))
      .leftJoin(staffUsers, eq(staffUsers.id, riderLedger.actorId))
      .where(and(eq(riderLedger.personId, personId), from ? gte(riderLedger.createdAt, from) : undefined, to ? lt(riderLedger.createdAt, to) : undefined))
      .orderBy(asc(riderLedger.createdAt), asc(riderLedger.id))
    let running = opening
    const entries = rows.map((r) => {
      running += r.e.amountMinor
      return {
        id: r.e.id, kind: r.e.kind, amount: money(r.e.amountMinor), balance: money(running),
        ...(r.num !== null && r.prefix ? { orderNumber: orderNumberOf({ number: r.num, numberPrefix: r.prefix }) } : {}),
        ...(r.runNo !== null ? { runNumber: runNumber(r.runNo) } : {}), ...(r.receiptNo ? { receiptNumber: r.receiptNo } : {}),
        ...(r.e.note ? { note: r.e.note } : {}), ...(r.actor ? { actor: r.actor } : {}), createdAt: r.e.createdAt.toISOString(),
      }
    })
    return { person, opening: money(opening), closing: money(running), entries }
  }

  // ---------------------------------------------------------------------------------------------------------------- runs
  /** @param {Db} x @param {string} runId */
  async function runView(x, runId) {
    const [run] = await x.select({ r: deliveryRuns, personName: deliveryPeople.name }).from(deliveryRuns).innerJoin(deliveryPeople, eq(deliveryPeople.id, deliveryRuns.personId)).where(eq(deliveryRuns.id, runId))
    if (!run) throw new DomainError('not_found')
    const rows = await x
      .select({ a: deliveryAssignments, o: orders })
      .from(deliveryAssignments)
      .innerJoin(orders, eq(orders.id, deliveryAssignments.orderId))
      .where(and(eq(deliveryAssignments.runId, runId), sql`${deliveryAssignments.status} <> 'removed'`))
      .orderBy(asc(orders.number))
    const orderIds = rows.map((r) => r.o.id)
    const rc = orderIds.length ? await x.select().from(receipts).where(and(inArray(receipts.orderId, orderIds), eq(receipts.kind, 'customer'), eq(receipts.status, 'issued'))) : []
    const receiptOf = new Map(rc.map((r) => [r.orderId, r]))
    const assignments = rows.map(({ a, o }) => ({
      id: a.id, orderId: o.id, orderNumber: orderNumberOf(o), customerName: o.customerName, phone: o.customerPhone, city: o.shipCity,
      address: [o.shipAddress, o.shipLandmark].filter(Boolean).join(', '), status: a.status, cashDue: money(a.cashDueMinor), collected: money(a.collectedMinor),
      ...(a.failReason ? { failReason: a.failReason } : {}), ...(receiptOf.get(o.id) ? { receiptId: receiptOf.get(o.id)?.id, receiptNumber: receiptOf.get(o.id)?.number } : {}),
      ...(a.resolvedAt ? { resolvedAt: a.resolvedAt.toISOString() } : {}),
    }))
    return {
      shop: await shopInfo(), id: run.r.id, number: runNumber(run.r.number), personId: run.r.personId, personName: run.personName, runDate: run.r.runDate, status: run.r.status,
      orders: assignments.length, cashDue: money(assignments.reduce((s, a) => s + a.cashDue.amount, 0)), collected: money(assignments.reduce((s, a) => s + a.collected.amount, 0)),
      createdAt: run.r.createdAt.toISOString(), ...(run.r.note ? { note: run.r.note } : {}), ...(run.r.outAt ? { outAt: iso(run.r.outAt) } : {}), ...(run.r.closedAt ? { closedAt: iso(run.r.closedAt) } : {}),
      assignments,
    }
  }
  /** The courier a person's orders are dispatched with: their own, or the shop's "Own delivery" (made the first time it is needed). @param {Tx} tx @param {typeof deliveryPeople.$inferSelect} person */
  async function courierFor(tx, person) {
    if (person.courierId) return person.courierId
    const [own] = await tx.select().from(couriers).where(eq(couriers.name, OWN_COURIER))
    if (own) return own.id
    const id = uuidv7()
    await tx.insert(couriers).values({ id, name: OWN_COURIER, trackingUrlPattern: null, trackingRequired: false, enabled: true, sortOrder: 99 })
    return id
  }
  /** The assignment and its run and person, locked. @param {Tx} tx @param {string} assignmentId */
  async function lockAssignment(tx, assignmentId) {
    const [a] = await tx.select().from(deliveryAssignments).where(eq(deliveryAssignments.id, assignmentId)).for('update')
    if (!a) throw new DomainError('not_found')
    const [run] = await tx.select().from(deliveryRuns).where(eq(deliveryRuns.id, a.runId)).for('update')
    const [person] = await tx.select().from(deliveryPeople).where(eq(deliveryPeople.id, /** @type {NonNullable<typeof run>} */ (run).personId))
    const [order] = await tx.select().from(orders).where(eq(orders.id, a.orderId)).for('update')
    return { a, run: /** @type {NonNullable<typeof run>} */ (run), person: /** @type {NonNullable<typeof person>} */ (person), order: /** @type {NonNullable<typeof order>} */ (order) }
  }
  /** What the customer still has to pay on delivery, in paisa: nothing for an order paid in advance. @param {typeof orders.$inferSelect} o */
  const cashDueOf = (o) => (o.paymentMethod === 'cod' ? Math.max(0, o.totalMinor - (o.paidMinor - o.refundedMinor)) : 0)

  return {
    // ================================================================================================================ people
    async listPeople() {
      const [rows, bal, out] = await Promise.all([db.select().from(deliveryPeople).orderBy(desc(deliveryPeople.active), asc(deliveryPeople.name)), balances(db), outCounts(db)])
      return { items: rows.map((p) => personView(p, bal, out)) }
    },

    /** @param {Staff} actor @param {import('@noor/contract').z.infer<typeof import('@noor/contract').DeliveryPersonInput>} input @param {RequestInfo} req */
    async createPerson(actor, input, req) {
      const fields = personFields(input)
      const id = uuidv7()
      const at = now()
      await transaction(db, async (tx) => {
        await tx.insert(deliveryPeople).values({ id, ...fields, createdAt: at, updatedAt: at })
        await record(tx, { ...audit(actor, req), action: 'delivery_person.created', entityType: 'delivery_person', entityId: id, entityLabel: fields.name })
      })
      return loadPerson(db, id)
    },

    /** @param {Staff} actor @param {string} id @param {import('@noor/contract').z.infer<typeof import('@noor/contract').DeliveryPersonInput> & { version: number }} input @param {RequestInfo} req */
    async updatePerson(actor, id, input, req) {
      const fields = personFields(input)
      await transaction(db, async (tx) => {
        const [p] = await tx.select().from(deliveryPeople).where(eq(deliveryPeople.id, id)).for('update')
        if (!p) throw new DomainError('not_found')
        if (p.version !== input.version) throw new DomainError('stale_write', { currentVersion: p.version })
        await tx.update(deliveryPeople).set({ ...fields, version: p.version + 1, updatedAt: now() }).where(eq(deliveryPeople.id, id))
        await record(tx, { ...audit(actor, req), action: 'delivery_person.updated', entityType: 'delivery_person', entityId: id, entityLabel: fields.name })
      })
      return loadPerson(db, id)
    },

    // ================================================================================================================ assignment
    /**
     * Puts the orders on one run of one person, today's or the date given. An order that cannot go (not confirmed, already on a run, gone) is skipped with the reason, and the rest are still assigned.
     * @param {Staff} actor @param {{ personId: string, orderIds: string[], runDate?: string, note?: string }} input @param {RequestInfo} req
     */
    async assign(actor, input, req) {
      return transaction(db, async (tx) => {
        const [person] = await tx.select().from(deliveryPeople).where(eq(deliveryPeople.id, input.personId)).for('update')
        if (!person) throw new DomainError('not_found')
        if (!person.active) throw refuse('personId', 'invalid_format')
        const ids = [...new Set(input.orderIds)].toSorted()
        const found = await tx.select().from(orders).where(inArray(orders.id, ids)).orderBy(asc(orders.id)).for('update')
        const byId = new Map(found.map((o) => [o.id, o]))
        const live = await tx.select({ orderId: deliveryAssignments.orderId }).from(deliveryAssignments).where(and(inArray(deliveryAssignments.orderId, ids), isNotNull(deliveryAssignments.openKey)))
        const liveSet = new Set(live.map((l) => l.orderId))
        /** @type {string[]} */
        const assigned = []
        /** @type {{ id: string, code: string, detail?: string }[]} */
        const skipped = []
        const runDate = input.runDate ?? today()
        for (const id of input.orderIds.filter((x, i, all) => all.indexOf(x) === i)) {
          const o = byId.get(id)
          if (!o) skipped.push({ id, code: 'not_found' })
          else if (liveSet.has(id)) skipped.push({ id, code: 'already_assigned', detail: `${orderNumberOf(o)} is already on a delivery run.` })
          else if (o.status !== 'confirmed') skipped.push({ id, code: 'not_assignable', detail: `${orderNumberOf(o)} is ${o.status.replace('_', ' ')}: only confirmed orders can be given to a rider.` })
          else assigned.push(id)
        }
        if (!assigned.length) return { assigned, skipped }
        let [run] = await tx.select().from(deliveryRuns).where(and(eq(deliveryRuns.personId, person.id), eq(deliveryRuns.runDate, runDate), eq(deliveryRuns.status, 'open'))).for('update')
        const at = now()
        if (!run) {
          await ensureCounter(tx, 'delivery_run', 0)
          const number = await nextValue(tx, 'delivery_run')
          const id = uuidv7()
          await tx.insert(deliveryRuns).values({ id, number, personId: person.id, runDate, status: 'open', note: input.note ?? null, createdBy: actor.staffId, createdAt: at, updatedAt: at })
          ;[run] = await tx.select().from(deliveryRuns).where(eq(deliveryRuns.id, id))
        }
        const theRun = /** @type {NonNullable<typeof run>} */ (run)
        for (const id of assigned) {
          const o = /** @type {NonNullable<ReturnType<typeof byId.get>>} */ (byId.get(id))
          await tx.insert(deliveryAssignments).values({ id: uuidv7(), runId: theRun.id, orderId: id, status: 'assigned', cashDueMinor: cashDueOf(o), openKey: id, assignedAt: at })
        }
        await record(tx, { ...audit(actor, req), action: 'delivery.assigned', entityType: 'delivery_run', entityId: theRun.id, entityLabel: `${runNumber(theRun.number)}, ${person.name}`, category: 'money' })
        return { runId: theRun.id, number: runNumber(theRun.number), assigned, skipped }
      })
    },

    /** Gives the run to the rider: each order is dispatched, and the cash to collect is put on the rider's ledger. @param {Staff} actor @param {string} runId @param {RequestInfo} req */
    async sendOut(actor, runId, req) {
      await transaction(db, async (tx) => {
        const [run] = await tx.select().from(deliveryRuns).where(eq(deliveryRuns.id, runId)).for('update')
        if (!run) throw new DomainError('not_found')
        if (run.status !== 'open') throw new DomainError('action_not_allowed')
        const [person] = await tx.select().from(deliveryPeople).where(eq(deliveryPeople.id, run.personId))
        const items = await tx.select().from(deliveryAssignments).where(and(eq(deliveryAssignments.runId, runId), eq(deliveryAssignments.status, 'assigned'))).orderBy(asc(deliveryAssignments.orderId)).for('update')
        if (!items.length) throw refuse('runId', 'required')
        const courierId = await courierFor(tx, /** @type {NonNullable<typeof person>} */ (person))
        const at = now()
        for (const a of items) {
          const [order] = await tx.select().from(orders).where(eq(orders.id, a.orderId)).for('update')
          const o = /** @type {NonNullable<typeof order>} */ (order)
          if (o.status !== 'confirmed') {
            // it changed since it was assigned (cancelled, say): it leaves the run instead of being sent
            await tx.update(deliveryAssignments).set({ status: 'removed', openKey: null, resolvedAt: at, failReason: `the order became ${o.status}` }).where(eq(deliveryAssignments.id, a.id))
            continue
          }
          await orderService.transition(tx, o.id, { version: o.version, to: 'dispatched', courierId, trackingNumber: runNumber(run.number) }, orderActor(actor), req)
          await tx.update(deliveryAssignments).set({ status: 'out', outAt: at }).where(eq(deliveryAssignments.id, a.id))
          if (a.cashDueMinor > 0) await append(tx, { personId: run.personId, kind: 'cash_due', amount: a.cashDueMinor, orderId: o.id, assignmentId: a.id, runId, actorId: actor.staffId })
        }
        await tx.update(deliveryRuns).set({ status: 'out', outAt: at, updatedAt: at }).where(eq(deliveryRuns.id, runId))
        await record(tx, { ...audit(actor, req), action: 'delivery.sent_out', entityType: 'delivery_run', entityId: runId, entityLabel: runNumber(run.number), category: 'money' })
      })
      return runView(db, runId)
    },

    /** The order reached the customer and the rider collected the cash: delivered through the order rules, the customer's receipt issued, the rider's fee credited. @param {Staff} actor @param {string} assignmentId @param {RequestInfo} req */
    async deliver(actor, assignmentId, req) {
      const runId = await transaction(db, async (tx) => {
        const { a, run, person, order } = await lockAssignment(tx, assignmentId)
        if (a.status !== 'out' && a.status !== 'failed') throw new DomainError('action_not_allowed')
        await orderService.transition(tx, order.id, { version: order.version, to: 'delivered', cashReceived: a.cashDueMinor > 0 }, orderActor(actor), req)
        await tx.update(deliveryAssignments).set({ status: 'delivered', collectedMinor: a.cashDueMinor, failReason: null, openKey: null, resolvedAt: now() }).where(eq(deliveryAssignments.id, a.id))
        if (a.cashDueMinor > 0) await issueReceipt(tx, 'customer', { personId: person.id, orderId: order.id, amount: a.cashDueMinor, actorId: actor.staffId })
        if (person.feeMinor > 0) await append(tx, { personId: person.id, kind: 'fee', amount: -person.feeMinor, orderId: order.id, assignmentId: a.id, runId: run.id, note: 'Fee for the delivery', actorId: actor.staffId })
        await record(tx, { ...audit(actor, req), action: 'delivery.delivered', entityType: 'delivery_run', entityId: run.id, entityLabel: orderNumberOf(order), category: 'money' })
        return run.id
      })
      return runView(db, runId)
    },

    /** The rider could not deliver: the cash stays on the rider until the parcel is back. @param {Staff} actor @param {string} assignmentId @param {string} reason @param {RequestInfo} req */
    async fail(actor, assignmentId, reason, req) {
      const runId = await transaction(db, async (tx) => {
        const { a, run, order } = await lockAssignment(tx, assignmentId)
        if (a.status !== 'out') throw new DomainError('action_not_allowed')
        await tx.update(deliveryAssignments).set({ status: 'failed', failReason: reason }).where(eq(deliveryAssignments.id, a.id))
        await record(tx, { ...audit(actor, req), action: 'delivery.failed', entityType: 'delivery_run', entityId: run.id, entityLabel: `${orderNumberOf(order)}: ${reason}`, category: 'money' })
        return run.id
      })
      return runView(db, runId)
    },

    /** The parcel is back at the shop: the order is returned through the order rules, and the cash that was on the rider is taken off their ledger. @param {Staff} actor @param {string} assignmentId @param {RequestInfo} req */
    async returnToShop(actor, assignmentId, req) {
      const runId = await transaction(db, async (tx) => {
        const { a, run, person, order } = await lockAssignment(tx, assignmentId)
        if (a.status !== 'out' && a.status !== 'failed') throw new DomainError('action_not_allowed')
        const lines = await tx.select().from(orderLines).where(eq(orderLines.orderId, order.id))
        await orderService.transition(
          tx,
          order.id,
          { version: order.version, to: 'returned', returnType: 'undelivered', lines: lines.map((l) => ({ lineId: l.id, quantity: l.quantity - l.returnedQuantity, restock: true })), note: a.failReason ?? 'Returned by the rider' },
          orderActor(actor),
          req,
        )
        await tx.update(deliveryAssignments).set({ status: 'returned', openKey: null, resolvedAt: now() }).where(eq(deliveryAssignments.id, a.id))
        if (a.cashDueMinor > 0) await append(tx, { personId: person.id, kind: 'cash_returned', amount: -a.cashDueMinor, orderId: order.id, assignmentId: a.id, runId: run.id, note: 'Parcel returned to the shop', actorId: actor.staffId })
        await record(tx, { ...audit(actor, req), action: 'delivery.returned', entityType: 'delivery_run', entityId: run.id, entityLabel: orderNumberOf(order), category: 'money' })
        return run.id
      })
      return runView(db, runId)
    },

    /** Takes an order off a run that has not gone out yet. @param {Staff} actor @param {string} assignmentId @param {RequestInfo} req */
    async remove(actor, assignmentId, req) {
      const runId = await transaction(db, async (tx) => {
        const { a, run, order } = await lockAssignment(tx, assignmentId)
        if (a.status !== 'assigned') throw new DomainError('action_not_allowed')
        await tx.update(deliveryAssignments).set({ status: 'removed', openKey: null, resolvedAt: now() }).where(eq(deliveryAssignments.id, a.id))
        await record(tx, { ...audit(actor, req), action: 'delivery.removed', entityType: 'delivery_run', entityId: run.id, entityLabel: orderNumberOf(order) })
        return run.id
      })
      return runView(db, runId)
    },

    /** Ends the day's sheet: nothing may still be out with the rider. A run that never went out is cancelled with its orders. @param {Staff} actor @param {string} runId @param {RequestInfo} req */
    async close(actor, runId, req) {
      await transaction(db, async (tx) => {
        const [run] = await tx.select().from(deliveryRuns).where(eq(deliveryRuns.id, runId)).for('update')
        if (!run) throw new DomainError('not_found')
        if (run.status === 'closed') throw new DomainError('action_not_allowed')
        const items = await tx.select().from(deliveryAssignments).where(eq(deliveryAssignments.runId, runId)).for('update')
        if (items.some((a) => a.status === 'out')) throw new DomainError('action_not_allowed', { reason: 'orders_still_out' })
        const at = now()
        for (const a of items.filter((x) => x.status === 'assigned')) await tx.update(deliveryAssignments).set({ status: 'removed', openKey: null, resolvedAt: at }).where(eq(deliveryAssignments.id, a.id))
        await tx.update(deliveryRuns).set({ status: 'closed', closedAt: at, updatedAt: at }).where(eq(deliveryRuns.id, runId))
        await record(tx, { ...audit(actor, req), action: 'delivery.closed', entityType: 'delivery_run', entityId: runId, entityLabel: runNumber(run.number) })
      })
      return runView(db, runId)
    },

    /** @param {{ page: number, size: number, status?: 'open' | 'out' | 'closed', personId?: string }} q */
    async listRuns(q) {
      const where = and(q.status ? eq(deliveryRuns.status, q.status) : undefined, q.personId ? eq(deliveryRuns.personId, q.personId) : undefined)
      const [rows, total] = await Promise.all([
        db.select({ r: deliveryRuns, personName: deliveryPeople.name }).from(deliveryRuns).innerJoin(deliveryPeople, eq(deliveryPeople.id, deliveryRuns.personId)).where(where).orderBy(desc(deliveryRuns.runDate), desc(deliveryRuns.number)).limit(q.size).offset((q.page - 1) * q.size),
        db.select({ n: count() }).from(deliveryRuns).where(where),
      ])
      const ids = rows.map((r) => r.r.id)
      const sums = ids.length
        ? await db.select({ runId: deliveryAssignments.runId, orders: count(), due: sum(deliveryAssignments.cashDueMinor), got: sum(deliveryAssignments.collectedMinor) }).from(deliveryAssignments).where(and(inArray(deliveryAssignments.runId, ids), sql`${deliveryAssignments.status} <> 'removed'`)).groupBy(deliveryAssignments.runId)
        : []
      const byRun = new Map(sums.map((s) => [s.runId, s]))
      return {
        items: rows.map(({ r, personName }) => ({
          id: r.id, number: runNumber(r.number), personId: r.personId, personName, runDate: r.runDate, status: r.status,
          orders: byRun.get(r.id)?.orders ?? 0, cashDue: money(Number(byRun.get(r.id)?.due ?? 0)), collected: money(Number(byRun.get(r.id)?.got ?? 0)), createdAt: r.createdAt.toISOString(),
        })),
        total: total[0]?.n ?? 0, page: q.page, size: q.size,
      }
    },

    /** @param {string} id */
    getRun: (id) => runView(db, id),

    /** Every time an order was on a run, newest first: the delivery panel of the order page. @param {string} orderId */
    async ofOrder(orderId) {
      const rows = await db
        .select({ a: deliveryAssignments, o: orders, run: deliveryRuns, p: deliveryPeople })
        .from(deliveryAssignments)
        .innerJoin(orders, eq(orders.id, deliveryAssignments.orderId))
        .innerJoin(deliveryRuns, eq(deliveryRuns.id, deliveryAssignments.runId))
        .innerJoin(deliveryPeople, eq(deliveryPeople.id, deliveryRuns.personId))
        .where(eq(deliveryAssignments.orderId, orderId))
        .orderBy(desc(deliveryAssignments.assignedAt))
      const rc = await db.select().from(receipts).where(and(eq(receipts.orderId, orderId), eq(receipts.kind, 'customer'), eq(receipts.status, 'issued')))
      return {
        items: rows.map(({ a, o, run, p }) => ({
          id: a.id, orderId: o.id, orderNumber: orderNumberOf(o), customerName: o.customerName, phone: o.customerPhone, city: o.shipCity, address: [o.shipAddress, o.shipLandmark].filter(Boolean).join(', '),
          status: a.status, cashDue: money(a.cashDueMinor), collected: money(a.collectedMinor), ...(a.failReason ? { failReason: a.failReason } : {}),
          ...(rc[0] && a.status === 'delivered' ? { receiptId: rc[0].id, receiptNumber: rc[0].number } : {}), ...(a.resolvedAt ? { resolvedAt: a.resolvedAt.toISOString() } : {}),
          runId: run.id, runNumber: runNumber(run.number), personId: p.id, personName: p.name, assignedAt: a.assignedAt.toISOString(),
        })),
      }
    },

    // ================================================================================================================ ledger
    /** @param {string} personId @param {{ from?: string, to?: string }} range */
    statement: (personId, range) => statement(db, personId, range),

    /** The rider hands cash in. @param {Staff} actor @param {string} personId @param {{ amount: number, note?: string }} input @param {RequestInfo} req */
    async deposit(actor, personId, input, req) {
      const id = await transaction(db, async (tx) => {
        const [p] = await tx.select().from(deliveryPeople).where(eq(deliveryPeople.id, personId)).for('update')
        if (!p) throw new DomainError('not_found')
        const r = await issueReceipt(tx, 'deposit', { personId, amount: input.amount, actorId: actor.staffId })
        await append(tx, { personId, kind: 'deposit', amount: -input.amount, receiptId: r.id, note: input.note, actorId: actor.staffId })
        await record(tx, { ...audit(actor, req), action: 'delivery.deposit', entityType: 'delivery_person', entityId: personId, entityLabel: `${p.name}: ${r.number}`, category: 'money' })
        return r.id
      })
      return receiptView(db, id)
    },

    /** The shop pays the rider the fees they earned. @param {Staff} actor @param {string} personId @param {{ amount: number, note?: string }} input @param {RequestInfo} req */
    async payFee(actor, personId, input, req) {
      const id = await transaction(db, async (tx) => {
        const [p] = await tx.select().from(deliveryPeople).where(eq(deliveryPeople.id, personId)).for('update')
        if (!p) throw new DomainError('not_found')
        const r = await issueReceipt(tx, 'fee', { personId, amount: input.amount, actorId: actor.staffId })
        await append(tx, { personId, kind: 'fee_paid', amount: input.amount, receiptId: r.id, note: input.note, actorId: actor.staffId })
        await record(tx, { ...audit(actor, req), action: 'delivery.fee_paid', entityType: 'delivery_person', entityId: personId, entityLabel: `${p.name}: ${r.number}`, category: 'money' })
        return r.id
      })
      return receiptView(db, id)
    },

    /** A correction that is not a deposit or a fee, with a note saying why. @param {Staff} actor @param {string} personId @param {{ amount: number, note: string }} input @param {RequestInfo} req */
    async adjust(actor, personId, input, req) {
      await transaction(db, async (tx) => {
        const [p] = await tx.select().from(deliveryPeople).where(eq(deliveryPeople.id, personId)).for('update')
        if (!p) throw new DomainError('not_found')
        await append(tx, { personId, kind: 'adjustment', amount: input.amount, note: input.note, actorId: actor.staffId })
        await record(tx, { ...audit(actor, req), action: 'delivery.adjustment', entityType: 'delivery_person', entityId: personId, entityLabel: `${p.name}: ${input.amount}`, category: 'money' })
      })
      return statement(db, personId, {})
    },

    // ================================================================================================================ receipts
    /** @param {{ page: number, size: number, kind?: 'customer' | 'deposit' | 'fee', personId?: string, status?: 'issued' | 'void' }} q */
    async listReceipts(q) {
      const where = and(q.kind ? eq(receipts.kind, q.kind) : undefined, q.personId ? eq(receipts.personId, q.personId) : undefined, q.status ? eq(receipts.status, q.status) : undefined)
      const [rows, total] = await Promise.all([
        db
          .select({ r: receipts, personName: deliveryPeople.name, issuer: staffUsers.name, num: orders.number, prefix: orders.numberPrefix, customer: orders.customerName })
          .from(receipts)
          .innerJoin(deliveryPeople, eq(deliveryPeople.id, receipts.personId))
          .leftJoin(staffUsers, eq(staffUsers.id, receipts.issuedBy))
          .leftJoin(orders, eq(orders.id, receipts.orderId))
          .where(where)
          .orderBy(desc(receipts.issuedAt), desc(receipts.number))
          .limit(q.size)
          .offset((q.page - 1) * q.size),
        db.select({ n: count() }).from(receipts).where(where),
      ])
      return { items: rows.map((r) => receiptRow(r)), total: total[0]?.n ?? 0, page: q.page, size: q.size }
    },

    /** @param {string} id */
    getReceipt: (id) => receiptView(db, id),

    /** A receipt is never deleted: it is marked void with the reason, and what it put on the ledger is reversed. @param {Staff} actor @param {string} id @param {string} reason @param {RequestInfo} req */
    async voidReceipt(actor, id, reason, req) {
      await transaction(db, async (tx) => {
        const [r] = await tx.select().from(receipts).where(eq(receipts.id, id)).for('update')
        if (!r) throw new DomainError('not_found')
        if (r.status === 'void') throw new DomainError('action_not_allowed')
        const at = now()
        await tx.update(receipts).set({ status: 'void', voidReason: reason, voidedBy: actor.staffId, voidedAt: at }).where(eq(receipts.id, id))
        const [entry] = await tx.select().from(riderLedger).where(eq(riderLedger.receiptId, id))
        if (entry) await append(tx, { personId: r.personId, kind: 'reversal', amount: -entry.amountMinor, receiptId: id, reversesId: entry.id, note: `Receipt ${r.number} voided: ${reason}`, actorId: actor.staffId })
        await record(tx, { ...audit(actor, req), action: 'delivery.receipt_voided', entityType: 'receipt', entityId: id, entityLabel: `${r.number}: ${reason}`, category: 'money' })
      })
      return receiptView(db, id)
    },
  }
}

