// Delivery cities, zones, methods and couriers: admin routes (plan/10-api/07 section 5, plan/09-data-model/09 section 4).
// The public city list (`shipping.listCities`) stays in table.js next to CityPublic.
import { z } from 'zod'
import { Money } from './money-schema.js'
import { Page, PageQuery, flag } from './pagination.js'
import { Id } from './primitives.js'
import { defineRoutes } from './routes.js'

export const provinces = /** @type {const} */ (['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad Capital Territory', 'Azad Jammu and Kashmir', 'Gilgit-Baltistan'])

const IdParams = z.strictObject({ id: Id })
const Fee = Money.refine((m) => m.amount >= 0, 'too_small')
const Days = z.int().min(0).max(60)

export const CityInput = z.strictObject({
  name: z.string().trim().min(2).max(60),
  province: z.enum(provinces),
  aliases: z.array(z.string().trim().min(2).max(60)).max(10).optional(),
  isMajor: z.boolean().optional(),
})
export const AdminCity = z.strictObject({
  id: Id, name: z.string(), province: z.string(), aliases: z.array(z.string()), isMajor: z.boolean(),
  zone: z.strictObject({ id: Id, name: z.string() }).optional(),
})

export const MethodInput = z.strictObject({
  id: Id.optional(),
  label: z.string().trim().min(1).max(60),
  fee: Fee,
  freeAbove: Fee.optional(),
  etaMinDays: Days,
  etaMaxDays: Days,
  codAllowed: z.boolean(),
  enabled: z.boolean(),
  i18n: z.strictObject({ ur: z.strictObject({ label: z.string().trim().max(60).optional() }).optional() }).optional(),
}).refine((m) => m.etaMinDays <= m.etaMaxDays, { message: 'too_big', path: ['etaMinDays'] })

export const ZoneInput = z.strictObject({
  name: z.string().trim().min(1).max(60),
  cityIds: z.array(Id).max(500),
  /** Order is display order. A zone needs at least one enabled method (DOC-07.10 section 2.1). */
  methods: z.array(MethodInput).min(1).max(4).refine((ms) => ms.some((m) => m.enabled), { message: 'required', path: [] }),
})
/** @typedef {z.infer<typeof ZoneInput>} ZoneInput */

export const AdminZone = z.strictObject({
  id: Id,
  name: z.string(),
  version: z.int().min(1),
  cityCount: z.int(),
  /** The first 50, by name. */
  cities: z.array(z.strictObject({ id: Id, name: z.string() })),
  methods: z.array(MethodInput.safeExtend({ id: Id })),
})

export const CourierInput = z.strictObject({
  name: z.string().trim().min(1).max(60),
  trackingUrlPattern: z.string().trim().max(300).refine((v) => v.startsWith('https://') && v.includes('{tracking}'), 'link_invalid').optional(),
  trackingRequired: z.boolean(),
  enabled: z.boolean(),
  sortOrder: z.int().min(0).max(1000).optional(),
})
export const Courier = z.strictObject({
  id: Id, name: z.string(), trackingUrlPattern: z.string().optional(), trackingRequired: z.boolean(), enabled: z.boolean(), sortOrder: z.int(),
})
/** @typedef {z.infer<typeof Courier>} Courier */

export const shippingRoutes = defineRoutes({
  'admin.shipping.listZones': {
    method: 'GET', path: '/admin/shipping/zones', auth: 'staff', permission: 'settings:read',
    response: z.strictObject({ items: z.array(AdminZone), unassignedCityCount: z.int() }),
  },
  'admin.shipping.createZone': { method: 'POST', path: '/admin/shipping/zones', auth: 'staff', permission: 'settings:write', status: 201, body: ZoneInput, response: AdminZone },
  'admin.shipping.updateZone': {
    method: 'PUT', path: '/admin/shipping/zones/:id', auth: 'staff', permission: 'settings:write', params: IdParams,
    body: ZoneInput.safeExtend({ version: z.int().min(1) }), response: AdminZone,
  },
  'admin.shipping.deleteZone': { method: 'DELETE', path: '/admin/shipping/zones/:id', auth: 'staff', permission: 'settings:write', params: IdParams, status: 204, response: z.undefined() },
  'admin.shipping.zoneImpact': {
    method: 'POST', path: '/admin/shipping/zones/:id/impact', auth: 'staff', permission: 'settings:read', params: IdParams, body: ZoneInput,
    response: z.strictObject({
      citiesRemoved: z.int(),
      citiesMovedIn: z.array(z.strictObject({ city: z.string(), fromZone: z.string() })),
      /** Carts do not exist yet; always 0 until the cart module (DOC-10.7 Q-10.7-2). */
      openCarts: z.int(),
    }),
  },
  'admin.shipping.listCities': {
    method: 'GET', path: '/admin/shipping/cities', auth: 'staff', permission: 'settings:read',
    query: PageQuery.pick({ page: true, size: true, q: true }).extend({ province: z.enum(provinces).optional(), unassigned: flag.optional() }),
    response: Page(AdminCity),
  },
  'admin.shipping.createCity': { method: 'POST', path: '/admin/shipping/cities', auth: 'staff', permission: 'settings:write', status: 201, body: CityInput, response: AdminCity },
  'admin.shipping.updateCity': { method: 'PUT', path: '/admin/shipping/cities/:id', auth: 'staff', permission: 'settings:write', params: IdParams, body: CityInput, response: AdminCity },
  'admin.shipping.matchCities': {
    method: 'POST', path: '/admin/shipping/cities/match', auth: 'staff', permission: 'settings:read',
    body: z.strictObject({ names: z.array(z.string().trim().min(1).max(60)).max(500) }),
    response: z.strictObject({ matched: z.array(z.strictObject({ input: z.string(), city: AdminCity })), unknown: z.array(z.string()) }),
  },
  'admin.couriers.list': { method: 'GET', path: '/admin/couriers', auth: 'staff', permission: 'settings:read', response: z.strictObject({ items: z.array(Courier) }) },
  'admin.couriers.create': { method: 'POST', path: '/admin/couriers', auth: 'staff', permission: 'settings:write', status: 201, body: CourierInput, response: Courier },
  'admin.couriers.update': { method: 'PUT', path: '/admin/couriers/:id', auth: 'staff', permission: 'settings:write', params: IdParams, body: CourierInput, response: Courier },
})
