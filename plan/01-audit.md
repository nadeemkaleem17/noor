# 01 — Code Audit

| Field | Value |
|---|---|
| ID | DOC-01 |
| Title | Audit of the attached codebases |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | README (assumptions A-01…A-05) |
| Decisions used | ADR-0001 … ADR-0020 (each finding names the ADR that resolves it) |

## 1. Purpose and scope

**Governs:** what is true of the three uploaded codebases today, with `file:line` evidence, so every later doc can say "replace X" rather than "improve things".
**Does not govern:** target design (docs 03–14), migration order (DOC-16), or the reasoning behind decisions (ADRs).

Line numbers refer to the uploaded archives as received (files dated 21–29 Sep 2026). They will drift; the finding ID is the stable handle.

## 2. Inputs inventory

| Input | Received | Notes |
|---|---|---|
| `ecommerce-website` (storefront) | Yes, 53 files | Vite 8, React 19.2.8, react-router-dom 6.28, JSX, no tests, no `zod` in `package.json` |
| `admin-panel` | Yes, 87 files | Vite 8, React Compiler on (`vite.config.js:7-10`), Radix + lucide, zod ^3.24.1, Vitest |
| `mock-api` | Yes, 8 files | Express 5, in-memory, zod ^3.25.76, single `server.js` (212 lines) |
| "v2 docs (03/05/06/07)" named in the storefront CHANGELOG | **Present, merged**: `STOREFRONT_DOCUMENTATION_COMPLETE_md.docx` contains docs 00–07 in one file | Not separate files. Treated as input, not as source of truth (see §5) |
| Storefront & Admin Documentation v3 (23 Sep) | Yes | Current-state description; contains claims that code contradicts (D-01) |
| Admin Panel Elite UI Design System v1 (23 Sep) | Yes | Input to DOC-04 |
| Admin Panel Progress vs Plan (29 Sep) | Yes | Reports lint/e2e results; cannot be re-verified from the zips (D-03) |
| **Not received** | — | `STOREFRONT_PLAN.md` (v1), `STOREFRONT_PROGRESS.md`, `pass6-wip.patch`, the repo-root `package.json` that `mock-api/README.md` says runs all three apps, any Playwright files, any CI config |

## 3. Verification of the findings you asked me to check

