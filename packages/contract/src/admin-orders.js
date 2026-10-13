// The staff side of orders (plan/10-api/06-admin-orders-customers.md section 2): the list and its tabs, one order in full, every change to it (each through
// the one function that does it), staff-created orders, and what leaves the system as a file. Customer fields are masked unless the staff member may read customers.
import { z } from 'zod'
import { Cart } from './cart.js'
import { CreateOrderBody } from './orders.js'
import { Enum } from './enum-schemas.js'
import { Money } from './money-schema.js'
import { BulkResult, CsvFile, csv, flag, Page, PageQuery } from './pagination.js'
import { PkMobile } from './phone.js'
import { Id, Image, IsoDate, LineCustomization } from './primitives.js'
import { defineRoutes } from './routes.js'

/** A UUID, or the number as shown to people (`RB-10458`). */
const OrderRef = z.strictObject({ id: z.string().trim().min(1).max(40) })

// ---------------------------------------------------------------- what changes an order
const via = z.enum(['call', 'whatsapp', 'customer_message'])

export const TransitionBody = z.discriminatedUnion('to', [
  z.strictObject({ version: z.int(), to: z.literal('confirmed'), via, note: z.string().trim().min(1).max(500).optional(), codOverrideReason: z.string().trim().min(1).max(300).optional() }),
  z.strictObject({ version: z.int(), to: z.literal('pending_confirmation'), reason: z.string().trim().min(1).max(300) }),
  z.strictObject({ version: z.int(), to: z.literal('dispatched'), courierId: Id, trackingNumber: z.string().trim().min(1).max(60).optional(), dispatchedAt: IsoDate.optional() }),
  z.strictObject({ version: z.int(), to: z.literal('delivered'), deliveredAt: IsoDate.optional(), cashReceived: z.boolean().optional() }),
  z.strictObject({ version: z.int(), to: z.literal('cancelled'), reason: Enum.cancelReason, note: z.string().trim().min(1).max(500).optional(), refundAcknowledged: z.boolean().optional() }),
  z.strictObject({
    version: z.int(), to: z.literal('returned'), returnType: Enum.returnType, note: z.string().trim().min(1).max(500).optional(),
    lines: z.array(z.strictObject({ lineId: Id, quantity: z.int().min(1).max(99), restock: z.boolean() })).min(1).max(50),
  }),
])
/** @typedef {z.infer<typeof TransitionBody>} TransitionBody */

export const OrderEditBody = z.strictObject({
  version: z.int(),
  shippingAddress: z.strictObject({ cityId: Id, address: z.string().trim().min(10).max(250), landmark: z.string().trim().min(1).max(120).optional(), notes: z.string().trim().min(1).max(250).optional() }).optional(),
  shippingMethodId: Id.optional(),
  customer: z.strictObject({ name: z.string().trim().min(2).max(80), email: z.email().max(254).optional() }).optional(),
  lines: z.array(z.strictObject({ lineId: Id.optional(), variantId: Id.optional(), quantity: z.int().min(1).max(99), customization: LineCustomization.optional() })).min(1).max(50).optional(),
})

export const Totals = z.strictObject({ subtotal: Money, discount: Money, shippingFee: Money, total: Money, depositDue: Money })

export const RecordPaymentBody = z.strictObject({
  kind: Enum.paymentKind,
  amount: Money,
  method: z.enum(['cash', 'bank_transfer', 'wallet', 'card', 'other']),
  reference: z.string().trim().min(1).max(120).optional(),
  paidAt: IsoDate.optional(),
  proofMediaId: Id.optional(),
})

export const AdminCreateOrderBody = CreateOrderBody.omit({ expectedTotal: true }).extend({
  lines: z.array(z.strictObject({ variantId: Id, quantity: z.int().min(1).max(99), customization: LineCustomization.optional() })).min(1).max(50),
  promoCode: z.string().trim().min(1).max(20).optional(),
  /** The customer was phoned while the order was typed: it starts confirmed. */
  confirmedOnCall: z.boolean().optional(),
  note: z.string().trim().min(1).max(1000).optional(),
})

