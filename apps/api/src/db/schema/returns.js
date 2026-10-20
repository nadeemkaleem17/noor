// Return and exchange requests (plan/10-api/10-returns.md). Written only by modules/returns. A request records what was asked and decided;
// the order, the stock and the money are changed by the order screens, never from here.
import { bigint, date, foreignKey, index, int, mysqlEnum, mysqlTable, primaryKey, smallint, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'
import { utc, uuid } from '../types.js'
import { staffUsers } from './auth.js'
import { orderLines, orders } from './orders.js'

export const returnRequests = mysqlTable(
  'return_requests',
  {
    id: uuid('id').primaryKey(),
    /** From the `return_request` counter, shown as `RR-0001`. */
    number: int('number').notNull(),
    orderId: uuid('order_id').notNull(),
    kind: mysqlEnum('kind', ['return', 'exchange']).notNull(),
    reason: mysqlEnum('reason', ['wrong_size', 'not_as_described', 'defective', 'changed_mind', 'other']).notNull(),
    note: varchar('note', { length: 500 }),
    exchangeNote: varchar('exchange_note', { length: 200 }),
    status: mysqlEnum('status', ['requested', 'approved', 'declined', 'received', 'completed']).notNull().default('requested'),
    decisionNote: varchar('decision_note', { length: 300 }),
    pickupOn: date('pickup_on', { mode: 'string' }),
    /** Paisa written down by staff when money is given back; the payment itself is recorded on the order. */
    refundMinor: bigint('refund_minor', { mode: 'number' }),
    requestedAt: utc('requested_at').notNull(),
    decidedAt: utc('decided_at'),
    decidedBy: uuid('decided_by'),
    updatedAt: utc('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('return_requests_number_uq').on(t.number),
    index('return_requests_status_idx').on(t.status, t.requestedAt),
    index('return_requests_order_idx').on(t.orderId),
    foreignKey({ name: 'return_requests_order_fk', columns: [t.orderId], foreignColumns: [orders.id] }),
    foreignKey({ name: 'return_requests_decided_by_fk', columns: [t.decidedBy], foreignColumns: [staffUsers.id] }),
  ],
)

export const returnRequestLines = mysqlTable(
  'return_request_lines',
  {
    requestId: uuid('request_id').notNull(),
    orderLineId: uuid('order_line_id').notNull(),
    quantity: smallint('quantity').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.requestId, t.orderLineId] }),
    foreignKey({ name: 'return_request_lines_request_fk', columns: [t.requestId], foreignColumns: [returnRequests.id] }),
    foreignKey({ name: 'return_request_lines_line_fk', columns: [t.orderLineId], foreignColumns: [orderLines.id] }),
  ],
)
