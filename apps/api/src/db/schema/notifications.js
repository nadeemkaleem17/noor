// Every message we tried, or would have tried, to send (plan/09-data-model/08-reviews-notifications.md section 3). While no messaging provider is
// configured the customer's message is written here as `skipped`, with its text, so staff can copy it into WhatsApp by hand.
import { enums } from '@noor/contract'
import { check, foreignKey, index, mysqlTable, text, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'
import { binVarchar, utc, uuid } from '../types.js'
import { inList } from './auth.js'
import { orders } from './orders.js'

export const notificationLog = mysqlTable(
  'notification_log',
  {
    id: uuid('id').primaryKey(),
    /** `<template>:<entity id>:<channel>`: a retried job cannot send twice. */
    uniqueKey: binVarchar('unique_key', { length: 190 }).notNull(),
    template: binVarchar('template', { length: 40 }).notNull(),
    /** The channel the message was meant for: a `skipped` row says which one was not available. */
    channel: binVarchar('channel', { length: 16 }).notNull(),
    audience: binVarchar('audience', { length: 16 }).notNull(),
    orderId: uuid('order_id'),
    /** A phone or an email: personal data, cleared when the customer is anonymised and deleted after 90 days. */
    recipient: varchar('recipient', { length: 254 }).notNull(),
    locale: binVarchar('locale', { length: 5 }).notNull(),
    body: text('body').notNull(),
    status: binVarchar('status', { length: 16 }).notNull(),
    provider: binVarchar('provider', { length: 24 }),
    providerRef: varchar('provider_ref', { length: 120 }),
    error: varchar('error', { length: 300 }),
    createdAt: utc('created_at').notNull(),
    sentAt: utc('sent_at'),
  },
  (t) => [
    uniqueIndex('notification_log_key_uq').on(t.uniqueKey),
    index('notification_log_order_idx').on(t.orderId, t.createdAt),
    index('notification_log_status_idx').on(t.status, t.createdAt),
    check('notification_log_channel_chk', inList(t.channel, enums.notificationChannel)),
    check('notification_log_status_chk', inList(t.status, enums.notificationStatus)),
    check('notification_log_audience_chk', inList(t.audience, ['customer', 'staff'])),
    foreignKey({ name: 'notification_log_order_fk', columns: [t.orderId], foreignColumns: [orders.id] }).onDelete('cascade'),
  ],
)
