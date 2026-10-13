# 13 — Quality

| Field | Value |
|---|---|
| 2026-10-13 | M7-01 built (`apps/e2e`): the 17 journeys as Playwright tests against the built storefront and admin, a real API and a scratch database (`rubaya_test_e2e`), with axe (WCAG 2.2 AA) on the pages of E2E-01, 08, 09, 10, 11, 14, 15 and 16. Differences: JavaScript, not TypeScript; the browser is the Chrome of the machine (`E2E_CHANNEL=chromium` for the downloaded one); the WebKit smoke set is configured and not yet run; **E2E-11 and E2E-12 needed a bulk product action that the plan listed (`admin.products.bulk`, DOC-10.5) and nobody had built: it is built now**; E2E-16 switches Urdu on through Settings, Store, Languages and turns the admin to `dir="rtl"` by script (the admin has no Urdu); E2E-13 waits up to 30 s for the shop to read the saved theme (its settings cache). The suite found a stray word "return" drawn at the top of every category and collection page (a mistake of M5-10) and the shop counting every customer as one address (see DOC-16 M7-09): both fixed |
| 2026-10-13 | M7-02 prepared: `tests/18-accessibility-sweep.spec.js` scans every storefront and admin screen (18 storefront pages, the cart and the checkout with its errors, the order page, 22 admin screens, an order, the command palette, a side panel, the sign-in screens) with axe and the storefront at 320 px for sideways scroll. It found one thing: at 320 px every storefront page scrolled 5 px sideways because of the header (fixed: the logo's margin). Section 12.1 is the script for the screen-reader passes; they are not done |
| ID | DOC-13 |
| Title | Testing pyramid, CI gates, performance budgets, accessibility, observability |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-03 … DOC-12, DOC-14 §6, DOC-15 §6 |
| Decisions used | ADR-0002, ADR-0004, ADR-0006, ADR-0007, ADR-0009, ADR-0010, ADR-0013, ADR-0018, ADR-0020 |

## 1. Purpose and scope

**Governs:** what is tested and how, which checks block a merge, the budgets a build must meet, the accessibility standard and how it is verified, and what the running system reports about itself.
**Does not govern:** pipeline wiring (DOC-14 §6), the checks' authoring rules (each owning doc's acceptance checklist), production alert routing (decided with the host in the production phase, README A-08).

Replaces today's state (F-23): about 67 unit cases in two admin files, none in the storefront, no CI.

The acceptance checklists at the end of every doc are the **requirements**; this document says which kind of automated check proves each kind of requirement.

## 2. Test types

| Layer | Tool | Runs against | What belongs here | Speed target |
|---|---|---|---|---|
| Unit | Vitest | Pure functions, no I/O | Money helpers and rounding, promo evaluation, pricing computation, state-machine tables, slug/phone normalisation, theme contrast and `themeCss`, cursor encode/decode, masking, permission matrix, Markdown allow-list, CSV escaping | < 10 s per package |
| Contract | Vitest | `@noor/contract` | Every schema parses its fixture; route table invariants (each route has auth; staff routes have a permission; error codes registered); OpenAPI snapshot | < 10 s |
| API integration | Vitest + real MySQL 8.4 | `buildApp()` with `app.inject`, one database per test file | Every endpoint: happy path, validation, auth/permission, domain errors; transactions, locking and concurrency; outbox and jobs; audit rows | < 3 min total |
| Component | Vitest + jsdom + Testing Library + user-event; Storybook portable stories (`composeStories`) + `axe-core` | `@noor/ui` and app feature components | Every story renders and passes axe (`test/stories.a11y.test.jsx`, finds stories with a glob, so a new story is covered with no registration); keyboard maps (DOC-04b §5); RTL story. Colour contrast is not checked here (jsdom has no layout): the token contrast gate covers every token pair, and the Storybook a11y panel covers composed stories in a browser | < 2 min |
| End-to-end | Playwright (Chromium; WebKit for the smoke set) | Built storefront + admin + API + seeded MySQL | The journeys in §4 | < 6 min |
| Performance (lab) | Lighthouse CI; bundle-size script | Built storefront, seeded | Budgets of DOC-06.10 §2 | < 4 min |
| Query plans | Vitest + `EXPLAIN` | Seeded 3,000-product database | The query set in §6.3 uses indexes | < 30 s |
| Static | `tsc --checkJs` (types are JSDoc), ESLint, `dependency-cruiser`, `check-logical`, contrast gate, gitleaks, `pnpm audit` | Source | Types, boundaries, tokens, secrets, known vulnerabilities | < 2 min |

