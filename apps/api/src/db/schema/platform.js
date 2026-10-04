// Outbox, jobs, dead jobs and counters (plan/09-data-model/01-platform.md sections 2.1-2.4).
import { bigint, index, int, json, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'
import { binVarchar, utc, uuid } from '../types.js'

export const outboxEvents = mysqlTable(
  'outbox_events',
  {
    id: uuid('id').primaryKey(), // UUIDv7: id order is creation order
    type: binVarchar('type', { length: 64 }).notNull(),
    payload: json('payload').notNull(), // ids only, no personal data
    requestId: uuid('request_id'),
    createdAt: utc('created_at').notNull(),
    processedAt: utc('processed_at'),
  },
  (t) => [index('outbox_events_unprocessed_idx').on(t.processedAt, t.id)],
)

export const jobs = mysqlTable(
  'jobs',
  {
    id: uuid('id').primaryKey(),
    type: binVarchar('type', { length: 64 }).notNull(),
    payload: json('payload').notNull(),
    uniqueKey: binVarchar('unique_key', { length: 190 }),
    runAt: utc('run_at').notNull(),
    attempts: int('attempts').notNull().default(0),
    maxAttempts: int('max_attempts').notNull().default(8),
    lockedAt: utc('locked_at'),
    lockedBy: varchar('locked_by', { length: 64 }),
    lastError: varchar('last_error', { length: 500 }),
    createdAt: utc('created_at').notNull(),
  },
  (t) => [uniqueIndex('jobs_unique_key_uq').on(t.uniqueKey), index('jobs_claim_idx').on(t.lockedAt, t.runAt), index('jobs_type_idx').on(t.type)],
)

export const jobsDead = mysqlTable(
  'jobs_dead',
  {
    id: uuid('id').primaryKey(), // the original job id
    type: binVarchar('type', { length: 64 }).notNull(),
    payload: json('payload').notNull(),
    uniqueKey: binVarchar('unique_key', { length: 190 }),
    runAt: utc('run_at').notNull(),
    attempts: int('attempts').notNull(),
    maxAttempts: int('max_attempts').notNull(),
    lastError: varchar('last_error', { length: 500 }),
    createdAt: utc('created_at').notNull(),
    diedAt: utc('died_at').notNull(),
  },
  (t) => [index('jobs_dead_type_idx').on(t.type, t.diedAt)],
)

export const counters = mysqlTable('counters', {
  name: binVarchar('name', { length: 32 }).primaryKey(), // order_number, invoice_2026, ...
  value: bigint('value', { mode: 'number' }).notNull(), // last issued value
})
