// Customer accounts (plan/10-api/11-account.md). Registering gives a person a password for their mobile number; it does NOT give them the orders of that number. An account sees an order only when it
// was placed while signed in, or when the person adds it with the order's own link (the same proof the order page takes). So registering someone else's number shows nothing of theirs.
// Sessions are random tokens kept as SHA-256 only. A sign-in is also the one reliable moment to say which browser's visits are this customer's.
import { and, desc, eq, gt, inArray, lt } from 'drizzle-orm'
import { maskPkMobile, normalizePkMobile } from '@noor/contract'
import { customerAccounts, customerSessions, accountOrders } from '../../db/schema/accounts.js'
import { customers } from '../../db/schema/customers.js'
import { orders } from '../../db/schema/orders.js'
import { now } from '../../platform/clock.js'
import { transaction } from '../../platform/db.js'
import { DomainError } from '../../platform/errors.js'
import { uuidv7 } from '../../platform/ids.js'
import { dummyHash, hashPassword, passwordProblem, verifyPassword, needsRehash } from '../auth/password.js'
import { randomToken, sha256Hex } from '../auth/tokens.js'
import { record } from '../audit/index.js'
import { trackingToken } from '../orders/tracking.js'

const SESSION_MS = 30 * 86_400_000
const MIN_PASSWORD = 8
const money = (/** @type {number} */ amount) => ({ amount, currency: /** @type {const} */ ('PKR') })
/** @param {unknown} e */
const isDuplicate = (e) => /** @type {{ cause?: { errno?: number }, errno?: number }} */ (e).cause?.errno === 1062 || /** @type {{ errno?: number }} */ (e).errno === 1062

/**
 * @typedef {{ staffId: string, name: string, role: string }} Staff
 * @typedef {{ ip: string, userAgent: string, requestId: string }} RequestInfo
 * @typedef {import('../../platform/db.js').Executor} Db
 */

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {{ orderByToken: (token: string) => Promise<{ id: string, customerId: string }> }} deps.orders the public order service: a link is the proof of an order
 * @param {{ linkCustomer: (input: { visitor: string, customerId: string }) => Promise<void> }} deps.visits
 * @param {import('../../platform/config.js').Config} deps.config
 */