Proportions follow the pyramid: many unit and integration tests, a small end-to-end set. A behaviour is tested at the **lowest** layer that can prove it; an end-to-end test never re-proves a rule an integration test covers.

Not used: snapshot tests of rendered component markup (brittle, low signal; visual review happens in Storybook), mocking the database (integration tests use the real engine: the bugs that matter here are locking, constraints and SQL), tests that call a real external provider.

## 3. Rules for writing tests

| Rule | Detail |
|---|---|
| Location | Next to the code: `*.test.ts(x)`. End-to-end in `apps/e2e/tests/*.spec.ts` |
| Naming | `describe('<unit>')` + `it('<observable behaviour>')`; cite the requirement when one exists: `it('rejects two lines of one variant over stock (ADR-0020, K10)')` |
| Data | Factory helpers in `apps/api/test/factories.ts` (`aProduct({ variants: 2 })`, `anOrder({ status: 'confirmed' })`) that insert through repositories. Tests never depend on the demo seed or on each other |
| Database isolation | Each integration test **file** gets its own schema (`rubaya_test_<worker>`), migrated once, tables truncated between tests. Files run in parallel workers |
| Time | `clock` is injected; tests set it. No `setTimeout` sleeps; job tests call `runDueJobs()` |
| Randomness | Seeded; ids are real UUIDv7 |
| External services | Fakes implementing the interfaces of DOC-12 (`FakePaymentProvider`, `FakeChannel`) |
| Assertions | Assert observable results (response, rows, emitted events), not internal calls |
| Concurrency tests | Use real parallel requests against one app instance with a real pool (`Promise.all` of `app.inject`), repeated 20 times in CI to catch flakiness |
| A bug fix | Starts with a failing test that reproduces it |
| What not to test | Framework behaviour, trivial getters, generated code, the exact text of English copy |

## 4. End-to-end journeys (the complete set)

| ID | Journey | Proves |
|---|---|---|
| E2E-01 | Browse home → category → filter by size and one attribute → product → add to cart → checkout (COD) → order page | The main purchase path, server totals, masked order page |
| E2E-02 | Same purchase with JavaScript disabled | Progressive enhancement (DOC-06.1 §8, DOC-06.5 §6) |
| E2E-03 | Apply a valid promo, then one below minimum spend | Promo UI and error mapping |
| E2E-04 | Add the last unit in two browser contexts; both check out | One order succeeds, the other sees the stock message and its cart updated |
| E2E-05 | Made-to-order product with custom size → order shows measurements; admin sees them | Customisation path |
| E2E-06 | Track order by number + phone in three phone formats; wrong phone | Tracking and uniform failure |
| E2E-07 | Customer cancels a pending order; stock returns | Customer action + inventory |
| E2E-08 | Admin: sign in (password + TOTP) → confirm → dispatch → deliver the order from E2E-01 | Staff workflow, invoice number, audit entries |
| E2E-09 | Admin: create a product of each kind, publish, view on storefront | Editor ↔ storefront agreement (DOC-07.3 §12) |
| E2E-10 | Admin: adjust stock, edit price; storefront reflects both | Cache purge path |
| E2E-11 | Admin: `viewer` role sees no write controls on every list screen; direct URL to a forbidden screen shows the 403 state | Permissions in the UI |
| E2E-12 | Admin: bulk publish 30 products, bulk dispatch with one bad row | Bulk flow and failure report |
| E2E-13 | Admin: edit theme (blocked by contrast, then valid) → storefront shows it | Theme path |
| E2E-14 | Storefront at 360 × 740 and admin orders at 360 px: no horizontal scroll, sticky bar present, primary actions reachable | Mobile layout |
| E2E-15 | Keyboard-only purchase: skip link → product → options → add → checkout → place order | Keyboard accessibility |
| E2E-16 | Storefront and admin under `dir="rtl"` test locale: no overlap, drawers from the correct side | RTL readiness |
| E2E-17 | Zero third-party network requests on home, PLP, PDP, cart, checkout | DOC-06.10 §7, DOC-12 §6.1 |

