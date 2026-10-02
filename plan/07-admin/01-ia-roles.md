# 07.1 — Admin: Information Architecture, Shell and Access

| Field | Value |
|---|---|
| ID | DOC-07.1 |
| Title | Routes, sidebar, shell, login screens, permission per screen |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-03 §5.1, §8, DOC-04a/b/c, DOC-05 §10 |
| Decisions used | ADR-0007, ADR-0012, ADR-0015 |

## 1. Purpose and scope

**Governs:** every admin URL, the sidebar, the top bar, the sign-in screens, which permission each screen and action needs, and what happens to today's 20 screens.
**Does not govern:** the role → permission matrix, session and 2FA rules (DOC-11); per-screen behaviour (DOC-07.2 … 07.15); endpoints (DOC-10; route keys here are provisional).

Fixes K8 and F-16: the admin has no login, no route guard and no roles today (`App.jsx:26-64`).

## 2. Routes

All under `admin.rubaya.pk` in production. Every route module is lazy (ADR-0015). "Permission" is the `resource:action` the API requires for the screen's main query; without it the sidebar item is hidden and the URL shows the 403 state (§6).

| URL | Screen | Permission | Spec |
|---|---|---|---|
| `/login` | Email + password | public | §5 |
| `/login/2fa` | TOTP or recovery code | pending session | §5 |
| `/forgot-password`, `/reset-password/:token` | Password reset | public | §5 |
| `/accept-invite/:token` | Set password, enrol 2FA | public | DOC-07.12 |
| `/` | Dashboard | `dashboard:read` | 07.2 |
| `/products`, `/products/new`, `/products/:id` | Products | `products:read` | 07.3 |
| `/categories` | Categories | `catalog:read` | 07.4 |
| `/collections`, `/collections/:id` | Collections | `catalog:read` | 07.4 |
| `/attributes` | Attributes | `catalog:read` | 07.4 |
| `/sizes` | Size systems, size charts, custom-size forms | `catalog:read` | 07.4 |
| `/orders`, `/orders/:id` | Orders | `orders:read` | 07.5 |
| `/orders/new` | Staff-created order | `orders:edit` | 07.6 §4 |
| `/orders/:id/print` | Invoice / packing slip print view (no shell) | `orders:read` | 07.5 §5.2 |
| `/customers`, `/customers/:id` | Customers | `customers:read` | 07.6 |
| `/promos` | Promo codes (edit in a drawer, `?edit=<id>`) | `promos:read` | 07.7 |
| `/reviews` | Review moderation | `reviews:read` | 07.8 |
| `/content/pages`, `/content/pages/:id` | CMS pages | `content:read` | 07.9 |
| `/content/menus` | Menus | `content:read` | 07.9 |
| `/content/home` | Home page content (hero, banners, announcement, footer) | `content:read` | 07.9 |
| `/settings/store` | Store settings | `settings:read` | 07.11 |
| `/settings/appearance` | Theme | `settings:read` | 07.11 |
| `/settings/shipping` | Zones, methods, couriers | `settings:read` | 07.10 |
| `/settings/payments` | Payment methods | `settings:read` | 07.10 |
| `/settings/data` | Import / export | `settings:manage` | 07.11 |
| `/staff`, `/staff/:id` | Staff and roles | `staff:read` | 07.12 |
| `/audit` | Audit log | `audit:read` | 07.13 |
| `/account` | My profile, password, 2FA, sessions | any signed-in user | 07.12 |
| `*` | Not found | — | §6 |

Permission vocabulary used across DOC-07 (resources × actions; DOC-11 assigns them to roles):

| Resource | Actions |
|---|---|
| `dashboard` | `read` |
| `products` | `read`, `write`, `publish`, `delete`, `export` |
| `inventory` | `adjust` |
| `catalog` | `read`, `write`, `delete` |
| `orders` | `read`, `note`, `confirm`, `dispatch`, `deliver`, `cancel`, `return`, `edit`, `payments`, `export` |
| `customers` | `read`, `write`, `export`, `anonymise` |
| `promos` | `read`, `write`, `delete` |
| `reviews` | `read`, `moderate` |
| `content` | `read`, `write`, `delete` |
| `settings` | `read`, `write`, `manage` |
| `staff` | `read`, `manage` |
| `audit` | `read` |