| # | Claimed finding | Verdict | Evidence | Fix |
|---|---|---|---|---|
| K1 | Two unrelated token systems; storefront has no dark mode | **Confirmed** | Storefront: gold `#C9A227`, Playfair Display, `--gold*` names, `index.css:1,3-33`, brand themes `:34-57`, no dark block. Admin: burgundy `#7A2E3A`, Instrument Sans, `index.css:7-40`, dark `:80`, `:109-110`. Only `--line`, `--ink`, `--success`, `--warning`, `--danger` share names, with different values | ADR-0006, DOC-04 |
| K2 | Contract copied by hand across admin/mock-api and re-mapped in storefront | **Confirmed, with one semantic drift** | `mock-api/schemas.js:1-2` ("Keep in sync by hand"). Textual diff vs `admin-panel/src/contract/schemas.js`: `OrderLine`, `Order`, `Product`, `Variant` differ; `Category`, `Component` identical. Semantic drift: `qty` is `.int()` in admin (`schemas.js:385`) but `.int().positive()` in mock (`schemas.js:173`). Name drift: mock `Settings` (`:155`) vs admin `SiteSettings` (`:321`). `OrderInput` exists only in mock (`:200`). Storefront has no schema at all and re-maps in `utils/catalogAdapter.js:63-95` | ADR-0005 |
| K3 | Duplicated `usePersistentState`, `ApiError`/request client, localStorage layers | **Confirmed, and worse** | `usePersistentState`: storefront `hooks/usePersistentState.js` (versioned blob, validators) vs admin `hooks/usePersistentState.js` (no version, no validation). `ApiError`: storefront `utils/api.js:11`, admin `lib/api.js:16` (different constructor signatures). Admin has **two** persistence mechanisms: `hooks/usePersistentState.js` (used at `AdminLayout.jsx:87`, `useTheme.js:8`) and `lib/db.js` (`SCHEMA_VERSION` at `:26`). Also duplicated: `formatPKR`/`formatMoney`, `newId`/`makeId` (`storefront utils/format.js:9`, `admin lib/id.js:1`, `mock server.js:47`) | ADR-0002, ADR-0003, ADR-0015 |
| K4 | Money minor units in contract, float rupees in storefront | **Confirmed** | Contract: `Money.amount` integer paisa (`schemas.js:8`). Storefront: `toRupees` divides by 100 (`catalogAdapter.js:16`), `money()` multiplies back (`orderPayload.js:3`), display uses `Math.round(amount)` (`utils/format.js:1-3`) which drops paisa that v2 doc §2 row 4 says are real (e.g. 17,759.20). Promo percent computed in rupees with `Math.round` (`PromoContext.jsx:28`). Shipping constants in rupees (`CartContext.jsx:64`) | ADR-0013 |
| K5 | No virtualization / lazy / Suspense in admin | **Confirmed (both apps)** | `admin App.jsx:2-22` imports 20 pages eagerly; `grep` finds no `lazy(`, `Suspense`, or virtualization in either `src/`. `ProductsList.jsx` and `OrdersList.jsx` render the full filtered array, no pagination. Progress doc reports one 604 kB bundle (its measurement; not reproduced here) | ADR-0015, DOC-05 |
| K6 | Sequential-await bulk actions | **Confirmed, deliberate** | `ProductsList.jsx:51-62`: `for (const id of selected) if (await update(...))`. The code comment says one-at-a-time is chosen so each failure gets its own toast. The cost is N round-trips, no atomicity, no bulk endpoint in `mock-api` | DOC-10 (bulk endpoints), DOC-07 |
| K7 | CSR storefront, SEO risk | **Confirmed** | `index.html:7` title is `ecommerce-website`; no description, canonical, OG or JSON-LD; products load client-side (`CatalogContext.jsx:28-50`); routes at `App.jsx:17-27`; product URL uses opaque id `/product/:id` (`App.jsx:20`) not a handle | ADR-0004 |
| K8 | Shared `x-admin-key` in public bundle | **Confirmed, and it is the only admin auth** | `admin lib/api.js:11` reads `VITE_ADMIN_KEY`; comment `:7-8` admits it is readable by anyone who can load the site. The admin UI has no login or route guard (`App.jsx:26-64`), so loading the site = full admin. Server: single shared key (`server.js:37-42`); CORS open to any origin (`:26`). `mock-api/.env` (key `dev-key`) is inside the received archive and the archive has no `.gitignore` (README says a root ignore covers it; unverifiable) | ADR-0012 |
| K9 | Order-number race | **Partly confirmed; reframed** | `nextOrderNo` = max over all in-memory orders + 1 (`server.js:54`). Inside one Node process the handler is synchronous (`:76-102`) so two requests cannot interleave. The real defects: numbers are reused after restart/reset (`:9-16`, `:174-177`), the scan is O(n), it collides the moment there are two instances or a DB, and numbers are sequential and guessable (`SF-10001…`) | ADR-0020 |
| K10 | Non-atomic stock decrement | **Partly confirmed; a different real bug found** | Verify-all-then-decrement-all (`server.js:78-97`) is effectively atomic in one process. But each cart line is checked **independently** (`:84`): two lines for the same variant (qty 2 + qty 2, stock 3) both pass, then stock goes to -1 (`:94`). No reservation; cancel/return never restocks (`PUT /orders/:id`, `:166-171`, only replaces the document) | ADR-0020 |
| K11 | No idempotency | **Confirmed** | No `Idempotency-Key` handling in `POST /api/public/orders` (`server.js:76`). Only guard is component state `placing` (`Checkout.jsx:22,47`), lost on refresh or second tab. Client times out at 20 s (`utils/api.js:9`) while the server may already have created the order, so a retry creates a duplicate | ADR-0020 |

