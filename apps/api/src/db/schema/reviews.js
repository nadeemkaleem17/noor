// Product reviews (plan/09-data-model/08-reviews-notifications.md section 2). One per purchased order line, shown only once staff approve it.
// There is no invite table: the order's link already proves who may write, and the 90-day window runs from the delivery date.
import { enums } from '@noor/contract'
import { sql } from 'drizzle-orm'
import { check, foreignKey, index, mysqlTable, primaryKey, smallint, tinyint, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'
import { binVarchar, utc, uuid } from '../types.js'
import { inList, staffUsers } from './auth.js'
import { media } from './media.js'
import { orderLines } from './orders.js'
import { products } from './products.js'

export const reviews = mysqlTable(
  'reviews',
  {
    id: uuid('id').primaryKey(),
    productId: uuid('product_id').notNull(),
    orderLineId: uuid('order_line_id').notNull(),
    /** First name and last initial by default; never the phone or the full name. */
    displayName: varchar('display_name', { length: 40 }).notNull(),
    rating: tinyint('rating').notNull(),
    title: varchar('title', { length: 100 }),
    body: varchar('body', { length: 1000 }).notNull(),
    fit: binVarchar('fit', { length: 16 }),
    status: binVarchar('status', { length: 16 }).notNull().default('pending'),
    rejectReason: binVarchar('reject_reason', { length: 24 }),
    rejectNote: varchar('reject_note', { length: 300 }),
    replyBody: varchar('reply_body', { length: 600 }),
    replyAt: utc('reply_at'),
    moderatedBy: uuid('moderated_by'),
    moderatedAt: utc('moderated_at'),
    locale: binVarchar('locale', { length: 5 }).notNull().default('en'),
    createdAt: utc('created_at').notNull(),
    updatedAt: utc('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('reviews_order_line_uq').on(t.orderLineId),
    index('reviews_product_idx').on(t.productId, t.status, t.createdAt),
    index('reviews_status_idx').on(t.status, t.createdAt),
    check('reviews_rating_chk', sql`${t.rating} BETWEEN 1 AND 5`),
    check('reviews_status_chk', inList(t.status, enums.reviewStatus)),
    check('reviews_fit_chk', sql`${t.fit} IS NULL OR ${inList(t.fit, enums.fitNote)}`),
    check('reviews_reject_reason_chk', sql`${t.rejectReason} IS NULL OR ${inList(t.rejectReason, enums.reviewRejectReason)}`),
    foreignKey({ name: 'reviews_product_fk', columns: [t.productId], foreignColumns: [products.id] }).onDelete('cascade'),
    foreignKey({ name: 'reviews_line_fk', columns: [t.orderLineId], foreignColumns: [orderLines.id] }).onDelete('restrict'),
    foreignKey({ name: 'reviews_moderator_fk', columns: [t.moderatedBy], foreignColumns: [staffUsers.id] }).onDelete('set null'),
  ],
)

/** At most three per review. Removing one deletes the row, then the media. */
export const reviewPhotos = mysqlTable(
  'review_photos',
  {
    reviewId: uuid('review_id').notNull(),
    mediaId: uuid('media_id').notNull(),
    sortOrder: smallint('sort_order').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.reviewId, t.mediaId] }),
    foreignKey({ name: 'review_photos_review_fk', columns: [t.reviewId], foreignColumns: [reviews.id] }).onDelete('cascade'),
    foreignKey({ name: 'review_photos_media_fk', columns: [t.mediaId], foreignColumns: [media.id] }).onDelete('restrict'),
  ],
)
