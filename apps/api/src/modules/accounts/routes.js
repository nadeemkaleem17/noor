// Handlers for the customer account routes of the contract (plan/10-api/11-account.md). The session travels in `X-Customer-Session`: the storefront server sends it, the browser never does.
import { normalizePkMobile } from '@noor/contract'
import { subjectHash } from '../../platform/rate-limit.js'

/**
 * @param {ReturnType<typeof import('./service.js').createAccountsService>} s
 * @returns {Partial<import('../../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>>}
 */
export function accountsHandlers(s) {
  /** @param {{ header: (name: string) => string | undefined }} http */
  const tokenOf = (http) => http.header('x-customer-session')
  /** Who is signed in: `unauthenticated` otherwise. @param {{ header: (name: string) => string | undefined }} http */
  const who = (http) => s.sessionOf(tokenOf(http))

  return {
    'account.register': async ({ body }) => s.register(body),
    // tries are counted by number as well as by address, so one number cannot be guessed at from many addresses
    'account.login': async ({ body, limit }) => {
      await limit('accountLogin', 'phone', subjectHash(normalizePkMobile(body.phone) ?? body.phone))
      return s.login(body)
    },
    'account.logout': async ({ http }) => s.logout(tokenOf(http)).then(() => undefined),
    'account.me': async ({ http }) => s.me((await who(http)).customerId),
    'account.update': async ({ http, body }) => s.update((await who(http)).customerId, body),
    'account.changePassword': async ({ http, body }) => s.changePassword((await who(http)).customerId, tokenOf(http), body).then(() => undefined),
    'account.delete': async ({ http, body }) => s.remove((await who(http)).customerId, body.password).then(() => undefined),
    'account.orders': async ({ http }) => s.orders((await who(http)).customerId),
    'account.claimOrder': async ({ http, body }) => s.claim((await who(http)).customerId, body.order),
    'admin.customers.removeAccount': async ({ actor, params, http, requestId }) =>
      s.adminRemove(/** @type {import('./service.js').Staff} */ (actor), params.id, { ip: http.ip, userAgent: http.userAgent, requestId }).then(() => undefined),
  }
}
