// Money in and out of an order, one row per attempt (plan/09-data-model/07-orders-payments.md section 4). A refund is its own row, so amounts only ever add up.
import { enums } from '@noor/contract'
import { sql } from 'drizzle-orm'
import { bigint, check, foreignKey, index, json, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'
import { binVarchar, utc, uuid } from '../types.js'
import { inList, staffUsers } from './auth.js'
import { media } from './media.js'
import { orders } from './orders.js'

export const payments = mysqlTable(
  'payments',
  {
    /** Also the reference sent to a provider: a retry cannot charge twice. */
    id: uuid('id').primaryKey(),
    orderId: uuid('order_id').notNull(),
    kind: binVarchar('kind', { length: 16 }).notNull(),
    /** What the customer or staff used: `cod`, `bank_transfer`, `cash`, ... */
    method: binVarchar('method', { length: 16 }).notNull(),
    /** Who handles it: `cod`, `manual`, `bank_transfer`, later `jazzcash`, `easypaisa`, `card`. */
    provider: binVarchar('provider', { length: 24 }).notNull(),
    state: binVarchar('state', { length: 24 }).notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    providerRef: binVarchar('provider_ref', { length: 120 }),
    /** What staff typed for a manual payment: a transfer id, a receipt number. */
    reference: varchar('reference', { length: 120 }),
    /** A picture of the receipt. */
    proofMediaId: uuid('proof_media_id'),
    recordedBy: uuid('recorded_by'),
    expiresAt: utc('expires_at'),
    createdAt: utc('created_at').notNull(),
    updatedAt: utc('updated_at').notNull(),
  },
  (t) => [
    index('payments_order_idx').on(t.orderId),
    index('payments_state_idx').on(t.state, t.createdAt),
    uniqueIndex('payments_provider_ref_uq').on(t.provider, t.providerRef),
    check('payments_amount_chk', sql`${t.amountMinor} > 0`),
    check('payments_kind_chk', inList(t.kind, enums.paymentKind)),
    check('payments_state_chk', inList(t.state, enums.paymentState)),
    foreignKey({ name: 'payments_order_fk', columns: [t.orderId], foreignColumns: [orders.id] }),
    foreignKey({ name: 'payments_staff_fk', columns: [t.recordedBy], foreignColumns: [staffUsers.id] }).onDelete('set null'),
    foreignKey({ name: 'payments_proof_fk', columns: [t.proofMediaId], foreignColumns: [media.id] }).onDelete('set null'),
  ],
)

/** What a provider told us, kept as received once its signature is checked. A repeated delivery of the same event is a no-op. */
export const paymentEvents = mysqlTable(
  'payment_events',
  {
    id: uuid('id').primaryKey(),
    provider: binVarchar('provider', { length: 24 }).notNull(),
    providerEventId: binVarchar('provider_event_id', { length: 120 }).notNull(),
    paymentId: uuid('payment_id'),
    payload: json('payload').notNull(),
    receivedAt: utc('received_at').notNull(),
    processedAt: utc('processed_at'),
  },
  (t) => [
    uniqueIndex('payment_events_provider_event_uq').on(t.provider, t.providerEventId),
    foreignKey({ name: 'payment_events_payment_fk', columns: [t.paymentId], foreignColumns: [payments.id] }).onDelete('set null'),
  ],
)
