# 16 — Roadmap and Backlog

| Field | Value |
|---|---|
| ID | DOC-16 |
| Title | Migration from the current code, milestones, ordered backlog |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | Every other document |
| Decisions used | ADR-0001 … ADR-0020 |

## 1. Purpose and scope

**Governs:** the order in which the plan is built, what each task must deliver, and how today's three projects turn into the target system.
**Does not govern:** how anything is built (the cited documents do).

Scope follows README A-08: **milestones M0–M7 build and finish the whole product locally. The production phase (`LAUNCH-*`) is listed but not scheduled**; the owner starts it when the local build is complete.

## 2. How to read the backlog

| Column | Meaning |
|---|---|
| ID | `<milestone>-<nn>`. Used in branch names, PR titles and `TODO(…)` comments (DOC-15) |
| Task | What is delivered |
| Docs | The sections that specify it. Read these, not the whole set (AGENTS.md §2) |
| After | Tasks that must be merged first |
| Days | Ideal working days for one developer with an AI coding agent, including tests. **Estimates, not measured**; they exist to order and size work, not to promise dates. Re-estimated at the end of each milestone from actuals (§9) |
| Done when | The acceptance, beyond "the cited docs' checklists pass and `pnpm check` is green", which applies to every task |

Rules: tasks are done in order within a milestone unless "After" allows parallel work; a task is merged as one or more PRs under 400 changed lines where practical (DOC-15 §5); a task whose doc turns out wrong fixes the doc in the same PR.

## 3. Migration from the current code

| Today | Becomes | When |
|---|---|---|
| Repo root with `scripts/dev.mjs`, `render.yaml` | pnpm + Turborepo workspace; `render.yaml` and the Render demo are retired (the mock deployment is not the product) | M0-01 |
| `admin-panel/` (JSX, localStorage/API dual layer, Radix, global CSS) | `apps/admin/`. Moved with `git mv` so history is kept. It keeps running against `mock-api` until M3; from M3 each screen is rebuilt in TypeScript on `@noor/ui` and the real API, and the old file is deleted in the same PR. `lib/db.js`, `hooks/useCollection.js`, `lib/api.js` and the Radix packages are deleted when the last old screen goes (M6) | M0-01 → M6 |
| `admin-panel/src/contract/schemas.js` + `fixtures.js` | `packages/contract` (Zod 4, with the changes of DOC-09.0 §6) and `apps/api/src/seed/demo` | M0-04, M1-12 |
| `admin-panel/src/lib/*` domain helpers (`variants.js`, `images.js`, `membership.js`, `orders.js`, `invoice.js`, `format.js`, `id.js`, `csv.js`) | Logic that survives moves to where it now belongs: variant generation → admin products feature; money/date formatting → `@noor/i18n`; order transitions and invoice numbers → API; CSV → API export. Each is re-read against DOC-01 before reuse (DOC-01 §7) | M3, M4 |
| `ecommerce-website/` | Not migrated: **rewritten** as `apps/storefront` (different rendering model, ADR-0004). Kept under `legacy/storefront/` for reference until M5 is done, then deleted | M0-01 → M7-04 |
| `mock-api/` | Reference for seed data and behaviour; replaced route by route by `apps/api`. Kept under `legacy/mock-api/` so the old admin runs until M3; deleted at M7-04 | M0-01 → M7-04 |
| `CLAUDE.md` (describes the current code) | Rewritten at M0-01 to describe the monorepo and point to `plan/AGENTS.md`; the "current code" sections shrink as old code is deleted | M0-01, M7-07 |
| The three `*.zip` archives | Deleted (untracked, superseded by git) | M0-01 |

The product is not live, so there is **no data migration**: the database starts from the seed (DOC-14 §5.2).

## 4. Milestones

| Milestone | Outcome (demonstrable) | Days |
|---|---|---|
| **M0 Foundation** | One repo, one `pnpm dev`, CI green, contract package, the four backend spikes and two frontend spikes recorded | 19.5 |
| **M1 Backend core** | API with staff login, settings, media, full catalog, stock, search, shipping; seeded MySQL; public catalog endpoints answer | 39.5 |
| **M2 Design system** | `@noor/ui` with every component of DOC-04b in Storybook, accessible, RTL-checked | 14.5 |
| **M3 Admin core** | Staff sign in and manage products, catalog, content, settings, shipping, staff; audit log visible | 33.5 |
| **M4 Commerce backend** | Cart, promos, orders, payments, customers, notifications, reviews, dashboard data: the purchase path works through the API | 37.5 |
| **M5 Storefront** | A customer browses, searches, buys with cash on delivery, tracks and cancels, on a phone, with server-rendered pages | 34.5 |
| **M6 Admin commerce** | Staff confirm, dispatch, deliver, cancel and return orders; customers, promos, reviews, dashboard, shortcuts | 20 |
| **M7 Hardening** | Full end-to-end suite, accessibility and security passes, old code deleted, owner sign-off of the local build | 15 |
| **Total M0–M7** | | **214** |
| LAUNCH (production phase) | Hosting, deploy, backups, real data, go-live | not scheduled |

Order rationale: the backend slice comes before the screens that need it (ADR-0015: no mock mode). The admin catalog screens (M3) come before the storefront (M5) so real products exist to browse, and the commerce backend (M4) before both order-facing UIs. M2 can run in parallel with M1.

```mermaid
flowchart LR
  M0 --> M1 --> M3 --> M4 --> M5 --> M6 --> M7 --> LAUNCH
  M0 --> M2 --> M3
  M2 --> M5
  M4 --> M6
```

## 5. Backlog

### M0 — Foundation