// ---------------------------------------------------------------- what staff see
export const OrderEvent = z.strictObject({
  id: Id, type: z.string(), fromStatus: Enum.orderStatus.optional(), toStatus: Enum.orderStatus.optional(), actorType: Enum.actorType, actorLabel: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(), createdAt: IsoDate,
})

const riskMarker = z.enum(['repeat_customer', 'refused_before', 'cod_blocked', 'duplicate_suspect', 'high_value'])
const action = z.enum(['confirm', 'revert_confirmation', 'dispatch', 'deliver', 'cancel', 'return', 'edit_address', 'edit_items', 'record_payment', 'switch_to_cod', 'update_tracking'])

/** What was chosen on a line, as kept with the order: the bundle's children carry their names, and `summary` is the one-line reading of it all. */
const LineCustomizationView = LineCustomization.extend({
  bundle: z.array(z.strictObject({ productId: Id, variantId: Id, title: z.string().optional(), sku: z.string().optional(), label: z.string().optional() })).max(20).optional(),
  summary: z.string().optional(),
})

export const AdminOrder = z.strictObject({
  id: Id, orderNumber: z.string(), status: Enum.orderStatus, channel: Enum.orderChannel, version: z.int(),
  placedAt: IsoDate, statusChangedAt: IsoDate, confirmedAt: IsoDate.optional(), dispatchedAt: IsoDate.optional(), deliveredAt: IsoDate.optional(), closedAt: IsoDate.optional(),
  /** Masked (name as "Sana M.", phone as "0300 ••••567", no email) without `customers:read`. */
  customer: z.strictObject({
    id: Id, name: z.string(), phone: z.string(), email: z.string().optional(), ordersCount: z.int(), deliveredCount: z.int(), refusedCount: z.int(), noCod: z.boolean(), vip: z.boolean(),
  }),
  riskMarkers: z.array(riskMarker),
  duplicateOf: z.strictObject({ id: Id, orderNumber: z.string() }).optional(),
  /** Without `customers:read` only the city. */
  shippingAddress: z.strictObject({ cityId: Id, city: z.string(), address: z.string().optional(), landmark: z.string().optional(), notes: z.string().optional() }),
  shipping: z.strictObject({ methodId: Id.optional(), label: z.string(), fee: Money, etaMinDays: z.int(), etaMaxDays: z.int() }),
  customFields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  lines: z.array(
    z.strictObject({
      id: Id, productId: Id, variantId: Id, title: z.string(), variantLabel: z.string(), sku: z.string(), image: Image.optional(), kind: Enum.productKind,
      quantity: z.int(), returnedQuantity: z.int(), unitPrice: Money, lineSubtotal: Money, lineDiscount: Money, deposit: Money,
      customization: LineCustomizationView.optional(), leadTime: z.strictObject({ minDays: z.int(), maxDays: z.int() }).optional(), stockTracked: z.boolean(),
    }),
  ),
  subtotal: Money, discount: Money, promoCode: z.string().optional(), shippingFee: Money, total: Money,
  depositDue: Money, paid: Money, refunded: Money, dueOnDelivery: Money,
  paymentMethod: Enum.paymentMethod, paymentStatus: Enum.paymentStatus,
  payments: z.array(
    z.strictObject({
      id: Id, kind: Enum.paymentKind, method: z.string(), state: Enum.paymentState, amount: Money, reference: z.string().optional(), recordedBy: z.string().optional(), createdAt: IsoDate, proof: Image.optional(),
    }),
  ),
  invoiceNumber: z.string().optional(), courier: z.strictObject({ id: Id, name: z.string() }).optional(), trackingNumber: z.string().optional(), trackingUrl: z.string().optional(),
  cancelReason: Enum.cancelReason.optional(),
  confirmationAttempts: z.int(),
  /** Newest first. */
  events: z.array(OrderEvent),
  allowedActions: z.array(action),
  /** The storefront page of this order, for staff to resend. */
  customerLink: z.string(),
  /** A wa.me link with the confirmation message ready; not given without `customers:read`. */
  whatsappConfirmUrl: z.string().optional(),
})
/** @typedef {z.infer<typeof AdminOrder>} AdminOrder */

