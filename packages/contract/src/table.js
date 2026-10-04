// The assembled route table. Each area keeps its routes next to its schemas; this file only merges them.
// Task M0-05 starts it with two real routes from DOC-10 (one public, one staff); every milestone adds more.
import { z } from 'zod'
import { auditRoutes, authRoutes } from './auth.js'
import { defineRoutes } from './routes.js'
import { Id, IsoDate } from './primitives.js'

/** A delivery city as the storefront sees it (DOC-10.1). */
export const CityPublic = z.strictObject({
  id: Id,
  name: z.string(),
  province: z.string(),
  aliases: z.array(z.string()),
  isMajor: z.boolean(),
})
/**
 * @typedef {z.infer<typeof CityPublic>} CityPublic
 */

export const SystemInfo = z.strictObject({
  environment: z.enum(['local', 'ci', 'staging', 'production']),
  version: z.string(),
  lastBackupAt: IsoDate.optional(),
  queue: z.strictObject({ pending: z.number().int(), dead: z.number().int(), oldestPendingAgeSec: z.number().int().optional() }),
})
/**
 * @typedef {z.infer<typeof SystemInfo>} SystemInfo
 */

export const routes = defineRoutes({
  ...authRoutes,
  ...auditRoutes,
  // DOC-10.1
  'shipping.listCities': {
    method: 'GET', path: '/shipping/cities', auth: 'public',
    response: z.strictObject({ items: z.array(CityPublic) }),
  },
  // DOC-10.8
  'admin.system.info': {
    method: 'GET', path: '/admin/system', auth: 'staff', permission: 'settings:manage',
    response: SystemInfo,
  },
})

/**
 * @typedef {typeof routes} Routes
 */