export function createAccountsService({ db, orders: publicOrders, visits, config }) {
  const problem = (/** @type {string} */ password) => passwordProblem(password, { relaxed: config.RELAXED_PASSWORDS, minLength: MIN_PASSWORD })

  /** @param {string} phone */
  const phoneOf = (phone) => {
    const e164 = normalizePkMobile(phone)
    if (!e164) throw new DomainError('validation_failed', { issues: [{ path: 'phone', code: 'phone_invalid' }] })
    return e164
  }

  /** @param {typeof customers.$inferSelect} c @param {Date} registeredAt */
  const meOf = (c, registeredAt) => ({ name: c.name, phoneMasked: maskPkMobile(c.phone), ...(c.email ? { email: c.email } : {}), registeredAt: registeredAt.toISOString() })

  /** A new session for a customer. @param {Db} x @param {string} customerId */
  async function openSession(x, customerId) {
    const token = randomToken()
    const at = now()
    const expiresAt = new Date(at.getTime() + SESSION_MS)
    await x.insert(customerSessions).values({ id: uuidv7(), customerId, tokenHash: sha256Hex(token), createdAt: at, expiresAt })
    return { token, expiresAt: expiresAt.toISOString() }
  }

  /** @param {string | undefined} visitor @param {string} customerId */
  const linkVisits = async (visitor, customerId) => {
    if (visitor) await visits.linkCustomer({ visitor, customerId }).catch(() => undefined) // never in the way of signing in
  }

  /** @param {Db} x @param {string} customerId */
  async function view(x, customerId) {
    const [row] = await x.select({ c: customers, a: customerAccounts }).from(customerAccounts).innerJoin(customers, eq(customers.id, customerAccounts.customerId)).where(eq(customerAccounts.customerId, customerId))
    if (!row) throw new DomainError('unauthenticated')
    return meOf(row.c, row.a.registeredAt)
  }

  return {
    /** @param {import('@noor/contract').z.infer<typeof import('@noor/contract').RegisterBody>} input */
    async register(input) {
      const phone = phoneOf(input.phone)
      const bad = problem(input.password)
      if (bad) throw new DomainError('password_too_weak', { reason: bad })
      const passwordHash = await hashPassword(input.password)
      const customerId = await transaction(db, async (tx) => {
        const at = now()
        let [c] = await tx.select().from(customers).where(eq(customers.phone, phone)).for('update')
        if (c?.anonymisedAt) throw new DomainError('account_exists') // an erased customer's number is not given out again
        if (!c) {
          const id = uuidv7()
          try {
            await tx.insert(customers).values({ id, phone, name: input.name.trim().slice(0, 80), email: input.email ?? null, createdAt: at, updatedAt: at })
          } catch (e) {
            if (!isDuplicate(e)) throw e
          }
          ;[c] = await tx.select().from(customers).where(eq(customers.phone, phone)).for('update')
        }
        if (!c) throw new DomainError('internal_error')
        const [existing] = await tx.select({ id: customerAccounts.customerId }).from(customerAccounts).where(eq(customerAccounts.customerId, c.id))
        if (existing) throw new DomainError('account_exists')
        // the customer row is NOT changed by registering: its name and email come from the orders placed with that number
        await tx.insert(customerAccounts).values({ customerId: c.id, passwordHash, registeredAt: at, lastLoginAt: at, updatedAt: at })
        return c.id
      })
      await linkVisits(input.visitor, customerId)
      const opened = await openSession(db, customerId)
      return { ...opened, account: await view(db, customerId) }
    },

    /** One answer for a wrong number, a number with no account and a wrong password, and the same time for all three. @param {import('@noor/contract').z.infer<typeof import('@noor/contract').LoginBody>} input */
    async login(input) {
      const phone = normalizePkMobile(input.phone)
      const [found] = phone
        ? await db.select({ id: customers.id, hash: customerAccounts.passwordHash }).from(customers).innerJoin(customerAccounts, eq(customerAccounts.customerId, customers.id)).where(eq(customers.phone, phone))
        : []
      const ok = await verifyPassword(found?.hash ?? (await dummyHash()), input.password)
      if (!found || !ok) throw new DomainError('invalid_credentials')
      const at = now()
      await db.update(customerAccounts).set({ lastLoginAt: at, updatedAt: at, ...(needsRehash(found.hash) ? { passwordHash: await hashPassword(input.password) } : {}) }).where(eq(customerAccounts.customerId, found.id))
      await linkVisits(input.visitor, found.id)
      const opened = await openSession(db, found.id)
      return { ...opened, account: await view(db, found.id) }
    },

    /** Who this session is, or `unauthenticated`. Expired sessions are never found. @param {string | undefined} token */
    async sessionOf(token) {
      if (!token) throw new DomainError('unauthenticated')
      const [row] = await db.select({ customerId: customerSessions.customerId }).from(customerSessions).where(and(eq(customerSessions.tokenHash, sha256Hex(token)), gt(customerSessions.expiresAt, now())))
      if (!row) throw new DomainError('unauthenticated')
      return { customerId: row.customerId }
    },

    /** @param {string | undefined} token */
    async logout(token) {
      if (token) await db.delete(customerSessions).where(eq(customerSessions.tokenHash, sha256Hex(token)))
    },

    /** @param {string} customerId */
    me: (customerId) => view(db, customerId),

    /** Name and email of the account: they are the customer row's, so the shop's staff see them too. @param {string} customerId @param {{ name: string, email?: string | undefined }} input */
    async update(customerId, input) {
      await db.update(customers).set({ name: input.name.trim().slice(0, 80), email: input.email ?? null, updatedAt: now() }).where(eq(customers.id, customerId))
      return view(db, customerId)
    },

    /** Every other session ends: a changed password is a reason to sign in again elsewhere. @param {string} customerId @param {string | undefined} keepToken @param {{ currentPassword: string, newPassword: string }} input */
    async changePassword(customerId, keepToken, input) {
      const [a] = await db.select().from(customerAccounts).where(eq(customerAccounts.customerId, customerId))
      if (!a || !(await verifyPassword(a.passwordHash, input.currentPassword))) throw new DomainError('invalid_credentials')
      const bad = problem(input.newPassword)
      if (bad) throw new DomainError('password_too_weak', { reason: bad })
      const passwordHash = await hashPassword(input.newPassword)
      await transaction(db, async (tx) => {
        await tx.update(customerAccounts).set({ passwordHash, updatedAt: now() }).where(eq(customerAccounts.customerId, customerId))
        const keep = keepToken ? sha256Hex(keepToken) : ''
        const rows = await tx.select({ id: customerSessions.id, hash: customerSessions.tokenHash }).from(customerSessions).where(eq(customerSessions.customerId, customerId))
        const gone = rows.filter((r) => r.hash !== keep).map((r) => r.id)
        if (gone.length) await tx.delete(customerSessions).where(inArray(customerSessions.id, gone))
      })
    },

    /** The person leaves: the password, the sessions and the list of orders go. The customer row and the orders stay, as the shop's records. @param {string} customerId @param {string} password */
    async remove(customerId, password) {
      const [a] = await db.select().from(customerAccounts).where(eq(customerAccounts.customerId, customerId))
      if (!a || !(await verifyPassword(a.passwordHash, password))) throw new DomainError('invalid_credentials')
      await forget(db, customerId)
    },

    /** The orders linked to this account, newest first. @param {string} customerId */
    async orders(customerId) {
      const rows = await db
        .select({ o: orders })
        .from(accountOrders)
        .innerJoin(orders, eq(orders.id, accountOrders.orderId))
        .where(eq(accountOrders.customerId, customerId))
        .orderBy(desc(orders.placedAt))
        .limit(200)
      return { items: rows.map(({ o }) => ({ orderNumber: `${o.numberPrefix}-${o.number}`, placedAt: o.placedAt.toISOString(), total: money(o.totalMinor), status: /** @type {never} */ (o.status), trackingToken: trackingToken(config, o.id) })) }
    },

    /**
     * Adds an order by its own link: only if the order is this customer's (same number), and the answer for every other case is the same "not found".
     * @param {string} customerId @param {string} orderToken
     */
    async claim(customerId, orderToken) {
      const found = await publicOrders.orderByToken(orderToken).catch(() => undefined)
      if (!found || found.customerId !== customerId) throw new DomainError('not_found')
      const at = now()
      await db.insert(accountOrders).values({ orderId: found.id, customerId, via: 'claimed', linkedAt: at }).onDuplicateKeyUpdate({ set: { orderId: found.id } })
      const [o] = await db.select().from(orders).where(eq(orders.id, found.id))
      return { orderNumber: `${o?.numberPrefix}-${o?.number}` }
    },

    /**
     * An order placed while signed in is the account's: called right after the order exists, with the order's own link as the proof, and never in the way of the order.
     * @param {string} customerId @param {string} orderToken
     */
    async attachPlaced(customerId, orderToken) {
      const found = await publicOrders.orderByToken(orderToken)
      if (found.customerId !== customerId) return
      await db.insert(accountOrders).values({ orderId: found.id, customerId, via: 'placed', linkedAt: now() }).onDuplicateKeyUpdate({ set: { orderId: found.id } })
    },

    /** Staff take an account away (a number registered by someone who does not own it, or a request). The customer's orders and notes stay. @param {Staff} actor @param {string} customerId @param {RequestInfo} req */
    async adminRemove(actor, customerId, req) {
      await transaction(db, async (tx) => {
        const [c] = await tx.select().from(customers).where(eq(customers.id, customerId)).for('update')
        if (!c) throw new DomainError('not_found')
        const [a] = await tx.select({ id: customerAccounts.customerId }).from(customerAccounts).where(eq(customerAccounts.customerId, customerId))
        if (!a) throw new DomainError('not_found')
        await forget(tx, customerId)
        await record(tx, { actor: { type: 'staff', id: actor.staffId, label: actor.name, role: actor.role }, ip: req.ip, userAgent: req.userAgent, requestId: req.requestId, action: 'customer.account_removed', entityType: 'customer', entityId: customerId, entityLabel: c.name, category: 'security' })
      })
    },

    /** Sessions that ran out are deleted (a daily job). */
    async cleanup() {
      await db.delete(customerSessions).where(lt(customerSessions.expiresAt, now()))
    },
  }
}

/** Everything of the account, nothing of the customer. @param {Db} x @param {string} customerId */
export async function forget(x, customerId) {
  await x.delete(customerSessions).where(eq(customerSessions.customerId, customerId))
  await x.delete(accountOrders).where(eq(accountOrders.customerId, customerId))
  await x.delete(customerAccounts).where(eq(customerAccounts.customerId, customerId))
}
