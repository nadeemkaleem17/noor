# 10.4 — API: Admin Authentication, Staff and Audit

| Field | Value |
|---|---|
| ID | DOC-10.4 |
| Title | Login, 2FA, sessions, my account, staff, roles, audit log |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-10.0, DOC-09.2, DOC-11 §3–6, DOC-07.1 §5, DOC-07.12, DOC-07.13 |
| Decisions used | ADR-0012 |

## 1. Purpose and scope

**Governs:** endpoints of the `auth` and `audit` modules.
**Does not govern:** the rules they enforce (DOC-11) or the screens (DOC-07.12, 07.13).

All paths are under `/api/v1/admin`. All responses `Cache-Control: no-store`. "Step-up" = requires recent password confirmation (DOC-11 §3.4).

## 2. Authentication (no session required)

| Key | Method & path | Auth | Request | Response | Errors | Notes |
|---|---|---|---|---|---|---|
| `admin.auth.login` | `POST /auth/login` | `public` | B: `{ email: string, password: string }` | 200 `LoginResult` + `Set-Cookie` | `invalid_credentials`, `too_many_attempts` | Bucket `login`. `Origin` must be the admin origin |
| `admin.auth.verifyTwoFactor` | `POST /auth/2fa` | `staff-pending` | B: `{ code: string }` (6 digits) or `{ recoveryCode: string }` | 200 `LoginResult` + new cookie | `invalid_code`, `unauthenticated` (pending session expired or 5 failures) | |
| `admin.auth.logout` | `POST /auth/logout` | `staff` | — | 204, cookie cleared | — | |
| `admin.auth.requestPasswordReset` | `POST /auth/password-reset` | `public` | B: `{ email }` | 204 always | — | Bucket `login`. Sends email only when a provider is configured |
| `admin.auth.resetPassword` | `POST /auth/password-reset/:token` | `public` | B: `{ password }` | 204 | `token_expired`, `password_too_weak` | Ends all of the user's sessions |
| `admin.auth.getInvite` | `GET /auth/invites/:token` | `public` | — | 200 `{ name: string, email: string, role: StaffRole, requiresTwoFactor: boolean }` | `token_expired` | |
| `admin.auth.acceptInvite` | `POST /auth/invites/:token` | `public` | B: `{ password }` | 200 `LoginResult` + cookie | `token_expired`, `password_too_weak` | Activates the user |

```ts
LoginResult = { next: 'ok' | 'two_factor' | 'enrol_two_factor' }
```

## 3. Current user (auth `staff`, any role)

| Key | Method & path | Request | Response | Errors | Notes |
|---|---|---|---|---|---|
| `admin.me.get` | `GET /me` | — | 200 `Me` | — | Called by the SPA shell; carries the CSRF token |
| `admin.me.update` | `PUT /me` | B: `{ name: string }` | 200 `Me` | — | |
| `admin.me.changePassword` | `POST /me/password` | B: `{ currentPassword, newPassword }` | 204 | `invalid_credentials`, `password_too_weak` | Ends other sessions |
| `admin.me.confirmPassword` | `POST /me/confirm-password` | B: `{ password }` | 204 | `invalid_credentials` | Refreshes step-up for 15 minutes |
| `admin.me.twoFactor.begin` | `POST /me/2fa/begin` | — | 200 `{ otpauthUri: string, secret: string }` | — | Step-up. Allowed in an `enrol_2fa` session. The secret is held pending until verified |
| `admin.me.twoFactor.enable` | `POST /me/2fa/enable` | B: `{ code }` | 200 `{ recoveryCodes: string[] }` | `invalid_code` | Codes are returned once |
| `admin.me.twoFactor.regenerateCodes` | `POST /me/2fa/recovery-codes` | — | 200 `{ recoveryCodes: string[] }` | — | Step-up |
| `admin.me.twoFactor.disable` | `DELETE /me/2fa` | — | 204 | `forbidden` (role requires 2FA) | Step-up |
| `admin.me.sessions.list` | `GET /me/sessions` | — | 200 `{ items: SessionInfo[] }` | — | |
| `admin.me.sessions.revoke` | `DELETE /me/sessions/:id` | — | 204 | `not_found` | `:id` is the session's public id (first 16 hex of the stored hash), never the cookie value |
| `admin.me.sessions.revokeOthers` | `POST /me/sessions/revoke-others` | — | 204 | — | |

