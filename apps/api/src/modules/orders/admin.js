// Orders for staff (plan/10-api/06-admin-orders-customers.md section 2): the list and its tabs, one order in full, a staff-typed order and its quote, bulk actions and
// the export. Every change goes through the same functions as the customer's: `changes.transition`, `edits.edit`, `recordPayment`. Without `customers:read` every
// customer field is masked the way the customer's own page masks it.
import { and, asc, count, desc, eq, gte, inArray, like, lte, or, sql } from 'drizzle-orm'
import { formatPkMobileLocal, maskPkMobile } from '@noor/contract'
import { staffUsers } from '../../db/schema/auth.js'
import { customers } from '../../db/schema/customers.js'
import { orderLines, orders } from '../../db/schema/orders.js'
import { rupees, toCsv } from '../../platform/csv.js'
import { transaction } from '../../platform/db.js'
import { DomainError } from '../../platform/errors.js'
import { record } from '../audit/index.js'
import { numberOf } from './changes.js'
import { shortName, summaryOf } from './public.js'
import * as repo from './repository.js'
import { riskMarkers } from './rules.js'
import { trackingHash, trackingToken } from './tracking.js'

/**
 * @typedef {import('../../platform/db.js').Executor} Db
 * @typedef {typeof orders.$inferSelect} OrderRow
 * @typedef {import('../../platform/http/route-registrar.js').Actor} Actor
 * @typedef {{ ip?: string, userAgent?: string, requestId?: string }} RequestInfo
 */

const money = (/** @type {number} */ amount) => ({ amount, currency: /** @type {const} */ ('PKR') })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_EXPORT_ROWS = 5000
const MAX_EXPORT_DAYS = 366

/** Who may make an order go where. */
const TRANSITION_PERMISSION = /** @type {const} */ ({ confirmed: 'orders:confirm', pending_confirmation: 'orders:confirm', dispatched: 'orders:dispatch', delivered: 'orders:deliver', cancelled: 'orders:cancel', returned: 'orders:return' })
const BULK_PERMISSION = /** @type {const} */ ({ confirm: 'orders:confirm', dispatch: 'orders:dispatch', deliver: 'orders:deliver' })

/** The staff member as the order's history records them. @param {Actor} a */
export const staffActor = (a) => ({ type: /** @type {const} */ ('staff'), id: a.staffId, label: a.name ?? 'Staff', role: a.role })

/** @param {Actor} actor @param {string} permission */
const may = (actor, permission) => actor.permissions.has(/** @type {never} */ (permission))

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {import('../../platform/config.js').Config} deps.config
 * @param {ReturnType<typeof import('./service.js').createOrdersService>} deps.orders
 * @param {ReturnType<typeof import('../cart/service.js').createCartService>} deps.cart
 * @param {{ paymentsOf: (x: Db, orderId: string) => Promise<{ id: string, kind: string, method: string, state: string, amountMinor: number, reference: string | null, recordedBy: string | null, proofMediaId: string | null, createdAt: Date }[]> }} deps.payments
 * @param {{ preview: (template: string, orderId: string) => Promise<string | undefined> }} deps.notifications
 * @param {{ value: (key: 'store', x: Db) => Promise<{ value: any }> }} deps.settings
 * @param {{ imagesFor: (ids: string[]) => Promise<Record<string, import('@noor/contract').Image>> }} deps.media
 * @param {{ courierById: (x: Db, id: string) => Promise<{ trackingUrlPattern: string | null } | undefined> }} deps.shipping
 */
