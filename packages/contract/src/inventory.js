// Stock adjustments and the movement ledger: admin side (plan/10-api/05-admin-catalog.md section 4, plan/09-data-model/04-inventory.md).
import { z } from 'zod'
import { Enum } from './enums.js'
import { Page, PageQuery } from './pagination.js'
import { Id, IsoDate } from './primitives.js'
import { defineRoutes } from './routes.js'

/** The reasons a person can give for changing a count. The others (`initial`, `sale`, `return_damaged`) are written by the system. */
export const adjustReasons = /** @type {const} */ (['restock', 'correction', 'damaged', 'return_restock', 'other'])

/** Quantities entered when a product is created; later changes go through `admin.inventory.adjust`. */
export const InitialStock = z.array(z.strictObject({ variantKey: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, 'handle_invalid'), quantity: z.int().min(0).max(1_000_000) })).max(100)

export const Movement = z.strictObject({
  id: Id,
  variantId: Id,
  sku: z.string(),
  productTitle: z.string(),
  delta: z.int(),
  onHandAfter: z.int(),
  reason: Enum.movementReason,
  note: z.string().optional(),
  orderNumber: z.string().optional(),
  staffName: z.string().optional(),
  createdAt: IsoDate,
})

export const inventoryRoutes = defineRoutes({
  'admin.inventory.adjust': {
    method: 'POST', path: '/admin/inventory/adjustments', auth: 'staff', permission: 'inventory:adjust',
    body: z.strictObject({
      variantId: Id,
      mode: z.enum(['add', 'remove', 'set']),
      quantity: z.int().min(0).max(1_000_000),
      reason: z.enum(adjustReasons),
      note: z.string().trim().max(300).optional(),
    }),
    response: z.strictObject({ variantId: Id, onHand: z.int(), reserved: z.int(), available: z.int(), stockStatus: Enum.stockStatus }),
  },
  'admin.inventory.listMovements': {
    method: 'GET', path: '/admin/inventory/movements', auth: 'staff', permission: 'products:read',
    query: PageQuery.pick({ page: true, size: true }).extend({ variantId: Id.optional(), productId: Id.optional(), reason: Enum.movementReason.optional(), from: IsoDate.optional(), to: IsoDate.optional() }),
    response: Page(Movement),
  },
})