## 3. Sidebar

```
┌────────────────────┐
│ RUBAYA      «      │  logo/name, collapse
│ Overview           │
│  ▣ Dashboard       │
│ Sales              │
│  ▣ Orders      12  │  badge = orders needing action (pending_confirmation + confirmed-not-dispatched)
│  ▣ Customers       │
│  ▣ Promo codes     │
│  ▣ Reviews      3  │  badge = pending reviews
│ Catalog            │
│  ▣ Products        │
│  ▣ Categories      │
│  ▣ Collections     │
│  ▣ Attributes      │
│  ▣ Sizes & charts  │
│ Content            │
│  ▣ Home page       │
│  ▣ Pages           │
│  ▣ Menus           │
│ Settings           │
│  ▣ Store           │
│  ▣ Appearance      │
│  ▣ Shipping        │
│  ▣ Payments        │
│  ▣ Staff & roles   │
│  ▣ Audit log       │
│  ▣ Data            │
└────────────────────┘
```

| Rule | Detail |
|---|---|
| Order | Sales first: orders are the daily work |
| Visibility | An item is rendered only when the signed-in user's permissions (from `GET /admin/me`) include its permission; a group with no visible items is omitted |
| Badges | From `admin.nav.counts` (one small query, `refetchInterval` 60 s while the tab is visible); hidden at 0; "99+" above 99 |
| Collapse | 240 px ↔ 64 px (icons with `Tooltip`); state in `noor.admin.prefs`. Under `lg` the sidebar is a `Drawer` opened by a menu button |
| Active item | `aria-current="page"`; a detail route keeps its list item active |
| Markup | `<nav aria-label="Main">` with one list per group and the group label as its heading |

