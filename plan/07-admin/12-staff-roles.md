# 07.12 — Admin: Staff, Roles and My Account

| Field | Value |
|---|---|
| ID | DOC-07.12 |
| Title | Staff list, invitations, roles, 2FA enrolment, sessions, my account |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-07.1 |
| Decisions used | ADR-0012 |

## 1. Purpose and scope

**Governs:** the screens `/staff`, `/staff/:id`, `/accept-invite/:token`, `/account` and the forced 2FA enrolment flow.
**Does not govern:** password rules, session lifetimes, rate limits, the role → permission matrix and its enforcement (DOC-11). This document shows what DOC-11 decides.

`/staff` needs `staff:read`; every change needs `staff:manage`.

## 2. Roles (as shown to staff)

Six fixed roles in v1 (ADR-0012). The screen shows this plain-language summary; "View permissions" opens a read-only table generated from the API's matrix (`admin.roles.list`), so the UI can never disagree with enforcement.

| Role | Summary shown in the UI | 2FA |
|---|---|---|
| Owner | Everything, including staff, settings and data export | Required |
| Manager | Everything except managing owners and deleting the store's data | Required |
| Catalog | Products, stock, categories, collections, attributes, sizes, content. No orders or customers | Optional |
| Fulfilment | Orders: confirm, edit before dispatch, dispatch, deliver, cancel, return, record payments; print invoices; adjust stock; see customer contact details. No prices, promos or settings | Optional |
| Support | View orders, customers and promo codes; log confirmation attempts; add notes and customer flags; moderate reviews. Cannot confirm, dispatch, cancel or refund | Optional |
| Viewer | Read-only on dashboard, products and orders. No customer contact details | Optional |

Custom roles are not in v1.

## 3. Staff list (`/staff`)

| Column | Content |
|---|---|
| Name | Name, email |
| Role | Role name |
| 2FA | On / Off (`danger` tone when off and required) |
| Status | Active, Invited (with "expires in 5 days"), Deactivated |
| Last active | Relative time |
| ⋯ | Edit, Resend invite, Reset password, Sign out everywhere, Deactivate / Reactivate |

Header action: **Invite staff**.

## 4. Staff actions

| Action | Dialog and rules |
|---|---|
| Invite | Name, email, role. Creates the user in `invited` state and an invite link valid 7 days. With an email provider (DOC-12) the link is emailed; otherwise the dialog shows the link **once** with a copy button and the text "Send this link to them privately" |
| Edit | Name, role. Changing a role signs that user out of all sessions (ADR-0012: rotate on privilege change) |
| Reset password | Generates a one-time reset link (shown once or emailed, as above); signs the user out everywhere |
| Reset 2FA | For a user who lost their device: removes their TOTP secret and recovery codes; they must re-enrol at next sign-in. Needs the acting user to re-enter their own password |
| Sign out everywhere | Revokes all of the user's sessions |
| Deactivate | Blocks sign-in and revokes sessions; the user's name stays on audit entries and order events. Reactivate restores access. Staff are never deleted |

Guard rails (enforced by the API, reflected in the UI by hiding or disabling with a reason):

| Rule |
|---|
| Only an owner can create, edit or deactivate an owner |
| The last active owner cannot be deactivated or demoted |
| Nobody can change their own role or deactivate themselves |
| A manager cannot grant a role higher than manager |
| Every action in this section asks for the acting user's password again if their session is older than 15 minutes (step-up) |

## 5. Accepting an invite and enrolling 2FA

`/accept-invite/:token` (public): shows the name and email (read-only) → set password (rules from DOC-11, with a live checklist) → if the role requires 2FA, or the user opts in, the enrolment step → signed in.

2FA enrolment (also reachable from `/account`, and **forced** after sign-in for owners and managers who have not enrolled):

```
┌────────────────────────────────────────────┐
│ Set up two-step sign-in                    │
│ 1. Scan with an authenticator app          │
│    ┌───────┐   or enter this key:          │
│    │  QR   │   JBSW Y3DP EHPK 3PXP         │
│    └───────┘                               │
│ 2. Enter the 6-digit code  [______]        │
│ [Verify]                                   │
└────────────────────────────────────────────┘
→ Recovery codes (10), shown once: [Copy] [Download .txt]
  ☐ I have saved these codes        [Done]
```

| Rule | Detail |
|---|---|
| QR | Rendered client-side as SVG from the `otpauth://` URI returned by `admin.me.twoFactor.begin`; the secret is also shown as text for manual entry |
| Verification | The code must verify before 2FA is switched on |
| Recovery codes | 10 single-use codes shown once; "Done" is disabled until the checkbox is ticked. Regenerating invalidates the old set |
| Forced flow | While enrolment is required and incomplete, the only reachable screens are enrolment and sign-out |

## 6. My account (`/account`)

| Card | Content |
|---|---|
| Profile | Name (editable), email (read-only; changed by an owner), role (read-only) |
| Password | Current password, new password twice. Success signs out other sessions |
| Two-step sign-in | Status; Set up / Regenerate recovery codes / Turn off (turn-off is not offered to roles that require 2FA). Each needs the current password |
| Sessions | Table: device/browser (from the user agent), IP address, signed in, last active, "This device" marker; "Sign out" per row and "Sign out all other sessions" |
| Preferences | Theme (light/dark/system), default orders tab, table density (comfortable/compact). Stored in `noor.admin.prefs` (browser), not on the server |

## 7. Rules

**Always:** show secrets (invite links, reset links, recovery codes, TOTP key) exactly once; require re-authentication for staff-management and security changes; keep deactivated staff for history.
**Never:** email or display a password; let a user raise their own privileges; delete staff records; put role logic in the client beyond showing what the API returns.
**Common mistakes:** leaving an ex-employee active; sharing one login between people (the audit log becomes meaningless); skipping recovery codes.

## 8. Acceptance checklist

- [ ] An invite link works once, expires after 7 days, and cannot be used after "Resend invite" issued a new one.
- [ ] An owner or manager without 2FA can reach nothing but the enrolment screen after signing in.
- [ ] Demoting or deactivating the last owner is refused with an explanation.
- [ ] Changing a user's role ends that user's sessions (their next request returns 401).
- [ ] Recovery codes are displayed once; reloading the page does not show them again.
- [ ] "Sign out all other sessions" leaves the current session working.
- [ ] The permissions table shown in the UI is rendered from `admin.roles.list`, not from a constant in the client.

## 9. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-07.12-1 | Role matrix and exact permissions per role | DOC-11; §2 summaries are adjusted to match it in Phase 4 | DOC-11 |
| Q-07.12-2 | QR rendering | A small QR encoder dependency in the admin (`qrcode`-class library, about 10 kB) loaded only on the enrolment screen | DOC-11 may prefer a server-rendered SVG |
| Q-07.12-3 | Passkeys / WebAuthn | Not in v1 (TOTP per ADR-0012) | Owner asks |
| Q-07.12-4 | Email delivery of invites | Manual link until DOC-12 email exists | — |

## 10. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 3) |
| 2026-10-02 | Phase 4: role summaries aligned with the DOC-11 matrix |
