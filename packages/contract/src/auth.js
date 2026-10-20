// Staff authentication, the current user and staff management (plan/10-api/04-admin-auth-staff.md sections 2-4).
// No schema here returns a password hash, TOTP secret, token hash or session cookie value.
import { z } from 'zod'
import { Enum } from './enum-schemas.js'
import { CursorPage, Page, PageQuery } from './pagination.js'
import { Permission } from './permissions.js'
import { Id, IsoDate } from './primitives.js'
import { defineRoutes } from './routes.js'

const Email = z.string().trim().toLowerCase().pipe(z.email().max(254))
/** A password being typed: only length is checked here; strength is checked by the server and answered as `password_too_weak`. */
const PasswordInput = z.string().min(1).max(256)
const Empty = z.undefined()

const StaffRole = Enum.staffRole
const StaffStatus = Enum.staffStatus

export const LoginResult = z.strictObject({ next: z.enum(['ok', 'two_factor', 'enrol_two_factor']) })
/** @typedef {z.infer<typeof LoginResult>} LoginResult */

export const SessionInfo = z.strictObject({
  id: z.string(),
  current: z.boolean(),
  createdAt: IsoDate,
  lastSeenAt: IsoDate,
  ip: z.string(),
  userAgent: z.string(),
})
/** @typedef {z.infer<typeof SessionInfo>} SessionInfo */

export const Me = z.strictObject({
  id: Id,
  name: z.string(),
  email: z.string(),
  role: StaffRole,
  permissions: z.array(Permission),
  twoFactorEnabled: z.boolean(),
  twoFactorRequired: z.boolean(),
  csrfToken: z.string(),
  environment: z.enum(['local', 'ci', 'staging', 'production']),
  stepUpValidUntil: IsoDate.optional(),
})
/** @typedef {z.infer<typeof Me>} Me */

export const StaffUser = z.strictObject({
  id: Id,
  name: z.string(),
  email: z.string(),
  role: StaffRole,
  status: StaffStatus,
  twoFactorEnabled: z.boolean(),
  lockedUntil: IsoDate.optional(),
  lastSeenAt: IsoDate.optional(),
  inviteExpiresAt: IsoDate.optional(),
  version: z.number().int(),
  createdAt: IsoDate,
  /** Added to the role for this person, taken from it, and what they may do in the end. */
  grants: z.array(Permission),
  revokes: z.array(Permission),
  permissions: z.array(Permission),
})
/** @typedef {z.infer<typeof StaffUser>} StaffUser */

export const RoleInfo = z.strictObject({
  role: StaffRole,
  label: z.string(),
  summary: z.string(),
  twoFactorRequired: z.boolean(),
  permissions: z.array(Permission),
})

const TokenParams = z.strictObject({ token: z.string().min(20).max(100) })
const IdParams = z.strictObject({ id: Id })
const StaffQuery = PageQuery.extend({ role: StaffRole.optional(), status: StaffStatus.optional() })

