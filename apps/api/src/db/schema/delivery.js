// Delivery people, their runs, the cash they hold and the receipts (plan/18-delivery-assignment-ledger-receipts.md section 3).
// Written only by modules/delivery. The ledger is append-only: a mistake is a reversing row, never an edit.
import { bigint, boolean, date, foreignKey, index, int, mysqlEnum, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'
import { binVarchar, utc, uuid } from '../types.js'
import { orders } from './orders.js'
import { couriers } from './shipping.js'

export const deliveryPeople = mysqlTable(
  'delivery_people',
  {
    id: uuid('id').primaryKey(),
    name: varchar('name', { length: 80 }).notNull(),
    phone: binVarchar('phone', { length: 16 }).notNull(),
    kind: mysqlEnum('kind', ['employee', 'freelancer', 'courier_rider']).notNull(),
    /** The courier the person's orders are dispatched with; the shop's own delivery courier when empty. */
    courierId: uuid('courier_id'),
    /** Paid to the person for each delivered order (credited to their ledger). */
    feeMinor: bigint('fee_minor', { mode: 'number' }).notNull().default(0),
    active: boolean('active').notNull().default(true),
    note: varchar('note', { length: 300 }),
    version: int('version').notNull().default(1),
    createdAt: utc('created_at').notNull(),
    updatedAt: utc('updated_at').notNull(),
  },
  (t) => [index('delivery_people_active_idx').on(t.active, t.name), foreignKey({ name: 'delivery_people_courier_fk', columns: [t.courierId], foreignColumns: [couriers.id] })],
)

export const deliveryRuns = mysqlTable(
  'delivery_runs',
  {
    id: uuid('id').primaryKey(),
    /** From the `delivery_run` counter, shown as `RUN-0001`. */
    number: int('number').notNull(),
    personId: uuid('person_id').notNull(),
    runDate: date('run_date', { mode: 'string' }).notNull(),
    status: mysqlEnum('status', ['open', 'out', 'closed']).notNull().default('open'),
    note: varchar('note', { length: 300 }),
    createdBy: uuid('created_by'),
    outAt: utc('out_at'),
    closedAt: utc('closed_at'),
    createdAt: utc('created_at').notNull(),
    updatedAt: utc('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('delivery_runs_number_uq').on(t.number),
    index('delivery_runs_person_idx').on(t.personId, t.runDate),
    index('delivery_runs_status_idx').on(t.status, t.runDate),
    foreignKey({ name: 'delivery_runs_person_fk', columns: [t.personId], foreignColumns: [deliveryPeople.id] }),
  ],
)

export const deliveryAssignments = mysqlTable(
  'delivery_assignments',
  {
    id: uuid('id').primaryKey(),
    runId: uuid('run_id').notNull(),
    orderId: uuid('order_id').notNull(),
    status: mysqlEnum('status', ['assigned', 'out', 'delivered', 'failed', 'returned', 'removed']).notNull().default('assigned'),
    /** The cash to collect when it was assigned: the part of the order not yet paid, for cash on delivery. */
    cashDueMinor: bigint('cash_due_minor', { mode: 'number' }).notNull(),
    collectedMinor: bigint('collected_minor', { mode: 'number' }).notNull().default(0),
    failReason: varchar('fail_reason', { length: 200 }),
    /** The order's id while the assignment is live (assigned, out, failed), else empty: the unique key keeps an order in one live assignment. */
    openKey: uuid('open_key'),
    assignedAt: utc('assigned_at').notNull(),
    outAt: utc('out_at'),
    resolvedAt: utc('resolved_at'),
  },
  (t) => [
    uniqueIndex('delivery_assignments_open_uq').on(t.openKey),
    index('delivery_assignments_run_idx').on(t.runId),
    index('delivery_assignments_order_idx').on(t.orderId, t.assignedAt),
    foreignKey({ name: 'delivery_assignments_run_fk', columns: [t.runId], foreignColumns: [deliveryRuns.id] }),
    foreignKey({ name: 'delivery_assignments_order_fk', columns: [t.orderId], foreignColumns: [orders.id] }),
  ],
)

export const receipts = mysqlTable(
  'receipts',
  {
    id: uuid('id').primaryKey(),
    /** `RC-000123` customer, `DP-000045` deposit, `FP-000007` fee payout: one counter for each kind. */
    number: binVarchar('number', { length: 12 }).notNull(),
    kind: mysqlEnum('kind', ['customer', 'deposit', 'fee']).notNull(),
    personId: uuid('person_id').notNull(),
    orderId: uuid('order_id'),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    status: mysqlEnum('status', ['issued', 'void']).notNull().default('issued'),
    voidReason: varchar('void_reason', { length: 200 }),
    issuedBy: uuid('issued_by'),
    issuedAt: utc('issued_at').notNull(),
    voidedBy: uuid('voided_by'),
    voidedAt: utc('voided_at'),
  },
  (t) => [
    uniqueIndex('receipts_number_uq').on(t.number),
    index('receipts_person_idx').on(t.personId, t.issuedAt),
    index('receipts_order_idx').on(t.orderId),
    foreignKey({ name: 'receipts_person_fk', columns: [t.personId], foreignColumns: [deliveryPeople.id] }),
  ],
)

export const riderLedger = mysqlTable(
  'rider_ledger',
  {
    id: uuid('id').primaryKey(),
    personId: uuid('person_id').notNull(),
    kind: mysqlEnum('kind', ['cash_due', 'cash_returned', 'deposit', 'fee', 'fee_paid', 'adjustment', 'reversal']).notNull(),
    /** Positive: the rider owes the shop more. Negative: the rider owes less. */
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    orderId: uuid('order_id'),
    assignmentId: uuid('assignment_id'),
    runId: uuid('run_id'),
    receiptId: uuid('receipt_id'),
    reversesId: uuid('reverses_id'),
    note: varchar('note', { length: 300 }),
    actorId: uuid('actor_id'),
    createdAt: utc('created_at').notNull(),
  },
  (t) => [
    index('rider_ledger_person_idx').on(t.personId, t.createdAt),
    index('rider_ledger_order_idx').on(t.orderId),
    index('rider_ledger_run_idx').on(t.runId),
    foreignKey({ name: 'rider_ledger_person_fk', columns: [t.personId], foreignColumns: [deliveryPeople.id] }),
  ],
)