"Smoke set" (also run after any future deploy): E2E-01, E2E-06, E2E-08. The journeys are `apps/e2e/tests/NN-*.spec.js`; how they run is in `apps/e2e/CLAUDE.md`.

## 5. CI gates

Every pull request must pass (DOC-14 §6 runs them, DOC-15 §6 lists them for authors):

| Gate | Fails when |
|---|---|
| Types | Any `tsc` error; `any` or `@ts-ignore` present (lint) |
| Lint | ESLint error, including import boundaries, no JSX string literals (storefront, ui), no `process.env` outside config, bare `TODO` |
| Module rules | `dependency-cruiser` finds an edge not in the allowed list (DOC-08 §5.1) |
| Tokens and direction | `check-contrast` or `check-logical` fails; a hex colour outside `tokens.css`/presets |
| Unit, contract, integration, component | Any test fails; a test is skipped (`.skip`/`.only` are lint errors) |
| Coverage | Line coverage below the floor for the paths in the table below. Coverage is a floor for the listed risky paths only, not a global target |
| OpenAPI | Generated document differs from the committed snapshot |
| Migrations | Drift between schema files and migrations; an applied migration file changed |
| End-to-end | Any journey fails (run for changes under `apps/` or `packages/`) |
| Performance | A DOC-06.10 lab budget or bundle budget is exceeded (run for storefront/ui changes) |
| Query plans | A listed query stops using its index |
| Security | gitleaks finding; high or critical advisory in production dependencies |
| PR title | Not a conventional commit |
| Admin TS ratio | Decreases (ADR-0002) |

| Path | Coverage floor (lines and branches) |
|---|---|
| `packages/contract/src/money*`, pricing in `modules/cart`, `modules/promotions` | 100% |
| `modules/orders` (service, transitions), `modules/inventory`, `modules/payments` | 95% |
| `modules/auth` | 95% |
| Everything else | No floor; reviewed by judgement |

**How the floors are enforced (M4-12).** `pnpm --filter @noor/api test:coverage` runs the suite with coverage over these paths and then `scripts/coverage-groups.mjs`, which exits `1` when a group is under its floor. **Lines** are held to the table. **Branches** are held to the level measured at M4-12, a ratchet: raise it when tests are added, never lower it. Measured then, with the floor set at or just under it, against the plan's floor: cart pricing and customisation with promotions 92.1 (floor 91) of 100; orders service and transitions 86.1 (86) of 95; inventory 84.7 (84) of 95; payments 83.6 (82) of 95; auth 85.2 (85) of 95. Lines measured 95.8 to 100. The distance is test debt (section 13, Q-13-7), not a decision that the plan's floor is wrong.

Flaky tests: a test that fails and passes on retry is quarantined the same day with an issue, and fixed or deleted within a week. CI does not auto-retry failed tests (retries hide concurrency bugs).

## 6. Performance

### 6.1 Storefront

Budgets are DOC-06.10 §2. Lighthouse CI runs three times per URL and uses the median, with the reference profile, against: `/`, one category with 300 products, one product with 6 images and 8 variants, `/cart` with 3 lines.

### 6.2 API (until the order tables exist the seeded database has 3,000 products and 25,000 variants and no orders; listing measured in M1-13, see DOC-10.2 §8; measured in integration tests against the seeded 3,000-product, 20,000-order database on CI hardware; they are regression guards, not production promises)

