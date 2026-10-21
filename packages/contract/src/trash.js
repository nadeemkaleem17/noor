// The trash of the admin (plan/17-owner-requests-2026-10.md item 6): what was deleted in the last 30 days, with a way to put it back. Open to any signed-in staff member; what a person sees and may
// do depends on the permissions of each kind (a restore needs the kind's write permission, emptying needs its delete permission).
import { z } from 'zod'
import { Id, IsoDate } from './primitives.js'
import { defineRoutes } from './routes.js'

export const trashKinds = /** @type {const} */ (['product', 'category', 'attribute', 'collection', 'promo', 'page'])

export const TrashItem = z.strictObject({
  id: Id,
  kind: z.enum(trashKinds),
  label: z.string(),
  deletedAt: IsoDate,
  deletedBy: z.string().optional(),
  /** After this the copy is gone for good. */
  expiresAt: IsoDate,
})
/** @typedef {z.infer<typeof TrashItem>} TrashItem */

const IdParams = z.strictObject({ id: Id })

export const trashRoutes = defineRoutes({
  'admin.trash.list': { method: 'GET', path: '/admin/trash', auth: 'staff-any', response: z.strictObject({ items: z.array(TrashItem) }) },
  'admin.trash.restore': {
    method: 'POST', path: '/admin/trash/:id/restore', auth: 'staff-any', rateLimit: 'admin', params: IdParams,
    response: z.strictObject({ kind: z.enum(trashKinds), id: Id, label: z.string() }),
  },
  'admin.trash.purge': { method: 'DELETE', path: '/admin/trash/:id', auth: 'staff-any', rateLimit: 'admin', status: 204, params: IdParams, response: z.undefined() },
})
