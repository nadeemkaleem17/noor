// Stock: levels, the movement ledger, reservations and back-in-stock subscriptions (plan/09-data-model/04-inventory.md).
// `reservations.order_id`, `order_line_id` and `inventory_movements.order_id` become foreign keys when the orders tables exist (M4).
import { enums } from '@noor/contract'
import { sql } from 'drizzle-orm'
import { check, foreignKey, index, int, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'
import { binVarchar, utc, uuid } from '../types.js'
import { inList, staffUsers } from './auth.js'
import { variants } from './products.js'

export const inventoryLevels = mysqlTable(
  'inventory_levels',
  {
    variantId: uuid('variant_id').primaryKey(),
    onHand: int('on_hand').notNull().default(0),
    reserved: int('reserved').notNull().default(0),
    updatedAt: utc('updated_at').notNull(),
  },
  (t) => [
    foreignKey({ name: 'inventory_levels_variant_fk', columns: [t.variantId], foreignColumns: [variants.id] }).onDelete('cascade'),
    check('inventory_levels_chk', sql`${t.onHand} >= 0 and ${t.reserved} >= 0 and ${t.reserved} <= ${t.onHand}`),
  ],
)

/** Append-only. `on_hand` of a variant always equals the sum of its `delta`s. */
export const inventoryMovements = mysqlTable(
  'inventory_movements',
  {
    id: uuid('id').primaryKey(),
    variantId: uuid('variant_id').notNull(),
    delta: int('delta').notNull(),
    reason: binVarchar('reason', { length: 16 }).notNull(),
    note: varchar('note', { length: 300 }),
    orderId: uuid('order_id'),
    staffUserId: uuid('staff_user_id'),
    onHandAfter: int('on_hand_after').notNull(),
    createdAt: utc('created_at').notNull(),
  },
  (t) => [
    index('inventory_movements_variant_idx').on(t.variantId, t.id),
    index('inventory_movements_order_idx').on(t.orderId),
    foreignKey({ name: 'inventory_movements_variant_fk', columns: [t.variantId], foreignColumns: [variants.id] }),
    foreignKey({ name: 'inventory_movements_staff_fk', columns: [t.staffUserId], foreignColumns: [staffUsers.id] }).onDelete('set null'),
    check('inventory_movements_delta_chk', sql`${t.delta} <> 0`),
    check('inventory_movements_reason_chk', inList(t.reason, enums.movementReason)),
  ],
)

export const reservations = mysqlTable(
  'reservations',
  {
    id: uuid('id').primaryKey(),
    orderId: uuid('order_id').notNull(),
    orderLineId: uuid('order_line_id').notNull(),
    variantId: uuid('variant_id').notNull(),
    quantity: int('quantity').notNull(),
    status: binVarchar('status', { length: 16 }).notNull().default('active'),
    expiresAt: utc('expires_at'),
    createdAt: utc('created_at').notNull(),
    updatedAt: utc('updated_at').notNull(),
  },
  (t) => [
    index('reservations_order_idx').on(t.orderId),
    index('reservations_variant_idx').on(t.variantId, t.status),
    index('reservations_expiry_idx').on(t.status, t.expiresAt),
    foreignKey({ name: 'reservations_variant_fk', columns: [t.variantId], foreignColumns: [variants.id] }),
    check('reservations_quantity_chk', sql`${t.quantity} > 0`),
    check('reservations_status_chk', inList(t.status, enums.reservationStatus)),
  ],
)

export const stockSubscriptions = mysqlTable(
  'stock_subscriptions',
  {
    id: uuid('id').primaryKey(),
    variantId: uuid('variant_id').notNull(),
    phone: binVarchar('phone', { length: 16 }).notNull(),
    locale: binVarchar('locale', { length: 5 }).notNull().default('en'),
    createdAt: utc('created_at').notNull(),
    notifiedAt: utc('notified_at'),
  },
  (t) => [
    uniqueIndex('stock_subscriptions_variant_phone_uq').on(t.variantId, t.phone),
    foreignKey({ name: 'stock_subscriptions_variant_fk', columns: [t.variantId], foreignColumns: [variants.id] }).onDelete('cascade'),
  ],
)
