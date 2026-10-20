// Visits and the rules that colour customers (plan/17-owner-requests-2026-10.md section 6).
// A visitor is a browser: an id the shop's own cookie holds, nothing else (no address, no browser name). It belongs to a customer only after
// that person placed an order from the same browser, which is the one reliable link there is; before that it stays anonymous.
import { boolean, foreignKey, index, int, mysqlEnum, mysqlTable, varchar } from 'drizzle-orm/mysql-core'
import { binChar, utc, uuid } from '../types.js'
import { customers } from './customers.js'

export const visitors = mysqlTable(
  'visitors',
  {
    /** 32 hex characters made by the shop's server; also the value of the visitor's cookie. */
    id: binChar('id', { length: 32 }).primaryKey(),
    customerId: uuid('customer_id'),
    firstSeenAt: utc('first_seen_at').notNull(),
    lastVisitAt: utc('last_visit_at').notNull(),
    visitsCount: int('visits_count').notNull().default(1),
  },
  (t) => [
    index('visitors_customer_idx').on(t.customerId),
    index('visitors_first_seen_idx').on(t.firstSeenAt),
    foreignKey({ name: 'visitors_customer_fk', columns: [t.customerId], foreignColumns: [customers.id] }).onDelete('set null'),
  ],
)

/** One row per visit: the first page of a stay that began more than 30 minutes after the last one. */
export const visits = mysqlTable(
  'visits',
  {
    id: uuid('id').primaryKey(),
    visitorId: binChar('visitor_id', { length: 32 }).notNull(),
    startedAt: utc('started_at').notNull(),
    landingPath: varchar('landing_path', { length: 120 }).notNull(),
  },
  (t) => [
    index('visits_visitor_idx').on(t.visitorId, t.startedAt),
    index('visits_started_idx').on(t.startedAt),
    foreignKey({ name: 'visits_visitor_fk', columns: [t.visitorId], foreignColumns: [visitors.id] }).onDelete('cascade'),
  ],
)

/** What colours a customer in the admin: a range of orders or of visits, a colour, a label. Staff add, change and remove them; none is in the code. */
export const customerHighlightRules = mysqlTable(
  'customer_highlight_rules',
  {
    id: uuid('id').primaryKey(),
    kind: mysqlEnum('kind', ['orders', 'visits']).notNull(),
    minCount: int('min_count').notNull(),
    /** Empty = no upper limit. */
    maxCount: int('max_count'),
    /** `#rrggbb`. */
    color: varchar('color', { length: 7 }).notNull(),
    label: varchar('label', { length: 40 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: utc('created_at').notNull(),
    updatedAt: utc('updated_at').notNull(),
  },
  (t) => [index('customer_highlight_rules_kind_idx').on(t.kind, t.minCount)],
)