## 4. New findings

Severity: **C** critical (money or access), **H** high, **M** medium, **L** low.

### 4.1 Orders, pricing, money integrity

| ID | Sev | Finding | Evidence | Fix |
|---|---|---|---|---|
| F-01 | C | **Client sets its own total.** `OrderInput` omits only id/orderNo/status/dates/invoice/dispatch/history/notes, so `discount`, `shippingFee`, `total` are accepted from the browser. Server verifies line prices and `subtotal` only | `mock schemas.js:200-202`; `server.js:82,89-90`; no check of `total` | ADR-0020, ADR-0013 |
| F-02 | C | **Promo codes are never validated by the server and live in browser localStorage.** Usage counts (`recordUsage`) are incremented client-side, so `usageLimit` and `perCustomerLimit` are unenforceable | `PromoContext.jsx:12,14-16,19-30`; `server.js` has no promo route; contract `Promo` at `admin schemas.js:364-381` | ADR-0020, DOC-10 |
| F-03 | C | **Admin order update replaces the whole order with the request body.** No transition check (the state machine exists only in UI at `OrderDetail.jsx:52-59` and `lib/orders.js:12-26`), body may change totals, lines, `orderNo`, customer; history is client-built | `server.js:166-171` | ADR-0020, DOC-09 |
| F-04 | H | **Invoice numbers use `Math.random()`**: 9,000 values per year, so a collision is likely after roughly 110 invoices (birthday bound) | `admin lib/invoice.js:9-13` | DOC-09 |
| F-05 | H | **Shipping rule is hard-coded in five places** and ignores the contract's zone model (`StoreConfig.shipping.zones[].cities`, `admin schemas.js:273-282`) | `CartContext.jsx:64`; `Product.jsx:218`; `Home.jsx:49`; `CmsPage.jsx:9`; sample order `OrdersContext.jsx:36` | DOC-06 cart, DOC-09 shipping |
| F-06 | H | **Phone and city are free text.** Server accepts any 7+ character phone and any city string; no Pakistani mobile format check, no zone/fee computation. Hurts COD confirmation and courier handoff | `mock schemas.js:203-204` | DOC-09, DOC-10 |
| F-07 | M | **Order tracking is brittle and enumerable.** Compare is digits-only equality, so `03001234567` ≠ `923001234567` and a legitimate customer fails. Numbers are sequential; no rate limit; the response returns address, phone, lines, dispatch (only `internalNotes` stripped) | `server.js:53,105-111` | DOC-10, ADR-0012 |
| F-08 | M | **Made-to-order deposit and lead time are in the contract but enforced nowhere.** `depositPercent`, `leadTime`, `returnable` never read by checkout or server; cart line identity is `productId__size` and ignores `customization` | `schemas.js:114-118`; `CartContext.jsx:18-20`; `OrderLine.customization` `schemas.js:174` unused | ADR-0014, DOC-06 |

### 4.2 Data layer and integration

