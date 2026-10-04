// Uploaded files (plan/09-data-model/03-catalog.md section 2.1). `confirmed_at` is not in the original table: it tells a ticket the browser
// never confirmed (purged after 24 hours) from one that is waiting for `media.process`.
import { enums } from '@noor/contract'
import { check, foreignKey, index, int, json, mysqlTable, varchar } from 'drizzle-orm/mysql-core'
import { binVarchar, utc, uuid } from '../types.js'
import { inList, staffUsers } from './auth.js'

export const media = mysqlTable(
  'media',
  {
    id: uuid('id').primaryKey(),
    kind: binVarchar('kind', { length: 16 }).notNull().default('image'),
    status: binVarchar('status', { length: 16 }).notNull().default('pending'),
    objectKey: binVarchar('object_key', { length: 500 }).notNull().unique('media_object_key_uq'),
    contentType: binVarchar('content_type', { length: 60 }).notNull(),
    bytes: int('bytes').notNull(),
    width: int('width'),
    height: int('height'),
    lqip: varchar('lqip', { length: 1500 }),
    durationSec: int('duration_sec'),
    posterMediaId: uuid('poster_media_id'),
    alt: varchar('alt', { length: 300 }).notNull().default(''),
    i18n: json('i18n'),
    rejectReason: varchar('reject_reason', { length: 100 }),
    uploadedBy: uuid('uploaded_by'),
    confirmedAt: utc('confirmed_at'),
    createdAt: utc('created_at').notNull(),
  },
  (t) => [
    index('media_status_idx').on(t.status, t.createdAt),
    foreignKey({ name: 'media_poster_fk', columns: [t.posterMediaId], foreignColumns: [t.id] }).onDelete('set null'),
    foreignKey({ name: 'media_uploaded_by_fk', columns: [t.uploadedBy], foreignColumns: [staffUsers.id] }).onDelete('set null'),
    check('media_kind_chk', inList(t.kind, enums.mediaKind)),
    check('media_status_chk', inList(t.status, enums.mediaStatus)),
  ],
)