| ID | Task | Docs | After | Days | Done when |
|---|---|---|---|---|---|
| M0-01 | Workspace: `pnpm-workspace.yaml`, `turbo.json`, root scripts, `.nvmrc`, `packageManager`; `git mv admin-panel apps/admin`; move `ecommerce-website` and `mock-api` to `legacy/`; delete zips and `render.yaml`; rewrite `CLAUDE.md` | DOC-03 §3, DOC-16 §3 | — | 2 | `pnpm dev` runs the old admin against `legacy/mock-api`; nothing else changed in behaviour |
| M0-02 | `packages/config`: `tsconfig.base.json`, ESLint flat config with feature/package boundaries, no-process-env, bare-TODO rule; Vitest preset | DOC-03 §4–5, ADR-0002, DOC-15 | M0-01 | 1.5 | Boundary fixture tests fail on a forbidden import |
| M0-03 | Local services: `docker-compose.yml`, `infra/mysql/init`, `scripts/setup-env.mjs`, `.env.example` files, readiness check in `pnpm dev` | DOC-14 §3–4 | M0-01 | 1 | Clean clone → DOC-14 §3.3 works on Windows |
| M0-04 | `packages/contract` v0: Zod 4 migration of `schemas.js` (codemod + fixes), `Money` helpers and rounding, `PkMobile`, error-code registry, `ApiError`, route-table types, `createClient`, page shapes | ADR-0005, ADR-0013, DOC-09.0 §6, DOC-10.0 | M0-02 | 3 | Money and phone unit tests pass (incl. the DOC-09.6 §6 numbers); package depends only on `zod` |
| M0-05 | `apps/api` skeleton + **spike 1**: config, logger, db pool, error handler, route registrar from the contract, `/healthz`, `/readyz`, OpenAPI snapshot; one public and one staff-stub route | DOC-08 §4, §6, §12–15 | M0-03, M0-04 | 2.5 | DOC-08 §15 `M0-API-SPIKE-1` recorded; startup fails on a route without a handler |
| M0-06 | **Spike 3**: Drizzle on MySQL 8.4 (`datetime(3)`, `json`, table `CHECK`, `FOR UPDATE [SKIP LOCKED]`, deadlock retry, generate + migrate, drift check) | DOC-08 §7, §15, DOC-14 §5.1, ADR-0008 | M0-05 | 1 | Result recorded in DOC-08 §18; fallbacks chosen where a feature is missing |
| M0-07 | **Spike 2**: `jobs` + `outbox_events` tables, claim loop with two workers, crash recovery, unique-key dedupe | DOC-08 §8–9, DOC-09.1 | M0-06 | 1.5 | 1,000 jobs, two workers, none run twice; result recorded |
| M0-08 | **Spike 4**: MinIO + imgproxy signed URLs, AVIF/WebP negotiation, `sharp` fallback path | DOC-08 §11, DOC-14 §3.2 | M0-03 | 0.5 | Result recorded; image tags pinned |
| M0-09 | CI workflow: `check`, `api-integration` (MySQL service), `security`, `pr-title`; branch protection | DOC-14 §6, DOC-13 §5, DOC-15 §3–6 | M0-05 | 1 | A PR with a failing test or a secret cannot merge |
| M0-10 | `packages/ui` skeleton: Tailwind v4, `tokens.css` with all four verified palettes, `cn`, Storybook 10 with a11y and RTL/dark toolbars, `check-contrast`, `check-logical` | DOC-04a | M0-02 | 2.5 | Both scripts pass; `@theme inline` and `--color-*: initial` confirmed (DOC-04a Q-04a-3) |
| M0-11 | **RTL spike**: Dialog, Drawer, Menu with submenu, Tabs, Combobox, Select, Tooltip on Base UI under `dir="rtl"` | DOC-04b §8, ADR-0007 | M0-10 | 0.5 | Table in DOC-04b §8 filled; any Radix fallback recorded in ADR-0007 |
| M0-12 | `apps/storefront` skeleton (React Router 8 framework mode, one SSR page, CSP headers, env validation) + `packages/i18n` (including `formatMoney`, `formatDate`, `formatNumber`; ADR-0013) + **i18n spike** | DOC-03 §5.2, §9–10, DOC-11 §5.3, ADR-0004 | M0-02, M0-10 | 2 | DOC-03 §9 spike result recorded; `curl` shows server-rendered HTML with a translated string |
| M0-13 | Repo scripts: `route-keys.mjs` (`ts-ratio.mjs` was built, then removed by ADR-0021); `dependency-cruiser` rules file for API modules | DOC-10.8 §6, ADR-0002, DOC-08 §5.1 | M0-05 | 0.5 | CI runs all three |

### M1 — Backend core

| ID | Task | Docs | After | Days | Done when |
|---|---|---|---|---|---|
| M1-01 | Platform: outbox emit + relay, job runner, scheduler, backoff, dead letter, in-process cache, idempotency helper, database rate-limit counters, ids, clock; tables of DOC-09.1 | DOC-08 §7–10, DOC-09.1 | M0-07 | 3 | DOC-08 §17 job and idempotency checks pass |
| M1-02 | `auth`: staff users, Argon2id, login throttle and lockout, sessions, CSRF, TOTP + recovery codes, invites and resets, step-up, role matrix, `requireSession`/`can`, CLI `owner:create` | DOC-11 §3–5, DOC-09.2, DOC-10.4 §2–4 | M1-01 | 5 | DOC-11 §13 auth items pass; DOC-10.4 §8 passes |
| M1-03 | `audit`: `record(tx)`, redaction, list/get endpoints, append-only guard, "every non-GET admin route audits" test harness | DOC-11 §6, DOC-09.2 §2.6, DOC-10.4 §5 | M1-02 | 1.5 | The harness fails for a route that forgets to audit |
| M1-04 | Security plumbing: helmet/CSP, exact-origin CORS, rate-limit buckets, internal key + forwarded IP, strict body schemas, route × role matrix test | DOC-11 §2, §5, DOC-10.0 §3–4, §11 | M1-02 | 2 | DOC-11 §13 header, CSRF and matrix items pass |
| M1-05 | `media`: upload tickets, presign, confirm, `media.process` job (magic bytes, limits, EXIF strip, LQIP), `imageUrl` signing, SVG sanitising or PNG-only decision | DOC-08 §11, DOC-09.3 §2, DOC-10.5 §3 | M1-01, M0-08 | 2.5 | A renamed HTML file is rejected and deleted |
| M1-06 | `settings`: five documents with validation, pages, menus, link validation, token resolution; public `store.getConfig`, `content.*`; admin endpoints | DOC-09.9 §2–3, DOC-10.1, DOC-10.7 §2–4 | M1-03, M1-05 | 3 | DOC-10.7 §8 and DOC-10.1 §6 pass |
| M1-07 | `shipping`: cities (seeded list), zones, methods, couriers, `quote`; admin endpoints; `shipping.listCities` | DOC-09.9 §4, DOC-10.7 §5, DOC-07.10 | M1-06 | 2.5 | A city is in at most one zone; city seed has ≥ 200 entries with provinces |
| M1-08 | `catalog` taxonomy: categories (tree, reorder, inherit filters), attributes and values (merge), size systems, size charts, form schemas; admin endpoints | DOC-09.3 §3–4, DOC-10.5 §5, §7 | M1-05 | 3 | Blocked deletes return `in_use` with counts |
| M1-09 | `catalog` products: products, options, values, variants (id-stable update), media links, collections, bundles, related, handle redirects, derived cache, publish checks, scheduled publish job, duplicate, preview link | DOC-09.3 §5–7, DOC-10.5 §2, §6, DOC-07.3 | M1-08 | 6 | DOC-09.3 §9 and DOC-10.5 §10 pass |
| M1-10 | `inventory`: levels, movements, reservations, `reserve/release/commit/restock/adjust`, consistency job, back-in-stock subscriptions | DOC-09.4, DOC-10.5 §4 | M1-09 | 2.5 | DOC-09.4 §6 passes (reserve tests use a stub order) |
| M1-11 | `search`: `product_search`, reindex job, synonyms seed, query builder, zero-result log | DOC-09.5 | M1-09 | 2 | DOC-09.5 §5 passes |
| M1-12 | Public catalog endpoints: listing with facets and cursor, detail, related, categories, collections, size charts, form schemas, sitemap entries | DOC-10.2 | M1-10, M1-11 | 3.5 | DOC-10.2 §8 passes |
| M1-13 | Seed: base, demo (fixtures converted to the new schema, demo images), `--perf` generator | DOC-14 §5.2, DOC-13 §11 | M1-12, M1-07 | 3 | `db:seed` idempotent; `--perf` builds 3,000 products in under 2 minutes (done) |