export const AdminOrderRow = z.strictObject({
  id: Id, orderNumber: z.string(), status: Enum.orderStatus, placedAt: IsoDate, statusChangedAt: IsoDate,
  customerName: z.string(), customerPhone: z.string(), city: z.string(), itemCount: z.int(), firstItemTitle: z.string(),
  total: Money, paymentMethod: Enum.paymentMethod, paymentStatus: Enum.paymentStatus, riskMarkers: z.array(riskMarker),
})

export const InvoiceData = z.strictObject({
  store: z.strictObject({ name: z.string(), phone: z.string().optional(), email: z.string().optional(), address: z.string().optional(), logo: Image.optional() }),
  invoiceNumber: z.string().optional(), orderNumber: z.string(), placedAt: IsoDate, dispatchedAt: IsoDate.optional(),
  customer: z.strictObject({ name: z.string(), phone: z.string() }),
  shippingAddress: z.strictObject({ city: z.string(), address: z.string(), landmark: z.string().optional() }),
  lines: z.array(z.strictObject({ title: z.string(), variantLabel: z.string(), sku: z.string(), quantity: z.int(), unitPrice: Money, lineTotal: Money, customizationSummary: z.string().optional() })),
  totals: Totals, paid: Money, amountToCollect: Money, paymentMethod: Enum.paymentMethod, courier: z.string().optional(), trackingNumber: z.string().optional(),
})

// ---------------------------------------------------------------- lists
const filters = {
  status: csv(Enum.orderStatus).optional(),
  cityId: Id.optional(),
  paymentMethod: Enum.paymentMethod.optional(),
  paymentStatus: Enum.paymentStatus.optional(),
  courierId: Id.optional(),
  from: IsoDate.optional(),
  to: IsoDate.optional(),
  promo: z.string().trim().min(1).max(20).optional(),
  hasDeposit: flag.optional(),
  customerId: Id.optional(),
  channel: Enum.orderChannel.optional(),
}
export const OrderListQuery = PageQuery.extend({ ...filters, sort: z.string().regex(/^-?(placedAt|total|city|statusAge)$/).optional() })

export const OrderExportBody = z.strictObject({ ...filters, q: z.string().trim().min(2).max(80).optional(), from: IsoDate, to: IsoDate })

const Bulk = z.discriminatedUnion('action', [
  z.strictObject({ ids: z.array(z.string().trim().min(1).max(40)).min(1).max(500), action: z.literal('confirm'), params: z.strictObject({ via }) }),
  z.strictObject({
    ids: z.array(z.string().trim().min(1).max(40)).min(1).max(500), action: z.literal('dispatch'),
    params: z.strictObject({ courierId: Id, tracking: z.array(z.strictObject({ orderNumber: z.string().trim().min(1).max(40), trackingNumber: z.string().trim().min(1).max(60) })).max(500).optional() }),
  }),
  z.strictObject({ ids: z.array(z.string().trim().min(1).max(40)).min(1).max(500), action: z.literal('deliver'), params: z.strictObject({ cashReceived: z.boolean() }) }),
])

const QuoteBody = z.strictObject({
  lines: z.array(z.strictObject({ variantId: Id, quantity: z.int().min(1).max(99), customization: LineCustomization.optional() })).min(1).max(50),
  cityId: Id, shippingMethodId: Id.optional(), paymentMethod: Enum.paymentMethod.optional(), promoCode: z.string().trim().min(1).max(20).optional(), phone: PkMobile.optional(),
})

const staffRoute = { auth: /** @type {const} */ ('staff') }

