# ADR-0012 — Server-side sessions, Argon2id, TOTP, RBAC; no shared admin key

| Field | Value |
|---|---|
| ID | ADR-0012 |
| Title | Auth, sessions, RBAC |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (K8, F-16, F-18), ADR-0008, ADR-0016 |
| Decisions used | ADR-0005, ADR-0009 |

## Purpose and scope
How staff and customers are authenticated and authorised. Full RBAC matrix, 2FA flows and OWASP checklist are DOC-11.

## Context
The only admin "auth" is a shared `x-admin-key` compiled into the public bundle (`lib/api.js:11`, `server.js:37-42`); the admin UI has no login (`App.jsx:26-64`); there are no roles or audit log (F-16). Customers check out as guests; tracking uses order number + phone (F-07).

## Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Server-side sessions in MySQL, `HttpOnly; Secure; SameSite=Lax` cookie | Revocable instantly; no token in JS; simple | Needs CSRF defence; sticky to our API |
| B. JWT access + refresh in memory/localStorage | Stateless | Not revocable without a denylist; XSS exposure when in storage |
| C. Hosted identity provider | Less code | Cost, foreign payment, lock-in; overkill for ~5 staff |

## Decision
**Option A.**
- Staff: email + password hashed with **Argon2id**; TOTP 2FA mandatory for `owner` and `manager`, optional for others; session idle timeout 8 h, absolute 14 d; rotate id on login and privilege change; login rate limit 5/15 min/account + IP; lockout with backoff; all sessions listable and revocable.
- Roles (v1): `owner`, `manager`, `catalog`, `fulfilment`, `support`, `viewer`; permissions are `resource:action` strings checked in route middleware; matrix in DOC-11.
- CSRF: double-submit token header for cookie-authenticated mutating requests plus `Origin` check. Admin and API share a parent domain (`admin.<domain>` → `api.<domain>`), cookie scoped accordingly (ADR-0019).
- Audit: every admin mutation writes `audit_log` (actor, action, entity, before/after diff, IP, user-agent) in the same transaction.
- Customers: guest checkout stays default. Order tracking requires order number + phone **and** is rate-limited (10/hour/IP and 5/hour/order); a signed, unguessable `tracking_token` is added to the confirmation link and WhatsApp message so the common path needs no phone entry. Customer accounts (phone OTP) are post-launch (DOC-16).
- The shared key is deleted from all apps; `VITE_ADMIN_KEY` is banned (lint + secret scan).

## Examples
```
Set-Cookie: __Host-rb_admin=<opaque 256-bit id>; Path=/; HttpOnly; Secure; SameSite=Lax
```
`__Host-` requires no `Domain` attribute, and none is needed: the cookie is set by the API host and the admin SPA calls that host with credentials (same-site), as decided in DOC-11 §3.4.

## Consequences
Real authentication, revocation and auditability. A login screen and 2FA UX must be built; tracking adds a token to messages.

## Rules
**Always:** check permission server-side on every route; hash with Argon2id; log security events. **Never:** put secrets in `VITE_*` variables; store a session token in `localStorage`; trust client-side role checks. **Common mistake:** hiding a button and calling that authorization.

## Acceptance checklist
- [x] `grep -r "ADMIN_KEY\|x-admin-key" apps packages` is empty. (Run at M7-07: only the scanner that bans the names (`packages/config/secrets.js`) matches.)
- [x] Every admin route has a declared permission (contract route table, ADR-0005) and a test that a lower role gets 403. (`apps/api/test/auth.int.test.js` ("route x role").)
- [x] Tracking endpoint returns 429 after the stated limit. (`apps/api/test/public-orders.int.test.js`.)

## Revisit trigger
More than 15 staff, a need for SSO, or a customer-account launch (then add OTP provider ADR).

## Open questions and assumptions
SMS OTP provider and cost are unresearched (DOC-12). Assumes fewer than 10 staff accounts at launch.

## Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |
| 2026-10-02 | Session store is MySQL (ADR-0008) |
| 2026-10-02 | Phase 2: guest-only customers confirmed for v1 with a revisit trigger for phone+OTP accounts (DOC-06.7 §2) |
| 2026-10-02 | Phase 4: cookie is `__Host-rb_admin` on the API host (no `Domain`); role matrix, limits and step-up specified in DOC-11 |
| 2026-10-02 | Phase 5: tracking token is HMAC-derived from the order id with `TRACKING_KEY`; the stored value is its hash (DOC-10.3 §4) |
| 2026-10-02 | Phase 7 consistency review: cookie example matches DOC-11 §3.4 |