### M2 — Design system (parallel with M1)

| ID | Task | Docs | After | Days | Done when |
|---|---|---|---|---|---|
| M2-01 | Actions and form controls: Button, IconButton, LinkButton, Field, Input, Textarea, NativeSelect, Checkbox, RadioGroup, Switch, NumberInput, MoneyInput, PhoneInput, QuantityStepper, OptionChips | DOC-04b §2–4.2 | M0-11 | 4 | Stories per state, RTL and dark stories, axe clean |
| M2-02 | Overlays: Dialog, ConfirmDialog, Drawer, Popover, Menu, Tooltip, Toast, Select, Combobox | DOC-04b §4.3, §5 | M2-01 | 4 | Keyboard-map tests pass |
| M2-03 | Navigation, display, feedback: Tabs, Accordion, Breadcrumb, Pagination, LoadMore, Badge, StatusBadge, Card, Skeleton, Spinner, EmptyState, ErrorState, Table, Carousel, VisuallyHidden, Ltr, DirectionProvider | DOC-04b §4.4–4.5, §6 | M2-01 | 3 | Same |
| M2-04 | Data-aware pieces: Image (srcset from API `Image`), Price (with `@noor/i18n` `formatMoney`), shared Markdown renderer with the allow-list, `RHFField`, ImageUpload | DOC-04b §4.2, §4.5, DOC-06.8 §2, DOC-05 §3 | M2-01 | 2.5 | DOC-06.8 §6 renderer test passes |
| M2-05 | Component test pipeline in CI (Storybook addon-vitest, a11y on every story) | DOC-13 §2, §7 | M2-02 | 1 | A story with a contrast or label violation fails CI |

### M3 — Admin core

| ID | Task | Docs | After | Days | Done when |
|---|---|---|---|---|---|
| M3-01 | Admin shell in TypeScript: lazy router, API client, query client, `admin.me.get`, `useCan`, sidebar, top bar, theme toggle, sign-in, 2FA, invite, reset and forced-enrolment screens, 401/403 handling | DOC-07.1, DOC-03 §5.1, §7–8, DOC-05 §10 | M1-04, M2-02 | 4 | DOC-07.1 §9 passes (items not needing later screens) |
| M3-02 | `DataTable`, URL state, filters, selection, bulk bar, job polling, export download | DOC-07.14, DOC-05 §2 | M3-01, M2-03 | 4 | DOC-07.14 §8 passes on one real list |
| M3-03 | Products: list, editor (all sections and kinds), media upload, options and variant table, stock adjustment, publish checks, stale-write dialog, duplicate, preview | DOC-07.3 | M3-02, M1-10 | 8 | DOC-07.3 §12 passes (storefront item deferred to M5-04) |
| M3-04 | Catalog screens: categories tree, collections, attributes, sizes (systems, charts grid, custom-size forms) | DOC-07.4 | M3-02, M1-09 | 5 | DOC-07.4 §7 passes |
| M3-05 | Content: home page form, pages editor with shared Markdown preview, menus, `LinkField` | DOC-07.9 | M3-02, M1-06, M2-04 | 3.5 | DOC-07.9 §6 passes |
| M3-06 | Settings: store, appearance with live preview and contrast panel, shipping, payments, data (exports list) | DOC-07.10, DOC-07.11 | M3-02, M1-07 | 5 | DOC-07.10 §6 and DOC-07.11 §6 pass |
| M3-07 | Staff and roles, my account (password, 2FA, sessions, preferences), audit log screen and History panels | DOC-07.12, DOC-07.13 | M3-02, M1-03 | 4 | DOC-07.12 §8 and DOC-07.13 §7 pass |

### M4 — Commerce backend

| ID | Task | Docs | After | Days | Done when |
|---|---|---|---|---|---|
| M4-01 | `customers`: upsert by phone, counters, notes, flags, anonymise | DOC-09.7 §2, DOC-10.6 §3, DOC-11 §8.2 | M1-03 | 2 | DOC-07.6 §7 items provable by API pass |
| M4-02 | `promotions`: promos, targets, evaluation, redemption with row lock, preview | DOC-09.6 §3–4, DOC-10.6 §4 | M1-09 | 2.5 | DOC-09.6 §6 promo items pass |
| M4-03 | `cart`: carts, lines, line identity, `cart.price` (the one pricing implementation), quote, payment options, public cart endpoints | DOC-09.6, DOC-10.3 §2 | M4-02, M1-10, M1-07 | 4 | 100% coverage on pricing; DOC-09.6 §6 passes |
| M4-04 | `orders` create: counters, idempotency protocol, reservation, snapshot, tracking token, `orders.create`; the five ADR-0020 tests | ADR-0020, DOC-08 §7, DOC-09.1, DOC-09.7 §3, DOC-10.3 §3 | M4-03, M4-01 | 5 | The five tests pass 20 runs in a row |
| M4-05 | `orders` transitions, edit and events: transition table, stock effects, invoice numbers, `allowedActions`, risk markers, order edit with re-pricing | DOC-09.7 §5–6, DOC-09.4 §3 | M4-04 | 5 | DOC-09.7 §8 passes |
| M4-06 | `payments`: `cod` and `manual` adapters, record payment/refund, `payment_status` recompute, bank-transfer instructions path, provider interface with fake + webhook route skeleton | DOC-12 §2–3, DOC-09.7 §4–5 | M4-05 | 2.5 | DOC-12 §10 payment items pass |
| M4-07 | Public order endpoints: by token (masked), track with uniform failure and limits, cancel, switch to COD | DOC-10.3 §4, DOC-06.6, DOC-11 §9 | M4-05 | 2 | DOC-10.3 §7 passes |
| M4-08 | `notifications`: templates in `@noor/i18n`, routing, `log` and `smtp` channels, event handlers, order `notification` events | DOC-12 §4, §7, DOC-09.8 §3 | M4-05 | 2.5 | A full order life produces the expected `skipped` rows once each |
| M4-09 | `reviews`: invites on delivery, submit with photos, moderation, rating recompute | DOC-09.8 §2, DOC-10.3 §4, DOC-10.6 §5 | M4-05, M1-05 | 2 | DOC-09.8 §5 review items pass |
| M4-10 | Admin commerce endpoints: orders list/get/counts/notes/attempts/tracking/invoice, staff-created orders and quote, bulk, exports; customers; promos | DOC-10.6 | M4-06, M4-07 | 5 | DOC-10.6 §8 passes |
| M4-11 | `reporting`: nav counts, to-do, sales summary, top products, zero searches, global search, job status, system info, vitals and client-error intake, `sales_count` job | DOC-10.8, DOC-13 §8.5–8.6 | M4-10 | 3 | DOC-10.8 §8 passes |
| M4-12 | Performance and plans: query-plan test set, API latency guards on the `--perf` seed, coverage floors enforced | DOC-13 §5–6 | M4-11 | 2 | Budgets replaced by measured p95 × 1.5 (DOC-13 Q-13-2) |

