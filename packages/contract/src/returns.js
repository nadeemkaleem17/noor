// Return and exchange requests (plan/06-storefront/14-site-blueprint.md RT-02 to RT-04, plan/10-api/10-returns.md): the customer asks from the order page
// (through the order's link), staff decide in the admin. A request records what was asked and decided; it never changes the order or the stock itself.
import { z } from 'zod'
import { enums } from './enums.js'
import { Money } from './money-schema.js'
import { Page, PageQuery } from './pagination.js'
import { Id, IsoDate } from './primitives.js'
import { defineRoutes } from './routes.js'

export const returnKinds = enums.returnKind
export const returnReasons = enums.returnReason
/** requested -> approved | declined; approved -> received | completed | declined; received -> completed. */
export const returnStatuses = enums.returnStatus
/** What staff may do next from each status. */
export const returnNext = /** @type {const} */ ({
  requested: ['approved', 'declined'],
  approved: ['received', 'completed', 'declined'],
  received: ['completed'],
  declined: [],
  completed: [],
})

export const CreateReturnBody = z.strictObject({
  kind: z.enum(returnKinds),
  reason: z.enum(returnReasons),
  note: z.string().trim().max(500).optional(),
  /** For an exchange: the size or colour wanted instead. */
  exchangeNote: z.string().trim().max(200).optional(),
  lines: z.array(z.strictObject({ lineId: Id, quantity: z.int().min(1).max(50) })).min(1).max(30),
})
/** @typedef {z.infer<typeof CreateReturnBody>} CreateReturnBody */

const ReturnLine = z.strictObject({ title: z.string(), variantLabel: z.string(), quantity: z.int() })

/** A request as its customer sees it on the order page. */
export const ReturnPublic = z.strictObject({
  number: z.string(),
  kind: z.enum(returnKinds),
  status: z.enum(returnStatuses),
  reason: z.enum(returnReasons),
  requestedAt: IsoDate,
  lines: z.array(ReturnLine),
  /** What the shop wrote when it approved or declined. */
  decisionNote: z.string().optional(),
  pickupOn: z.string().optional(),
  refund: Money.optional(),
})
/** @typedef {z.infer<typeof ReturnPublic>} ReturnPublic */

/** What the order page needs to offer the form: the window and, while it is open, until when. */
export const ReturnsOffer = z.strictObject({
  windowDays: z.int(),
  /** Present while a request can still be made. */
  eligibleUntil: IsoDate.optional(),
  requests: z.array(ReturnPublic),
})

export const ReturnRow = z.strictObject({
  id: Id,
  number: z.string(),
  kind: z.enum(returnKinds),
  status: z.enum(returnStatuses),
  reason: z.enum(returnReasons),
  note: z.string().optional(),
  exchangeNote: z.string().optional(),
  requestedAt: IsoDate,
  decidedAt: IsoDate.optional(),
  decidedBy: z.string().optional(),
  decisionNote: z.string().optional(),
  pickupOn: z.string().optional(),
  refund: Money.optional(),
  orderId: Id,
  orderNumber: z.string(),
  customerName: z.string(),
  customerPhone: z.string(),
  /** What the order's lines were worth, so staff can set a refund beside it. */
  lines: z.array(ReturnLine.extend({ lineTotal: Money })),
  orderTotal: Money,
  next: z.array(z.enum(returnStatuses)),
})
/** @typedef {z.infer<typeof ReturnRow>} ReturnRow */

export const ReturnUpdateBody = z.strictObject({
  status: z.enum(returnStatuses).exclude(['requested']),
  /** Required when declining: the customer reads it. */
  decisionNote: z.string().trim().max(300).optional(),
  /** A day, `YYYY-MM-DD`. */
  pickupOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_format').optional(),
  /** Money given back, in paisa: written down here, recorded as a payment on the order by the person who pays it. */
  refund: z.int().min(0).max(1_000_000_000).optional(),
})
/** @typedef {z.infer<typeof ReturnUpdateBody>} ReturnUpdateBody */

const Token = z.strictObject({ token: z.string().min(1).max(100) })
const IdParams = z.strictObject({ id: Id })

export const returnRoutes = defineRoutes({
  'orders.requestReturn': {
    method: 'POST', path: '/orders/by-token/:token/returns', auth: 'order-token', rateLimit: 'orderAction', status: 201, params: Token, body: CreateReturnBody,
    response: z.strictObject({ number: z.string() }),
  },
  'admin.returns.list': {
    method: 'GET', path: '/admin/returns', auth: 'staff', permission: 'orders:read',
    query: PageQuery.extend({ status: z.enum(returnStatuses).optional(), orderId: Id.optional() }),
    response: Page(ReturnRow).extend({ counts: z.record(z.enum(returnStatuses), z.int()) }),
  },
  'admin.returns.update': { method: 'POST', path: '/admin/returns/:id/update', auth: 'staff', permission: 'orders:return', params: IdParams, body: ReturnUpdateBody, response: ReturnRow },
})
