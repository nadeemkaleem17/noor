// Carts: a token, a promo and lines. No customer data and no money: prices are read from the variants every time (plan/09-data-model/06-cart-promotions.md section 2).
import { sql } from 'drizzle-orm'
import { bigint, check, foreignKey, index, json, mysqlTable, smallint, uniqueIndex } from 'drizzle-orm/mysql-core'
import { binChar, binVarchar, utc, uuid } from '../types.js'
import { promos } from './promotions.js'
import { variants } from './products.js'

export const carts = mysqlTable(
  'carts',
  {
    id: uuid('id').primaryKey(),
    /** SHA-256 of the `nc_cart` cookie value; the cookie is a random token, never the row id. */
    tokenHash: binChar('token_hash', { length: 64 }).notNull(),
    promoId: uuid('promo_id'),
    locale: binVarchar('locale', { length: 5 }).notNull().default('en'),
    createdAt: utc('created_at').notNull(),
    /** Last activity: carts idle for 30 days are deleted. */
    updatedAt: utc('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('carts_token_uq').on(t.tokenHash),
    index('carts_updated_idx').on(t.updatedAt),
    foreignKey({ name: 'carts_promo_fk', columns: [t.promoId], foreignColumns: [promos.id] }).onDelete('set null'),
  ],
)

export const cartLines = mysqlTable(
  'cart_lines',
  {
    id: uuid('id').primaryKey(),
    cartId: uuid('cart_id').notNull(),
    variantId: uuid('variant_id').notNull(),
    quantity: smallint('quantity').notNull(),
    customization: json('customization'),
    /** SHA-256 of the canonical customisation; empty when there is none. Part of the line's identity. */
    customizationHash: binChar('customization_hash', { length: 64 }).notNull().default(''),
    /** The unit price the customer last saw; used only to notice that it changed. */
    seenUnitPriceMinor: bigint('seen_unit_price_minor', { mode: 'number' }).notNull(),
    createdAt: utc('created_at').notNull(),
    updatedAt: utc('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('cart_lines_identity_uq').on(t.cartId, t.variantId, t.customizationHash),
    index('cart_lines_cart_idx').on(t.cartId, t.createdAt),
    check('cart_lines_quantity_chk', sql`${t.quantity} between 1 and 99`),
    foreignKey({ name: 'cart_lines_cart_fk', columns: [t.cartId], foreignColumns: [carts.id] }).onDelete('cascade'),
    foreignKey({ name: 'cart_lines_variant_fk', columns: [t.variantId], foreignColumns: [variants.id] }).onDelete('cascade'),
  ],
)
