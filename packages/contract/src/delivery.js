// Delivery people, runs, the cash they hold and the receipts (plan/18-delivery-assignment-ledger-receipts.md). Cash is integer paisa; in a ledger a positive amount is cash the rider owes the shop.
import { z } from 'zod'
import { Money } from './money-schema.js'
import { Page, PageQuery } from './pagination.js'
import { Id, IsoDate } from './primitives.js'
import { Day } from './reporting.js'
import { defineRoutes } from './routes.js'

const IdParams = z.strictObject({ id: Id })
/** A signed amount of cash in paisa, as a plain integer (the sign is the direction). */
const Paisa = z.int().min(-1_000_000_000).max(1_000_000_000)

export const deliveryKinds = /** @type {const} */ (['employee', 'freelancer', 'courier_rider'])

export const DeliveryPersonInput = z.strictObject({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(5).max(20),
  kind: z.enum(deliveryKinds),
  courierId: Id.optional(),
  /** Paid for each delivered order. */
  fee: Money.optional(),
  active: z.boolean(),
  note: z.string().trim().max(300).optional(),
})
export const DeliveryPerson = DeliveryPersonInput.extend({
  id: Id,
  /** What the person owes the shop now: the sum of their ledger. Negative: the shop owes them. */
  balance: Money,
  ordersOut: z.int(),
  version: z.int(),
})
/** @typedef {z.infer<typeof DeliveryPerson>} DeliveryPerson */

export const assignmentStatuses = /** @type {const} */ (['assigned', 'out', 'delivered', 'failed', 'returned', 'removed'])
export const RunAssignment = z.strictObject({
  id: Id,
  orderId: Id,
  orderNumber: z.string(),
  customerName: z.string(),
  phone: z.string(),
  city: z.string(),
  address: z.string(),
  status: z.enum(assignmentStatuses),
  cashDue: Money,
  collected: Money,
  failReason: z.string().optional(),
  receiptId: Id.optional(),
  receiptNumber: z.string().optional(),
  resolvedAt: IsoDate.optional(),
})

/** The shop's name and address, for the top of a printout. */
export const ShopInfo = z.strictObject({ name: z.string(), address: z.string().optional(), phone: z.string().optional() })

export const RunRow = z.strictObject({
  id: Id,
  number: z.string(),
  personId: Id,
  personName: z.string(),
  runDate: Day,
  status: z.enum(['open', 'out', 'closed']),
  orders: z.int(),
  cashDue: Money,
  collected: Money,
  createdAt: IsoDate,
})
export const Run = RunRow.extend({
  shop: ShopInfo,
  note: z.string().optional(),
  outAt: IsoDate.optional(),
  closedAt: IsoDate.optional(),
  assignments: z.array(RunAssignment),
})
/** @typedef {z.infer<typeof Run>} Run */

export const AssignBody = z.strictObject({ personId: Id, orderIds: z.array(Id).min(1).max(100), runDate: Day.optional(), note: z.string().trim().max(300).optional() })
export const AssignResult = z.strictObject({
  runId: Id.optional(),
  number: z.string().optional(),
  assigned: z.array(Id),
  skipped: z.array(z.strictObject({ id: Id, code: z.string(), detail: z.string().optional() })),
})

export const LedgerEntry = z.strictObject({
  id: Id,
  kind: z.enum(['cash_due', 'cash_returned', 'deposit', 'fee', 'fee_paid', 'adjustment', 'reversal']),
  amount: Money,
  /** The balance after this entry. */
  balance: Money,
  orderNumber: z.string().optional(),
  runNumber: z.string().optional(),
  receiptNumber: z.string().optional(),
  note: z.string().optional(),
  actor: z.string().optional(),
  createdAt: IsoDate,
})
export const Statement = z.strictObject({ person: DeliveryPerson, opening: Money, closing: Money, entries: z.array(LedgerEntry) })
/** @typedef {z.infer<typeof Statement>} Statement */

export const ReceiptRow = z.strictObject({
  id: Id,
  number: z.string(),
  kind: z.enum(['customer', 'deposit', 'fee']),
  personId: Id,
  personName: z.string(),
  orderNumber: z.string().optional(),
  amount: Money,
  status: z.enum(['issued', 'void']),
  voidReason: z.string().optional(),
  issuedAt: IsoDate,
})
export const Receipt = ReceiptRow.extend({ shop: ShopInfo, issuedBy: z.string().optional(), voidedAt: IsoDate.optional(), customerName: z.string().optional() })
/** @typedef {z.infer<typeof Receipt>} Receipt */

const CashBody = z.strictObject({ amount: z.int().min(1).max(1_000_000_000), note: z.string().trim().max(300).optional() })

const staff = { auth: /** @type {const} */ ('staff') }