export function createAdminOrders({ db, config, orders: orderService, cart, payments, notifications, settings, media, shipping }) {
  /** The order a person means by an id or by the number on the screen. @param {Db} x @param {string} ref */
  async function resolve(x, ref) {
    if (UUID.test(ref)) {
      const o = await repo.orderById(x, ref)
      if (o) return o
    } else {
      const m = /^(?:([A-Za-z]{1,4})-?)?(\d{1,12})$/.exec(ref.replace(/\s+/g, ''))
      const o = m ? await repo.orderByNumber(x, Number(m[2])) : undefined
      if (o && (!m?.[1] || m[1].toUpperCase() === o.numberPrefix)) return o
    }
    throw new DomainError('not_found')
  }

  /** @param {Db} x @param {string} ref */
  const idOf = async (x, ref) => (await resolve(x, ref)).id

  // ---------------------------------------------------------------- one order
  /** @param {string} id @param {Actor} actor */
  async function view(id, actor) {
    const seeCustomer = may(actor, 'customers:read')
    const o = /** @type {OrderRow} */ (await repo.orderById(db, id))
    const [lines, events, pays, cust, about, courier] = await Promise.all([
      repo.linesOf(db, id),
      repo.eventsOf(db, id),
      payments.paymentsOf(db, id),
      db.select().from(customers).where(eq(customers.id, o.customerId)),
      orderService.describe(db, id),
      o.courierId ? shipping.courierById(db, o.courierId) : undefined,
    ])
    const who = pays.flatMap((p) => (p.recordedBy ? [p.recordedBy] : []))
    const [staff, images] = await Promise.all([
      who.length ? db.select({ id: staffUsers.id, name: staffUsers.name }).from(staffUsers).where(inArray(staffUsers.id, who)) : [],
      media.imagesFor([...lines.flatMap((l) => (l.imageMediaId ? [l.imageMediaId] : [])), ...pays.flatMap((p) => (p.proofMediaId ? [p.proofMediaId] : []))]),
    ])
    const c = cust[0]
    const open = !['delivered', 'cancelled', 'returned'].includes(o.status)
    const link = `${config.STOREFRONT_URL}/orders/${trackingToken(config, id)}`
    const trackingUrl = courier?.trackingUrlPattern && o.trackingNumber ? courier.trackingUrlPattern.replace('{tracking}', encodeURIComponent(o.trackingNumber)) : undefined
    const text = o.status === 'pending_confirmation' && seeCustomer ? await notifications.preview('order.confirm_request', id) : undefined

    return {
      id, orderNumber: numberOf(o), status: /** @type {never} */ (o.status), channel: /** @type {never} */ (o.channel), version: o.version,
      placedAt: o.placedAt.toISOString(), statusChangedAt: o.statusChangedAt.toISOString(),
      ...(o.confirmedAt ? { confirmedAt: o.confirmedAt.toISOString() } : {}), ...(o.dispatchedAt ? { dispatchedAt: o.dispatchedAt.toISOString() } : {}),
      ...(o.deliveredAt ? { deliveredAt: o.deliveredAt.toISOString() } : {}), ...(o.closedAt ? { closedAt: o.closedAt.toISOString() } : {}),
      customer: {
        id: o.customerId, name: seeCustomer ? o.customerName : shortName(o.customerName), phone: seeCustomer ? o.customerPhone : maskPkMobile(o.customerPhone),
        ...(seeCustomer && o.customerEmail ? { email: o.customerEmail } : {}),
        ordersCount: c?.ordersCount ?? 0, deliveredCount: c?.deliveredCount ?? 0, refusedCount: c?.refusedCount ?? 0, noCod: c?.noCod ?? false, vip: c?.vip ?? false,
      },
      riskMarkers: /** @type {never} */ (about.riskMarkers),
      ...(about.duplicateOf ? { duplicateOf: about.duplicateOf } : {}),
      shippingAddress: {
        cityId: o.shipCityId, city: o.shipCity,
        ...(seeCustomer ? { address: o.shipAddress, ...(o.shipLandmark ? { landmark: o.shipLandmark } : {}), ...(o.shipNotes ? { notes: o.shipNotes } : {}) } : {}),
      },
      shipping: { ...(o.shippingMethodId ? { methodId: o.shippingMethodId } : {}), label: o.shippingMethodLabel, fee: money(o.shippingFeeMinor), etaMinDays: o.etaMinDays, etaMaxDays: o.etaMaxDays },
      ...(o.customFields ? { customFields: /** @type {never} */ (o.customFields) } : {}),
      lines: lines.map((l) => {
        const summary = summaryOf(l.customization)
        const image = l.imageMediaId ? images[l.imageMediaId] : undefined
        return {
          id: l.id, productId: l.productId, variantId: l.variantId, title: l.title, variantLabel: l.variantLabel, sku: l.sku, ...(image ? { image } : {}), kind: /** @type {never} */ (l.kind),
          quantity: l.quantity, returnedQuantity: l.returnedQuantity, unitPrice: money(l.unitPriceMinor), lineSubtotal: money(l.lineSubtotalMinor), lineDiscount: money(l.discountMinor), deposit: money(l.depositMinor),
          ...(l.customization || summary ? { customization: { .../** @type {object} */ (l.customization ?? {}), ...(summary ? { summary } : {}) } } : {}),
          ...(l.leadMinDays != null && l.leadMaxDays != null ? { leadTime: { minDays: l.leadMinDays, maxDays: l.leadMaxDays } } : {}),
          stockTracked: l.stockTracked,
        }
      }),
      subtotal: money(o.subtotalMinor), discount: money(o.discountMinor), ...(o.promoCode ? { promoCode: o.promoCode } : {}), shippingFee: money(o.shippingFeeMinor), total: money(o.totalMinor),
      depositDue: money(o.depositDueMinor), paid: money(o.paidMinor), refunded: money(o.refundedMinor),
      dueOnDelivery: money(o.paymentMethod === 'cod' && open ? Math.max(0, o.totalMinor - o.paidMinor) : 0),
      paymentMethod: /** @type {never} */ (o.paymentMethod), paymentStatus: /** @type {never} */ (o.paymentStatus),
      payments: pays.map((p) => {
        const proof = p.proofMediaId ? images[p.proofMediaId] : undefined
        const by = staff.find((s) => s.id === p.recordedBy)
        return { id: p.id, kind: /** @type {never} */ (p.kind), method: p.method, state: /** @type {never} */ (p.state), amount: money(p.amountMinor), ...(p.reference ? { reference: p.reference } : {}), ...(by ? { recordedBy: by.name } : {}), createdAt: p.createdAt.toISOString(), ...(proof ? { proof } : {}) }
      }),
      ...(o.invoiceNumber ? { invoiceNumber: o.invoiceNumber } : {}),
      ...(o.courierId && o.courierName ? { courier: { id: o.courierId, name: o.courierName } } : {}),
      ...(o.trackingNumber ? { trackingNumber: o.trackingNumber } : {}), ...(trackingUrl ? { trackingUrl } : {}),
      ...(o.cancelReason ? { cancelReason: /** @type {never} */ (o.cancelReason) } : {}),
      confirmationAttempts: events.filter((e) => e.type === 'confirmation_attempt').length,
      events: events.map((e) => ({
        id: e.id, type: e.type, ...(e.fromStatus ? { fromStatus: /** @type {never} */ (e.fromStatus) } : {}), ...(e.toStatus ? { toStatus: /** @type {never} */ (e.toStatus) } : {}),
        actorType: /** @type {never} */ (e.actorType), ...(e.actorLabel ? { actorLabel: e.actorLabel } : {}), ...(e.data ? { data: /** @type {never} */ (e.data) } : {}), createdAt: e.createdAt.toISOString(),
      })),
      allowedActions: /** @type {never} */ (about.allowedActions),
      customerLink: link,
      ...(text && seeCustomer ? { whatsappConfirmUrl: `https://wa.me/${o.customerPhone.replace(/^\+/, '')}?text=${encodeURIComponent(text)}` } : {}),
    }
  }

  // ---------------------------------------------------------------- lists
  /** The conditions of a list or an export. @param {Record<string, any>} q @param {boolean} seeCustomer */
  function conditions(q, seeCustomer) {
    const text = q.q ? `%${String(q.q).replace(/[\\%_]/g, '\\$&')}%` : undefined
    const digits = q.q ? String(q.q).replace(/\D/g, '') : ''
    const num = /^(?:[A-Za-z]{1,4}-?)?(\d{1,12})$/.exec(String(q.q ?? '').replace(/\s+/g, ''))
    return and(
      q.status?.length ? inArray(orders.status, q.status) : undefined,
      q.cityId ? eq(orders.shipCityId, q.cityId) : undefined,
      q.paymentMethod ? eq(orders.paymentMethod, q.paymentMethod) : undefined,
      q.paymentStatus ? eq(orders.paymentStatus, q.paymentStatus) : undefined,
      q.courierId ? eq(orders.courierId, q.courierId) : undefined,
      q.from ? gte(orders.placedAt, new Date(q.from)) : undefined,
      q.to ? lte(orders.placedAt, new Date(q.to)) : undefined,
      q.promo ? eq(orders.promoCode, String(q.promo).toUpperCase()) : undefined,
      q.hasDeposit ? sql`${orders.depositDueMinor} > 0` : undefined,
      q.customerId ? eq(orders.customerId, q.customerId) : undefined,
      q.channel ? eq(orders.channel, q.channel) : undefined,
      // a person who may not read customers finds orders by their number alone: a search by phone or name would tell them what they may not see
      text
        ? or(
            num ? eq(orders.number, Number(num[1])) : undefined,
            seeCustomer ? like(orders.customerName, text) : undefined,
            seeCustomer && digits.length >= 4 ? like(orders.customerPhone, `%${digits}%`) : undefined,
            like(orders.trackingNumber, text),
            like(orders.invoiceNumber, text),
          )
        : undefined,
    )
  }

  /** @param {OrderRow[]} rows @param {boolean} seeCustomer */
  async function rowsOf(rows, seeCustomer) {
    if (!rows.length) return []
    const ids = rows.map((o) => o.id)
    const [lines, people, store] = await Promise.all([
      db.select({ orderId: orderLines.orderId, position: orderLines.position, title: orderLines.title, quantity: orderLines.quantity }).from(orderLines).where(inArray(orderLines.orderId, ids)),
      db.select().from(customers).where(inArray(customers.id, [...new Set(rows.map((o) => o.customerId))])),
      settings.value('store', db),
    ])
    return rows.map((o) => {
      const mine = lines.filter((l) => l.orderId === o.id)
      const c = people.find((p) => p.id === o.customerId)
      return {
        id: o.id, orderNumber: numberOf(o), status: /** @type {never} */ (o.status), placedAt: o.placedAt.toISOString(), statusChangedAt: o.statusChangedAt.toISOString(),
        customerName: seeCustomer ? o.customerName : shortName(o.customerName), customerPhone: seeCustomer ? o.customerPhone : maskPkMobile(o.customerPhone),
        city: o.shipCity, itemCount: mine.reduce((s, l) => s + l.quantity, 0), firstItemTitle: [...mine].sort((a, b) => a.position - b.position)[0]?.title ?? '',
        total: money(o.totalMinor), paymentMethod: /** @type {never} */ (o.paymentMethod), paymentStatus: /** @type {never} */ (o.paymentStatus),
        // the duplicate check is one more query per order: the detail screen has it, the list does not
        riskMarkers: /** @type {never} */ (riskMarkers({ paymentMethod: o.paymentMethod, totalMinor: o.totalMinor, customer: c ?? { deliveredCount: 0, refusedCount: 0, noCod: false }, duplicateOf: undefined, highValueMinor: store.value.thresholds.highValueCodMinor })),
      }
    })
  }

  // ---------------------------------------------------------------- a temporary cart for a staff-typed order
  /** The lines a staff member typed, in a cart of their own: the one pricing code is the cart's. @param {{ lines: { variantId: string, quantity: number, customization?: any }[], promoCode?: string | undefined }} body */
  async function tempCart(body) {
    /** @type {string | undefined} */
    let token
    try {
      for (const l of body.lines) token = /** @type {{ cartToken: string }} */ (await cart.addLine(token, { variantId: l.variantId, quantity: l.quantity, ...(l.customization ? { customization: l.customization } : {}) })).cartToken
      if (body.promoCode) await cart.applyPromo(token, body.promoCode)
      return /** @type {string} */ (token)
    } catch (e) {
      await dropCart(token)
      throw e
    }
  }

  /** @param {string | undefined} token */
  async function dropCart(token) {
    if (!token) return
    const row = await cart.cartOf(db, token)
    if (row) await transaction(db, (tx) => cart.deleteCart(tx, row.id))
  }

  return {
    view,
    idOf: (/** @type {string} */ ref) => idOf(db, ref),

    /** @param {string} ref @param {Actor} actor */
    async get(ref, actor) {
      return view(await idOf(db, ref), actor)
    },

    /** @param {Record<string, any>} q @param {Actor} actor */
    async list(q, actor) {
      const seeCustomer = may(actor, 'customers:read')
      const where = conditions(q, seeCustomer)
      const field = (q.sort ?? '').replace(/^-/, '')
      const columns = { placedAt: orders.placedAt, total: orders.totalMinor, city: orders.shipCity, statusAge: orders.statusChangedAt }
      // a tab of orders waiting for somebody is oldest first; everything else newest first
      const waiting = q.status?.length === 1 && ['pending', 'pending_confirmation', 'confirmed', 'dispatched'].includes(q.status[0])
      const dir = q.sort ? (q.sort.startsWith('-') ? desc : asc) : waiting ? asc : desc
      const by = q.sort && field in columns ? columns[/** @type {keyof typeof columns} */ (field)] : waiting ? orders.statusChangedAt : orders.placedAt
      const [{ n: total } = { n: 0 }] = await db.select({ n: count() }).from(orders).where(where)
      const rows = await db.select().from(orders).where(where).orderBy(dir(by), desc(orders.id)).limit(q.size).offset((q.page - 1) * q.size)
      return { items: await rowsOf(rows, seeCustomer), total, page: q.page, size: q.size }
    },

    async counts() {
      const rows = await db.select({ status: orders.status, n: count() }).from(orders).groupBy(orders.status)
      return /** @type {Record<import('@noor/contract').EnumValue<'orderStatus'>, number>} */ (Object.fromEntries(['pending', 'pending_confirmation', 'confirmed', 'dispatched', 'delivered', 'cancelled', 'returned'].map((s) => [s, rows.find((r) => r.status === s)?.n ?? 0])))
    },

    // ---------------------------------------------------------------- changes
    /** @param {Actor} actor @param {string} ref @param {import('@noor/contract').TransitionBody} body @param {RequestInfo} req */
    async transition(actor, ref, body, req) {
      if (!may(actor, TRANSITION_PERMISSION[body.to])) throw new DomainError('forbidden')
      const id = await idOf(db, ref)
      await transaction(db, (tx) => orderService.transition(tx, id, /** @type {never} */ (body), staffActor(actor), req))
      return view(id, actor)
    },

    /** @param {Actor} actor @param {string} ref @param {import('@noor/contract').z.infer<typeof import('@noor/contract').OrderEditBody>} body @param {RequestInfo} req */
    async edit(actor, ref, body, req) {
      const id = await idOf(db, ref)
      await transaction(db, (tx) => orderService.edit(tx, id, /** @type {never} */ (body), staffActor(actor), req))
      return view(id, actor)
    },

    /** @param {string} ref @param {import('@noor/contract').z.infer<typeof import('@noor/contract').OrderEditBody>} body */
    async previewEdit(ref, body) {
      return orderService.previewEdit(db, await idOf(db, ref), /** @type {never} */ (body))
    },

    /** @param {Actor} actor @param {string} ref @param {string} text @param {RequestInfo} req */
    async addNote(actor, ref, text, req) {
      const id = await idOf(db, ref)
      return transaction(db, async (tx) => {
        const e = await orderService.addNote(tx, id, text, staffActor(actor))
        await record(tx, { actor: staffActor(actor), action: 'order.note_added', entityType: 'order', entityId: id, ...req })
        return e
      })
    },

    /** @param {Actor} actor @param {string} ref @param {{ channel: 'call' | 'whatsapp', outcome: any, note?: string | undefined }} attempt @param {RequestInfo} req */
    async logAttempt(actor, ref, attempt, req) {
      const id = await idOf(db, ref)
      return transaction(db, async (tx) => {
        const e = await orderService.logAttempt(tx, id, /** @type {never} */ (attempt), staffActor(actor))
        await record(tx, { actor: staffActor(actor), action: 'order.attempt_logged', entityType: 'order', entityId: id, ...req })
        return e
      })
    },

    /** @param {Actor} actor @param {string} ref @param {any} body @param {string} key @param {RequestInfo} req */
    async recordPayment(actor, ref, body, key, req) {
      const id = await idOf(db, ref)
      await orderService.recordPayment(id, body, staffActor(actor), key, req)
      return view(id, actor)
    },

    /** @param {Actor} actor @param {string} ref @param {{ courierId: string, trackingNumber?: string | undefined, version: number }} body @param {RequestInfo} req */
    async updateTracking(actor, ref, body, req) {
      const id = await idOf(db, ref)
      await transaction(db, (tx) => orderService.updateTracking(tx, id, /** @type {never} */ (body), staffActor(actor), req))
      return view(id, actor)
    },

    // ---------------------------------------------------------------- a staff-typed order
    /** The server's totals for the form while it is filled in. No cart is kept. @param {import('@noor/contract').z.infer<typeof import('@noor/contract').adminOrderRoutes['admin.orders.quote']['body']>} body */
    async quote(body) {
      const token = await tempCart(body)
      try {
        return await cart.quote(token, { cityId: body.cityId, ...(body.shippingMethodId ? { shippingMethodId: body.shippingMethodId } : {}), ...(body.phone ? { phone: body.phone } : {}) })
      } finally {
        await dropCart(token)
      }
    },

    /** @param {Actor} actor @param {import('@noor/contract').z.infer<typeof import('@noor/contract').AdminCreateOrderBody>} body @param {string} key @param {RequestInfo} req */
    async create(actor, body, key, req) {
      const token = await tempCart(body)
      let created
      try {
        // the order form is the customer's own; the lines, the code and the notes were typed into the cart and the history
        const form = /** @type {Record<string, unknown>} */ ({ ...body })
        for (const k of ['lines', 'promoCode', 'confirmedOnCall', 'note']) delete form[k]
        created = await orderService.create(token, /** @type {never} */ (form), key, { staff: { id: actor.staffId, label: actor.name ?? 'Staff' }, asked: body })
      } finally {
        await dropCart(token) // gone already when the order was made; left when it was refused, or when the key was used before
      }
      const order = /** @type {OrderRow} */ (await repo.orderByTokenHash(db, trackingHash(created.trackingToken)))
      await transaction(db, (tx) => record(tx, { actor: staffActor(actor), action: 'order.created', entityType: 'order', entityId: order.id, entityLabel: numberOf(order), category: 'money', ...req }))
      if (body.note && order.status !== 'cancelled') await this.addNote(actor, order.id, body.note, req).catch(() => undefined)
      if (body.confirmedOnCall && order.status === 'pending_confirmation') {
        // the customer was phoned: it starts confirmed. If a deposit is still owed it stays waiting, and the screen says so
        try {
          await transaction(db, (tx) => orderService.transition(tx, order.id, { version: order.version, to: 'confirmed', via: 'call' }, staffActor(actor), req))
        } catch (e) {
          if (!(e instanceof DomainError)) throw e
        }
      }
      return view(order.id, actor)
    },

    /** @param {string} ref @param {Actor} actor */
    async invoice(ref, actor) {
      const id = await idOf(db, ref)
      const o = /** @type {OrderRow} */ (await repo.orderById(db, id))
      const [lines, store] = await Promise.all([repo.linesOf(db, id), settings.value('store', db)])
      const logoId = store.value.brand?.logoLightMediaId
      const logo = logoId ? (await media.imagesFor([logoId]))[logoId] : undefined
      const c = store.value.contact ?? {}
      const open = !['delivered', 'cancelled', 'returned'].includes(o.status)
      return {
        store: { name: String(store.value.brand?.name ?? 'Rubaya'), ...(c.phone ? { phone: c.phone } : {}), ...(c.email ? { email: c.email } : {}), ...(c.address ? { address: c.address } : {}), ...(logo ? { logo } : {}) },
        ...(o.invoiceNumber ? { invoiceNumber: o.invoiceNumber } : {}), orderNumber: numberOf(o), placedAt: o.placedAt.toISOString(), ...(o.dispatchedAt ? { dispatchedAt: o.dispatchedAt.toISOString() } : {}),
        customer: { name: may(actor, 'customers:read') ? o.customerName : shortName(o.customerName), phone: may(actor, 'customers:read') ? o.customerPhone : maskPkMobile(o.customerPhone) },
        shippingAddress: { city: o.shipCity, address: may(actor, 'customers:read') ? o.shipAddress : '', ...(may(actor, 'customers:read') && o.shipLandmark ? { landmark: o.shipLandmark } : {}) },
        lines: lines.map((l) => ({ title: l.title, variantLabel: l.variantLabel, sku: l.sku, quantity: l.quantity, unitPrice: money(l.unitPriceMinor), lineTotal: money(l.lineSubtotalMinor - l.discountMinor), ...(summaryOf(l.customization) ? { customizationSummary: summaryOf(l.customization) } : {}) })),
        totals: { subtotal: money(o.subtotalMinor), discount: money(o.discountMinor), shippingFee: money(o.shippingFeeMinor), total: money(o.totalMinor), depositDue: money(o.depositDueMinor) },
        paid: money(o.paidMinor), amountToCollect: money(o.paymentMethod === 'cod' && open ? Math.max(0, o.totalMinor - o.paidMinor) : 0),
        paymentMethod: /** @type {never} */ (o.paymentMethod), ...(o.courierName ? { courier: o.courierName } : {}), ...(o.trackingNumber ? { trackingNumber: o.trackingNumber } : {}),
      }
    },

    // ---------------------------------------------------------------- many at once
    /**
     * Each order on its own through the same transition as one at a time: one that cannot go (unknown, in the wrong state, changed meanwhile) is listed with its code, the rest go.
     * @param {Actor} actor @param {import('@noor/contract').z.infer<typeof import('@noor/contract').adminOrderRoutes['admin.orders.bulk']['body']>} body @param {RequestInfo} req
     */
    async bulk(actor, body, req) {
      if (!may(actor, BULK_PERMISSION[body.action])) throw new DomainError('forbidden')
      /** @type {string[]} */
      const succeeded = []
      /** @type {{ id: string, code: string }[]} */
      const failed = []
      const tracking = new Map(body.action === 'dispatch' ? (body.params.tracking ?? []).map((t) => [t.orderNumber.replace(/\s+/g, '').toUpperCase(), t.trackingNumber]) : [])
      for (const ref of body.ids) {
        try {
          await transaction(db, async (tx) => {
            const o = await resolve(tx, ref)
            if (body.action === 'confirm') await orderService.transition(tx, o.id, { version: o.version, to: 'confirmed', via: body.params.via }, staffActor(actor), req)
            else if (body.action === 'deliver') await orderService.transition(tx, o.id, { version: o.version, to: 'delivered', cashReceived: body.params.cashReceived }, staffActor(actor), req)
            else {
              const trackingNumber = tracking.get(numberOf(o).toUpperCase())
              await orderService.transition(tx, o.id, { version: o.version, to: 'dispatched', courierId: body.params.courierId, ...(trackingNumber ? { trackingNumber } : {}) }, staffActor(actor), req)
            }
          })
          succeeded.push(ref)
        } catch (e) {
          if (!(e instanceof DomainError)) throw e
          failed.push({ id: ref, code: e.code })
        }
      }
      return { succeeded, failed }
    },

    /** The orders of a period as a file. Personal data leaves the system, so it is limited, and written down. @param {Actor} actor @param {Record<string, any>} q @param {RequestInfo} req */
    async exportCsv(actor, q, req) {
      const days = (new Date(q.to).getTime() - new Date(q.from).getTime()) / 86_400_000
      if (!(days >= 0) || days > MAX_EXPORT_DAYS) throw new DomainError('validation_failed', { issues: [{ path: 'to', code: days < 0 ? 'invalid_format' : 'too_big' }] })
      const where = conditions(q, true)
      const [{ n: total } = { n: 0 }] = await db.select({ n: count() }).from(orders).where(where)
      if (total > MAX_EXPORT_ROWS) throw new DomainError('validation_failed', { issues: [{ path: 'from', code: 'too_big' }] })
      const rows = await db.select().from(orders).where(where).orderBy(asc(orders.placedAt), asc(orders.id))
      const file = toCsv(
        ['Order', 'Placed at', 'Status', 'Channel', 'Payment method', 'Payment status', 'Subtotal', 'Discount', 'Shipping', 'Total', 'Paid', 'Promo code', 'Customer', 'Phone', 'City', 'Address', 'Courier', 'Tracking number', 'Invoice'],
        rows.map((o) => [numberOf(o), o.placedAt.toISOString(), o.status, o.channel, o.paymentMethod, o.paymentStatus, rupees(o.subtotalMinor), rupees(o.discountMinor), rupees(o.shippingFeeMinor), rupees(o.totalMinor), rupees(o.paidMinor), o.promoCode, o.customerName, formatPkMobileLocal(o.customerPhone), o.shipCity, o.shipAddress, o.courierName, o.trackingNumber, o.invoiceNumber]),
      )
      await transaction(db, (tx) => record(tx, { actor: staffActor(actor), action: 'order.exported', entityType: 'order', entityId: 'export', entityLabel: `${rows.length} orders`, reason: `${q.from} to ${q.to}`, category: 'security', ...req }))
      return { filename: `orders-${String(q.from).slice(0, 10)}-${String(q.to).slice(0, 10)}.csv`, rowCount: rows.length, csv: file }
    },
  }
}