```ts
Me = { id: Id, name: string, email: string, role: StaffRole, permissions: Permission[],
       twoFactorEnabled: boolean, twoFactorRequired: boolean,
       csrfToken: string, environment: 'local' | 'ci' | 'staging' | 'production',
       stepUpValidUntil?: IsoDate }
SessionInfo = { id: string, current: boolean, createdAt: IsoDate, lastSeenAt: IsoDate, ip: string, userAgent: string }
```

## 4. Staff and roles

| Key | Method & path | Permission | Request | Response | Errors | Notes |
|---|---|---|---|---|---|---|
| `admin.roles.list` | `GET /roles` | `staff:read` | — | 200 `{ items: { role: StaffRole, label: string, summary: string, twoFactorRequired: boolean, permissions: Permission[] }[] }` | — | Generated from the matrix in code (DOC-11 §4.1) |
| `admin.staff.list` | `GET /staff` | `staff:read` | Q: `q?`, `role?`, `status?`, `page`, `size`, `sort` (`name`, `-lastSeenAt`) | 200 `Page<StaffUser>` | — | |
| `admin.staff.get` | `GET /staff/:id` | `staff:read` | — | 200 `StaffUser & { sessions: SessionInfo[] }` | `not_found` | |
| `admin.staff.invite` | `POST /staff` | `staff:manage` | B: `{ name, email, role }` | 201 `StaffUser & { inviteLink?: string }` | `email_taken`, `forbidden` (granting above own level) | Step-up. `inviteLink` is returned once, and only when no email provider is configured |
| `admin.staff.update` | `PUT /staff/:id` | `staff:manage` | B: `{ name, role, version }` | 200 `StaffUser` | `stale_write`, `last_owner`, `forbidden` | Step-up. Role change ends that user's sessions |
| `admin.staff.setPermissions` | `PUT /staff/:id/permissions` | `staff:manage` (step-up) | B: `{ grants: Permission[], revokes: Permission[], version }` | 200 `StaffUser` (`grants`, `revokes`, `permissions`) | `forbidden` (own access, an owner as a manager, a permission the actor lacks), `validation_failed` (a revoke on an owner), `stale_write` | Added 2026-10-20 |
| `admin.staff.resendInvite` | `POST /staff/:id/invite` | `staff:manage` | — | 200 `{ inviteLink?: string }` | `action_not_allowed` (not `invited`) | Step-up |
| `admin.staff.resetPassword` | `POST /staff/:id/password-reset` | `staff:manage` | — | 200 `{ resetLink?: string }` | `forbidden` | Step-up |
| `admin.staff.resetTwoFactor` | `DELETE /staff/:id/2fa` | `staff:manage` | — | 204 | `forbidden` | Step-up |
| `admin.staff.revokeSessions` | `POST /staff/:id/sessions/revoke` | `staff:manage` | — | 204 | — | Step-up |
| `admin.staff.clearLock` | `POST /staff/:id/unlock` | `staff:manage` | — | 204 | — | |
| `admin.staff.deactivate` | `POST /staff/:id/deactivate` | `staff:manage` | — | 200 `StaffUser` | `last_owner`, `forbidden` (self, or owner by a non-owner) | Step-up |
| `admin.staff.reactivate` | `POST /staff/:id/reactivate` | `staff:manage` | — | 200 `StaffUser` | — | Step-up |

```ts
StaffUser = { id: Id, name: string, email: string, role: StaffRole, status: StaffStatus,
              twoFactorEnabled: boolean, lockedUntil?: IsoDate, lastSeenAt?: IsoDate,
              inviteExpiresAt?: IsoDate, version: int, createdAt: IsoDate }
```

There is no delete endpoint for staff (DOC-07.12 §4).

## 5. Audit log