### M5 — Storefront

| ID | Task | Docs | After | Days | Done when |
|---|---|---|---|---|---|
| M5-01 | Shell: root loader, theme injection with CSP hash, header, footer, menus, mobile drawer, announcement, redirects, canonical query handling, error and not-found pages, cache headers per class | DOC-06.1, DOC-04a §6, DOC-11 §5.3 | M0-12, M2-03, M1-06 | 4 | DOC-06.1 §8 passes |
| M5-02 | Home | DOC-06.2 | M5-01, M1-12 | 2 | DOC-06.2 §6 passes |
| M5-03 | Listings: category, collection, new, sale, search; ProductCard; filters (drawer and sidebar, no-JS form); sort; load more with position restore | DOC-06.3 | M5-01, M1-12 | 5 | DOC-06.3 §11 passes |
| M5-04 | Product page: gallery, buy box, every kind, stock states, size guide drawer, custom-size form, add to cart, deferred reviews and related, recently viewed | DOC-06.4 | M5-03, M4-03 | 5.5 | DOC-06.4 §12 passes; DOC-07.3 §12 storefront item passes |
| M5-05 | Cart: `/cart` actions (with and without JS), drawer, promo, optimistic quantity, undo remove, header badge | DOC-06.5 §2–3, DOC-05 §9 | M5-04 | 3 | Cart items of DOC-06.5 §6 pass |
| M5-06 | Checkout: form, city combobox, live quote, payment options, idempotency key, conflict handling, draft, no-JS path | DOC-06.5 §4 | M5-05, M4-04 | 4 | DOC-06.5 §6 passes |
| M5-07 | Order page, track, cancel, WhatsApp links, review form | DOC-06.6 | M5-06, M4-07, M4-09 | 3 | DOC-06.6 §8 passes |
| M5-08 | Wishlist and cookie handling | DOC-06.7 | M5-03 | 1 | DOC-06.7 §6 passes |
| M5-09 | CMS pages, contact page, size guide | DOC-06.8 | M5-01 | 1.5 | DOC-06.8 §6 passes |
| M5-10 | SEO: `buildMeta`, JSON-LD helpers, sitemap, robots, noindex rules, OG tags | DOC-06.9 | M5-04 | 2.5 | DOC-06.9 §10 passes (manual Rich Results check recorded) |
| M5-11 | Performance: image and font rules, bundle budget script, Lighthouse CI, `web-vitals` reporting; adjust budgets once from the first real build | DOC-06.10, DOC-13 §6.1 | M5-07 | 3 | DOC-06.10 §11 passes |

### M6 — Admin commerce

| ID | Task | Docs | After | Days | Done when |
|---|---|---|---|---|---|
| M6-01 | Orders: list with tabs and card view at 360 px, detail, all action dialogs, confirmation log, WhatsApp/call buttons, print view, bulk actions | DOC-07.5 | M3-02, M4-10 | 7 | DOC-07.5 §8 passes |
| M6-02 | Customers and staff-created orders | DOC-07.6 | M6-01 | 3.5 | DOC-07.6 §7 passes |
| M6-03 | Promo codes | DOC-07.7 | M3-02, M4-10 | 2 | DOC-07.7 §6 passes |
| M6-04 | Reviews moderation | DOC-07.8 | M3-02, M4-09 | 1.5 | DOC-07.8 §5 passes |
| M6-05 | Dashboard | DOC-07.2 | M4-11, M6-01 | 2.5 | DOC-07.2 §8 passes |
| M6-06 | Shortcuts, help sheet, command palette | DOC-07.15 | M6-02 | 2.5 | DOC-07.15 §8 passes |
| M6-07 | Remove the old admin: delete remaining `.jsx` screens, `lib/db.js`, `useCollection`, old `lib/api.js`, Radix packages, global CSS; admin is 100% TypeScript | ADR-0002, ADR-0007, DOC-16 §3 | M6-06 | 1 | `grep -r "@radix-ui\|apiEnabled\|localStorage" apps/admin/src` matches only `lib/prefs.ts` |

### M7 — Hardening and local sign-off

| ID | Task | Docs | After | Days | Done when |
|---|---|---|---|---|---|
| M7-01 | End-to-end suite: all 17 journeys, smoke set on WebKit, axe on visited pages | DOC-13 §4, §7 | M6-06, M5-11 | 4 | All pass in CI |
| M7-02 | Accessibility manual passes (NVDA, TalkBack), fixes | DOC-13 §7, §9 | M7-01 | 2.5 | Recorded in DOC-13 §12 with no open blocker |
| M7-03 | Security review against the OWASP list and DOC-11 §13; fix findings | DOC-11 §11–13 | M7-01 | 2 | Every DOC-11 §13 box ticked in the PR |
| M7-04 | Delete `legacy/` (old storefront and mock API) | DOC-16 §3 | M7-01 | 0.5 | Repo contains only `apps/`, `packages/`, `plan/`, `infra/`, `scripts/` |
| M7-05 | Content: drafted privacy, terms, shipping and returns pages (A-09); base seed reviewed; real store settings entered (contact, WhatsApp, policies) | DOC-06.8 §3, DOC-14 §5.2 | M5-09 | 1.5 | Owner has read the four pages |
| M7-06 | Real-device purchase on a mid-range Android phone on throttled data; fix findings | DOC-13 §9, DOC-06.10 | M7-01 | 1.5 | Recorded in DOC-13 §12 |
| M7-07 | Documentation close-out: `CLAUDE.md` and `AGENTS.md` describe the finished repo; every doc's checklist reviewed; ADRs moved from Proposed to Accepted by the owner; spike results and open questions updated | README §6, DOC-02 | M7-04 | 1.5 | No doc refers to deleted code |
| M7-08 | Owner walkthrough of the complete local product against DOC-06 and DOC-07; sign-off or a fix list | all | M7-05, M7-06, M7-07 | 1.5 | Sign-off recorded in README changelog. **This closes the local build** |