export const deliveryRoutes = defineRoutes({
  'admin.delivery.people.list': { method: 'GET', path: '/admin/delivery/people', ...staff, permission: 'deliveries:read', response: z.strictObject({ items: z.array(DeliveryPerson) }) },
  'admin.delivery.people.create': { method: 'POST', path: '/admin/delivery/people', ...staff, permission: 'deliveries:assign', status: 201, body: DeliveryPersonInput, response: DeliveryPerson },
  'admin.delivery.people.update': { method: 'PUT', path: '/admin/delivery/people/:id', ...staff, permission: 'deliveries:assign', params: IdParams, body: DeliveryPersonInput.extend({ version: z.int().min(1) }), response: DeliveryPerson },
  'admin.delivery.assign': { method: 'POST', path: '/admin/delivery/assign', ...staff, permission: 'deliveries:assign', body: AssignBody, response: AssignResult },
  'admin.delivery.runs.list': {
    method: 'GET', path: '/admin/delivery/runs', ...staff, permission: 'deliveries:read',
    query: PageQuery.extend({ status: z.enum(['open', 'out', 'closed']).optional(), personId: Id.optional() }),
    response: Page(RunRow),
  },
  'admin.delivery.runs.get': { method: 'GET', path: '/admin/delivery/runs/:id', ...staff, permission: 'deliveries:read', params: IdParams, response: Run },
  'admin.delivery.runs.sendOut': { method: 'POST', path: '/admin/delivery/runs/:id/send-out', ...staff, permission: 'deliveries:assign', params: IdParams, response: Run },
  'admin.delivery.runs.close': { method: 'POST', path: '/admin/delivery/runs/:id/close', ...staff, permission: 'deliveries:assign', params: IdParams, response: Run },
  'admin.delivery.assignments.deliver': { method: 'POST', path: '/admin/delivery/assignments/:id/deliver', ...staff, permission: 'deliveries:assign', params: IdParams, response: Run },
  'admin.delivery.assignments.fail': { method: 'POST', path: '/admin/delivery/assignments/:id/fail', ...staff, permission: 'deliveries:assign', params: IdParams, body: z.strictObject({ reason: z.string().trim().min(1).max(200) }), response: Run },
  'admin.delivery.assignments.return': { method: 'POST', path: '/admin/delivery/assignments/:id/return', ...staff, permission: 'deliveries:assign', params: IdParams, response: Run },
  'admin.delivery.assignments.remove': { method: 'POST', path: '/admin/delivery/assignments/:id/remove', ...staff, permission: 'deliveries:assign', params: IdParams, response: Run },
  'admin.delivery.ledger.statement': {
    method: 'GET', path: '/admin/delivery/people/:id/ledger', ...staff, permission: 'ledger:read', params: IdParams,
    query: z.strictObject({ from: Day.optional(), to: Day.optional() }), response: Statement,
  },
  'admin.delivery.ledger.deposit': { method: 'POST', path: '/admin/delivery/people/:id/deposit', ...staff, permission: 'ledger:write', status: 201, params: IdParams, body: CashBody, response: Receipt },
  'admin.delivery.ledger.payFee': { method: 'POST', path: '/admin/delivery/people/:id/pay-fee', ...staff, permission: 'ledger:write', status: 201, params: IdParams, body: CashBody, response: Receipt },
  'admin.delivery.ledger.adjust': {
    method: 'POST', path: '/admin/delivery/people/:id/adjust', ...staff, permission: 'ledger:write', params: IdParams,
    body: z.strictObject({ amount: Paisa.refine((n) => n !== 0, { message: 'required' }), note: z.string().trim().min(1).max(300) }), response: Statement,
  },
  'admin.delivery.receipts.list': {
    method: 'GET', path: '/admin/delivery/receipts', ...staff, permission: 'ledger:read',
    query: PageQuery.extend({ kind: z.enum(['customer', 'deposit', 'fee']).optional(), personId: Id.optional(), status: z.enum(['issued', 'void']).optional() }),
    response: Page(ReceiptRow),
  },
  'admin.delivery.receipts.get': { method: 'GET', path: '/admin/delivery/receipts/:id', ...staff, permission: 'ledger:read', params: IdParams, response: Receipt },
  'admin.delivery.receipts.void': { method: 'POST', path: '/admin/delivery/receipts/:id/void', ...staff, permission: 'receipts:void', params: IdParams, body: z.strictObject({ reason: z.string().trim().min(1).max(200) }), response: Receipt },
  'admin.orders.delivery': {
    method: 'GET', path: '/admin/orders/:id/delivery', ...staff, permission: 'deliveries:read', params: IdParams,
    response: z.strictObject({ items: z.array(RunAssignment.extend({ runId: Id, runNumber: z.string(), personId: Id, personName: z.string(), assignedAt: IsoDate })) }),
  },
})

