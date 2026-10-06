// Orders, their lines and their history (plan/09-data-model/07-orders-payments.md section 3). Everything about the customer, the address, the
// prices and the product is copied at the time of the order: nothing here changes when the catalog or a customer does.
import { enums } from '@noor/contract'
import { sql } from 'drizzle-orm'
import { bigint, boolean, check, foreignKey, index, int, json, mysqlTable, smallint, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'
import { binChar, binVarchar, utc, uuid } from '../types.js'
import { inList, staffUsers } from './auth.js'
import { customers } from './customers.js'
import { media } from './media.js'
import { products, variants } from './products.js'
import { cities, couriers, shippingMethods } from './shipping.js'

export const orders = mysqlTable(
  'orders',
  {
    id: uuid('id').primaryKey(),
    /** From the `order_number` counter. Shown as `<prefix>-<number>`. */
    number: bigint('number', { mode: 'number' }).notNull(),
    numberPrefix: binVarchar('number_prefix', { length: 4 }).notNull(),
    /** SHA-256 of the customer's tracking token (derived from the id, never stored itself). */
    trackingTokenHash: binChar('tracking_token_hash', { length: 64 }).notNull(),
    status: binVarchar('status', { length: 24 }).notNull(),
    channel: binVarchar('channel', { length: 16 }).notNull().default('storefront'),
    locale: binVarchar('locale', { length: 5 }).notNull().default('en'),
    customerId: uuid('customer_id').notNull(),
    customerName: varchar('customer_name', { length: 80 }).notNull(),
    customerPhone: binVarchar('customer_phone', { length: 16 }).notNull(),
    customerEmail: varchar('customer_email', { length: 254 }),
    shipCityId: uuid('ship_city_id').notNull(),
    shipCity: varchar('ship_city', { length: 60 }).notNull(),
    shipAddress: varchar('ship_address', { length: 250 }).notNull(),
    shipLandmark: varchar('ship_landmark', { length: 120 }),
    shipNotes: varchar('ship_notes', { length: 250 }),
    customFields: json('custom_fields'),
    shippingMethodId: uuid('shipping_method_id'),
    shippingMethodLabel: varchar('shipping_method_label', { length: 60 }).notNull(),
    etaMinDays: smallint('eta_min_days').notNull(),
    etaMaxDays: smallint('eta_max_days').notNull(),
    subtotalMinor: bigint('subtotal_minor', { mode: 'number' }).notNull(),
    discountMinor: bigint('discount_minor', { mode: 'number' }).notNull().default(0),
    shippingFeeMinor: bigint('shipping_fee_minor', { mode: 'number' }).notNull(),
    totalMinor: bigint('total_minor', { mode: 'number' }).notNull(),
    depositDueMinor: bigint('deposit_due_minor', { mode: 'number' }).notNull().default(0),
    // derived by the payments module
    paidMinor: bigint('paid_minor', { mode: 'number' }).notNull().default(0),
    refundedMinor: bigint('refunded_minor', { mode: 'number' }).notNull().default(0),
    promoCode: binVarchar('promo_code', { length: 20 }),
    paymentMethod: binVarchar('payment_method', { length: 16 }).notNull(),
    paymentStatus: binVarchar('payment_status', { length: 24 }).notNull().default('unpaid'),
    invoiceNumber: binVarchar('invoice_number', { length: 20 }),
    courierId: uuid('courier_id'),
    courierName: varchar('courier_name', { length: 60 }),
    trackingNumber: varchar('tracking_number', { length: 60 }),
    cancelReason: binVarchar('cancel_reason', { length: 24 }),
    placedAt: utc('placed_at').notNull(),
    confirmedAt: utc('confirmed_at'),
    dispatchedAt: utc('dispatched_at'),
    deliveredAt: utc('delivered_at'),
    /** Cancelled or returned. */
    closedAt: utc('closed_at'),
    statusChangedAt: utc('status_changed_at').notNull(),
    createdBy: uuid('created_by'),
    version: int('version').notNull().default(1),
    createdAt: utc('created_at').notNull(),
    updatedAt: utc('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('orders_number_uq').on(t.number),
    uniqueIndex('orders_tracking_token_uq').on(t.trackingTokenHash),
    uniqueIndex('orders_invoice_uq').on(t.invoiceNumber),
    index('orders_status_placed_idx').on(t.status, t.placedAt),
    index('orders_status_changed_idx').on(t.status, t.statusChangedAt),
    index('orders_customer_idx').on(t.customerId, t.placedAt),
    index('orders_phone_idx').on(t.customerPhone),
    index('orders_placed_idx').on(t.placedAt),
    index('orders_city_idx').on(t.shipCityId, t.placedAt),
    index('orders_tracking_idx').on(t.trackingNumber),
    index('orders_promo_idx').on(t.promoCode),
    index('orders_payment_idx').on(t.paymentMethod, t.paymentStatus),
    check('orders_total_chk', sql`${t.totalMinor} = ${t.subtotalMinor} - ${t.discountMinor} + ${t.shippingFeeMinor}`),
    check(
      'orders_money_chk',
      sql`${t.subtotalMinor} >= 0 and ${t.discountMinor} >= 0 and ${t.shippingFeeMinor} >= 0 and ${t.totalMinor} >= 0 and ${t.depositDueMinor} >= 0 and ${t.paidMinor} >= 0 and ${t.refundedMinor} >= 0 and ${t.depositDueMinor} <= ${t.totalMinor}`,
    ),
    check('orders_status_chk', inList(t.status, enums.orderStatus)),
    check('orders_channel_chk', inList(t.channel, enums.orderChannel)),
    check('orders_payment_method_chk', inList(t.paymentMethod, enums.paymentMethod)),
    check('orders_payment_status_chk', inList(t.paymentStatus, enums.paymentStatus)),
    foreignKey({ name: 'orders_customer_fk', columns: [t.customerId], foreignColumns: [customers.id] }),
    foreignKey({ name: 'orders_city_fk', columns: [t.shipCityId], foreignColumns: [cities.id] }),
    foreignKey({ name: 'orders_method_fk', columns: [t.shippingMethodId], foreignColumns: [shippingMethods.id] }).onDelete('set null'),
    foreignKey({ name: 'orders_courier_fk', columns: [t.courierId], foreignColumns: [couriers.id] }).onDelete('set null'),
    foreignKey({ name: 'orders_created_by_fk', columns: [t.createdBy], foreignColumns: [staffUsers.id] }).onDelete('set null'),
  ],
)

export const orderLines = mysqlTable(
  'order_lines',
  {
    id: uuid('id').primaryKey(),
    orderId: uuid('order_id').notNull(),
    position: smallint('position').notNull(),
    productId: uuid('product_id').notNull(),
    variantId: uuid('variant_id').notNull(),
    kind: binVarchar('kind', { length: 16 }).notNull(),
    title: varchar('title', { length: 120 }).notNull(),
    variantLabel: varchar('variant_label', { length: 120 }).notNull().default(''),
    sku: binVarchar('sku', { length: 40 }).notNull(),
    imageMediaId: uuid('image_media_id'),
    quantity: smallint('quantity').notNull(),
    unitPriceMinor: bigint('unit_price_minor', { mode: 'number' }).notNull(),
    lineSubtotalMinor: bigint('line_subtotal_minor', { mode: 'number' }).notNull(),
    /** This line's share of the promo discount: refunds and partial returns use these exact amounts. */
    discountMinor: bigint('discount_minor', { mode: 'number' }).notNull().default(0),
    depositMinor: bigint('deposit_minor', { mode: 'number' }).notNull().default(0),
    customization: json('customization'),
    /** Whether stock was held for it (counted variants). */
    stockTracked: boolean('stock_tracked').notNull(),
    returnedQuantity: smallint('returned_quantity').notNull().default(0),
    leadMinDays: smallint('lead_min_days'),
    leadMaxDays: smallint('lead_max_days'),
  },
  (t) => [
    index('order_lines_order_idx').on(t.orderId, t.position),
    index('order_lines_variant_idx').on(t.variantId),
    index('order_lines_sku_idx').on(t.sku),
    index('order_lines_product_idx').on(t.productId),
    check('order_lines_quantity_chk', sql`${t.quantity} > 0`),
    check('order_lines_subtotal_chk', sql`${t.lineSubtotalMinor} = ${t.unitPriceMinor} * ${t.quantity}`),
    check('order_lines_returned_chk', sql`${t.returnedQuantity} <= ${t.quantity}`),
    foreignKey({ name: 'order_lines_order_fk', columns: [t.orderId], foreignColumns: [orders.id] }).onDelete('cascade'),
    foreignKey({ name: 'order_lines_product_fk', columns: [t.productId], foreignColumns: [products.id] }),
    foreignKey({ name: 'order_lines_variant_fk', columns: [t.variantId], foreignColumns: [variants.id] }),
    foreignKey({ name: 'order_lines_media_fk', columns: [t.imageMediaId], foreignColumns: [media.id] }).onDelete('set null'),
  ],
)

/** Append-only: transitions, edits, notes, attempts, notifications, payments. The admin timeline and the customer's four steps come from it. */
export const orderEvents = mysqlTable(
  'order_events',
  {
    /** UUIDv7: time-ordered. */
    id: uuid('id').primaryKey(),
    orderId: uuid('order_id').notNull(),
    type: binVarchar('type', { length: 32 }).notNull(),
    fromStatus: binVarchar('from_status', { length: 24 }),
    toStatus: binVarchar('to_status', { length: 24 }),
    actorType: binVarchar('actor_type', { length: 16 }).notNull(),
    actorId: uuid('actor_id'),
    actorLabel: varchar('actor_label', { length: 120 }),
    data: json('data'),
    /** Whether the customer's timeline may show it. */
    public: boolean('public').notNull().default(false),
    createdAt: utc('created_at').notNull(),
  },
  (t) => [
    index('order_events_order_idx').on(t.orderId, t.id),
    check('order_events_actor_chk', inList(t.actorType, enums.actorType)),
    foreignKey({ name: 'order_events_order_fk', columns: [t.orderId], foreignColumns: [orders.id] }).onDelete('cascade'),
  ],
)