### LAUNCH — production phase (not scheduled; started by the owner after M7-08)

| ID | Task | Docs | After |
|---|---|---|---|
| LAUNCH-01 | Answer README CQ-2; measure latency from Karachi and Lahore for candidate regions; choose host, managed MySQL, object storage, CDN; amend ADR-0019 | DOC-14 §8 | M7-08 |
| LAUNCH-02 | Dockerfiles verified, registry, staging environment, secrets, MySQL flags, database users | DOC-14 §4, §7–8 | LAUNCH-01 |
| LAUNCH-03 | Deploy pipeline: staging on merge, production on tag with approval, smoke set after deploy | DOC-14 §8.1 | LAUNCH-02 |
| LAUNCH-04 | Backups, off-site dump, restore rehearsal recorded | DOC-14 §9 | LAUNCH-02 |
| LAUNCH-05 | Domain `rubaya.pk`: DNS for `www`, `admin`, `api`, `img`; TLS; HSTS after verification; CDN cache rules and purge adapter | DOC-14 §8, DOC-11 §5.3 | LAUNCH-02 |
| LAUNCH-06 | Email: provider, SPF/DKIM/DMARC, staff notification addresses | DOC-12 §7 | LAUNCH-05 |
| LAUNCH-07 | Metrics export, alerts, uptime checks, error tracker | DOC-13 §8 | LAUNCH-02 |
| LAUNCH-08 | Real data: products with photos, categories, delivery cities and fees, couriers and tracking link patterns, first owner and staff accounts | DOC-07 | LAUNCH-02 |
| LAUNCH-09 | Load test at 3× expected peak; tune pool sizes and instance counts | DOC-13 §6.5, DOC-14 R-8 | LAUNCH-03 |
| LAUNCH-10 | Legal: owner (or adviser) review of privacy, terms and data handling | DOC-11 Q-11-1, README A-09 | M7-05 |
| LAUNCH-11 | Go-live checklist: `noindex` removed on production only, sitemap submitted, test order end to end with a real phone, runbooks filed | DOC-06.9, DOC-14 §11 | all above |

### After launch (unordered candidates, each needs its trigger and usually an ADR amendment)

| Item | Trigger | Docs |
|---|---|---|
| Online payments (aggregator or JazzCash/Easypaisa) | Owner has a merchant account | DOC-12 §3.4, §8 |
| WhatsApp Business API and reply-to-confirm | More than 50 orders/day or confirmation delays over 2 h | DOC-12 §4.2 |
| Courier booking and status sync | More than 30 dispatches/day | DOC-12 §5.2 |
| GA4 and Meta Pixel with consent | Owner runs ads | DOC-12 §6.2 |
| Urdu storefront | Urdu launch date set | ADR-0018 |
| Customer accounts (phone + OTP) | Repeat customers over 25% of orders | DOC-06.7 §2 |
| Home page built from templates | Owner reorders sections repeatedly | DOC-06.2 §2 |
| Storefront dark mode | DOC-04a §6 trigger | DOC-04a |
| Meilisearch | Zero-result rate over 8% | ADR-0010 |
| Phone OTP at checkout | COD refusal over 20% | DOC-06.5 Q-06.5-4 |

## 6. Audit findings → tasks

Every Critical and High finding of DOC-01, and the eleven verified claims, map to the task that removes it (DOC-01 §8).

| Finding | Removed by |
|---|---|
| K1 two token systems | M0-10, M2-01…03 |
| K2 contract copied by hand | M0-04 |
| K3 duplicated hooks, clients, storage layers | M0-04, M3-01, M6-07 |
| K4 float rupees in the storefront | M0-04, M4-03, M5-04…06 |
| K5 no lazy loading or virtualization | M3-01, M3-02 |
| K6 sequential bulk actions | M3-02, M4-10 |
| K7 client-rendered storefront | M0-12, M5-01…10 |
| K8 shared admin key, no login | M1-02, M1-04, M3-01 |
| K9 order numbers | M4-04 |
| K10 stock decrement | M1-10, M4-04, M4-05 |
| K11 no idempotency | M1-01, M4-04, M5-06 |
| F-01 client sets its own total | M4-03, M4-04 |
| F-02 promos unvalidated | M4-02, M4-03 |
| F-03 admin overwrites orders | M4-05, M4-10, M6-01 |
| F-04 random invoice numbers | M4-05 |
| F-05 shipping rule hard-coded | M1-07, M4-03, M5-06 |
| F-06 phone and city free text | M0-04, M1-07, M5-06 |
| F-07 tracking brittle and enumerable | M4-07, M5-07 |
| F-08 made-to-order rules unenforced | M4-03, M5-04 |
| F-09 admin data never reaches the storefront | M1-06…12, M3 |
| F-10 storefront drops the domain model | M1-12, M5-04 |
| F-11 dual-mode code paths | M3-01, M5-01, M6-07 |
| F-12 unpaginated catalog | M1-12, M5-03 |
| F-13 whole collection as one blob | M1 (database) |
| F-14 ad hoc errors | M0-04, M0-05 |
| F-15 zod version skew | M0-04 |
| F-16 no auth, roles, audit | M1-02, M1-03 |
| F-17 uploads trusted by header | M1-05 |
| F-18 no rate limits, headers, CORS `*` | M1-04 |
| F-19 `trust proxy` hard-coded | M0-05 |
| F-20 storefront without React Compiler | M0-12 |
| F-21 render-blocking Google Fonts | M0-10, M5-11 |
| F-22 not RTL-ready | M0-10, M0-11, M0-12 |
| F-23 almost no tests, no CI | M0-09, every task, M7-01 |
| F-24, F-25 hard-coded CMS pages and contact copy | M1-06, M5-09 |

## 7. Working agreement for each task

1. Read AGENTS.md and the task's "Docs" sections.
2. Answer the five "before writing code" questions (AGENTS.md §5).
3. Contract first, then server, then client (where the task spans them).
4. Tests at the lowest layer that proves each requirement (DOC-13 §2).
5. `pnpm check` green; PR per DOC-15 §5 citing the task id, doc sections and findings fixed.
6. If the doc was wrong or silent, fix the doc in the same PR.
7. Tick the task in §8.

## 8. Progress