## 4. Top bar and page frame

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ☰   Products › Embroidered Lawn 3-Piece         [⌘K Search]  ◐  (AK ▾)  │
└──────────────────────────────────────────────────────────────────────────┘
```

| Element | Behaviour |
|---|---|
| Breadcrumb | Section › entity name; each part a link |
| Search / command palette | Opens with the button or `Ctrl/⌘ K` (DOC-07.15) |
| Theme toggle | Light / dark / system (DOC-04a §6) |
| User menu | Name and role; "My account" (`/account`), "View storefront" (new tab), "Sign out" (`admin.auth.logout`, clears the query cache, goes to `/login`) |
| Page header | `PageHeader`: `<h1>`, optional description, primary action at inline-end, secondary actions in a `Menu` |
| Environment banner | A non-dismissible `warning-soft` strip "Staging: test data" when the API reports a non-production environment |
| Skip link | First focusable element |

## 5. Sign-in screens

Centered card, 400 px, on `bg`; no sidebar.

| Screen | Fields and behaviour |
|---|---|
| `/login` | Email, password, "Sign in". Errors are one generic message for wrong email or password (`invalid_credentials`). `429` → "Too many attempts. Try again in N minutes" (DOC-11 limits). On success: if 2FA is enrolled → `/login/2fa`; if the role requires 2FA and it is not enrolled → forced enrolment (DOC-07.12 §5); else → `?next` (same-origin paths only) or `/` |
| `/login/2fa` | 6-digit code (`inputMode="numeric"`, `autoComplete="one-time-code"`), "Use a recovery code" switches to a text field. 5 wrong codes end the pending session |
| `/forgot-password` | Email → always the same response "If that address has an account, we've sent a link". Needs the email provider (DOC-12); until one is configured the screen says "Ask the owner to reset your password" and the owner uses DOC-07.12 §4 |
| `/reset-password/:token` | New password twice (rules in DOC-11); success signs out all sessions of that user and returns to `/login` |

Session handling in the client: the shell loader calls `admin.me.get`; `401` on any request clears the cache and redirects to `/login?next=<current path>`; an expired idle session shows a toast "Signed out after inactivity" on the login page. The CSRF token from `admin.me.get` is attached by `lib/api.ts` to every mutating request (ADR-0012).

## 6. Access and error states

| Case | UI |
|---|---|
| No permission for a screen | `ErrorState` "You don't have access to this page" + "Ask an owner or manager" (no retry). The sidebar never linked there |
| No permission for an action on a visible screen | The control is **not rendered** (not disabled), e.g. no "Delete" for a role without `products:delete`. The API still enforces it; a `403` from a stale UI shows a toast "You no longer have permission" and refetches `admin.me.get` |
| Unknown URL | "Page not found" + link to the dashboard |
| Route chunk failed to load (deploy during a session) | `ErrorState` with "Reload" |
| API unreachable | Screen-level `ErrorState` with Retry; the shell stays |

Permission checks in components use one helper: `const can = useCan(); can('orders:dispatch')`.

## 7. What happens to the current screens

| Current screen | New home |
|---|---|
| Dashboard, Products, Categories, Collections, Attributes, Sizes, Orders, Promos, Reviews | Same names, rebuilt per 07.2–07.8 |
| CMS pages, Menus | `/content/pages`, `/content/menus` |
| Site settings (hero slides, announcement, banners, footer) | `/content/home` (it is content, not configuration) |
| Store settings | `/settings/store` |
| Appearance | `/settings/appearance` |
| Shipping & payments | Split: `/settings/shipping`, `/settings/payments` |
| Page templates | **Not shipped in v1** (the storefront does not render `PageTemplate`, DOC-06.2 §2). The contract type stays; the screen returns with that feature |
| Data & publishing (localStorage bundle import/export, reset demo data) | Replaced by `/settings/data` (CSV import/export against the API). "Reset all demo data" exists only as `db:seed` in development |
| — | New: Customers, Staff & roles, Audit log, My account, sign-in screens |

Old URLs redirect client-side: `/pages` → `/content/pages`, `/menus` → `/content/menus`, `/site` → `/content/home`, `/settings` → `/settings/store`, `/appearance` → `/settings/appearance`, `/shipping` → `/settings/shipping`, `/templates` and `/data` → `/`.

## 8. Rules

**Always:** derive what a user sees from `admin.me.get` permissions; keep list state in the URL; give each screen one `<h1>` and one primary action.
**Never:** hide a control with CSS as the only protection; hard-code role names in components (check permissions, not roles); put a secret or key in the admin bundle; open `?next` URLs that are not same-origin paths.
**Common mistakes:** disabling instead of removing a forbidden action; a sidebar link that leads to a 403; checking `role === 'owner'`.

## 9. Acceptance checklist

- [ ] Every row of §2 exists as a lazy route; initial JS ≤ 200 kB gzip (ADR-0015).
- [ ] A `viewer` user sees no create, edit, delete or bulk control anywhere (Playwright walks every list screen).
- [ ] Visiting any app URL signed out redirects to `/login?next=…` and returns there after sign-in.
- [ ] `?next=https://evil.example` is ignored.
- [ ] `grep -rnE "role ===|role ==" apps/admin/src` returns nothing.
- [ ] Sidebar is keyboard-operable, announces the current page, and works collapsed.

## 10. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-07.1-1 | Permission list in §2 | Final names and the role matrix are confirmed in DOC-11 | DOC-11 |
| Q-07.1-2 | Password reset by email | Needs DOC-12 email provider; owner reset is the launch path | Email provider configured |
| Q-07.1-3 | Admin on phones | Not supported under 768 px except the orders list and order detail, which must work at 360 px (staff confirm COD orders from a phone) | — |

## 11. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 3). Supersedes DOC-04c Q-04c-2: orders screens work at 360 px |
| 2026-10-02 | Phase 4: permission list aligned with the DOC-11 matrix (`orders:note`, `customers:anonymise`) |
| 2026-10-02 | Phase 7 consistency review: route key `admin.me.get` |
