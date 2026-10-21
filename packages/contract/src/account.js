// Customer accounts (plan/10-api/11-account.md): a customer may register with a mobile number and a password, sign in, see the orders linked to the account, and leave. Guest checkout
// stays as it is. The storefront server holds the session in its own cookie and sends it as `X-Customer-Session`; the browser never talks to the API.
import { z } from 'zod'
import { Money } from './money-schema.js'
import { Enum } from './enum-schemas.js'
import { Id, IsoDate } from './primitives.js'
import { defineRoutes } from './routes.js'

const VisitorId = z.string().regex(/^[0-9a-f]{32}$/)
/** The number as typed ("0300 1234567"); the API reads it as a Pakistani mobile number. */
const Phone = z.string().trim().min(5).max(40)
export const accountPasswordRules = { min: 8, max: 128 }
const Password = z.string().min(accountPasswordRules.min).max(accountPasswordRules.max)

export const AccountMe = z.strictObject({
  name: z.string(),
  /** Masked: the number is the account's identity and is not shown whole on a screen. */
  phoneMasked: z.string(),
  email: z.string().optional(),
  registeredAt: IsoDate,
})
/** @typedef {z.infer<typeof AccountMe>} AccountMe */

/** What a sign-in or a registration answers: the session for the storefront's cookie, and the account. */
export const AccountSession = z.strictObject({ token: z.string(), expiresAt: IsoDate, account: AccountMe })

export const AccountOrder = z.strictObject({
  orderNumber: z.string(),
  placedAt: IsoDate,
  total: Money,
  status: Enum.orderStatus,
  /** The key to the order's own page, `/orders/<token>`. */
  trackingToken: z.string(),
})

export const RegisterBody = z.strictObject({
  name: z.string().trim().min(2).max(80),
  phone: Phone,
  password: Password,
  email: z.email().max(254).optional(),
  /** The browser's visitor number, when it has one: its visits then belong to this customer (the sign-in is the reliable link). */
  visitor: VisitorId.optional(),
})
export const LoginBody = z.strictObject({ phone: Phone, password: z.string().min(1).max(accountPasswordRules.max), visitor: VisitorId.optional() })

const session = { auth: /** @type {const} */ ('customer') }

export const accountRoutes = defineRoutes({
  'account.register': { method: 'POST', path: '/account/register', auth: 'public', rateLimit: 'accountRegister', status: 201, body: RegisterBody, response: AccountSession },
  'account.login': { method: 'POST', path: '/account/login', auth: 'public', rateLimit: 'accountLogin', body: LoginBody, response: AccountSession },
  'account.logout': { method: 'POST', path: '/account/logout', ...session, status: 204, response: z.undefined() },
  'account.me': { method: 'GET', path: '/account', ...session, response: AccountMe },
  'account.update': { method: 'PUT', path: '/account', ...session, body: z.strictObject({ name: z.string().trim().min(2).max(80), email: z.email().max(254).optional() }), response: AccountMe },
  'account.changePassword': {
    method: 'POST', path: '/account/password', ...session, rateLimit: 'accountLogin', status: 204,
    body: z.strictObject({ currentPassword: z.string().min(1).max(accountPasswordRules.max), newPassword: Password }), response: z.undefined(),
  },
  'account.delete': { method: 'POST', path: '/account/delete', ...session, rateLimit: 'accountLogin', status: 204, body: z.strictObject({ password: z.string().min(1).max(accountPasswordRules.max) }), response: z.undefined() },
  'account.orders': { method: 'GET', path: '/account/orders', ...session, response: z.strictObject({ items: z.array(AccountOrder) }) },
  // an order placed before the account (or as a guest) is added by its own link: the same proof the order page itself takes
  'account.claimOrder': {
    method: 'POST', path: '/account/orders/claim', ...session, rateLimit: 'accountLogin', body: z.strictObject({ order: z.string().min(10).max(200) }),
    response: z.strictObject({ orderNumber: z.string() }),
  },
  'admin.customers.removeAccount': {
    method: 'POST', path: '/admin/customers/:id/remove-account', auth: 'staff', permission: 'customers:write', params: z.strictObject({ id: Id }), status: 204, response: z.undefined(),
  },
})