| Milestone | Tasks | Done |
|---|---|---|
| M0 | 13 | 12 (all but M0-08, which is skipped with Docker; M0-03, M0-06 and M0-07 finished 4 Oct 2026) |
| M1 | 13 | 13 (M1-01 to 13, milestone done) |
| M2 | 5 | 5 (M2-01 to 05, milestone done) |
| M3 | 7 | 2 (M3-01, M3-02) |
| M4 | 12 | 0 |
| M5 | 11 | 0 |
| M6 | 7 | 0 |
| M7 | 8 | 0 |

Updated by the PR that finishes a task.

## 9. Rules

**Always:** take the next unblocked task in order; keep the old app runnable until its replacement is merged; record spike results before building on them; re-estimate the remaining milestones from actuals at the end of each one.
**Never:** start a screen before its API exists (no mock mode); start a `LAUNCH` task before M7-08 unless the owner says so; skip a spike; let a milestone close with a failing acceptance item (move the item to a named follow-up task instead and say so in the progress table).
**Common mistakes:** building the storefront before real products can be created in the admin; treating day estimates as dates; carrying old code forward "for now" past its deletion task.

## 10. Acceptance checklist

- [ ] Every Critical and High finding of DOC-01 appears in §6 with a task.
- [ ] Every task cites at least one doc section and has a "done when".
- [ ] No task depends on a later task (the `After` column forms no cycle and points only upward or to an earlier milestone).
- [ ] Milestone day totals in §4 equal the sum of their tasks.
- [ ] The progress table is current.

## 11. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-16-1 | Team | The owner working with an AI coding agent; README A-01 assumed 2–3 developers and A-05 a 12-week MVP. The totals here are effort, not calendar time; with one developer M0–M7 is substantially longer than 12 weeks | Owner states the real team and weekly hours → convert days to dates |
| Q-16-2 | Estimates | Unmeasured. First correction after M0 | End of each milestone |
| Q-16-3 | Old admin stays usable during M0–M2 | Yes, against `legacy/mock-api`, with no new features added to it | It breaks → freeze it rather than fix it |
| Q-16-4 | Reducing scope if needed | Candidates to defer without breaking the launch path: reviews (M4-09, M6-04, part of M5-07), bundles, custom-size forms, command palette, collections' publish windows, appearance editor (ship the preset only) | Owner wants an earlier finish |