| Endpoint | p95 budget |
|---|---|
| `catalog.listProducts` (category + 2 filters + facets) | 120 ms |
| `catalog.getProduct` | 60 ms |
| `cart.get`, `cart.addLine` | 60 ms |
| `cart.quote` | 80 ms |
| `orders.create` (3 lines, promo) | 250 ms |
| `orders.getByToken` | 60 ms |
| `admin.orders.list` (status + search) | 150 ms |
| `admin.products.list` | 150 ms |
| `admin.dashboard.summary` (30 days) | 300 ms |
| `admin.search` | 150 ms |

**Measured at M4-12** (`pnpm --filter @noor/api test:perf`, `apps/api/perf/`): the shop at its planned size is built on a scratch database (the `--perf` seed, then 20,000 orders with 40,000 lines, 20,000 audit entries, 3,000 customers and 20,000 waiting jobs, written in bulk) and each endpoint is timed 40 times in process after two warm-up calls. The budgets above are replaced by the slowest p95 of five runs times 1.5, rounded up to 5 ms and never under 10 ms; they are in `apps/api/perf/budgets.js`: `catalog.listProducts` 10 (measured 1.6 to 3.6), `catalog.getProduct` 50 (21.3 to 32.1), `cart.get` 10 (0.3 to 1), `cart.addLine` 85 (32.4 to 54.4), `cart.quote` 10 (0.6 to 1.5), `orders.create` 390 (108 to 259.2), `orders.getByToken` 20 (6.2 to 11.1), `admin.orders.list` 65 (15.9 to 42.2), `admin.products.list` 225 (96 to 149.1), `admin.dashboard.summary` 125 (43.1 to 80.5), `admin.search` 45 (17 to 29.2). The run-to-run spread on this machine is large (`orders.create` was 108 ms on a quiet run and 259 ms on a busy one), which is why the budget is built on the worst run. They are regression guards for this machine and data size, not promises about production.

### 6.3 Query-plan set

`EXPLAIN` must show index access (no full scan of `products`, `variants`, `orders`, `order_lines`, `audit_log`) for: category listing with one attribute filter and each sort; size facet count; text search; product by handle; cart by token hash; order by number; order by token hash; orders by status + placed date; orders by phone prefix; order lines by SKU; audit list by entity; customers by phone prefix; jobs claim query; outbox unprocessed query.

**Built at M4-12** in the same file: every query the listed endpoints send is captured at the connection pool and run through `EXPLAIN`; a full scan (`type = ALL`) of `products`, `variants`, `orders`, `order_lines`, `audit_log`, `customers`, `product_search`, `inventory_levels` or `jobs` fails the test. It covers the category listing with an attribute filter under each sort, the size facet, text search, product by handle, cart by token, order by number, by token hash, by phone prefix and name prefix, orders by status and date, the order tabs, order lines by SKU, the audit list by entity, customers by phone prefix, the admin search and the job claim (built the same way, since it runs in its own transaction). It found three missing indexes and two infix searches (`LIKE '%…%'`), fixed in the same change (DOC-09.3, DOC-09.7, DOC-10.6).

### 6.4 Admin

Initial JavaScript ≤ 230 kB gzip (ADR-0015, amended at M7-09 from 200: the measured 222.3 at sign-in is what the stack costs, see the M7-09 line of plan/16; open-source guides put a code-split web app at 200 to 500 kB); each lazy route chunk ≤ 120 kB; a 100-row table scrolls at 60 fps on a mid-range laptop (manual check when `DataTable` changes); a 100-variant product form types without perceptible lag (React Profiler: no commit over 16 ms while typing in one field).

Measured in M3-01: `node scripts/admin-initial-js.mjs [route]` after `pnpm --filter @noor/admin build` prints the gzipped initial JavaScript for a first visit to a route (default `login`). Sign-in: 206.8 kB then, 222.3 kB at M7-09, dashboard 227.5 kB; the budget is 230 and only comes down.

### 6.5 Load testing

Not part of local development. It is a production-phase task before the first sale/drop (runbook R-8, DOC-14): a scripted load of the listing → PDP → cart → checkout path at 3× the expected peak (A-03: about 2,000 concurrent sessions, 1,500 orders in a day) against staging, watching lock waits, error rate and queue latency. The concurrency correctness is already proven locally by the integration tests (ADR-0020 acceptance).

## 7. Accessibility

