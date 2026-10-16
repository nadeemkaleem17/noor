// The cart: what the storefront calls (plan/10-api/03-cart-orders-public.md section 2). No request here carries a price, discount, fee or total:
// the server prices the cart every time it is read (plan/09-data-model/06-cart-promotions.md section 4).
import { z } from 'zod'
import { Enum } from './enum-schemas.js'
import { Money } from './money-schema.js'
import { PkMobile } from './phone.js'
import { flag } from './pagination.js'
import { Id, Image, LineCustomization } from './primitives.js'
import { defineRoutes } from './routes.js'

export const maxCartLines = 50

const ShippingChoice = z.strictObject({ methodId: Id, label: z.string(), fee: Money, etaMinDays: z.int(), etaMaxDays: z.int() })

export const CartLine = z.strictObject({
  id: Id,
  productId: Id,
  variantId: Id,
  handle: z.string(),
  title: z.string(),
  variantLabel: z.string(),
  image: Image.optional(),
  kind: Enum.productKind,
  quantity: z.int(),
  unitPrice: Money,
  compareAt: Money.optional(),
  lineSubtotal: Money,
  lineDiscount: Money,
  /** What can be bought now, when it is counted. */
  available: z.int().optional(),
  maxPerOrder: z.int(),
  customization: LineCustomization.extend({ summary: z.string().optional() }).optional(),
  madeToOrder: z.strictObject({ leadMinDays: z.int(), leadMaxDays: z.int(), depositPercent: z.number().optional() }).optional(),
  issues: z.array(z.enum(['price_changed', 'low_stock', 'sold_out', 'unavailable'])),
  /** With `price_changed`: the price the customer last saw. */
  previousUnitPrice: Money.optional(),
})
/** @typedef {z.infer<typeof CartLine>} CartLine */

export const Cart = z.strictObject({
  id: Id.optional(),
  /** Only in the response that made the cart: the storefront keeps it in the `nc_cart` cookie. */
  cartToken: z.string().optional(),
  lines: z.array(CartLine),
  /** Sum of the quantities. */
  count: z.int(),
  promo: z.strictObject({ code: z.string(), label: z.string(), discount: Money }).optional(),
  /** Why the code on the cart no longer applies, when it does not (the cart is then priced without it). */
  promoProblem: z.string().optional(),
  subtotal: Money,
  discount: Money,
  /** Only after a quote. */
  shipping: ShippingChoice.optional(),
  total: Money,
  depositDue: Money.optional(),
  dueOnDelivery: Money.optional(),
  shippingOptions: z.array(ShippingChoice.extend({ codAllowed: z.boolean() })).optional(),
  paymentOptions: z
    .array(
      z.strictObject({
        method: Enum.paymentMethod,
        label: z.string(),
        description: z.string().optional(),
        allowed: z.boolean(),
        reason: z.enum(['cod_limit_exceeded', 'cod_not_available', 'deposit_requires_prepayment']).optional(),
      }),
    )
    .optional(),
  messages: z.array(z.strictObject({
    code: z.enum(['free_shipping_remaining', 'free_shipping_applied']),
    amount: Money.optional(),
    /** With `free_shipping_remaining`: how far the bag is on the way to the threshold, in whole percent (the progress bar; the storefront does no money arithmetic). */
    percent: z.int().min(0).max(100).optional(),
  })),
  /** A line is sold out or unavailable: the order cannot be placed until it is removed. */
  hasBlockingIssues: z.boolean(),
})
/** @typedef {z.infer<typeof Cart>} Cart */

export const QuoteBody = z.strictObject({
  cityId: Id,
  shippingMethodId: Id.optional(),
  /** The method the customer leans towards; every method is still listed with whether it is allowed. */
  paymentMethod: Enum.paymentMethod.optional(),
  /** Lets the quote apply per-customer promo limits and the customer's No COD flag early. */
  phone: PkMobile.optional(),
})

const LineParams = z.strictObject({ lineId: Id })

export const cartRoutes = defineRoutes({
  'cart.get': {
    method: 'GET', path: '/cart', auth: 'cart', rateLimit: 'cart',
    query: z.strictObject({ summary: flag.optional(), locale: Enum.locale.optional() }),
    response: z.union([Cart, z.strictObject({ count: z.int() })]),
  },
  'cart.addLine': {
    method: 'POST', path: '/cart/lines', auth: 'cart', rateLimit: 'cart',
    body: z.strictObject({ variantId: Id, quantity: z.int().min(1).max(99), customization: LineCustomization.optional() }),
    response: Cart,
  },
  'cart.setLineQuantity': {
    method: 'PUT', path: '/cart/lines/:lineId', auth: 'cart', rateLimit: 'cart', params: LineParams,
    body: z.strictObject({ quantity: z.int().min(0).max(99) }),
    response: Cart,
  },
  'cart.removeLine': { method: 'DELETE', path: '/cart/lines/:lineId', auth: 'cart', rateLimit: 'cart', params: LineParams, response: Cart },
  'cart.applyPromo': {
    method: 'PUT', path: '/cart/promo', auth: 'cart', rateLimit: 'cart',
    body: z.strictObject({ code: z.string().trim().toUpperCase().min(1).max(20) }),
    response: Cart,
  },
  'cart.removePromo': { method: 'DELETE', path: '/cart/promo', auth: 'cart', rateLimit: 'cart', response: Cart },
  'cart.quote': { method: 'POST', path: '/cart/quote', auth: 'cart', rateLimit: 'cart', body: QuoteBody, response: Cart },
})