export const authRoutes = defineRoutes({
  // ---- no session (DOC-10.4 section 2)
  'admin.auth.login': { method: 'POST', path: '/admin/auth/login', auth: 'public', rateLimit: 'login', body: z.strictObject({ email: Email, password: PasswordInput }), response: LoginResult },
  'admin.auth.verifyTwoFactor': {
    method: 'POST', path: '/admin/auth/2fa', auth: 'staff-pending', rateLimit: 'login',
    body: z.union([z.strictObject({ code: z.string().regex(/^\d{6}$/) }), z.strictObject({ recoveryCode: z.string().min(8).max(20) })]),
    response: LoginResult,
  },
  'admin.auth.logout': { method: 'POST', path: '/admin/auth/logout', auth: 'staff-any', status: 204, response: Empty },
  'admin.auth.requestPasswordReset': { method: 'POST', path: '/admin/auth/password-reset', auth: 'public', rateLimit: 'login', status: 204, body: z.strictObject({ email: Email }), response: Empty },
  'admin.auth.resetPassword': { method: 'POST', path: '/admin/auth/password-reset/:token', auth: 'public', rateLimit: 'login', status: 204, params: TokenParams, body: z.strictObject({ password: PasswordInput }), response: Empty },
  'admin.auth.getInvite': {
    method: 'GET', path: '/admin/auth/invites/:token', auth: 'public', rateLimit: 'login', params: TokenParams,
    response: z.strictObject({ name: z.string(), email: z.string(), role: StaffRole, requiresTwoFactor: z.boolean() }),
  },
  'admin.auth.acceptInvite': { method: 'POST', path: '/admin/auth/invites/:token', auth: 'public', rateLimit: 'login', params: TokenParams, body: z.strictObject({ password: PasswordInput }), response: LoginResult },

  // ---- the current user (DOC-10.4 section 3)
  'admin.me.get': { method: 'GET', path: '/admin/me', auth: 'staff-any', enrolment: true, response: Me },
  'admin.me.update': { method: 'PUT', path: '/admin/me', auth: 'staff-any', body: z.strictObject({ name: z.string().trim().min(1).max(100) }), response: Me },
  'admin.me.changePassword': { method: 'POST', path: '/admin/me/password', auth: 'staff-any', status: 204, body: z.strictObject({ currentPassword: PasswordInput, newPassword: PasswordInput }), response: Empty },
  'admin.me.confirmPassword': { method: 'POST', path: '/admin/me/confirm-password', auth: 'staff-any', enrolment: true, status: 204, body: z.strictObject({ password: PasswordInput }), response: Empty },
  'admin.me.twoFactor.begin': { method: 'POST', path: '/admin/me/2fa/begin', auth: 'staff-any', enrolment: true, stepUp: true, response: z.strictObject({ otpauthUri: z.string(), secret: z.string() }) },
  'admin.me.twoFactor.enable': { method: 'POST', path: '/admin/me/2fa/enable', auth: 'staff-any', enrolment: true, body: z.strictObject({ code: z.string().regex(/^\d{6}$/) }), response: z.strictObject({ recoveryCodes: z.array(z.string()) }) },
  'admin.me.twoFactor.regenerateCodes': { method: 'POST', path: '/admin/me/2fa/recovery-codes', auth: 'staff-any', stepUp: true, response: z.strictObject({ recoveryCodes: z.array(z.string()) }) },
  'admin.me.twoFactor.disable': { method: 'DELETE', path: '/admin/me/2fa', auth: 'staff-any', stepUp: true, status: 204, response: Empty },
  'admin.me.sessions.list': { method: 'GET', path: '/admin/me/sessions', auth: 'staff-any', response: z.strictObject({ items: z.array(SessionInfo) }) },
  'admin.me.sessions.revoke': { method: 'DELETE', path: '/admin/me/sessions/:id', auth: 'staff-any', status: 204, params: z.strictObject({ id: z.string().regex(/^[0-9a-f]{16}$/) }), response: Empty },
  'admin.me.sessions.revokeOthers': { method: 'POST', path: '/admin/me/sessions/revoke-others', auth: 'staff-any', status: 204, response: Empty },

  // ---- staff and roles (DOC-10.4 section 4)
  'admin.roles.list': { method: 'GET', path: '/admin/roles', auth: 'staff', permission: 'staff:read', response: z.strictObject({ items: z.array(RoleInfo) }) },
  'admin.staff.list': { method: 'GET', path: '/admin/staff', auth: 'staff', permission: 'staff:read', query: StaffQuery, response: Page(StaffUser) },
  'admin.staff.get': { method: 'GET', path: '/admin/staff/:id', auth: 'staff', permission: 'staff:read', params: IdParams, response: StaffUser.extend({ sessions: z.array(SessionInfo) }) },
  'admin.staff.invite': {
    method: 'POST', path: '/admin/staff', auth: 'staff', permission: 'staff:manage', stepUp: true, status: 201,
    body: z.strictObject({ name: z.string().trim().min(1).max(100), email: Email, role: StaffRole }),
    response: StaffUser.extend({ inviteLink: z.string().optional() }),
  },
  'admin.staff.update': {
    method: 'PUT', path: '/admin/staff/:id', auth: 'staff', permission: 'staff:manage', stepUp: true, params: IdParams,
    body: z.strictObject({ name: z.string().trim().min(1).max(100), role: StaffRole, version: z.number().int() }),
    response: StaffUser,
  },
  'admin.staff.setPermissions': {
    method: 'PUT', path: '/admin/staff/:id/permissions', auth: 'staff', permission: 'staff:manage', stepUp: true, params: IdParams,
    body: z.strictObject({ grants: z.array(Permission).max(60), revokes: z.array(Permission).max(60), version: z.number().int() }),
    response: StaffUser,
  },
  'admin.staff.resendInvite': { method: 'POST', path: '/admin/staff/:id/invite', auth: 'staff', permission: 'staff:manage', stepUp: true, params: IdParams, response: z.strictObject({ inviteLink: z.string().optional() }) },
  'admin.staff.resetPassword': { method: 'POST', path: '/admin/staff/:id/password-reset', auth: 'staff', permission: 'staff:manage', stepUp: true, params: IdParams, response: z.strictObject({ resetLink: z.string().optional() }) },
  'admin.staff.resetTwoFactor': { method: 'DELETE', path: '/admin/staff/:id/2fa', auth: 'staff', permission: 'staff:manage', stepUp: true, status: 204, params: IdParams, response: Empty },
  'admin.staff.revokeSessions': { method: 'POST', path: '/admin/staff/:id/sessions/revoke', auth: 'staff', permission: 'staff:manage', stepUp: true, status: 204, params: IdParams, response: Empty },
  'admin.staff.clearLock': { method: 'POST', path: '/admin/staff/:id/unlock', auth: 'staff', permission: 'staff:manage', status: 204, params: IdParams, response: Empty },
  'admin.staff.deactivate': { method: 'POST', path: '/admin/staff/:id/deactivate', auth: 'staff', permission: 'staff:manage', stepUp: true, params: IdParams, response: StaffUser },
  'admin.staff.reactivate': { method: 'POST', path: '/admin/staff/:id/reactivate', auth: 'staff', permission: 'staff:manage', stepUp: true, params: IdParams, response: StaffUser },
})

