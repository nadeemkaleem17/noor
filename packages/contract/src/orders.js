// Placing an order: what the storefront calls (plan/10-api/03-cart-orders-public.md section 3). The body is strict: a price, discount, fee or total
// anywhere in it is a 400 (ADR-0020); the server prices the cart it finds behind the cart token.
import { z } from 'zod'
import { Enum } from './enums.js'
import { Money } from './money.js'
import { PkMobile } from './phone.js'
import { Id } from './primitives.js'
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

export const orderRoutes = defineRoutes({
  'orders.create': { method: 'POST', path: '/orders', auth: 'cart', rateLimit: 'checkout', idempotent: true, status: 201, body: CreateOrderBody, response: OrderCreated },
})
