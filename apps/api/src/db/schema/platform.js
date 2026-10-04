// Outbox, jobs, dead jobs and counters (plan/09-data-model/01-platform.md sections 2.1-2.4).
import { sql } from 'drizzle-orm'
import { bigint, check, index, int, json, mysqlTable, primaryKey, smallint, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'
import { binChar, binVarchar, utc, uuid } from '../types.js'

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
  (t) => [uniqueIndex('jobs_unique_key_uq').on(t.uniqueKey), index('jobs_claim_idx').on(t.runAt), index('jobs_type_idx').on(t.type)],
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

export const idempotencyKeys = mysqlTable(
  'idempotency_keys',
  {
    scope: binVarchar('scope', { length: 40 }).notNull(), // route key, e.g. orders.create
    key: uuid('key').notNull(), // client UUID
    requestHash: binChar('request_hash', { length: 64 }).notNull(), // SHA-256 of the canonical request body
    status: binVarchar('status', { length: 16 }).notNull(), // in_progress | done
    responseStatus: smallint('response_status'),
    responseBody: json('response_body'), // sensitive: holds the order tracking token
    createdAt: utc('created_at').notNull(),
    expiresAt: utc('expires_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.scope, t.key] }), index('idempotency_keys_expires_idx').on(t.expiresAt), check('idempotency_keys_status_chk', sql`${t.status} IN ('in_progress', 'done')`)],
)

export const rateLimitHits = mysqlTable(
  'rate_limit_hits',
  {
    bucket: binVarchar('bucket', { length: 24 }).notNull(),
    subject: binVarchar('subject', { length: 100 }).notNull(), // ip:<addr>, phone:<sha256 prefix> ... never a clear phone or email
    windowStart: utc('window_start').notNull(),
    count: int('count').notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.bucket, t.subject, t.windowStart] }), index('rate_limit_hits_window_idx').on(t.windowStart)],
)
