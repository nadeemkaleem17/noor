// Customers: admin routes (plan/10-api/06-admin-orders-customers.md section 3, plan/09-data-model/07-orders-payments.md section 2).
// The export answers with the file's text (at most 5,000 rows); the bigger, background kind waits for the jobs screen (DOC-10.8).
import { z } from 'zod'
import { Money } from './money-schema.js'
import { CsvFile, Page, PageQuery, flag, qint } from './pagination.js'
import { Id, IsoDate } from './primitives.js'
import { defineRoutes } from './routes.js'

const IdParams = z.strictObject({ id: Id })

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
  noCod: z.boolean(),
  vip: z.boolean(),
  marketingConsent: z.boolean(),
})

export const CustomerNote = z.strictObject({ id: Id, body: z.string(), staffName: z.string().optional(), createdAt: IsoDate })

export const AdminCustomer = AdminCustomerRow.extend({
  email: z.string().optional(),
  noCodReason: z.string().optional(),
  consentNote: z.string().optional(),
  cancelledCount: z.int(),
  averageOrder: Money.optional(),
  firstOrderAt: IsoDate.optional(),
  /** Taken from the customer's orders (M4-04); empty until there are any. */
  addresses: z.array(z.strictObject({ city: z.string(), address: z.string(), landmark: z.string().optional(), lastUsedAt: IsoDate })),
  notes: z.array(CustomerNote),
  version: z.int(),
  anonymisedAt: IsoDate.optional(),
})
/** @typedef {z.infer<typeof AdminCustomer>} AdminCustomer */
/** @typedef {z.infer<typeof AdminCustomerRow>} AdminCustomerRow */

export const customerSorts = /** @type {const} */ (['name', 'city', 'ordersCount', 'refusedCount', 'spent', 'lastOrderAt'])

export const CustomerListQuery = PageQuery.extend({
  sort: z.string().regex(/^-?(name|city|ordersCount|refusedCount|spent|lastOrderAt)$/).optional(),
  cityName: z.string().trim().min(1).max(60).optional(),
  flag: z.enum(['no_cod', 'vip', 'consent']).optional(),
  minOrders: qint(z.number().int().min(1).max(1000)).optional(),
  hasRefusals: flag.optional(),
})

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

export const customerRoutes = defineRoutes({
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