## 12. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 6) |
| 2026-10-02 | Phase 7 consistency review: route key `admin.me.get` |
| 2026-10-02 | M0-01 started. Deviations: the `*.zip` archives are git-ignored instead of deleted (they are the owner's untracked files); `.nvmrc` is 24 (installed Node is 24.14) |
| 2026-10-02 | M0-02 done: `packages/config` (tsconfig base, ESLint pieces, Vitest preset, 7 fixture tests). `.gitattributes` added (LF) |
| 2026-10-02 | M0-04 done with a narrower scope than written: `packages/contract` v0 holds the foundation (money, phone, enums, permissions, error registry with HTTP status per code, ApiError, pagination/query helpers, shared pieces Image/Swatch/FormSchema/ThemeTokens/LineCustomization, route-table types, typed client). Entity schemas (Product, Order, Promo, Settings ...) are NOT migrated from the old `schemas.js`: DOC-10 redefines them, so each is written with the first endpoint that uses it (M1-xx, M4-xx) |
| 2026-10-02 | M0-12 now names `formatMoney` explicitly (it is not in the contract) |
| 2026-10-02 | M0-05 done (spike 1 recorded in DOC-08 section 19). Scope note: the database pool is part of M0-06, so `/readyz` takes an injected check until then; rate limit, helmet, CORS and sessions stay in M1-04 and M1-02 |
| 2026-10-02 | M0-09 and M0-13 done as workflow files and scripts. M0-09: `.github/workflows/ci.yml` (check, security, pr-title) and the PR template exist but have never run: they need a push to GitHub and branch protection set in the repository settings (owner action). `api-integration` joins with the first MySQL test (M0-06). M0-13: `route-keys.mjs` and `ts-ratio.mjs` done; the dependency-cruiser rules move to M1-01 because they can only be tested against real modules. M0-08 is skipped (no Docker) |
| 2026-10-02 | M0-10 done: `packages/ui` (tokens.css, cn, contrast, themeCss, 215 tests, Storybook 10 with brand/scheme/direction toolbars and one token story, built and checked in a browser) and `scripts/check-logical.mjs` (engine and 27 tests in `packages/config`) |
| 2026-10-02 | M0-11 done: RTL spike passes on Base UI (Select needs `alignItemWithTrigger={false}`); results in DOC-04b §8 |
| 2026-10-02 | M0-12 done: `packages/i18n` (10 tests) and `apps/storefront` skeleton (React Router 8.4, one SSR page in en and ur, CSP and security headers, env validation at boot, 10 tests); I18N spike answered in DOC-03 §9 |
| 2026-10-02 | M2-01 done: 16 form and action components in `@noor/ui` with stories (default, states, RTL, Dark), axe clean on all 14 stories; keyboard-map interaction tests wait for M2-05 |
| 2026-10-02 | M2-02 done: Dialog, Drawer, ConfirmDialog, Popover, Menu, Tooltip, Toast, Select, Combobox; 28 keyboard-map tests (jsdom) pass; axe clean on 10 overlay stories |
| 2026-10-02 | M2-03 done: Tabs, Accordion, Breadcrumb, Pagination, LoadMore, Badge, StatusBadge, Card, Skeleton, EmptyState, ErrorState, Table, Carousel, VisuallyHidden, Ltr, Link; 19 tests; axe clean |
| 2026-10-02 | M2-04 done: Image, Price, Markdown (allow-list, tokens), RHFField, ImageUpload; 20 tests including the DOC-06.8 §6 renderer test; axe clean |
| 2026-10-02 | M2-05 done: `test/stories.a11y.test.tsx` runs axe over all 35 stories (a story with a label violation fails `pnpm test`); `@noor/ui` is complete except the pieces later milestones add (submenus, feature components). M2 finished |
| 2026-10-02 | M0-03 partly done in its no-Docker form: env and SQL scripts exist; the database users are not created yet (needs the MySQL administrator password) and the `pnpm dev` readiness check waits for M0-06 |
| 2026-10-04 | **Language change (ADR-0021):** the owner chose JavaScript over TypeScript; all code built in M0 and M2 was converted to JavaScript with JSDoc types (113 files). `pnpm typecheck` is `tsc --checkJs`. Checks all still green (contract 53, i18n 10, api 24, config 32, ui 307, storefront 10 tests). In every task row, `.ts`/`.tsx` means `.js`/`.jsx` |
| 2026-10-04 | M0-06 and M0-07 prepared without a database: Drizzle schema for outbox_events, jobs, jobs_dead, counters (`apps/api/src/db/schema/platform.js`, first migration generated offline, `ascii_bin` columns via a custom type because Drizzle 0.45 has no per-column collation), `platform/{db,ids,jobs}.js` (pool, deadlock retry, UUIDv7, claim/complete/fail with `.for('update', { skipLocked: true })`), spike scripts `spike:drizzle` and `spike:jobs`. They run once MySQL and the database users exist |
| 2026-10-04 | **M0 done.** MySQL 8.4.11 set up on port 3307; the platform migration applied; M0-06 (9/9) and M0-07 (7/7) pass and are recorded in DOC-08 §18. Bug found by M0-06: Drizzle wraps MySQL errors, hiding deadlocks from the retry helper (fixed, tested). Next: M1 (backend core), starting with M1-01 |
| 2026-10-04 | M1-01 done: `platform/{clock,cache,outbox,jobs,worker,scheduler,runtime,idempotency,rate-limit,counters}.js`, tables `idempotency_keys` and `rate_limit_hits`, `src/worker.js`. 61 API tests (26 against real MySQL: two workers never run a job twice, deadlock-free claiming, crash takeover, outbox atomicity, idempotency replay/mismatch/in-progress/takeover, 50 concurrent order numbers without a gap, rolled-back numbers return, rate-limit windows, hashed subjects). Next: M1-02 (auth) |
| 2026-10-04 | M1-02 done: `modules/auth` (roles matrix, Argon2id passwords and blocklist, AES-GCM sealed TOTP secrets, TOTP with replay protection, recovery codes, hashed sessions with idle/absolute/step-up rules, throttling and lockout escalation, invites/resets, 2FA enrolment, staff management with owner guard rails), `modules/audit` (record + redaction), 32 contract routes, `@fastify/cookie`, Origin/CSRF/step-up enforcement, `cli owner:create`. 110 API tests (34 through HTTP on real MySQL). Next: M1-03 (audit endpoints and the database privilege split) and M1-04 (security plumbing)
| 2026-10-04 | M1-03 done: `admin.audit.list` / `admin.audit.get` (cursor, filters, text search, summary, IP masked for non-owners, secrets shown as `[redacted]`), migration `0002` with append-only triggers (they test `USER()`; `CURRENT_USER()` inside a trigger is the definer, so the first version never fired), failed sign-ins now record the email tried, and `test/audit.int.test.js` (31 tests): one sample per non-GET admin route plus a table-driven check that a new route needs a sample or a written exemption. `admin.audit.export` waits for the exports table. Next: M1-04 (security plumbing) |
| 2026-10-04 | M1-04 done: `platform/http/security.js` (API headers, exact-origin CORS with preflight for `/admin/*` only, Origin check, `clientIp` with the `INTERNAL_KEY` rule), `platform/http/rate-limit.js` (every bucket of DOC-11 §5.4, memory and database stores, `RateLimit-*` and `Retry-After`), staff authentication and limits now run in `onRequest` (a stranger gets 401 before the body is validated), startup fails on an unknown bucket name. Tests: `test/security.test.js` (16), contract `strict-bodies` (every body schema closed at every depth), route x role and route x stranger matrices over the whole contract in `auth.int.test.js`. Not done here: Storefront and admin-host headers (M3-01, M5), `orders.create` mass-assignment and `orders.track` limit checks (they need those routes, M1-0x). Next: M1-05 |
| 2026-10-04 | M1-05 done (local storage, no M0-08): table `media` (+ `confirmed_at`, migration 0003), contract `media.js` (5 routes, `content:write`), `platform/storage.js` (local driver; HMAC-signed upload links, key shape check) and `platform/http/storage-routes.js` (`PUT /api/v1/_dev/uploads/*`, `GET /img/*` for generated sizes only), `modules/media` (magic-byte check, declared-type match, 8000 px limit, `sharp` re-encode without metadata, six widths in WebP and JPEG, LQIP, jobs `media.process` / `media.purge` / `media.cleanup`), `backgroundOf()` shared by `main.js` and `worker.js`, `sharp` added to the API. Decisions: images only (no SVG, no video yet), S3 driver and imgproxy deferred to deployment, `STORAGE_DRIVER=local` refused in production. 21 media tests. Env: `INTERNAL_KEY` (DOC-14 said `INTERNAL_API_KEY`; docs renamed). Next: M1-06 |
| 2026-10-04 | M1-06 done: contract `settings.js` + `content.js` (26 routes: five documents, theme presets, translation status, pages, menus, link search, `store.getConfig`, `content.getHome/getMenu/getPage/listPages`), route flag `cache: 'shared'`, the contrast gate (`contrastFailures`, `deriveColors`, `resolveColors`) and the link rule (`isValidLink`, `safeHref`) moved from `@noor/ui` into `@noor/contract` (ui re-exports them), tables `settings`, `pages`, `page_redirects`, `menus` (migration 0004), `modules/settings` (defaults at version 0, optimistic versions, field-level audit diffs via `diffOf`, outbox `settings.updated` / `content.updated` with cache tags, media readiness check and media-in-use guard, token resolution, time windows, Urdu overlay with English fallback, menu liveness). 23 settings tests + route x role and audit harness extended. Not here: shipping facts and cities (M1-07), catalog link targets (M1-08/09), product translation counts, seeding of the locked pages (M1-13). Next: M1-07 |
| 2026-10-04 | M1-07 done: contract `shipping.js` (13 admin routes) and the real `shipping.listCities`; tables `cities`, `shipping_zones`, `shipping_zone_cities` (city id is the whole primary key), `shipping_methods` (CHECKs on fee and ETA), `couriers` (migration 0005); `modules/shipping` (zones saved whole with method matching by id and city moves in one transaction, `no_deliverable_city` guard, impact preview, paste-a-list matching, couriers, `quote`, `facts()` feeding `store.getConfig` and the `{{shipping.*}}` page tokens, `seedShipping` with 242 cities and 6 couriers). 18 shipping tests; audit harness extended. Not here: open-cart count (needs carts), orders' fee snapshots (M4). Next: M1-08 |
| 2026-10-04 | M1-08 done: contract `taxonomy.js` (22 routes: categories, attributes with values and merge, size systems, size charts, custom-size forms), tables `categories`, `attributes`, `attribute_values`, `category_attributes`, `size_systems`, `size_system_values`, `size_charts`, `form_schemas`, `handle_redirects` (migration 0006), `modules/catalog` (tree depth and cycle rules, sibling reorder, filter inheritance, fixed yes/no and number values, id-stable value and size edits, optimistic versions, `in_use` with counts, audit diffs, cache tags). Product counts come through a `usage` seam that M1-09 fills in (the foreign keys already refuse). `media/repository.readyIds` is now shared. 17 taxonomy tests; audit harness extended. Not here: collections (M1-09, with products), page redirects still use `page_redirects` rather than `handle_redirects`. Next: M1-09 |
| 2026-10-04 | M1-09 done: contract `products.js` (14 routes), tables `products`, `product_categories`, `product_media`, `product_options`, `product_option_values`, `variants`, `variant_option_values`, `product_attribute_values`, `collections`, `collection_products`, `bundle_items`, `product_related` (migration 0007; CHECKs and unique keys as in DOC-09.3), `catalog/products.js` (whole-document save with id-stable options and variants, validation with all issues at once, publish checks shared by save / checks endpoint / list flag, `recomputeProductCache`, handle redirects, duplicate, preview links, delete, job `catalog.publish_scheduled`), `catalog/collections.js`, `catalog/usage.js` (real counts for the structure screens). 22 product tests. Left for later and recorded in DOC-10.5: bulk, export, import, `initialStock`, `onHand`/`reserved`, quantity sort, `hasIssues` filter (inventory M1-10 and the product screens M3-03). Next: M1-10 |
| 2026-10-04 | M1-10 done: contract `inventory.js` (`admin.inventory.adjust`, `listMovements`, `initialStock` on create), tables `inventory_levels` (CHECK on_hand/reserved), `inventory_movements`, `reservations`, `stock_subscriptions` (migration 0008; order FKs wait for M4), `modules/inventory` (`reserve` with per-variant aggregation and ascending lock order, `release`, `commit`, `restock` incl. the damaged pair, `editReserved`, `adjust`, outbox `inventory.changed` / `variant.back_in_stock`, products' cached stock status refreshed in the same transaction, jobs `inventory.expire_reservations` every 5 min, `inventory.verify` nightly (reports, never repairs), `inventory.cleanup_subscriptions`, subscriptions with retention). The catalog's `stock` seam is now real: variants read `onHand`, `reserved` and a true stock status. 24 inventory tests incl. 50 concurrent buyers for one unit and opposite-order deadlock check. Next: M1-11 |
| 2026-10-05 | M1-11 done: tables `product_search` (FULLTEXT on title and on title + body, stopwords off at index creation), `search_synonyms`, `search_misses` (migration 0009), `modules/search` (query builder with operator stripping and synonym groups, per-product and full reindex, SKU-first lookup, listing predicates, miss log with Karachi days and phone filtering, 5-minute synonym cache), events `product.updated` and `catalog.structure_changed` mapped to reindex jobs by the new shared `eventHandlers`, schedule `search.cleanup_misses`. 21 search tests incl. every DOC-09.5 section 5 item (EXPLAIN uses the FULLTEXT index). Also fixed: the storefront dev server could not resolve the `~/` alias (`resolve.tsconfigPaths`). Next: M1-12 |
| 2026-10-05 | M1-12 done: contract `catalog-public.js` (12 public routes: `catalog.listProducts` with facets, price presets and keyset cursors, `getProduct` with redirects and preview tokens, `listRelated`, categories, collections, size charts, form schemas, `subscribeBackInStock`, `seo.listSitemapEntries`), `catalog/public-listing.js` (one filter builder for items, total and facets), `catalog/public.js`, `search.predicate()`; the route registrar now gives handlers `limit()` (rate-limit rules that need a value the route knows, e.g. a phone) and `http.setHeader()`. 30 tests covering DOC-10.2 section 8 except the 3,000-product timing (needs the M1-13 perf seed) and reviews (own module). Next: M1-13 |
| 2026-10-05 | M1-13 done (M1 complete): `apps/api/src/seed/` (`base`, `owner`, `demo`, `perf`, `index.runSeed`) and CLI `db:seed [--base-only] [--no-demo] [--perf]`; `modules/services.js` `createServices` wires every service for the app, the worker and the seed. Base is idempotent and never overwrites staff edits; production accepts only `--base-only`; the demo shop (24 products, 8 categories, 3 collections, generated pictures) is built through the services; `--perf` adds 3,000 products / 25,000 variants in 80 s in total. Measuring the listing on that database found a 500 ms size facet (join over every variant), so the new derived table `product_sizes` (migration 0010, written by `recomputeProductCache`) now serves the size filter and facet, and the facet counts run concurrently: the slowest single query is 45 ms, the whole call 70–150 ms, 3–4 kB gzip. `test/seed.int.test.js` (8 tests) and a size-index test; vitest `hookTimeout` 60 s for scratch-database setup. Not verified: the perf seed on CI hardware, orders in the perf data (M4). |
| 2026-10-05 | M3-01 done (in JavaScript, ADR-0021): `apps/admin` is the new shell (React Router 8 data router, TanStack Query, `@noor/ui`, Tailwind). `lib/` (typed client with CSRF header, query client, session `useMe`/`useCan`/`requireMe`/`useLogout`, prefs, `screens.js` = every URL with its permission, drives router and sidebar), `components/` (app shell, sidebar, top bar, page header, route error), `features/auth/` (sign-in, code, reset, invite, forced two-step set-up with QR), `routes/` (thin lazy modules; unbuilt screens share `soon.jsx`). Shell is lazy so sign-in does not carry menus. New in the packages: `Drawer side="start"`, `@noor/i18n/staff` (no ICU, English only), `passwords_differ` message, lint rule now allows `@hookform/resolvers/zod`. 35 admin tests (router gate, permissions, set-up flow) + 77 old. Checked by hand against the real API: sign-in, forced set-up with a real authenticator code, recovery codes, shell. Not verified: the code-entry sign-in against the real API in a browser, the user menu with a real mouse click (the Browser pane was hidden), the 200 kB budget (206.8 kB on sign-in). Old admin moved to `apps/admin/old/` (`pnpm --filter @noor/admin dev:old` on :5175 with the mock API); root `pnpm dev` now starts the new admin and the real API |
| 2026-10-05 | M3-02 done: `components/data-table.jsx` (+ `list-filters.jsx`, `bulk-bar.jsx`), `lib/list-params.js` (address <-> list params with the route's own Zod query schema; invalid values dropped), `lib/download.js`. First real list: `/products` (`features/products`) against `admin.products.list`, checked in the browser on the 24 seeded products (search, sort and size restored from the address). Selection survives paging and is dropped on a new search or filter; one bulk request, mixed results keep the failed rows selected, jobs are polled every 2 s. 19 DataTable tests with a fake server. Decisions: no TanStack Table and no virtualisation (DOC-07.14 section 2 updated). Not built: bulk and export endpoints and `admin.jobs.get` (the table is tested with fakes; the endpoints come with M3-03 and M4), card layout, the async filter, column resizing |