export const adminOrderRoutes = defineRoutes({
  'admin.orders.list': { method: 'GET', path: '/admin/orders', ...staffRoute, permission: 'orders:read', query: OrderListQuery, response: Page(AdminOrderRow) },
  'admin.orders.counts': { method: 'GET', path: '/admin/orders/counts', ...staffRoute, permission: 'orders:read', response: z.record(Enum.orderStatus, z.int()) },
  // what the order screens choose from (the dispatch dialog, the city filter): given to everyone who reads orders, since a fulfilment role may not read settings
  'admin.orders.lookups': {
    method: 'GET', path: '/admin/orders/lookups', ...staffRoute, permission: 'orders:read',
    response: z.strictObject({ couriers: z.array(z.strictObject({ id: Id, name: z.string(), trackingRequired: z.boolean(), trackingUrlPattern: z.string().optional() })), cities: z.array(z.strictObject({ id: Id, name: z.string() })) }),
  },
  'admin.orders.get': { method: 'GET', path: '/admin/orders/:id', ...staffRoute, permission: 'orders:read', params: OrderRef, response: AdminOrder },
  // the permission depends on where the order is going (confirm, dispatch, deliver, cancel, return): the handler checks it
  'admin.orders.transition': { method: 'POST', path: '/admin/orders/:id/transitions', ...staffRoute, permission: 'orders:read', params: OrderRef, body: TransitionBody, response: AdminOrder },
  'admin.orders.edit': { method: 'PUT', path: '/admin/orders/:id', ...staffRoute, permission: 'orders:edit', params: OrderRef, body: OrderEditBody, response: AdminOrder },
  'admin.orders.previewEdit': {
    method: 'POST', path: '/admin/orders/:id/edit-preview', ...staffRoute, permission: 'orders:edit', params: OrderRef, body: OrderEditBody,
    response: z.strictObject({ before: Totals, after: Totals, promoStillApplies: z.boolean(), issues: z.array(z.string()) }),
  },
  'admin.orders.addNote': { method: 'POST', path: '/admin/orders/:id/notes', ...staffRoute, permission: 'orders:note', status: 201, params: OrderRef, body: z.strictObject({ body: z.string().trim().min(1).max(1000) }), response: OrderEvent },
  'admin.orders.logAttempt': {
    method: 'POST', path: '/admin/orders/:id/confirmation-attempts', ...staffRoute, permission: 'orders:note', status: 201, params: OrderRef,
    body: z.strictObject({ channel: z.enum(['call', 'whatsapp']), outcome: Enum.attemptOutcome, note: z.string().trim().min(1).max(500).optional() }), response: OrderEvent,
  },
  'admin.orders.recordPayment': { method: 'POST', path: '/admin/orders/:id/payments', ...staffRoute, permission: 'orders:payments', status: 201, idempotent: true, params: OrderRef, body: RecordPaymentBody, response: AdminOrder },
  'admin.orders.updateTracking': {
    method: 'PUT', path: '/admin/orders/:id/tracking', ...staffRoute, permission: 'orders:dispatch', params: OrderRef,
    body: z.strictObject({ courierId: Id, trackingNumber: z.string().trim().min(1).max(60).optional(), version: z.int() }), response: AdminOrder,
  },
  'admin.orders.create': { method: 'POST', path: '/admin/orders', ...staffRoute, permission: 'orders:edit', status: 201, idempotent: true, body: AdminCreateOrderBody, response: AdminOrder },
  'admin.orders.quote': { method: 'POST', path: '/admin/orders/quote', ...staffRoute, permission: 'orders:edit', body: QuoteBody, response: Cart },
  'admin.orders.invoice': { method: 'GET', path: '/admin/orders/:id/invoice', ...staffRoute, permission: 'orders:read', params: OrderRef, response: InvoiceData },
  // the permission depends on the action: the handler checks it
  'admin.orders.bulk': { method: 'POST', path: '/admin/orders/bulk', ...staffRoute, permission: 'orders:read', body: Bulk, response: BulkResult },
  'admin.orders.export': { method: 'POST', path: '/admin/orders/exports', ...staffRoute, permission: 'orders:export', stepUp: true, body: OrderExportBody, response: CsvFile },
})