Standard: **WCAG 2.2 level AA** for the storefront and the admin.

| Check | How | When |
|---|---|---|
| Automated rules (axe) | `addon-a11y` on every story; `@axe-core/playwright` on each page visited by E2E-01, E2E-08, E2E-09 | Every PR |
| Contrast | Token contrast gate (DOC-04a §9) | Every PR |
| Keyboard | Component keyboard-map tests (DOC-04b §5); E2E-15 | Every PR |
| Focus visibility and order | Part of E2E-15; reviewed in Storybook | Every PR touching UI |
| Target size, reflow at 320 CSS px, 200% zoom | E2E-14 plus a manual check | Each milestone |
| Screen reader | Manual pass with NVDA (Windows) on: home, PLP with filters, PDP option selection and add to cart, cart, checkout with errors, order page; admin: login, orders list, order detail actions | Before the storefront milestone closes and before go-live |
| Reduced motion | Story + one E2E assertion (carousel does not auto-advance) | Every PR touching motion |
| RTL | RTL stories; E2E-16 | Every PR touching layout |
| Forms | Labels, `aria-describedby` errors, error summary announcement: component tests of `Field`/`RHFField`; E2E-01 with invalid input | Every PR |
| Language | `lang`/`dir` on `<html>`; asserted in E2E-01 | — |

Automated tools find only part of the problems; the manual passes are required, and their date and findings are recorded in §12.

Definition of an accessibility bug: anything that blocks a keyboard or screen-reader user from completing a journey in §4, or any failed WCAG 2.2 AA criterion. Such bugs block the milestone they are found in.

## 8. Observability

### 8.1 Logs (from day one, DOC-08 §14)

Structured JSON with `requestId`; local output is pretty-printed by `pino-pretty` in development only. Enough to trace: storefront request → API request → transaction → outbox event → job → notification log row.

### 8.2 Health

`/healthz`, `/readyz` (DOC-10.8 §5); `admin.system.info` shows queue depth and dead-job count to owners.

### 8.3 Metrics (specified now, exported in the production phase)

Collected in-process and exposed at `GET /metrics` (Prometheus text format, reachable only from the private network) once a host exists; locally the same numbers appear in `admin.system.info` and logs.

| Metric | Type | Labels |
|---|---|---|
| `http_requests_total`, `http_request_duration_seconds` | counter, histogram | `route` (pattern), `method`, `status_class` |
| `db_query_duration_seconds`, `db_pool_in_use` | histogram, gauge | `module` |
| `db_deadlock_retries_total`, `db_lock_wait_seconds` | counter, histogram | `operation` |
| `orders_created_total`, `orders_transition_total` | counter | `channel`, `payment_method` / `to` |
| `order_create_conflicts_total` | counter | `code` (`insufficient_stock`, `price_changed`, …) |
| `jobs_processed_total`, `jobs_duration_seconds`, `jobs_queue_depth`, `jobs_oldest_pending_seconds`, `jobs_dead_total` | counter, histogram, gauges | `type`, `outcome` |
| `outbox_unprocessed` | gauge | |
| `notifications_total` | counter | `template`, `channel`, `status` |
| `auth_login_total`, `auth_lockouts_total` | counter | `outcome` |
| `rate_limited_total` | counter | `bucket` |
| `inventory_consistency_mismatches` | gauge | (nightly check, DOC-09.4 §2.3) |

### 8.4 Alerts (thresholds fixed here; routing chosen with the host)

| Alert | Condition | Severity |
|---|---|---|
| API error rate | 5xx over 2% of requests for 5 minutes | page |
| Readiness failing | `/readyz` failing for 2 minutes | page |
| Checkout failing | `orders.create` 5xx over 1% for 5 minutes, or zero orders for 2 hours during 10:00–23:00 PKT when the 7-day average for that hour is ≥ 3 | page |
| Slow API | p95 over 1 s for 10 minutes | warn |
| Lock waits | `db_lock_wait_seconds` p95 over 200 ms for 10 minutes (ADR-0020 revisit trigger) | warn |
| Queue backing up | `jobs_oldest_pending_seconds` over 300 for 10 minutes (ADR-0009 trigger: p95 latency 30 s) | warn |
| Dead jobs | `jobs_dead_total` increases | warn (also a dashboard card) |
| Inventory mismatch | `inventory_consistency_mismatches` > 0 | page |
| Login lockouts | 3 lockouts in a day, or 20 failed logins from one IP in an hour | warn |
| Backup | No successful backup in 26 hours | page |
| Certificate / domain expiry | Under 14 days | warn |

