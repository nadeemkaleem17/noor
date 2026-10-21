// Customer accounts (plan/10-api/11-account.md). A customer row (one per phone) stays what it was; an account is the password and the sessions of the person who registered it, and the orders
// that account may see. Written only by modules/accounts.
import { foreignKey, index, mysqlEnum, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'
import { binChar, utc, uuid } from '../types.js'
import { customers } from './customers.js'
import { orders } from './orders.js'

export const customerAccounts = mysqlTable(
  'customer_accounts',
  {
    customerId: uuid('customer_id').primaryKey(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    registeredAt: utc('registered_at').notNull(),
    lastLoginAt: utc('last_login_at'),
    updatedAt: utc('updated_at').notNull(),
  },
  (t) => [foreignKey({ name: 'customer_accounts_customer_fk', columns: [t.customerId], foreignColumns: [customers.id] }).onDelete('cascade')],
)

export const customerSessions = mysqlTable(
  'customer_sessions',
  {
    id: uuid('id').primaryKey(),
    customerId: uuid('customer_id').notNull(),
    /** SHA-256 of the token: the token itself is only ever in the storefront server's cookie. */
    tokenHash: binChar('token_hash', { length: 64 }).notNull(),
    createdAt: utc('created_at').notNull(),
    expiresAt: utc('expires_at').notNull(),
  },
  (t) => [
    uniqueIndex('customer_sessions_token_uq').on(t.tokenHash),
    index('customer_sessions_customer_idx').on(t.customerId),
    index('customer_sessions_expires_idx').on(t.expiresAt),
    foreignKey({ name: 'customer_sessions_customer_fk', columns: [t.customerId], foreignColumns: [customers.id] }).onDelete('cascade'),
  ],
)

/** The orders an account may see: placed while signed in, or added by the order's own link. An order is in at most one account. */
export const accountOrders = mysqlTable(
  'account_orders',
  {
    orderId: uuid('order_id').primaryKey(),
    customerId: uuid('customer_id').notNull(),
    via: mysqlEnum('via', ['placed', 'claimed']).notNull(),
    linkedAt: utc('linked_at').notNull(),
  },
  (t) => [
    index('account_orders_customer_idx').on(t.customerId, t.linkedAt),
    foreignKey({ name: 'account_orders_order_fk', columns: [t.orderId], foreignColumns: [orders.id] }),
    foreignKey({ name: 'account_orders_customer_fk', columns: [t.customerId], foreignColumns: [customers.id] }).onDelete('cascade'),
  ],
)
