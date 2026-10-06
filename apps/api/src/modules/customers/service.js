// Customers: found or made by phone number when an order is placed, flagged and annotated by staff, counted by the order transitions,
// and anonymised on request (plan/09-data-model/07-orders-payments.md section 2, plan/10-api/06 section 3, plan/11-security-auth.md section 8.2).
import { randomInt } from 'node:crypto'
import { formatPkMobileLocal, normalizePkMobile } from '@noor/contract'
import { DomainError } from '../../platform/errors.js'
import { transaction } from '../../platform/db.js'
import { now } from '../../platform/clock.js'
import { count, rupees, toCsv } from '../../platform/csv.js'
import { uuidv7 } from '../../platform/ids.js'
import { record } from '../audit/index.js'
import * as repo from './repository.js'

/**
 * @typedef {{ staffId: string, name: string, role: string }} Staff
 * @typedef {{ ip: string, userAgent: string, requestId: string }} RequestInfo
 * @typedef {import('../../platform/db.js').Executor} Db
 * @typedef {object} OrderChange what an order transition did to a customer's counters; each is a signed amount to add
 * @property {number} [orders] non-cancelled orders
 * @property {number} [delivered]
 * @property {number} [refused] returns of type refused or undelivered
 * @property {number} [cancelled]
 * @property {number} [spentMinor] delivered totals minus refunds
 * @property {Date} [orderedAt] set when the order is new: moves the first and last order times
 */

/**
 * What the orders module (M4-04) tells this one. Until orders exist there is nothing open and nothing to rewrite.
 * @typedef {object} OrdersView
 * @property {(db: Db, customerId: string) => Promise<number>} openCount orders not yet in a final status
 * @property {(db: Db, customerId: string) => Promise<{ city: string, address: string, landmark?: string, lastUsedAt: string }[]>} addresses
 * @property {(db: Db, customerId: string) => Promise<void>} anonymise clears the personal fields of the customer's orders in a final status
 */
/** @type {OrdersView} */
const noOrders = { openCount: async () => 0, addresses: async () => [], anonymise: async () => {} }

/** @param {unknown} e */
const isDuplicate = (e) => /** @type {{ cause?: { errno?: number }, errno?: number }} */ (e).cause?.errno === 1062 || /** @type {{ errno?: number }} */ (e).errno === 1062

const money = (/** @type {number} */ amount) => ({ amount, currency: /** @type {const} */ ('PKR') })
const iso = (/** @type {Date | null} */ d) => (d ? d.toISOString() : undefined)
const CHANGED = '(changed)'

/** The placeholder phone of an anonymised customer: country code 0 does not exist, so it can never be dialled or collide with a real number. */
const placeholderPhone = () => `+0${Array.from({ length: 14 }, () => randomInt(10)).join('')}`

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {OrdersView} [deps.orders]
 */
