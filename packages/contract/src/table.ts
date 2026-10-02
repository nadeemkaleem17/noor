// The assembled route table. Each area keeps its routes next to its schemas; this file only merges them.
// Task M0-05 starts it with two real routes from DOC-10 (one public, one staff); every milestone adds more.
import { z } from 'zod'
import { defineRoutes } from './routes'
import { Id, IsoDate } from './primitives'

/** A delivery city as the storefront sees it (DOC-10.1). */
export const CityPublic = z.strictObject({
  id: Id,
  name: z.string(),
  province: z.string(),
  aliases: z.array(z.string()),
  isMajor: z.boolean(),
})
export type CityPublic = z.infer<typeof CityPublic>

export const SystemInfo = z.strictObject({
  environment: z.enum(['local', 'ci', 'staging', 'production']),
  version: z.string(),
  lastBackupAt: IsoDate.optional(),
  queue: z.strictObject({ pending: z.number().int(), dead: z.number().int(), oldestPendingAgeSec: z.number().int().optional() }),
})
export type SystemInfo = z.infer<typeof SystemInfo>

export const routes = defineRoutes({
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

export type Routes = typeof routes
