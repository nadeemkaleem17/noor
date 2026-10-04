// The audit trail (plan/09-data-model/02-auth-audit.md section 2.6). Append-only: triggers (migration 0002) refuse UPDATE and DELETE for every
// database user but the migration user; no code path updates or deletes a row.
import { enums } from '@noor/contract'
import { check, index, json, mysqlTable, varchar } from 'drizzle-orm/mysql-core'
import { binVarchar, utc, uuid } from '../types.js'
import { inList } from './auth.js'

export const auditLog = mysqlTable(
  'audit_log',
  {
    id: uuid('id').primaryKey(), // UUIDv7: id order = time order, used as the list cursor
    at: utc('at').notNull(),
    actorType: binVarchar('actor_type', { length: 16 }).notNull(),
    actorId: uuid('actor_id'), // no foreign key: the log is never blocked by, or cascaded from, staff changes
    actorLabel: varchar('actor_label', { length: 120 }).notNull(),
    actorRole: varchar('actor_role', { length: 32 }),
    action: binVarchar('action', { length: 64 }).notNull(), // <entity>.<verb>
    entityType: binVarchar('entity_type', { length: 32 }).notNull(),
    entityId: binVarchar('entity_id', { length: 64 }),
    entityLabel: varchar('entity_label', { length: 200 }),
    diff: json('diff'), // { field: [before, after] }, redacted
    reason: varchar('reason', { length: 500 }),
    category: binVarchar('category', { length: 16 }).notNull().default('general'), // general | security | money
    ip: varchar('ip', { length: 45 }),
    userAgent: varchar('user_agent', { length: 300 }),
    requestId: uuid('request_id'),
  },
  (t) => [
    index('audit_log_entity_idx').on(t.entityType, t.entityId, t.id),
    index('audit_log_actor_idx').on(t.actorId, t.id),
    index('audit_log_action_idx').on(t.action, t.id),
    index('audit_log_category_idx').on(t.category, t.id),
    index('audit_log_at_idx').on(t.at),
    check('audit_log_actor_type_chk', inList(t.actorType, enums.actorType)),
    check('audit_log_category_chk', inList(t.category, ['general', 'security', 'money'])),
  ],
)