// ---- audit log (DOC-10.4 section 5). Read-only: no route creates, changes or deletes an entry.
export const AuditEntry = z.strictObject({
  id: Id,
  at: IsoDate,
  actorType: Enum.actorType,
  actorId: Id.optional(),
  actorLabel: z.string(),
  actorRole: StaffRole.optional(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().optional(),
  entityLabel: z.string().optional(),
  summary: z.string().optional(),
  reason: z.string().optional(),
  category: z.enum(['general', 'security', 'money']),
  /** Masked (last part hidden) for everyone except an owner. */
  ip: z.string().optional(),
})
/** @typedef {z.infer<typeof AuditEntry>} AuditEntry */

export const AuditEntryDetail = AuditEntry.extend({
  /** A field is a [before, after] pair, or the text "[redacted]" when it holds a secret. */
  diff: z.record(z.string(), z.union([z.tuple([z.unknown(), z.unknown()]), z.literal('[redacted]')])).optional(),
  userAgent: z.string().optional(),
  requestId: z.string().optional(),
})

export const auditRoutes = defineRoutes({
  'admin.audit.list': {
    method: 'GET', path: '/admin/audit', auth: 'staff', permission: 'audit:read',
    query: z.strictObject({
      actorId: Id.optional(),
      entityType: z.string().max(32).optional(),
      entityId: z.string().max(64).optional(),
      action: z.string().max(64).optional(),
      category: z.enum(['security', 'money']).optional(),
      from: IsoDate.optional(),
      to: IsoDate.optional(),
      q: z.string().trim().min(2).max(80).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      cursor: z.string().max(80).optional(),
    }),
    response: CursorPage(AuditEntry),
  },
  'admin.audit.get': { method: 'GET', path: '/admin/audit/:id', auth: 'staff', permission: 'audit:read', params: IdParams, response: AuditEntryDetail },
})