Locally none of these page anyone; the same conditions are visible in logs and `admin.system.info`.

### 8.5 Error tracking

Unhandled errors (API 500s, storefront server errors, admin and storefront browser errors) are logged with `requestId`. A hosted error tracker is a production-phase choice; until then the admin and storefront report browser errors to `POST /api/v1/client-errors` (public, bucket `default`, body `{ message, stack?, route, app, release }`, truncated to 4 kB, no user identifiers), which logs them at `error`. A browser extension's errors are filtered by ignoring stacks without our own script URLs.

### 8.6 Real-user web vitals

`POST /api/v1/vitals` (DOC-12 §6.1) writes to one table, owned by `reporting`:

| Column (`web_vitals_daily`) | Type | Notes |
|---|---|---|
| `day` | date | PK part (Asia/Karachi) |
| `route` | varchar(40) (bin) | PK part: route id (`home`, `category`, `product`, `cart`, `checkout`, `order`, `page`, `other`) |
| `metric` | varchar(4) (bin) | PK part: `LCP`, `INP`, `CLS` |
| `bucket` | smallint | PK part: histogram bucket index (LCP and INP: 100 ms steps up to 10 s; CLS: 0.01 steps up to 1) |
| `count` | int | Incremented with `INSERT … ON DUPLICATE KEY UPDATE` |

The 75th percentile per route and day is computed from the buckets. This is the 67th table; DOC-09.0 §3 lists it under platform/reporting. Rows older than 180 days are deleted. A simple table on `/settings/data` shows p75 per route for the last 28 days against the "good" thresholds.

## 9. Manual checks per milestone

| Check | Milestones |
|---|---|
| Walk every screen of the milestone against its doc's acceptance checklist; tick the boxes in the PR that closes the milestone | all |
| Screen-reader pass (§7) | storefront, admin commerce, before go-live |
| Real device: a mid-range Android phone on throttled data, full purchase | storefront, before go-live |
| OWASP checklist (DOC-11 §11) | commerce backend, before go-live |
| Restore rehearsal, latency measurement, load test | production phase only |

## 10. Rules

**Always:** write the failing test first for a bug; test money, stock, order and auth paths against the real database; keep each behaviour tested at one layer; treat a red or flaky test as a stop signal.
**Never:** mock MySQL for logic that depends on transactions, locks or constraints; skip or auto-retry a failing test to get a green build; call a real provider from a test; lower a budget or a coverage floor without a changelog row here explaining why.
**Common mistakes:** an end-to-end test for every validation rule; tests coupled to the demo seed; asserting on English copy; measuring performance on a database with ten rows.

## 11. Acceptance checklist