| Key | Method & path | Permission | Request | Response | Errors | Notes |
|---|---|---|---|---|---|---|
| `admin.audit.list` | `GET /audit` | `audit:read` | Q: `actorId?`, `entityType?`, `entityId?`, `action?`, `category?: 'security' \| 'money'`, `from?`, `to?`, `q?`, `limit?` (≤ 100, default 50), `cursor?` | 200 `CursorPage<AuditEntry>` | — | Newest first; cursor = last `id` |
| `admin.audit.get` | `GET /audit/:id` | `audit:read` | — | 200 `AuditEntry & { diff?: Record<string, [unknown, unknown]>, userAgent?: string, requestId?: string }` | `not_found` | |
| `admin.audit.export` | `POST /audit/exports` | `audit:read` + owner | B: the list filters | 202 `{ jobId }` | — | Step-up; max 10,000 rows |

```ts
AuditEntry = { id: Id, at: IsoDate, actorType: ActorType, actorId?: Id, actorLabel: string, actorRole?: StaffRole,
               action: string, entityType: string, entityId?: string, entityLabel?: string,
               summary?: string,          // "price 6,990 → 7,490; status draft → active"
               reason?: string, category: 'general' | 'security' | 'money', ip?: string /* masked for non-owners */ }
```

No create, update or delete route exists for audit entries.

**Contract additions (M1-02).** Two route flags were added to the contract: `stepUp` (the route needs a password confirmation within 15 minutes, else `403 step_up_required`) and `enrolment` (also reachable from a session that may only enrol two-factor: `admin.me.get`, `confirmPassword`, `twoFactor.begin`, `twoFactor.enable`). A new auth class `staff-any` means "any signed-in staff member, no permission" and is used by `logout` and every `admin.me.*` route; the strict rule "a staff route names a permission" still holds for `staff`. The half-finished sessions answer other routes with `403 two_factor_required`.

## 6. Example

```http
POST /api/v1/admin/auth/login
Origin: https://admin.rubaya.pk
{ "email": "owner@rubaya.pk", "password": "…" }

200 OK
Set-Cookie: __Host-rb_admin=…; Path=/; HttpOnly; Secure; SameSite=Lax
{ "next": "two_factor" }
```

## 7. Rules

**Always:** answer login, reset-request and unknown-invite uniformly; return secrets (invite link, reset link, recovery codes, TOTP secret) exactly once; rotate the session id at each step of login.
**Never:** return a password hash, TOTP secret after enrolment, session id or token hash; allow a route here to change the caller's own role; add an audit mutation endpoint.
**Common mistakes:** putting `csrfToken` in a cookie readable by scripts instead of the `me` response; a staff list that leaks whether an email exists to a role without `staff:read`.

## 8. Acceptance checklist

- [x] Every DOC-11 §13 acceptance item that names an endpoint passes against these routes. (DOC-11 §13 is ticked box by box (M7-03).)
- [x] `admin.roles.list` output equals the code matrix (snapshot test); the UI table renders from it. (`apps/api/test/auth.int.test.js` ("the roles list equals the matrix in code").)
- [x] `admin.staff.update` demoting the last owner → `409 last_owner`. (`apps/api/test/auth.int.test.js` ("keeps the last owner").)
- [x] Step-up routes return `403 step_up_required` when `lastAuthAt` is older than 15 minutes and succeed after `admin.me.confirmPassword`. (`apps/api/test/auth.int.test.js` ("step-up routes need a recent password confirmation").)
- [x] No response in this file contains `passwordHash`, `totpSecret`, `tokenHash` or a session cookie value (schema test). (`apps/api/test/auth.int.test.js` ("never exposes credentials") and `secrets-at-rest.int.test.js`.)

## 9. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-10.4-1 | Session public id = prefix of the stored hash | Sufficiently unique per user; not usable as a credential | Collision observed |
| Q-10.4-2 | Email delivery of links | Off until DOC-12 email is configured | — |

## 10. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 5, part 2) |
| 2026-10-04 | M1-02 built. Behaviour fixed while building: (1) clearing a lock (`admin.staff.clearLock`) also forgets that email's failed attempts, otherwise the next try would re-lock; (2) `admin.auth.requestPasswordReset` only counts the request (5 per 15 min per IP) because no email provider exists; owners issue reset links from the staff screen; (3) the first 2FA code check uses the application clock, so tests can freeze time; (4) a role change, deactivation, password reset and 2FA reset end that person's sessions; (5) `inviteLink` and `resetLink` are always returned (no provider), at most once |
