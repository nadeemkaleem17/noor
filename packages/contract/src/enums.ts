// The stored enum values (plan/09-data-model/00-conventions.md section 5). Single source: the same literals are
// the database CHECK lists and the API enums. All values are snake_case. Add a value here and in the table's CHECK together.
import { z } from 'zod'

export const enums = {
  productStatus: ['draft', 'scheduled', 'active', 'archived'],
  productKind: ['stitched', 'unstitched', 'made_to_order', 'footwear', 'accessory', 'bundle', 'home', 'beauty'],
  stockMode: ['counted', 'made_to_order', 'preorder'],
  stockStatus: ['in_stock', 'low_stock', 'sold_out', 'made_to_order', 'preorder'], // derived, never stored on variants
  optionRole: ['size', 'color', 'material', 'other'],
  optionDisplay: ['buttons', 'swatch', 'select'],
  optionValueKind: ['standard', 'custom'],
  mediaKind: ['image', 'video'],
  mediaStatus: ['pending', 'ready', 'rejected'],
  mediaRole: ['model', 'flat', 'detail', 'lifestyle'],
  colorFamily: ['black', 'white', 'grey', 'beige', 'brown', 'red', 'pink', 'orange', 'yellow', 'green', 'blue', 'purple', 'gold', 'silver', 'multi'],
  attributeType: ['enum', 'number', 'boolean', 'color'],
  attributeDisplay: ['checkbox', 'swatch', 'buttons', 'range'],
  collectionStatus: ['draft', 'active'],
  movementReason: ['initial', 'restock', 'correction', 'damaged', 'return_restock', 'return_damaged', 'sale', 'other'],
  reservationStatus: ['active', 'committed', 'released'],
  promoType: ['percent', 'fixed', 'free_shipping'],
  promoTargetType: ['category', 'product'],
  orderStatus: ['pending', 'pending_confirmation', 'confirmed', 'dispatched', 'delivered', 'cancelled', 'returned'],
  orderChannel: ['storefront', 'admin'],
  paymentMethod: ['cod', 'bank_transfer', 'wallet', 'card', 'bnpl'],
  paymentStatus: ['unpaid', 'deposit_paid', 'paid', 'refund_due', 'partially_refunded', 'refunded'], // order level, derived
  paymentState: ['initiated', 'pending_confirmation', 'authorized', 'captured', 'failed', 'expired', 'refunded'], // one payment row
  paymentKind: ['deposit', 'balance', 'full', 'refund'],
  cancelReason: ['customer_request', 'unreachable', 'duplicate', 'out_of_stock', 'suspected_fake', 'payment_expired', 'other'],
  returnType: ['refused_at_door', 'undelivered', 'customer_return'],
  attemptOutcome: ['no_answer', 'busy', 'wrong_number', 'call_later', 'declined'],
  reviewStatus: ['pending', 'approved', 'rejected'],
  reviewRejectReason: ['offensive', 'personal_data', 'not_about_product', 'spam', 'other'],
  fitNote: ['runs_small', 'true_to_size', 'runs_large'],
  pageStatus: ['draft', 'active'],
  staffRole: ['owner', 'manager', 'catalog', 'fulfilment', 'support', 'viewer'],
  staffStatus: ['invited', 'active', 'deactivated'],
  authTokenType: ['invite', 'password_reset'],
  actorType: ['staff', 'system', 'storefront'],
  notificationChannel: ['whatsapp', 'sms', 'email'],
  notificationStatus: ['queued', 'sent', 'failed', 'skipped'],
  exportStatus: ['queued', 'running', 'done', 'failed'],
  locale: ['en', 'ur'],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type Enums = typeof enums
export type EnumValue<K extends keyof Enums> = Enums[K][number]

type Schemas = { [K in keyof Enums]: z.ZodEnum<{ [V in Enums[K][number]]: V }> }
/** Zod enum per registry key: `Enum.orderStatus.parse('confirmed')`. */
export const Enum = Object.fromEntries(Object.entries(enums).map(([k, v]) => [k, z.enum(v)])) as unknown as Schemas

export type ProductStatus = EnumValue<'productStatus'>
export type ProductKind = EnumValue<'productKind'>
export type StockStatus = EnumValue<'stockStatus'>
export type OrderStatus = EnumValue<'orderStatus'>
export type PaymentMethod = EnumValue<'paymentMethod'>
export type PaymentStatus = EnumValue<'paymentStatus'>
export type StaffRole = EnumValue<'staffRole'>
export type Locale = EnumValue<'locale'>
