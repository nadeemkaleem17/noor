// Customers and their notes (plan/09-data-model/07-orders-payments.md section 2).
import { bigint, boolean, foreignKey, index, int, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'
import { binVarchar, utc, uuid } from '../types.js'
import { staffUsers } from './auth.js'

export const customers = mysqlTable(
  'customers',
  {
    id: uuid('id').primaryKey(),
    /** E.164 (`+923001234567`): the identity. A random `+0…` placeholder once anonymised. */
    phone: binVarchar('phone', { length: 16 }).notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    email: varchar('email', { length: 254 }),
    city: varchar('city', { length: 60 }),
    noCod: boolean('no_cod').notNull().default(false),
    noCodReason: varchar('no_cod_reason', { length: 300 }),
    vip: boolean('vip').notNull().default(false),
    marketingConsent: boolean('marketing_consent').notNull().default(false),
    consentNote: varchar('consent_note', { length: 200 }),
    // Derived: changed only by `applyOrderChange` inside the order transition transaction.
    ordersCount: int('orders_count').notNull().default(0),
    deliveredCount: int('delivered_count').notNull().default(0),
    refusedCount: int('refused_count').notNull().default(0),
    cancelledCount: int('cancelled_count').notNull().default(0),
    spentMinor: bigint('spent_minor', { mode: 'number' }).notNull().default(0),
    firstOrderAt: utc('first_order_at'),
    lastOrderAt: utc('last_order_at'),
    // Derived from the visitors that belong to this customer (modules/visits is the only writer): kept apart from the order counters on purpose.
    visitsCount: int('visits_count').notNull().default(0),
    lastVisitAt: utc('last_visit_at'),
    anonymisedAt: utc('anonymised_at'),
    version: int('version').notNull().default(1),
    createdAt: utc('created_at').notNull(),
    updatedAt: utc('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('customers_phone_uq').on(t.phone),
    index('customers_last_order_idx').on(t.lastOrderAt),
    index('customers_name_idx').on(t.name),
    index('customers_email_idx').on(t.email),
    index('customers_city_idx').on(t.city),
    index('customers_refused_idx').on(t.refusedCount),
    index('customers_visits_idx').on(t.visitsCount),
  ],
)

/** Add-only: a note is never edited or removed (except with the customer, when anonymised). */
export const customerNotes = mysqlTable(
  'customer_notes',
  {
    id: uuid('id').primaryKey(),
    customerId: uuid('customer_id').notNull(),
    body: varchar('body', { length: 1000 }).notNull(),
    staffUserId: uuid('staff_user_id'),
    createdAt: utc('created_at').notNull(),
  },
  (t) => [
    index('customer_notes_customer_idx').on(t.customerId),
    foreignKey({ name: 'customer_notes_customer_fk', columns: [t.customerId], foreignColumns: [customers.id] }).onDelete('cascade'),
    foreignKey({ name: 'customer_notes_staff_fk', columns: [t.staffUserId], foreignColumns: [staffUsers.id] }).onDelete('set null'),
  ],
)
