// Media uploads (plan/10-api/05-admin-catalog.md section 3, plan/08-backend-architecture.md section 11).
// The browser asks for an upload slot, sends the file straight to storage, then confirms; the server checks the bytes afterwards.
import { z } from 'zod'
import { Enum } from './enum-schemas.js'
import { Id, Image, IsoDate } from './primitives.js'
import { defineRoutes } from './routes.js'

/** File types accepted for upload. Video and SVG are not accepted yet (SVG logos are PNG only, DOC-07.11 Q-07.11-2). */
export const uploadTypes = /** @type {const} */ (['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
export const maxUploadBytes = 10 * 1024 * 1024
/** Widths the image host will ever serve (ADR-0011). */
export const imageWidths = /** @type {const} */ ([320, 480, 640, 828, 1080, 1600])

export const MediaInfo = z.strictObject({
  id: Id,
  kind: Enum.mediaKind,
  status: Enum.mediaStatus,
  rejectReason: z.string().optional(),
  image: Image.optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  bytes: z.number().int(),
  alt: z.string(),
  i18n: z.strictObject({ ur: z.strictObject({ alt: z.string().optional() }).optional() }).optional(),
  createdAt: IsoDate,
})
/** @typedef {z.infer<typeof MediaInfo>} MediaInfo */

const IdParams = z.strictObject({ id: Id })
const Alt = z.string().trim().max(300)

export const mediaRoutes = defineRoutes({
  'admin.media.createUpload': {
    method: 'POST', path: '/admin/media/uploads', auth: 'staff', permission: 'content:write', rateLimit: 'upload',
    body: z.strictObject({
      filename: z.string().trim().min(1).max(255),
      contentType: z.enum(uploadTypes, 'invalid_format'),
      bytes: z.int().min(1, 'too_small').max(maxUploadBytes, 'too_big'),
    }),
    response: z.strictObject({ mediaId: Id, uploadUrl: z.string(), headers: z.record(z.string(), z.string()), expiresAt: IsoDate }),
  },
  'admin.media.confirm': { method: 'POST', path: '/admin/media/:id/confirm', auth: 'staff', permission: 'content:write', params: IdParams, response: MediaInfo },
  'admin.media.get': { method: 'GET', path: '/admin/media/:id', auth: 'staff', permission: 'content:read', params: IdParams, response: MediaInfo },
  'admin.media.update': {
    method: 'PUT', path: '/admin/media/:id', auth: 'staff', permission: 'content:write', params: IdParams,
    body: z.strictObject({ alt: Alt, i18n: z.strictObject({ ur: z.strictObject({ alt: Alt.optional() }).optional() }).optional() }),
    response: MediaInfo,
  },
  'admin.media.delete': { method: 'DELETE', path: '/admin/media/:id', auth: 'staff', permission: 'content:write', params: IdParams, status: 204, response: z.undefined() },
})
