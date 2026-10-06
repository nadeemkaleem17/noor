// Placing an order: what the storefront calls (plan/10-api/03-cart-orders-public.md section 3). The body is strict: a price, discount, fee or total
// anywhere in it is a 400 (ADR-0020); the server prices the cart it finds behind the cart token.
import { z } from 'zod'
import { Enum } from './enums.js'
import { Money } from './money.js'
import { PkMobile } from './phone.js'
import { Id, Image, IsoDate } from './primitives.js'
import { defineRoutes } from './routes.js'

export const CreateOrderBody = z.strictObject({
  customer: z.strictObject({ name: z.string().trim().min(2).max(80), phone: PkMobile, email: z.email().max(254).optional() }),
  shippingAddress: z.strictObject({
    cityId: Id,
    address: z.string().trim().min(10).max(250),
    landmark: z.string().trim().min(1).max(120).optional(),
    notes: z.string().trim().min(1).max(250).optional(),
  }),
  shippingMethodId: Id,
  paymentMethod: Enum.paymentMethod,
  /** Answers to the extra checkout fields of the store settings. */
  customFields: z.record(z.string().max(30), z.union([z.string().max(300), z.number(), z.boolean()])).optional(),
  marketingConsent: z.boolean().optional(),
  locale: Enum.locale.optional(),
  /** The total the customer saw. Never a price: if it differs from the server's total the order is refused with `price_changed`. */
  expectedTotal: Money.optional(),
})
/** @typedef {z.infer<typeof CreateOrderBody>} CreateOrderBody */

export const OrderCreated = z.strictObject({
  /** "RB-10458". */
  orderNumber: z.string(),
  /** Returned only here and in notifications; the order page is `/orders/<token>`. */
  trackingToken: z.string(),
  status: Enum.orderStatus,
  total: Money,
  /** For a prepaid method: where to pay or how. */
  payment: z.strictObject({ redirectUrl: z.string().optional(), instructions: z.string().optional() }).optional(),
})
/** @typedef {z.infer<typeof OrderCreated>} OrderCreated */

const Token = z.strictObject({ token: z.string().min(1).max(100) })

/** The order as its customer sees it (plan/10-api/03-cart-orders-public.md section 4): masked by the API, so no page ever holds the full phone, address or email. */
export const OrderPublic = z.strictObject({
  orderNumber: z.string(),
  status: Enum.orderStatus,
  placedAt: IsoDate,
  timeline: z.array(z.strictObject({ step: z.enum(['placed', 'confirmed', 'dispatched', 'delivered']), at: IsoDate.optional(), current: z.boolean() })),
  closed: z.strictObject({ status: z.enum(['cancelled', 'returned']), at: IsoDate, reason: Enum.cancelReason.optional() }).optional(),
  lines: z.array(
    z.strictObject({
      id: Id, title: z.string(), variantLabel: z.string(), image: Image.optional(), quantity: z.int(), unitPrice: Money, lineTotal: Money,
      customizationSummary: z.string().optional(), review: z.strictObject({ available: z.boolean(), submitted: z.boolean() }).optional(), leadTime: z.strictObject({ minDays: z.int(), maxDays: z.int() }).optional(),
    }),
  ),
  subtotal: Money, discount: Money, promoCode: z.string().optional(), shippingFee: Money, total: Money,
  depositDue: Money.optional(), paid: Money, dueOnDelivery: Money,
  paymentMethod: Enum.paymentMethod, paymentLabel: z.string(), paymentStatus: Enum.paymentStatus,
  /** Only while a bank transfer is waited for. */
  bankTransfer: z.strictObject({ accountTitle: z.string(), bank: z.string(), accountNumber: z.string(), instructions: z.string().optional() }).optional(),
  customer: z.strictObject({ firstName: z.string(), phoneMasked: z.string() }),
  delivery: z.strictObject({
    city: z.string(), addressMasked: z.string(), methodLabel: z.string(),
    eta: z.strictObject({ from: z.string(), to: z.string() }).optional(),
    courier: z.string().optional(), trackingNumber: z.string().optional(), trackingUrl: z.string().optional(),
  }),
  allowedActions: z.array(z.enum(['cancel', 'switch_to_cod', 'retry_payment'])),
  locale: Enum.locale,
})
/** @typedef {z.infer<typeof OrderPublic>} OrderPublic */

export const orderRoutes = defineRoutes({
  'orders.create': { method: 'POST', path: '/orders', auth: 'cart', rateLimit: 'checkout', idempotent: true, status: 201, body: CreateOrderBody, response: OrderCreated },
  'orders.getByToken': { method: 'GET', path: '/orders/by-token/:token', auth: 'order-token', params: Token, response: OrderPublic },
  'orders.cancelByToken': { method: 'POST', path: '/orders/by-token/:token/cancel', auth: 'order-token', rateLimit: 'orderAction', params: Token, body: z.strictObject({ reason: z.string().trim().max(200).optional() }), response: OrderPublic },
  'orders.switchToCod': { method: 'POST', path: '/orders/by-token/:token/switch-to-cod', auth: 'order-token', rateLimit: 'orderAction', params: Token, response: OrderPublic },
  // The body is loose on purpose: a malformed phone must fail exactly like a wrong one (one answer for every cause, ADR-0012).
  'orders.track': { method: 'POST', path: '/orders/track', auth: 'public', rateLimit: 'track', body: z.strictObject({ orderNumber: z.string().max(40), phone: z.string().max(40) }), response: z.strictObject({ trackingToken: z.string() }) },
})
