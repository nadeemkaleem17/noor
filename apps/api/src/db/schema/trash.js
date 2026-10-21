// The trash of the admin (plan/17-owner-requests-2026-10.md item 6): what staff deleted, kept as the document it was for 30 days so it can be put back. Written only by modules/trash.
// A deleted record is really deleted (nothing in the shop lists, searches or sells it); what is kept here is a copy of its input, never a live row.
import { index, json, mysqlEnum, mysqlTable, varchar } from 'drizzle-orm/mysql-core'
import { utc, uuid } from '../types.js'

export const trashItems = mysqlTable(
  'trash_items',
  {
    id: uuid('id').primaryKey(),
    kind: mysqlEnum('kind', ['product', 'category', 'attribute', 'collection', 'promo', 'page']).notNull(),
    label: varchar('label', { length: 160 }).notNull(),
    /** What `create` takes for this kind: the same words the record was made with. */
    payload: json('payload').notNull(),
    deletedAt: utc('deleted_at').notNull(),
    deletedById: uuid('deleted_by_id'),
    deletedByName: varchar('deleted_by_name', { length: 100 }),
    /** Thirty days after the delete. */
    expiresAt: utc('expires_at').notNull(),
    restoredAt: utc('restored_at'),
  },
  (t) => [index('trash_items_open_idx').on(t.restoredAt, t.deletedAt), index('trash_items_expires_idx').on(t.expiresAt)],
)