export function createCustomersService({ db, orders = noOrders }) {
  /** @param {Staff} a @param {RequestInfo} req */
  const actorOf = (a, req) => ({ actor: { type: /** @type {const} */ ('staff'), id: a.staffId, label: a.name, role: a.role }, ip: req.ip, userAgent: req.userAgent, requestId: req.requestId })

  /** @param {repo.CustomerRow} c */
  const toRow = (c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    ...(c.city ? { city: c.city } : {}),
    ordersCount: c.ordersCount,
    deliveredCount: c.deliveredCount,
    refusedCount: c.refusedCount,
    spent: money(c.spentMinor),
    ...(c.lastOrderAt ? { lastOrderAt: iso(c.lastOrderAt) } : {}),
    noCod: c.noCod,
    vip: c.vip,
    marketingConsent: c.marketingConsent,
  })

  /** @param {Db} x @param {string} id */
  async function view(x, id) {
    const c = await repo.findById(x, id)
    if (!c) throw new DomainError('not_found')
    const [notes, addresses] = await Promise.all([repo.notesOf(x, id), orders.addresses(x, id)])
    return {
      ...toRow(c),
      ...(c.email ? { email: c.email } : {}),
      ...(c.noCodReason ? { noCodReason: c.noCodReason } : {}),
      ...(c.consentNote ? { consentNote: c.consentNote } : {}),
      cancelledCount: c.cancelledCount,
      ...(c.deliveredCount > 0 ? { averageOrder: money(Math.round(c.spentMinor / c.deliveredCount)) } : {}),
      ...(c.firstOrderAt ? { firstOrderAt: iso(c.firstOrderAt) } : {}),
      addresses,
      notes: notes.map((n) => ({ id: n.id, body: n.body, ...(n.staffName ? { staffName: n.staffName } : {}), createdAt: n.createdAt.toISOString() })),
      version: c.version,
      ...(c.anonymisedAt ? { anonymisedAt: iso(c.anonymisedAt) } : {}),
    }
  }

  /** The customer with this phone number, if any: what an order needs to know about No COD. @param {Db} x @param {string} phone */
  async function findByPhone(x, phone) {
    const normalised = normalizePkMobile(phone)
    return normalised ? repo.findByPhone(x, normalised) : undefined
  }

  return {
    /**
     * Finds the customer with this phone number or makes one, and keeps the latest name, email and city (a customer is a phone number).
     * The number may be typed any way people type it; the flags and counters of an existing customer are never touched here.
     * @param {Db} tx inside the order's transaction
     * @param {{ phone: string, name: string, email?: string, city?: string }} input
     */
    async upsertByPhone(tx, input) {
      const phone = normalizePkMobile(input.phone)
      if (!phone) throw new DomainError('validation_failed', { issues: [{ path: 'phone', code: 'phone_invalid' }] })
      const at = now()
      const fresh = { name: input.name.trim().slice(0, 80), email: input.email?.trim() || null, city: input.city?.trim() || null }
      const existing = await repo.lockByPhone(tx, phone)
      if (existing) {
        await repo.update(tx, existing.id, { name: fresh.name, ...(fresh.email ? { email: fresh.email } : {}), ...(fresh.city ? { city: fresh.city } : {}), updatedAt: at })
        return /** @type {repo.CustomerRow} */ (await repo.findById(tx, existing.id))
      }
      const id = uuidv7()
      try {
        await repo.insert(tx, { id, phone, ...fresh, createdAt: at, updatedAt: at })
      } catch (e) {
        if (!isDuplicate(e)) throw e
        // another order from the same phone number got there first: use that customer
        const winner = await repo.lockByPhone(tx, phone)
        if (!winner) throw e
        return winner
      }
      return /** @type {repo.CustomerRow} */ (await repo.findById(tx, id))
    },

    /**
     * The counters change only here, in the transaction of the order transition (plan/09-data-model/07 section 2.1).
     * @param {Db} tx @param {string} customerId @param {OrderChange} change
     */
    async applyOrderChange(tx, customerId, change) {
      const d = { orders: change.orders ?? 0, delivered: change.delivered ?? 0, refused: change.refused ?? 0, cancelled: change.cancelled ?? 0, spentMinor: change.spentMinor ?? 0 }
      await repo.bump(tx, customerId, d, change.orderedAt, now())
    },

    findByPhone,

    /** Is cash on delivery switched off for this customer? @param {Db} x @param {string} id */
    async noCod(x, id) {
      return Boolean((await repo.findById(x, id))?.noCod)
    },

    /** @param {Db} x @param {string} id */
    async counters(x, id) {
      const c = await repo.findById(x, id)
      return c ? { ordersCount: c.ordersCount, deliveredCount: c.deliveredCount, refusedCount: c.refusedCount, noCod: c.noCod, vip: c.vip } : undefined
    },

    /** The customer ticked the marketing box at checkout. Never switched off from here: only staff or the customer can take consent back. @param {Db} tx @param {string} id @param {string} note */
    async recordConsent(tx, id, note) {
      await repo.update(tx, id, { marketingConsent: true, consentNote: note, updatedAt: now() })
    },

    /** @param {Parameters<typeof repo.listCustomers>[1]} query */
    async list(query) {
      const { rows, total } = await repo.listCustomers(db, query)
      return { items: rows.map(toRow), total, page: query.page, size: query.size }
    },

    /**
     * The customers of a filter as a file: personal data leaves the system, so there are at most 5,000 rows and it is written down.
     * @param {Staff} actor @param {Omit<Parameters<typeof repo.listCustomers>[1], 'page' | 'size' | 'sort'>} filter @param {RequestInfo} req
     */
    async exportCsv(actor, filter, req) {
      const { rows, total } = await repo.listCustomers(db, { ...filter, sort: 'name', page: 1, size: 5000 })
      if (total > 5000) throw new DomainError('validation_failed', { issues: [{ path: 'q', code: 'too_big' }] })
      const file = toCsv(
        ['Name', 'Phone', 'Email', 'City', 'Orders', 'Delivered', 'Refused', 'Cancelled', 'Spent', 'First order', 'Last order', 'No cash on delivery', 'VIP', 'Marketing consent'],
        rows.map((c) => [c.name, formatPkMobileLocal(c.phone), c.email, c.city, count(c.ordersCount), count(c.deliveredCount), count(c.refusedCount), count(c.cancelledCount), rupees(c.spentMinor), c.firstOrderAt?.toISOString(), c.lastOrderAt?.toISOString(), c.noCod ? 'yes' : 'no', c.vip ? 'yes' : 'no', c.marketingConsent ? 'yes' : 'no']),
      )
      await transaction(db, (tx) => record(tx, { ...actorOf(actor, req), action: 'customer.exported', entityType: 'customer', entityId: 'export', entityLabel: `${rows.length} customers`, category: 'security' }))
      return { filename: `customers-${now().toISOString().slice(0, 10)}.csv`, rowCount: rows.length, csv: file }
    },

    /** @param {string} id */
    get: (id) => view(db, id),

    /** For the staff order form: the customer behind a typed phone number, if there is one. @param {string} phone */
    async lookup(phone) {
      const c = await findByPhone(db, phone)
      return c ? { customer: toRow(c) } : {}
    },

    /** @param {Staff} actor @param {string} id @param {import('@noor/contract').z.infer<typeof import('@noor/contract').CustomerUpdate>} input @param {RequestInfo} req */
    async update(actor, id, input, req) {
      await transaction(db, async (tx) => {
        const c = await repo.lockById(tx, id)
        if (!c) throw new DomainError('not_found')
        if (c.anonymisedAt) throw new DomainError('action_not_allowed')
        if (c.version !== input.version) throw new DomainError('stale_write', { currentVersion: c.version })
        const next = {
          name: input.name,
          email: input.email ?? null,
          noCod: input.noCod,
          noCodReason: input.noCod ? (input.noCodReason ?? null) : null,
          vip: input.vip,
          marketingConsent: input.marketingConsent,
          consentNote: input.consentNote ?? null,
        }
        await repo.update(tx, id, { ...next, version: c.version + 1, updatedAt: now() })
        // the audit trail cannot be rewritten, so a name or an address never goes into it: only that it changed
        /** @type {Record<string, [unknown, unknown]>} */
        const diff = {}
        for (const k of /** @type {const} */ (['name', 'email'])) if ((c[k] ?? null) !== next[k]) diff[k] = [CHANGED, CHANGED]
        for (const k of /** @type {const} */ (['noCod', 'noCodReason', 'vip', 'marketingConsent', 'consentNote'])) if ((c[k] ?? null) !== next[k]) diff[k] = [c[k] ?? null, next[k]]
        if (Object.keys(diff).length) await record(tx, { ...actorOf(actor, req), action: 'customer.updated', entityType: 'customer', entityId: id, entityLabel: id, diff })
      })
      return view(db, id)
    },

    /** @param {Staff} actor @param {string} id @param {string} body @param {RequestInfo} req */
    async addNote(actor, id, body, req) {
      const noteId = uuidv7()
      const at = now()
      await transaction(db, async (tx) => {
        const c = await repo.lockById(tx, id)
        if (!c) throw new DomainError('not_found')
        if (c.anonymisedAt) throw new DomainError('action_not_allowed')
        await repo.insertNote(tx, { id: noteId, customerId: id, body, staffUserId: actor.staffId, createdAt: at })
        await record(tx, { ...actorOf(actor, req), action: 'customer.note_added', entityType: 'customer', entityId: id, entityLabel: id })
      })
      return { id: noteId, body, staffName: actor.name, createdAt: at.toISOString() }
    },

    /**
     * Irreversible: the name, phone, email and notes go; counts, amounts and dates stay (plan/11-security-auth.md section 8.2).
     * @param {Staff} actor @param {string} id @param {string} confirm the last 4 digits of the phone number @param {RequestInfo} req
     */
    async anonymise(actor, id, confirm, req) {
      await transaction(db, async (tx) => {
        const c = await repo.lockById(tx, id)
        if (!c) throw new DomainError('not_found')
        if (c.anonymisedAt) throw new DomainError('action_not_allowed')
        if (confirm !== c.phone.slice(-4)) throw new DomainError('validation_failed', { issues: [{ path: 'confirm', code: 'invalid_format' }] })
        const open = await orders.openCount(tx, id)
        if (open > 0) throw new DomainError('action_not_allowed', { openOrders: open })
        const at = now()
        await repo.update(tx, id, {
          name: 'Removed customer',
          phone: placeholderPhone(),
          email: null,
          city: null,
          marketingConsent: false,
          consentNote: null,
          anonymisedAt: at,
          version: c.version + 1,
          updatedAt: at,
        })
        await repo.deleteNotes(tx, id)
        await orders.anonymise(tx, id)
        await record(tx, { ...actorOf(actor, req), action: 'customer.anonymised', entityType: 'customer', entityId: id, entityLabel: id, category: 'security' })
      })
    },
  }
}
