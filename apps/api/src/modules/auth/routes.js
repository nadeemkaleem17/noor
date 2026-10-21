// Handlers for the auth routes of the contract (plan/10-api/04). Each one: read the input, call the service, set a cookie if needed.
import { sessionCookieOptions } from './http.js'

/**
 * @param {import('./service.js').createAuthService extends (...a: any) => infer R ? R : never} auth
 * @param {import('../../platform/config.js').Config} config
 * @returns {Partial<import('../../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>>}
 */
export function authHandlers(auth, config) {
  /** @param {{ ip: string, userAgent: string }} http @param {string} requestId */
  const info = (http, requestId) => ({ ip: http.ip, userAgent: http.userAgent, requestId })
  /** The actor of an authenticated route. @param {unknown} actor */
  const who = (actor) => /** @type {import('./service.js').StaffActor} */ (actor)
  /** @param {import('../../platform/http/route-registrar.js').HttpInfo} http @param {string} cookie @param {'pending_2fa' | 'enrol_2fa' | 'full'} kind */
  const setSession = (http, cookie, kind) => http.setCookie(config.SESSION_COOKIE_NAME, cookie, sessionCookieOptions(config, kind))
  const kindOf = (/** @type {'ok' | 'two_factor' | 'enrol_two_factor'} */ next) => (next === 'ok' ? 'full' : next === 'two_factor' ? 'pending_2fa' : 'enrol_2fa')

  return {
    'admin.auth.login': async ({ body, http, requestId }) => {
      const r = await auth.login(body, info(http, requestId))
      setSession(http, r.cookie, kindOf(r.next))
      return { next: r.next }
    },
    'admin.auth.verifyTwoFactor': async ({ actor, body, http, requestId }) => {
      const r = await auth.verifyTwoFactor(who(actor), body, info(http, requestId))
      setSession(http, r.cookie, 'full')
      return { next: r.next }
    },
    'admin.auth.logout': async ({ actor, http, requestId }) => {
      await auth.logout(who(actor), info(http, requestId))
      http.clearCookie(config.SESSION_COOKIE_NAME)
    },
    'admin.auth.requestPasswordReset': async ({ body, http, requestId }) => void (await auth.requestPasswordReset(body.email, info(http, requestId))),
    'admin.auth.resetPassword': async ({ params, body, http, requestId }) => void (await auth.resetPassword(params.token, body.password, info(http, requestId))),
    'admin.auth.getInvite': async ({ params }) => auth.getInvite(params.token),
    'admin.auth.acceptInvite': async ({ params, body, http, requestId }) => {
      const r = await auth.acceptInvite(params.token, body.password, info(http, requestId))
      setSession(http, r.cookie, kindOf(r.next))
      return { next: r.next }
    },

    'admin.me.get': async ({ actor }) => auth.me(who(actor)),
    'admin.me.update': async ({ actor, body, http, requestId }) => auth.updateMe(who(actor), body, info(http, requestId)),
    'admin.me.changePassword': async ({ actor, body, http, requestId }) => {
      const s = await auth.changePassword(who(actor), body, info(http, requestId))
      setSession(http, s.cookie, 'full')
    },
    'admin.me.confirmPassword': async ({ actor, body }) => void (await auth.confirmPassword(who(actor), body.password)),
    'admin.me.twoFactor.begin': async ({ actor }) => auth.beginTwoFactor(who(actor)),
    'admin.me.twoFactor.enable': async ({ actor, body, http, requestId }) => {
      const r = await auth.enableTwoFactor(who(actor), body.code, info(http, requestId))
      if (r.session) setSession(http, r.session.cookie, 'full')
      return { recoveryCodes: r.recoveryCodes }
    },
    'admin.me.twoFactor.regenerateCodes': async ({ actor, http, requestId }) => auth.regenerateRecoveryCodes(who(actor), info(http, requestId)),
    'admin.me.twoFactor.disable': async ({ actor, http, requestId }) => void (await auth.disableTwoFactor(who(actor), info(http, requestId))),
    'admin.me.sessions.list': async ({ actor }) => auth.listSessions(who(actor)),
    'admin.me.sessions.revoke': async ({ actor, params, http, requestId }) => void (await auth.revokeSession(who(actor), params.id, info(http, requestId))),
    'admin.me.sessions.revokeOthers': async ({ actor, http, requestId }) => void (await auth.revokeOtherSessions(who(actor), info(http, requestId))),

    'admin.roles.list': async () => auth.roles(),
    'admin.staff.list': async ({ query }) => auth.listStaff(query),
    'admin.staff.get': async ({ actor, params }) => auth.getStaff(who(actor), params.id),
    'admin.staff.invite': async ({ actor, body, http, requestId }) => auth.inviteStaff(who(actor), body, info(http, requestId)),
    'admin.staff.update': async ({ actor, params, body, http, requestId }) => auth.updateStaff(who(actor), params.id, body, info(http, requestId)),
    'admin.profiles.list': async () => auth.listProfiles(),
    'admin.profiles.create': async ({ actor, body, http, requestId }) => auth.createProfile(who(actor), body, info(http, requestId)),
    'admin.profiles.update': async ({ actor, params, body, http, requestId }) => auth.updateProfile(who(actor), params.id, body, info(http, requestId)),
    'admin.profiles.delete': async ({ actor, params, http, requestId }) => auth.deleteProfile(who(actor), params.id, info(http, requestId)).then(() => undefined),
    'admin.staff.applyProfile': async ({ actor, params, body, http, requestId }) => auth.applyProfile(who(actor), params.id, body, info(http, requestId)),
    'admin.staff.setPermissions': async ({ actor, params, body, http, requestId }) => auth.setPermissions(who(actor), params.id, body, info(http, requestId)),
    'admin.staff.resendInvite': async ({ actor, params, http, requestId }) => auth.resendInvite(who(actor), params.id, info(http, requestId)),
    'admin.staff.resetPassword': async ({ actor, params, http, requestId }) => auth.createResetLink(who(actor), params.id, info(http, requestId)),
    'admin.staff.resetTwoFactor': async ({ actor, params, http, requestId }) => void (await auth.resetStaffTwoFactor(who(actor), params.id, info(http, requestId))),
    'admin.staff.revokeSessions': async ({ actor, params, http, requestId }) => void (await auth.revokeStaffSessions(who(actor), params.id, info(http, requestId))),
    'admin.staff.clearLock': async ({ actor, params, http, requestId }) => void (await auth.clearLock(who(actor), params.id, info(http, requestId))),
    'admin.staff.deactivate': async ({ actor, params, http, requestId }) => auth.deactivate(who(actor), params.id, info(http, requestId)),
    'admin.staff.reactivate': async ({ actor, params, http, requestId }) => auth.reactivate(who(actor), params.id, info(http, requestId)),
  }
}
