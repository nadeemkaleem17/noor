// Customers: admin routes (plan/10-api/06-admin-orders-customers.md section 3, plan/09-data-model/07-orders-payments.md section 2).
// The export answers with the file's text (at most 5,000 rows); the bigger, background kind waits for the jobs screen (DOC-10.8).
import { z } from 'zod'
import { Money } from './money-schema.js'
import { CsvFile, Page, PageQuery, flag, qint } from './pagination.js'
import { Id, IsoDate } from './primitives.js'
import { Day } from './reporting.js'
import { defineRoutes } from './routes.js'

const IdParams = z.strictObject({ id: Id })

/** A colour the admin gives a customer because of a rule staff wrote (customers with orders in a range, or visits in a range). */
export const CustomerHighlight = z.strictObject({ ruleId: Id, kind: z.enum(['orders', 'visits']), label: z.string(), color: z.string() })
/** @typedef {z.infer<typeof CustomerHighlight>} CustomerHighlight */

export const HighlightColor = z.string().regex(/^#[0-9a-f]{6}$/i, 'invalid_format')
const ruleShape = {
  kind: z.enum(['orders', 'visits']),
  minCount: z.int().min(0).max(100_000),
  /** Empty: no upper limit. */
  maxCount: z.int().min(0).max(100_000).optional(),
  color: HighlightColor,
  label: z.string().trim().min(1).max(40),
  enabled: z.boolean(),
}
const maxAfterMin = (/** @type {{ minCount: number, maxCount?: number }} */ r) => r.maxCount === undefined || r.maxCount >= r.minCount
const tooSmall = { message: 'too_small', path: ['maxCount'] }
/** A rule with an `id` is a change to that rule; one without is new; a rule left out of the list is deleted. */
export const HighlightRuleInput = z.strictObject({ id: Id.optional(), ...ruleShape }).refine(maxAfterMin, tooSmall)
export const HighlightRule = z.strictObject({ id: Id, ...ruleShape }).refine(maxAfterMin, tooSmall)
/** @typedef {z.infer<typeof HighlightRule>} HighlightRule */
export const maxHighlightRules = 30

export const AdminCustomerRow = z.strictObject({
  id: Id,
  name: z.string(),
  /** E.164; a placeholder like `+0…` once anonymised. */
  phone: z.string(),
  city: z.string().optional(),
  ordersCount: z.int(),
  deliveredCount: z.int(),
  refusedCount: z.int(),
  spent: Money,
  lastOrderAt: IsoDate.optional(),
  email: z.string().optional(),
  noCod: z.boolean(),
  vip: z.boolean(),
  marketingConsent: z.boolean(),
  /** When the customer registered an account on the shop; absent for a customer who only ever ordered as a guest. */
  registeredAt: IsoDate.optional(),
  /** When the customer was first recorded: their first order. */
  createdAt: IsoDate,
  /** Visits by the browsers this customer ordered from; the order counts above are a separate thing. */
  visitsCount: z.int(),
  lastVisitAt: IsoDate.optional(),
  /** The enabled rules that match this customer now: at most one for orders and one for visits. */
  highlights: z.array(CustomerHighlight),
})

export const CustomerNote = z.strictObject({ id: Id, body: z.string(), staffName: z.string().optional(), createdAt: IsoDate })

export const AdminCustomer = AdminCustomerRow.extend({
  lastLoginAt: IsoDate.optional(),
  noCodReason: z.string().optional(),
  consentNote: z.string().optional(),
  cancelledCount: z.int(),
  averageOrder: Money.optional(),
  firstOrderAt: IsoDate.optional(),
  /** Taken from the customer's orders (M4-04); empty until there are any. */
  addresses: z.array(z.strictObject({ city: z.string(), address: z.string(), landmark: z.string().optional(), lastUsedAt: IsoDate })),
  notes: z.array(CustomerNote),
  /** The latest visits of the browsers linked to this customer, newest first. */
  recentVisits: z.array(z.strictObject({ startedAt: IsoDate, landingPath: z.string() })),
  /** How many browsers (phones, laptops) are linked to this customer. */
  devices: z.int(),
  version: z.int(),
  anonymisedAt: IsoDate.optional(),
})
/** @typedef {z.infer<typeof AdminCustomer>} AdminCustomer */
/** @typedef {z.infer<typeof AdminCustomerRow>} AdminCustomerRow */

export const customerSorts = /** @type {const} */ (['name', 'city', 'ordersCount', 'refusedCount', 'spent', 'lastOrderAt', 'visitsCount', 'createdAt'])

export const CustomerListQuery = PageQuery.extend({
  sort: z.string().regex(/^-?(name|city|ordersCount|refusedCount|spent|lastOrderAt|visitsCount|createdAt)$/).optional(),
  cityName: z.string().trim().min(1).max(60).optional(),
  flag: z.enum(['no_cod', 'vip', 'consent']).optional(),
  minOrders: qint(z.number().int().min(1).max(1000)).optional(),
  hasRefusals: flag.optional(),
  minVisits: qint(z.number().int().min(1).max(100_000)).optional(),
  /** Only the customers who registered an account. */
  registered: flag.optional(),
  /** Only the customers one highlight rule colours now. */
  rule: Id.optional(),
})

/** A first set of highlight rules, only to show how it works and to start again from: staff change, switch off or delete every one of them. Not read by any rule check. */
export const defaultHighlightRules = /** @type {const} */ ([
  { kind: 'orders', minCount: 1, maxCount: 5, color: '#3b82f6', label: 'New customer' },
  { kind: 'orders', minCount: 6, maxCount: 10, color: '#f59e0b', label: 'Regular' },
  { kind: 'orders', minCount: 11, maxCount: null, color: '#16a34a', label: 'Loyal' },
  { kind: 'visits', minCount: 2, maxCount: null, color: '#8b5cf6', label: 'Repeat visitor' },
])

export const VisitSummary = z.strictObject({
  visits: z.int(),
  visitors: z.int(),
  /** Visitors whose first visit is in the period. */
  newVisitors: z.int(),
  /** Visitors seen in the period who had come before it. */
  returningVisitors: z.int(),
  /** Visitors who have since ordered from that browser (so they are linked to a customer). */
  identifiedVisitors: z.int(),
  days: z.array(z.strictObject({ day: Day, visits: z.int(), visitors: z.int() })),
  /** The pages visits began on, most first (at most 8). An order link is counted as `/orders/*`. */
  topPages: z.array(z.strictObject({ path: z.string(), visits: z.int() })).default([]),
})
/** @typedef {z.infer<typeof VisitSummary>} VisitSummary */

export const CustomerExportBody = CustomerListQuery.omit({ page: true, size: true, sort: true }).strict()

export const CustomerUpdate = z
  .strictObject({
    name: z.string().trim().min(1).max(80),
    email: z.email().max(254).optional(),
    noCod: z.boolean(),
    noCodReason: z.string().trim().min(1).max(300).optional(),
    vip: z.boolean(),
    marketingConsent: z.boolean(),
    consentNote: z.string().trim().min(1).max(200).optional(),
    version: z.int().min(1),
  })
  .refine((c) => !c.noCod || Boolean(c.noCodReason), { message: 'required', path: ['noCodReason'] })

const VisitorId = z.string().regex(/^[0-9a-f]{32}$/, 'invalid_format')

export const customerRoutes = defineRoutes({
  // a browser says a page was opened; the shop's server passes it on with the visitor's own cookie value and never with an address or a browser name
  'visits.record': { method: 'POST', path: '/visits', auth: 'public', status: 204, body: z.strictObject({ visitor: VisitorId, path: z.string().max(200) }), response: z.undefined() },
  // after an order: the order's link proves this browser placed it, so its visits belong to that customer from now on
  'visits.link': { method: 'POST', path: '/visits/link', auth: 'public', status: 204, body: z.strictObject({ visitor: VisitorId, order: z.string().min(10).max(200) }), response: z.undefined() },
  'admin.customers.highlightRules.list': { method: 'GET', path: '/admin/customers/highlight-rules', auth: 'staff', permission: 'customers:read', response: z.strictObject({ items: z.array(HighlightRule) }) },
  'admin.customers.highlightRules.save': {
    method: 'PUT', path: '/admin/customers/highlight-rules', auth: 'staff', permission: 'customers:write',
    body: z.strictObject({ rules: z.array(HighlightRuleInput).max(maxHighlightRules) }),
    response: z.strictObject({ items: z.array(HighlightRule) }),
  },
  'admin.customers.visits': { method: 'GET', path: '/admin/customers/visit-summary', auth: 'staff', permission: 'customers:read', query: z.strictObject({ from: Day, to: Day }), response: VisitSummary },
  'admin.customers.list': { method: 'GET', path: '/admin/customers', auth: 'staff', permission: 'customers:read', query: CustomerListQuery, response: Page(AdminCustomerRow) },
  'admin.customers.lookup': {
    method: 'GET', path: '/admin/customers/by-phone', auth: 'staff', permission: 'orders:edit',
    query: z.strictObject({ phone: z.string().min(1).max(30) }),
    response: z.strictObject({ customer: AdminCustomerRow.optional() }),
  },
  'admin.customers.get': { method: 'GET', path: '/admin/customers/:id', auth: 'staff', permission: 'customers:read', params: IdParams, response: AdminCustomer },
  'admin.customers.update': { method: 'PUT', path: '/admin/customers/:id', auth: 'staff', permission: 'customers:write', params: IdParams, body: CustomerUpdate, response: AdminCustomer },
  'admin.customers.addNote': {
    method: 'POST', path: '/admin/customers/:id/notes', auth: 'staff', permission: 'customers:write', status: 201, params: IdParams,
    body: z.strictObject({ body: z.string().trim().min(1).max(1000) }),
    response: CustomerNote,
  },
  'admin.customers.export': { method: 'POST', path: '/admin/customers/exports', auth: 'staff', permission: 'customers:export', stepUp: true, body: CustomerExportBody, response: CsvFile },
  'admin.customers.anonymise': {
    method: 'POST', path: '/admin/customers/:id/anonymise', auth: 'staff', permission: 'customers:anonymise', stepUp: true, status: 204, params: IdParams,
    /** Must equal the last 4 digits of the phone: a typed confirmation of an irreversible act. */
    body: z.strictObject({ confirm: z.string().regex(/^\d{4}$/) }),
    response: z.undefined(),
  },
})
