// The staff's overview and the system's own measurements (plan/10-api/08-admin-dashboard-ops.md): counts for the menu, the dashboard, the search box, failed jobs,
// and what the browsers tell us about speed and errors. The figures are worked out in SQL by the API, never by the client.
import { z } from 'zod'
import { Enum } from './enums.js'
import { Money } from './money.js'
import { Page, PageQuery, qint } from './pagination.js'
import { Id, Image, IsoDate } from './primitives.js'
import { defineRoutes } from './routes.js'

/** A calendar day in Pakistan, `2026-10-06`. */
export const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_format')
const Range = { from: Day, to: Day }
export const maxReportDays = 366

export const NavCounts = z.strictObject({ ordersNeedingAction: z.int().optional(), reviewsPending: z.int().optional() })

const card = z.strictObject({ count: z.int(), oldestAt: IsoDate.optional() })
export const TodoCounts = z.strictObject({
  toConfirm: card.optional(),
  toDispatch: card.optional(),
  /** Only while a prepaid method is on. */
  awaitingPayment: z.strictObject({ count: z.int() }).optional(),
  lowStock: z.strictObject({ count: z.int() }).optional(),
  soldOut: z.strictObject({ count: z.int() }).optional(),
  reviewsPending: z.strictObject({ count: z.int() }).optional(),
  failedJobs: z.strictObject({ count: z.int() }).optional(),
})

export const Kpis = z.strictObject({
  netSales: Money,
  orders: z.int(),
  averageOrder: Money.optional(),
  /** Absent until 20 orders of the period have a final status. */
  deliveredRate: z.number().optional(),
  cancelledRate: z.number().optional(),
  cancelledByReason: z.record(z.string(), z.int()).optional(),
})

export const SalesSummary = z.strictObject({
  current: Kpis,
  /** The period of the same length just before. */
  previous: Kpis,
  byDay: z.array(z.strictObject({ day: Day, sales: Money, orders: z.int() })),
  bucket: z.enum(['day', 'week']),
})

export const TopProducts = z.strictObject({
  items: z.array(z.strictObject({ productId: Id, title: z.string(), image: Image.optional(), units: z.int(), sales: Money })),
})

export const SearchResults = z.strictObject({
  orders: z.array(z.strictObject({ id: Id, orderNumber: z.string(), status: Enum.orderStatus, customerName: z.string(), total: Money })),
  products: z.array(z.strictObject({ id: Id, title: z.string(), sku: z.string().optional(), status: Enum.productStatus, stockStatus: Enum.stockStatus, image: Image.optional() })),
  customers: z.array(z.strictObject({ id: Id, name: z.string(), phone: z.string(), city: z.string().optional(), ordersCount: z.int() })),
})

export const DeadJob = z.strictObject({ id: Id, type: z.string(), attempts: z.int(), lastError: z.string().optional(), diedAt: IsoDate })

const short = (/** @type {number} */ n) => z.string().transform((s) => s.slice(0, n))

export const reportingRoutes = defineRoutes({
  'admin.nav.counts': { method: 'GET', path: '/admin/nav/counts', auth: 'staff-any', response: NavCounts },
  'admin.dashboard.todo': { method: 'GET', path: '/admin/dashboard/todo', auth: 'staff', permission: 'dashboard:read', response: TodoCounts },
  // the permission to read orders is checked as well: the handler answers 403 without it
  'admin.dashboard.summary': { method: 'GET', path: '/admin/dashboard/summary', auth: 'staff', permission: 'dashboard:read', query: z.strictObject(Range), response: SalesSummary },
  'admin.dashboard.topProducts': {
    method: 'GET', path: '/admin/dashboard/top-products', auth: 'staff', permission: 'dashboard:read',
    query: z.strictObject({ ...Range, limit: qint(z.number().int().min(1).max(20)).default(10) }), response: TopProducts,
  },
  'admin.dashboard.zeroSearches': {
    method: 'GET', path: '/admin/dashboard/zero-searches', auth: 'staff', permission: 'dashboard:read',
    query: z.strictObject({ ...Range, limit: qint(z.number().int().min(1).max(50)).default(10) }),
    response: z.strictObject({ items: z.array(z.strictObject({ query: z.string(), count: z.int() })) }),
  },
  'admin.search': { method: 'GET', path: '/admin/search', auth: 'staff-any', rateLimit: 'admin', query: z.strictObject({ q: z.string().trim().min(2).max(80) }), response: SearchResults },
  'admin.jobs.listDead': {
    method: 'GET', path: '/admin/jobs/dead', auth: 'staff', permission: 'audit:read', query: PageQuery.pick({ page: true, size: true }).extend({ type: z.string().max(64).optional() }), response: Page(DeadJob),
  },
  'admin.jobs.retry': { method: 'POST', path: '/admin/jobs/dead/:id/retry', auth: 'staff', permission: 'settings:manage', status: 204, params: z.strictObject({ id: Id }), response: z.undefined() },
  // browsers report to us, with no names or numbers of people in what they send
  'reporting.vitals': {
    method: 'POST', path: '/vitals', auth: 'public', status: 204,
    body: z.strictObject({ name: z.enum(['LCP', 'INP', 'CLS']), value: z.number().min(0).max(1_000_000), route: z.string().max(40), navigationType: z.string().max(30).optional() }),
    response: z.undefined(),
  },
  'reporting.clientError': {
    method: 'POST', path: '/client-errors', auth: 'public', status: 204,
    body: z.strictObject({ message: short(1000), stack: short(2500).optional(), route: short(100), app: z.enum(['storefront', 'admin']), release: short(40) }),
    response: z.undefined(),
  },
})