| ID | Sev | Finding | Evidence | Fix |
|---|---|---|---|---|
| F-09 | H | **Most admin data never reaches the storefront.** Only products, categories, orders and site settings are remote; promos, pages, menus, templates, reviews, attributes, sizes, size charts, collections and `storeConfig` stay in the admin's own localStorage | `admin lib/db.js:2,8,46-54` | ADR-0005, ADR-0008 |
| F-10 | H | **Storefront drops the domain model.** The adapter flattens each product to one "cheapest" variant and a size list; `kind`, `components`, `colorway`, `madeToOrder`, `sizeChartId`, `fit`, `customSizeSchemaId`, `seo` are never read anywhere in storefront `src/` (only in the adapter's input) | `catalogAdapter.js:63-95`; grep for those fields returns nothing | ADR-0014, DOC-06 PDP |
| F-11 | H | **Dual-mode code paths everywhere.** With `VITE_API_URL` unset the storefront runs on `mockData.js` and creates orders in the browser; every context branches on `apiEnabled`. Local orders never reach the admin | `utils/api.js:2-4`; `CatalogContext.jsx:13-21`; `OrdersContext.jsx:62-72` | ADR-0015 |
| F-12 | M | **Catalog endpoint returns everything, unpaginated.** The storefront then filters, sorts and searches in memory. Payload grows with catalog size | `server.js:63,69`; `Shop.jsx:19-34` | ADR-0010, DOC-10 |
| F-13 | M | **Admin writes each whole collection as one JSON blob** on every change; localStorage is ~5 MB. Fine for 30 KB fixtures, not for thousands of products with media arrays | `db.js:94-96` | ADR-0008 |
| F-14 | M | **Error contract is ad hoc.** Server returns `{error, issues?}` with English prose; storefront reads only `error` (`utils/api.js:58`) and shows it to customers; admin maps `issues` (`lib/api.js:52`). No codes, so no localization and no programmatic handling | `server.js:204-210` | DOC-10 conventions, ADR-0018 |
| F-15 | L | **zod version skew**: admin `^3.24.1`, mock-api `^3.25.76`, storefront none | three `package.json` files | ADR-0005 |

### 4.3 Security

| ID | Sev | Finding | Evidence | Fix |
|---|---|---|---|---|
| F-16 | C | **No admin authentication, no roles, no audit trail** (see K8). Every admin user is a superuser with one shared secret | `App.jsx:26-64`; `server.js:37-42` | ADR-0012, DOC-11 |
| F-17 | M | **Uploads: in-memory, lost on restart, MIME trusted from the client header only**, 2 MB cap, no magic-byte check, no dimension limit | `server.js:17-19,179-193,198` | ADR-0011 |
| F-18 | M | **No rate limiting, no security headers/CSP, CORS `*`** on public order and tracking endpoints | `server.js:26-27` | DOC-11 |
| F-19 | L | `trust proxy` is hard-coded to 1 hop | `server.js:25` | DOC-14 |

### 4.4 Frontend, quality and i18n

| ID | Sev | Finding | Evidence | Fix |
|---|---|---|---|---|
| F-20 | M | **Storefront has no React Compiler** while both docs imply it does; manual memoization is sparse (39 `useMemo/useCallback/memo` across both apps) | `storefront vite.config.js:6` is plain `react()`; admin `vite.config.js:7-10` has the compiler | DOC-05 |
| F-21 | M | **Fonts load via render-blocking cross-origin CSS `@import`** from Google Fonts on the storefront; admin self-hosts via `@fontsource`. No Urdu-capable font in either | `storefront index.css:1`; `admin package.json` | ADR-0018, DOC-04 |
| F-22 | M | **Not RTL-ready.** `<html lang="en">` fixed, no `dir`, no i18n library; 16 (storefront) and 18 (admin) physical-direction CSS declarations (`margin-left`, `padding-right`, `left:` …) and zero logical ones | `index.html:2`; grep of both `index.css` | ADR-0018, ADR-0006 |
| F-23 | M | **Tests: ~67 unit cases in two admin files, all in `lib/`.** No component tests; storefront zero; no CI or lint gate in any archive; no `tsconfig`/`jsconfig`/Prettier | `admin lib/__tests__/` (42 + 25 `test/it` calls); directory listing | DOC-13 |
| F-24 | L | **Storefront CMS pages are hard-coded**, so admin-authored `CmsPage` records and `Menu` records are never fetched | `CmsPage.jsx:4-22`; no pages route in `server.js` | DOC-06 CMS |
| F-25 | L | Contact and policy copy duplicate store config (`store.phone`, `store.email`) rather than reading one source | `CmsPage.jsx:29-36` | DOC-06 |

## 5. Documentation drift (inputs that disagree with code)

| ID | Claim | Reality |
|---|---|---|
| D-01 | v3 §A1: "React Compiler enabled via @vitejs/plugin-react" for the storefront | `storefront vite.config.js:6` has no compiler preset. Only the admin has one. The storefront `README.md` repeats the Vite template sentence "React Compiler is enabled on this template" |
| D-02 | `CHANGELOG_THIS_PASS.md` (21 Sep) describes `SellerContext`, `SellerLayout`, `SellerLogin` | None of these exist in the received storefront. v3 says seller routes were removed in "Pass 4". The CHANGELOG is stale |
| D-03 | Progress doc (29 Sep): 75 Playwright tests, lint failing in `helpers.js`/`playwright.config.js`, image library "lost" | The admin zip contains no Playwright files, no `helpers.js`; but it **does** contain `lib/images.js`, `lib/imageFile.js`, `components/ImageUpload.jsx`, `__tests__/images.test.js`, and no IndexedDB usage. Either the zip is a different snapshot than the report measured, or the report is stale. Cannot verify either way |
| D-04 | v2 §2 row 2: React Router "v8 (8.4.0 current)" | Supported by an independent July 2026 source (v8.0.0 on 17 Jun 2026, v8.2.0 then) so v8 is real; the 8.4.0 number could not be checked and may be right for 21 Sep. Floors: Node ≥ 22.22, React ≥ 19.2.7, Vite ≥ 7. Storefront already meets them |

## 6. What is good and must be kept

| Asset | Where | Keep as |
|---|---|---|
| Integer minor-unit `Money` shape | `schemas.js:7-11` | The only money type (ADR-0013) |
| Product model: kinds, components, options→variants, colorway, made-to-order, size systems/charts, custom-size form schema | `schemas.js:57-157,193-232` | Seed for DOC-09 catalog tables (ADR-0014) |
| `PageTemplate → Section → Block` model | `schemas.js:350-361` | CMS design in DOC-06/07 |
| `db.js` seam: components never touch storage or fetch | `db.js:2` | Pattern preserved as the API client layer (ADR-0015) |
| Server re-checks price and stock rather than trusting the client | `server.js:78-90` | Extended into full server-side pricing (ADR-0020) |
| Order tracking by number **and** phone | `server.js:105-111` | Kept, hardened (F-07) |
| `esc()` before printing customer data into invoice HTML | `invoice.js:5` | Rule in AGENTS.md |
| Admin tokens, dark theme, focus-visible, `tabular-nums` | admin `index.css` | Starting point for DOC-04 |
| Checkout guard against double click, safe-href helper | `Checkout.jsx:47`; `utils/api.js:64-74` | Kept as UX guard, not as the integrity mechanism |

## 7. Rules

**Always**
- Cite a finding ID (`F-xx`, `K-x`, `D-xx`) in any PR that fixes one.
- Treat §3 and §4 as a backlog source for DOC-16; every Critical and High finding must map to a roadmap task.

**Never**
- Copy code from these archives into the new apps without re-reading the finding that covers it (K4 and F-01 live inside "working" code).
- Rely on the v2/v3 docs for what the code does; use this audit.

**Common mistakes**
- Treating K9/K10 as concurrency bugs in the mock; they are design gaps that appear the moment a real DB or second instance exists.
- Fixing money by rounding better; the fix is to stop converting (ADR-0013).

## 8. Acceptance checklist

- [ ] Every Critical/High row maps to a DOC-16 task ID. **Checked at Phase 7 (DOC-16 §6); not re-run.**
- [ ] Every row names the doc or ADR that resolves it. **Checked at Phase 7; not re-run.**
- [ ] No finding is marked fixed without a merged PR referencing its ID. **No pull request was ever made (the work is on one branch, not pushed): findings are cited by id in the commits instead.**

## 9. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-1 | Is the uploaded admin zip the same snapshot the Progress doc measured? (D-03) | Treat the zip as the truth | You supply `pass6-wip.patch` or newer zips |
| Q-2 | Are `mock-api/.env` and `.env.local` committed to git? | Assume yes until shown otherwise; rotate any non-dev key | You confirm repo history |
| Q-3 | Does a repo root exist with a combined `npm run dev`? | Yes, per `mock-api/README.md` | You upload it |

## 10. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial audit (Phase 0) |
| 2026-10-02 | Phase 6: every finding is mapped to the task that removes it in DOC-16 §6 |
