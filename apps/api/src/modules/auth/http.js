// The HTTP side of authentication: finding the session behind a request, the CSRF and step-up rules, and the session cookie
// (plan/11-security-auth.md sections 3.4, 5.1; plan/10-api/04 section 3).
import { DomainError } from '../../platform/errors.js'
import { now } from '../../platform/clock.js'
import { ABSOLUTE_MS, loadSession, PENDING_MS, STEP_UP_MS } from './sessions.js'
import { safeEqual } from './tokens.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Builds the `authorize` function the route registrar calls for every staff route.
 * @param {{ db: import('../../platform/db.js').Database['db'], config: import('../../platform/config.js').Config, auth: ReturnType<import('./service.js').createAuthService> }} deps
 * @returns {import('../../platform/http/route-registrar.js').Authorize}
 */
export function createAuthorize({ db, config, auth }) {
  return async (req, def) => {
    const cookies = /** @type {Record<string, string | undefined>} */ (/** @type {{ cookies?: Record<string, string | undefined> }} */ (req).cookies ?? {})
    const loaded = await loadSession(db, cookies[config.SESSION_COOKIE_NAME])
    if (!loaded) return null
    const { session, user } = loaded
    const kind = /** @type {import('./sessions.js').SessionKind} */ (session.kind)

    if (def.auth === 'staff-pending') {
      if (kind !== 'pending_2fa') return null
    } else if (kind === 'pending_2fa') {
      throw new DomainError('two_factor_required') // signed in with a password but the second step is not done
    } else if (kind === 'enrol_2fa' && !def.enrolment) {
      throw new DomainError('two_factor_required', { next: 'enrol_two_factor' })
    }

    // the Origin check ran earlier for every non-GET admin call; the double-submit token covers sessions that can change things
    if (!SAFE_METHODS.has(req.method) && kind !== 'pending_2fa') {
      const sent = req.headers['x-csrf-token']
      if (typeof sent !== 'string' || !safeEqual(sent, session.csrfToken)) throw new DomainError('csrf_failed')
    }
    if (def.stepUp && now().getTime() - session.lastAuthAt.getTime() > STEP_UP_MS) throw new DomainError('step_up_required')
    return auth.actorFor(user, session)
  }
}

/**
 * Cookie options for the session cookie: host-only, HttpOnly, SameSite=Lax. `Secure` everywhere except a local `http://` setup.
 * @param {import('../../platform/config.js').Config} config
 * @param {'pending_2fa' | 'enrol_2fa' | 'full'} kind
 */
export const sessionCookieOptions = (config, kind) => ({
  path: '/',
  httpOnly: true,
  sameSite: /** @type {const} */ ('lax'),
  secure: config.APP_ENV !== 'local',
  maxAge: Math.floor((kind === 'full' ? ABSOLUTE_MS : PENDING_MS) / 1000),
})