- [ ] `pnpm check` runs every gate that needs no browser or database in under 3 minutes locally; `pnpm test:integration` and `pnpm test:e2e` run the rest. **Open: `pnpm check` takes about 10 minutes here (it includes the integration tests when MySQL is up); the split into a fast `check` and `pnpm test:integration` is made (M7-07) but the 3-minute figure is not measured.**
- [x] Each of the five ADR-0020 acceptance tests exists as a named integration test. (All five are ticked in ADR-0020 with their tests (`orders.int.test.js`, `order-transitions.test.js`).)
- [x] The route × role matrix test and the "every non-GET admin route audits" test exist (DOC-11 §13). (`auth.int.test.js` ("route x role", "route x stranger") and `audit.int.test.js` ("every admin mutation writes exactly one entry").)
- [x] All 17 end-to-end journeys exist and pass on Chromium (the Chrome of the machine); the smoke set also on WebKit. (`apps/e2e`, `pnpm test:e2e`: 27 tests in the 17 journeys, and 4 more in the accessibility sweep, all passing on a freshly prepared database. **WebKit ran at M7-09: the smoke set (purchase, tracking) passes on it; the staff journey is tagged `@staff` and left out there, because Safari refuses the Secure staff cookie over the plain-http test servers** (`E2E_WEBKIT=1`, after `playwright install webkit`). WebKit found that the cart and wishlist cookies were `Secure` by `NODE_ENV` and not by the site address; they now follow `PUBLIC_SITE_URL` (`cookieSecure()`).)
- [x] Coverage floors of §5 are enforced by configuration. (Lines at the plan's floors, branches at the measured ratchet: section 5 and Q-13-7.)
- [ ] The seeded performance database (3,000 products, 25,000 variants, 20,000 orders) is generated by `db:seed --perf` in under 2 minutes. (The products and variants are: 80 s. The 20,000 orders are added by the performance test in about 10 s, not by the seed, which has no orders.)
- [x] The query-plan test covers every query in §6.3. (`apps/api/perf/perf.test.js`.)
- [ ] The manual accessibility passes are recorded in §12. (Script and table: §12.1. The automated half, `apps/e2e/tests/18-accessibility-sweep.spec.js`, passes; the passes with NVDA and TalkBack are for a person.)

## 12. Records

| Check | Date | By | Findings |
|---|---|---|---|
| Screen-reader pass, storefront | not yet | | |
| Screen-reader pass, admin | not yet | | |
| Real-device purchase | not yet | | |

### 12.1 Script for the screen-reader passes (M7-02)

What a machine can check is checked by `apps/e2e/tests/18-accessibility-sweep.spec.js` (axe, WCAG 2.2 AA, on every storefront and admin screen, with the checkout showing its errors, a dialog and a side panel open, and the storefront at 320 px); it passes. What follows is for a person with the real tools. **Nothing in the table above is filled in until somebody has done this and signed it.**

**Set-up.** Windows with the latest NVDA and Chrome (and Firefox once), the shop run locally: `pnpm dev` (admin and API) and `pnpm --filter @noor/storefront dev`, or the prepared copy with `pnpm --filter @noor/e2e prepare:data` then `pnpm --filter @noor/e2e serve` (shop :4174, admin :4173, sign in as `e2e-owner@rubaya.test`, password in `apps/e2e/env.mjs`, two-step set-up asks for an authenticator). Android with TalkBack and Chrome for the phone pass (the shop reached through the computer's address on the same network, or a tunnel). Turn the screen off or look away from it: the pass is by ear.

**For every flow, listen for:** the page title and the one level-1 heading when the page opens; landmarks (banner, navigation, main, contentinfo) reachable by the landmark key; headings in a sensible order; every control announced with a name and its role and state (a size chip says its size and that it is selected, a quantity says what it is the quantity of, a switch says on or off); the result of an action announced without moving (added to cart, promo applied, code refused); on an error, that the focus or the announcement reaches the message and the field says it is invalid; a dialog or drawer takes the focus, keeps it inside, and gives it back when it closes; nothing that is only drawn (an icon, a colour, a badge count) is the only carrier of its meaning; no keyboard trap; the focus never disappears.

| # | Flow (storefront) | Steps | Pass when |
|---|---|---|---|
| S1 | Home | Open `/`; move by headings, by landmarks, through the carousel | The hero and collections have names; the carousel can be stopped and moved by keys; the announcement bar can be dismissed |
| S2 | Listing with filters | `/c/stitched`; open the filters, choose a size and a fabric, read the count, change the sort, load more | Each filter group has a name; the number of results is announced after a change; a chosen filter is announced as chosen and can be removed |
| S3 | Product and options | `/p/cotton-kurta`; read the gallery, choose a size with the arrow keys, press Add to cart | Pictures have useful alt text; "Select Size" becomes "Add to cart" when a size is chosen; "Added to cart" is announced; the stock line is read |
| S4 | Cart | Open the cart; change a quantity, remove a line and undo, apply a wrong code, then a right one | Each line says what it is; quantity changes and removals are announced; the code's error is announced and tied to its field |
| S5 | Checkout with errors | Press Place order with the form empty; fix one field at a time | The first problem is announced; each invalid field says why; the delivery choices and the payment choice are radio groups with names; the total is read |
| S6 | Order page | Place an order; read the page; open the cancel dialog and close it | The thank-you heading is first; the timeline reads as a list with the current step; the dialog traps and returns the focus |
| S7 | Language | Switch to Urdu (if on) and repeat S3 | `lang` and direction are right; the reading order is right to left; numbers and the phone number stay readable |

| # | Flow (admin) | Steps | Pass when |
|---|---|---|---|
| A1 | Sign-in | Sign in with a wrong password, then a right one and a code | The error is announced and the focus stays usable; the code field says what it wants |
| A2 | Orders list | Filter, search, select two rows, open the bulk bar; use the keys of the shortcut sheet | The table has a caption and column headers; the selected count is announced; the bulk bar is a toolbar |
| A3 | Order detail | Open an order; confirm it, dispatch it, deliver it | Each action opens a labelled dialog; the result is announced; the status change is announced; destructive actions say so |
| A4 | A form with an error | Product editor: save with the title empty | The error summary or the first invalid field is reached; "unsaved changes" is announced |

**TalkBack (phone).** Repeat S1 to S6 on the phone (swipe navigation, double tap to activate, explore by touch) and A2 and A3 at 360 px. Also check that every target can be hit with one finger without the neighbour firing (24 px minimum, 44 px intended for the main buttons).

**Recording.** Each finding goes in the table below with a severity (blocker: a user cannot finish a journey of section 4; major; minor), the flow number, what was heard, and the fix (or "open"). A finding that blocks a journey blocks the milestone (section 7). When the passes are done and no blocker is open, fill in the rows of section 12 (date, who, and the tools and versions used) and tick the last box of section 11.

| # | Flow | Severity | What was heard | Fix or status |
|---|---|---|---|---|
| | | | | |

## 13. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-13-1 | Vitest 5 browser mode with the Storybook addon | Works (DOC-04b Q-04b-3) | M2 setup; fallback `@storybook/test-runner` |
| Q-13-2 | API latency budgets | Resolved at M4-12: measured p95 × 1.5 (section 6.2). To be measured again on CI hardware when CI first runs | First CI run |
| Q-13-7 | Branch coverage under the floors of section 5 | Held at the measured level (a ratchet) while the commerce backend is finished; V8 counts every `?.`, `??` and default as a branch, so some of the gap is defensive code that cannot happen | M7 hardening: add tests for the uncovered branches of `auth`, `inventory`, `payments`, `orders` and `promotions` until the plan's floors hold, then set the floors to the plan's |
| Q-13-3 | Metrics exporter and alerting tool | Chosen with the host (production phase) | `LAUNCH-01` |
| Q-13-4 | Hosted error tracker | None until production | Production phase |
| Q-13-5 | Screen reader used | NVDA on Windows (the development machine); TalkBack on the Android test phone for the storefront | — |
| Q-13-6 | CI minutes | Within the git host's free allowance for a private repository | Limits hit → run e2e and Lighthouse only on PRs labelled ready |

## 14. Changelog

| Date | Change |
|---|---|
| 2026-10-06 | M4-12: the performance and query-plan run (`pnpm --filter @noor/api test:perf`, `apps/api/perf/`), measured budgets (section 6.2), coverage floors enforced by `scripts/coverage-groups.mjs` with branch floors as a ratchet (section 5, Q-13-7). A full Node load test of the entry points (`apps/api/test/node-esm.test.js`) was added after the API was found unable to start under plain Node while every Vitest test passed. |
| 2026-10-02 | Initial version (Phase 6). Adds table `web_vitals_daily` (67 tables in total) and `POST /api/v1/client-errors` |
| 2026-10-02 | M2-05: component test pipeline is jsdom + axe over every story instead of `addon-vitest` browser mode (no browser download; same gate in `pnpm check` and CI); contrast stays with the token gate |
| 2026-10-04 | ADR-0021: `ts-ratio` removed from the static checks; `tsc` runs with `checkJs` |
