// Promo codes: admin routes (plan/10-api/06-admin-orders-customers.md section 4, plan/09-data-model/06-cart-promotions.md section 3).
// The storefront routes that apply a code (`cart.applyPromo`) come with the cart (M4-03).
import { z } from 'zod'
import { Enum } from './enums.js'
import { BulkResult, Page, PageQuery } from './pagination.js'
import { Money } from './money.js'
import { Id, IsoDate } from './primitives.js'
import { defineRoutes } from './routes.js'

const IdParams = z.strictObject({ id: Id })
const Positive = Money.refine((m) => m.amount > 0, 'too_small')

export const promoStatuses = /** @type {const} */ (['active', 'scheduled', 'expired', 'disabled'])
export const promoScopes = /** @type {const} */ (['all', 'categories', 'products'])

/** The fields of a promo, before the rules that tie them together. */
const PromoFields = z.strictObject({
  /** Stored upper-case. */
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,20}$/, 'code_invalid'),
  type: Enum.promoType,
  /** Whole percent, stored as basis points. */
  percent: z.int().min(1).max(90).optional(),
  amount: Positive.optional(),
  maxDiscount: Positive.optional(),
  minSpend: Positive.optional(),
  scope: z.enum(promoScopes),
  targetIds: z.array(Id).max(200).optional(),
  excludeSaleItems: z.boolean(),
  firstOrderOnly: z.boolean(),
  usageLimit: z.int().min(1).max(1_000_000).optional(),
  perCustomerLimit: z.int().min(1).max(1000).optional(),
  startsAt: IsoDate.optional(),
  endsAt: IsoDate.optional(),
  enabled: z.boolean(),
  note: z.string().trim().min(1).max(300).optional(),
})

/** The rules between fields. Each issue names the field the person must fix. @param {z.infer<typeof PromoFields>} p @param {z.RefinementCtx} ctx */
function promoRules(p, ctx) {
  const issue = (/** @type {string} */ path, /** @type {string} */ message) => ctx.addIssue({ code: 'custom', path: [path], message })
  if (p.type === 'percent') {
    if (p.percent === undefined) issue('percent', 'required')
    if (p.amount) issue('amount', 'invalid_format')
  } else if (p.type === 'fixed') {
    if (!p.amount) issue('amount', 'required')
    if (p.percent !== undefined) issue('percent', 'invalid_format')
  } else {
    if (p.percent !== undefined) issue('percent', 'invalid_format')
    if (p.amount) issue('amount', 'invalid_format')
  }
  if (p.maxDiscount && p.type !== 'percent') issue('maxDiscount', 'invalid_format') // a cap only makes sense on a percentage
  if (p.scope === 'all' && p.targetIds?.length) issue('targetIds', 'invalid_format')
  if (p.scope !== 'all' && !p.targetIds?.length) issue('targetIds', 'required')
  if (p.targetIds && new Set(p.targetIds).size !== p.targetIds.length) issue('targetIds', 'not_unique')
  if (p.startsAt && p.endsAt && p.startsAt >= p.endsAt) issue('endsAt', 'invalid_format')
}

export const PromoInput = PromoFields.superRefine(promoRules)
/** @typedef {z.infer<typeof PromoInput>} PromoInput */
export const PromoUpdate = PromoFields.extend({ version: z.int().min(1) }).superRefine(promoRules)

export const AdminPromo = PromoFields.extend({
  id: Id,
  status: z.enum(promoStatuses),
  usageCount: z.int(),
  /** Has any redemption, reversed or not: then its code and type are fixed and it cannot be deleted. */
  used: z.boolean(),
  targets: z.array(z.strictObject({ id: Id, type: Enum.promoTargetType, label: z.string() })),
  /** The rule in words. */
  summary: z.string(),
  version: z.int(),
  createdAt: IsoDate,
})
/** @typedef {z.infer<typeof AdminPromo>} AdminPromo */

export const PromoListQuery = PageQuery.extend({
  sort: z.string().regex(/^-?(code|createdAt|usageCount)$/).optional(),
  status: z.enum(promoStatuses).optional(),
  type: Enum.promoType.optional(),
})

export const PromoPreview = z.strictObject({
  applies: z.boolean(),
  /** A `promo_*` code (see DOC-10.0 section 6.2) when it does not apply. */
  reason: z.string().optional(),
  discount: Money,
  eligibleSubtotal: Money,
  lineDiscounts: z.array(z.strictObject({ variantId: Id, discount: Money })),
})

export const promoRoutes = defineRoutes({
  'admin.promos.list': { method: 'GET', path: '/admin/promos', auth: 'staff', permission: 'promos:read', query: PromoListQuery, response: Page(AdminPromo) },
  'admin.promos.get': { method: 'GET', path: '/admin/promos/:id', auth: 'staff', permission: 'promos:read', params: IdParams, response: AdminPromo },
  'admin.promos.create': { method: 'POST', path: '/admin/promos', auth: 'staff', permission: 'promos:write', status: 201, body: PromoInput, response: AdminPromo },
  'admin.promos.update': { method: 'PUT', path: '/admin/promos/:id', auth: 'staff', permission: 'promos:write', params: IdParams, body: PromoUpdate, response: AdminPromo },
  'admin.promos.delete': { method: 'DELETE', path: '/admin/promos/:id', auth: 'staff', permission: 'promos:delete', status: 204, params: IdParams, response: z.undefined() },
  'admin.promos.preview': {
    method: 'POST', path: '/admin/promos/preview', auth: 'staff', permission: 'promos:read',
    body: z.strictObject({ promo: PromoInput, lines: z.array(z.strictObject({ variantId: Id, quantity: z.int().min(1).max(100) })).min(1).max(50) }),
    response: PromoPreview,
  },
  'admin.promos.bulk': {
    method: 'POST', path: '/admin/promos/bulk', auth: 'staff', permission: 'promos:write',
    body: z.strictObject({ ids: z.array(Id).min(1).max(100), action: z.enum(['enable', 'disable']) }),
    response: BulkResult,
  },
})
