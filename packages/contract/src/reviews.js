// Product reviews (plan/10-api/03-cart-orders-public.md section 4, 02-catalog-public.md section 5, 06-admin-orders-customers.md section 5, plan/09-data-model/08).
// A customer writes one review per purchased order line, through the link of their order; staff approve it before it shows.
import { z } from 'zod'
import { Enum } from './enums.js'
import { BulkResult, cursorQuery, flag, qint, Page, PageQuery } from './pagination.js'
import { Id, Image, IsoDate } from './primitives.js'
import { defineRoutes } from './routes.js'

const IdParams = z.strictObject({ id: Id })
const LineParams = z.strictObject({ token: z.string().min(1).max(100), lineId: Id })

export const reviewPhotoMaxBytes = 5 * 1024 * 1024
export const maxReviewPhotos = 3

export const ReviewInput = z.strictObject({
  rating: z.int().min(1).max(5),
  title: z.string().trim().min(1).max(100).optional(),
  body: z.string().trim().min(20, 'too_small').max(1000, 'too_big'),
  fit: Enum.fitNote.optional(),
  displayName: z.string().trim().min(2, 'too_small').max(40, 'too_big'),
  photoMediaIds: z.array(Id).max(maxReviewPhotos).optional(),
})
/** @typedef {z.infer<typeof ReviewInput>} ReviewInput */

export const ReviewPublic = z.strictObject({
  id: Id,
  displayName: z.string(),
  rating: z.int(),
  title: z.string().optional(),
  body: z.string(),
  fit: Enum.fitNote.optional(),
  photos: z.array(Image),
  createdAt: IsoDate,
  reply: z.strictObject({ body: z.string(), createdAt: IsoDate }).optional(),
})

export const ReviewListing = z.strictObject({
  items: z.array(ReviewPublic),
  nextCursor: z.string().optional(),
  /** `byStar[0]` is the number of one-star reviews, `byStar[4]` of five-star ones. */
  summary: z.strictObject({ average: z.number(), count: z.int(), byStar: z.tuple([z.int(), z.int(), z.int(), z.int(), z.int()]) }),
})
/** @typedef {z.infer<typeof ReviewListing>} ReviewListing */

export const ReviewInvite = z.strictObject({
  product: z.strictObject({ title: z.string(), image: Image.optional() }),
  displayNameDefault: z.string(),
  /** Whether the product comes in sizes, so the form asks about fit. */
  sized: z.boolean(),
  submitted: z.boolean(),
})

const Moderate = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('approved') }),
  z.strictObject({ status: z.literal('rejected'), reason: Enum.reviewRejectReason, note: z.string().trim().min(1).max(300).optional() }),
])

export const AdminReview = z.strictObject({
  id: Id,
  product: z.strictObject({ id: Id, title: z.string(), image: Image.optional() }),
  order: z.strictObject({ id: Id, orderNumber: z.string() }),
  displayName: z.string(),
  rating: z.int(),
  title: z.string().optional(),
  body: z.string(),
  fit: Enum.fitNote.optional(),
  photos: z.array(Image.extend({ mediaId: Id })),
  status: Enum.reviewStatus,
  rejectReason: Enum.reviewRejectReason.optional(),
  rejectNote: z.string().optional(),
  reply: z.strictObject({ body: z.string(), at: IsoDate }).optional(),
  moderatedBy: z.string().optional(),
  moderatedAt: IsoDate.optional(),
  createdAt: IsoDate,
})
/** @typedef {z.infer<typeof AdminReview>} AdminReview */

export const ReviewListQuery = PageQuery.extend({
  sort: z.string().regex(/^-?(createdAt|rating)$/).optional(),
  status: Enum.reviewStatus.optional(),
  rating: qint(z.number().int().min(1).max(5)).optional(),
  productId: Id.optional(),
  hasPhotos: flag.optional(),
})

export const reviewRoutes = defineRoutes({
  'reviews.listForProduct': { method: 'GET', path: '/products/:id/reviews', auth: 'public', cache: 'shared', params: IdParams, query: cursorQuery(20, 5), response: ReviewListing },
  'reviews.getInvite': { method: 'GET', path: '/orders/by-token/:token/lines/:lineId/review', auth: 'order-token', params: LineParams, response: ReviewInvite },
  'reviews.createForOrderLine': {
    method: 'POST', path: '/orders/by-token/:token/lines/:lineId/review', auth: 'order-token', rateLimit: 'review', status: 201, params: LineParams, body: ReviewInput,
    response: z.strictObject({ status: z.literal('pending') }),
  },
  'reviews.createPhotoUpload': {
    method: 'POST', path: '/orders/by-token/:token/lines/:lineId/review/uploads', auth: 'order-token', rateLimit: 'review', params: LineParams,
    body: z.strictObject({ contentType: z.enum(['image/jpeg', 'image/png', 'image/webp'], 'invalid_format'), bytes: z.int().min(1, 'too_small').max(reviewPhotoMaxBytes, 'too_big') }),
    response: z.strictObject({ mediaId: Id, uploadUrl: z.string(), headers: z.record(z.string(), z.string()), expiresAt: IsoDate }),
  },
  'admin.reviews.list': { method: 'GET', path: '/admin/reviews', auth: 'staff', permission: 'reviews:read', query: ReviewListQuery, response: Page(AdminReview) },
  'admin.reviews.get': { method: 'GET', path: '/admin/reviews/:id', auth: 'staff', permission: 'reviews:read', params: IdParams, response: AdminReview },
  'admin.reviews.moderate': { method: 'POST', path: '/admin/reviews/:id/moderation', auth: 'staff', permission: 'reviews:moderate', params: IdParams, body: Moderate, response: AdminReview },
  'admin.reviews.reply': {
    method: 'PUT', path: '/admin/reviews/:id/reply', auth: 'staff', permission: 'reviews:moderate', params: IdParams,
    body: z.strictObject({ body: z.string().trim().max(600, 'too_big') }), response: AdminReview,
  },
  'admin.reviews.removePhoto': {
    method: 'DELETE', path: '/admin/reviews/:id/photos/:mediaId', auth: 'staff', permission: 'reviews:moderate', params: z.strictObject({ id: Id, mediaId: Id }), response: AdminReview,
  },
  'admin.reviews.bulk': {
    method: 'POST', path: '/admin/reviews/bulk', auth: 'staff', permission: 'reviews:moderate',
    body: z.discriminatedUnion('action', [
      z.strictObject({ ids: z.array(Id).min(1).max(100), action: z.literal('approve') }),
      z.strictObject({ ids: z.array(Id).min(1).max(100), action: z.literal('reject'), reason: Enum.reviewRejectReason }),
    ]),
    response: BulkResult,
  },
})

