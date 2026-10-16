// Promo codes, what they apply to, and what has been redeemed (plan/09-data-model/06-cart-promotions.md section 3).
import { enums } from '@noor/contract'
import { sql } from 'drizzle-orm'
import { bigint, boolean, check, foreignKey, index, int, mysqlTable, primaryKey, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'
import { binVarchar, utc, uuid } from '../types.js'
import { inList } from './auth.js'
import { customers } from './customers.js'

export const promos = mysqlTable(
  'promos',
  {
    id: uuid('id').primaryKey(),
    /** Upper-case. */
    code: binVarchar('code', { length: 20 }).notNull(),
    type: binVarchar('type', { length: 16 }).notNull(),
    valueBps: int('value_bps'),
    valueMinor: bigint('value_minor', { mode: 'number' }),
    maxDiscountMinor: bigint('max_discount_minor', { mode: 'number' }),
    minSpendMinor: bigint('min_spend_minor', { mode: 'number' }),
    scope: binVarchar('scope', { length: 16 }).notNull().default('all'),
    excludeSaleItems: boolean('exclude_sale_items').notNull().default(true),
    firstOrderOnly: boolean('first_order_only').notNull().default(false),
    usageLimit: int('usage_limit'),
    perCustomerLimit: int('per_customer_limit').default(1),
    /** Redemptions that have not been reversed; changed only inside the order transaction (`redeem`, `reverse`). */
    usageCount: int('usage_count').notNull().default(0),
    startsAt: utc('starts_at'),
    endsAt: utc('ends_at'),
    enabled: boolean('enabled').notNull().default(true),
    /** Listed on the shop's Offers page (the code is shown to everyone). */
    isPublic: boolean('is_public').notNull().default(false),
    note: varchar('note', { length: 300 }),
    version: int('version').notNull().default(1),
    createdAt: utc('created_at').notNull(),
    updatedAt: utc('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('promos_code_uq').on(t.code),
    check('promos_type_chk', inList(t.type, enums.promoType)),
    check('promos_scope_chk', inList(t.scope, ['all', 'categories', 'products'])),
    check(
      'promos_value_chk',
      sql`(${t.type} = 'percent' and ${t.valueBps} is not null and ${t.valueMinor} is null) or (${t.type} = 'fixed' and ${t.valueMinor} is not null and ${t.valueBps} is null) or (${t.type} = 'free_shipping' and ${t.valueBps} is null and ${t.valueMinor} is null)`,
    ),
  ],
)

/** A category target includes its descendants. `target_id` is polymorphic, so there is no foreign key: the service drops rows whose target is gone. */
export const promoTargets = mysqlTable(
  'promo_targets',
  {
    promoId: uuid('promo_id').notNull(),
    targetType: binVarchar('target_type', { length: 16 }).notNull(),
    targetId: uuid('target_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.promoId, t.targetType, t.targetId] }),
    check('promo_targets_type_chk', inList(t.targetType, enums.promoTargetType)),
    foreignKey({ name: 'promo_targets_promo_fk', columns: [t.promoId], foreignColumns: [promos.id] }).onDelete('cascade'),
  ],
)

/**
 * One per order. `order_id` gets its foreign key to `orders` with the orders table (M4-04); until then the unique index alone keeps one redemption per order.
 */
export const promoRedemptions = mysqlTable(
  'promo_redemptions',
  {
    id: uuid('id').primaryKey(),
    promoId: uuid('promo_id').notNull(),
    orderId: uuid('order_id').notNull(),
    customerId: uuid('customer_id').notNull(),
    discountMinor: bigint('discount_minor', { mode: 'number' }).notNull(),
    shippingWaivedMinor: bigint('shipping_waived_minor', { mode: 'number' }).notNull().default(0),
    createdAt: utc('created_at').notNull(),
    reversedAt: utc('reversed_at'),
  },
  (t) => [
    uniqueIndex('promo_redemptions_order_uq').on(t.orderId),
    index('promo_redemptions_promo_idx').on(t.promoId, t.reversedAt),
    index('promo_redemptions_customer_idx').on(t.customerId, t.promoId, t.reversedAt),
    foreignKey({ name: 'promo_redemptions_promo_fk', columns: [t.promoId], foreignColumns: [promos.id] }), // RESTRICT: a used promo cannot be deleted
    foreignKey({ name: 'promo_redemptions_customer_fk', columns: [t.customerId], foreignColumns: [customers.id] }),
  ],
)
