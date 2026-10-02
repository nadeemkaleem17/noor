# Noor & Co. — Engineering Documentation Set (merged)

> **Snapshot of Phase 0 only (with the MySQL amendment).** The split files in this folder are the source of truth and are the only ones updated from Phase 1 onward. Start at [README.md](README.md).

Single-file edition. Each phase is a top-level section; each document inside a phase is a sub-section. Later phases are appended as new top-level sections (Phase 1 … Phase 7) without changing Phase 0.

| Field | Value |
|---|---|
| Last updated | 2026-10-02 |
| Phases delivered | 0 of 7 |
| Next | Phase 1 (on "continue") |

## Contents

| Phase | Scope | Status |
|---|---|---|
| [Phase 0](#phase-0) | README, Glossary, Audit, ADR-0001…0020 | Delivered, awaiting approval |
| Phase 1 | Frontend architecture, design system, React patterns, conventions, AGENTS.md | Not started |
| Phase 2 | Storefront (06) | Not started |
| Phase 3 | Admin (07) | Not started |
| Phase 4 | Backend architecture, security/auth, devops | Not started |
| Phase 5 | Data model, API, integrations | Not started |
| Phase 6 | Quality, roadmap/backlog | Not started |
| Phase 7 | Consistency review | Not started |

---

<a id="phase-0"></a>

# Phase 0 — Foundations: index, glossary, audit, decisions

Documents in this phase:

| # | Section | Anchor |
|---|---|---|
| 1 | Noor & Co. — Engineering Documentation Set | [doc-readme](#doc-readme) |
| 2 | Glossary | [doc-glossary](#doc-glossary) |
| 3 | 01 — Code Audit | [doc-01-audit](#doc-01-audit) |
| 4 | 02 — Decision records (index and research register) | [doc-02-decisions-index](#doc-02-decisions-index) |
| 5 | ADR-0001 — Build a modular-monolith commerce backend; borrow Medusa's patterns, not its code | [adr-0001-build-vs-adopt](#adr-0001-build-vs-adopt) |
| 6 | ADR-0002 — Strict TypeScript for all new code; admin migrated incrementally | [adr-0002-typescript](#adr-0002-typescript) |
| 7 | ADR-0003 — pnpm workspaces + Turborepo | [adr-0003-monorepo](#adr-0003-monorepo) |
| 8 | ADR-0004 — Storefront on React Router v8 framework mode, SSR with CDN caching | [adr-0004-storefront-rendering](#adr-0004-storefront-rendering) |
| 9 | ADR-0005 — REST + OpenAPI with one Zod 4 contract package | [adr-0005-api-and-contract](#adr-0005-api-and-contract) |
| 10 | ADR-0006 — Tailwind v4 with three-tier CSS-variable tokens; logical properties only | [adr-0006-styling-and-tokens](#adr-0006-styling-and-tokens) |
| 11 | ADR-0007 — Owned shadcn-style components on Base UI | [adr-0007-component-foundation](#adr-0007-component-foundation) |
| 12 | ADR-0008 — MySQL 8.4 + Drizzle ORM (pinned 0.45.x) | [adr-0008-database-and-orm](#adr-0008-database-and-orm) |
| 13 | ADR-0009 — MySQL-backed jobs and transactional outbox; HTTP/CDN cache first | [adr-0009-jobs-events-cache](#adr-0009-jobs-events-cache) |
| 14 | ADR-0010 — MySQL FULLTEXT + synonyms + SQL facets at launch | [adr-0010-search-and-filtering](#adr-0010-search-and-filtering) |
| 15 | ADR-0011 — S3-compatible object storage and on-the-fly image transforms | [adr-0011-media-storage](#adr-0011-media-storage) |
| 16 | ADR-0012 — Server-side sessions, Argon2id, TOTP, RBAC; no shared admin key | [adr-0012-auth-sessions-rbac](#adr-0012-auth-sessions-rbac) |
| 17 | ADR-0013 — Integer paisa everywhere; no float rupees | [adr-0013-money](#adr-0013-money) |
| 18 | ADR-0014 — Style → Colorway → Size catalog model | [adr-0014-catalog-model](#adr-0014-catalog-model) |
| 19 | ADR-0015 — Loaders on the storefront; TanStack Query, Table and Virtual in the admin; Zustand for cart UI state | [adr-0015-client-state-and-data](#adr-0015-client-state-and-data) |
| 20 | ADR-0016 — Fastify 5 modular monolith with enforced module boundaries | [adr-0016-backend-framework](#adr-0016-backend-framework) |
| 21 | ADR-0017 — COD-first payments behind a provider interface; hosted-redirect gateways; signed idempotent webhooks | [adr-0017-payments](#adr-0017-payments) |
| 22 | ADR-0018 — English at launch, Urdu/RTL-ready from day one | [adr-0018-i18n-rtl](#adr-0018-i18n-rtl) |
| 23 | ADR-0019 — Single-region container host, managed MySQL, CDN | [adr-0019-hosting-baseline](#adr-0019-hosting-baseline) |
| 24 | ADR-0020 — Server-side pricing, idempotent order creation, stock reservation, sequence order numbers | [adr-0020-order-and-inventory-consistency](#adr-0020-order-and-inventory-consistency) |

---

<a id="doc-readme"></a>

### Noor & Co. — Engineering Documentation Set

| Field | Value |
|---|---|
| ID | DOC-README |
| Title | Index, reading order, status, assumptions |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | — |
| Decisions used | ADR-0001 … ADR-0020 |

#### 1. Purpose and scope
Entry point to the docs set that a small team and AI coding agents follow as the single source of truth. **Governs:** structure, reading order, status, the project inputs and assumptions. **Does not govern:** any technical specification (each lives in exactly one numbered doc).

#### 2. How to use this set
1. Humans: read §3 order. Agents: read `AGENTS.md` first (first version arrives in Phase 1), then only the docs your task cites.
2. One fact lives in one doc. If you need a fact, follow the cross-reference; if two docs disagree, the lower-numbered ADR wins and you open a PR fixing the other.
3. A PR is reviewable against the **Acceptance checklist** at the end of each doc it touches.
4. Findings are cited by ID (`F-01`, `K9`, `D-02` from DOC-01); decisions by ADR number.
5. Phases are delivered one per response; later phases may amend earlier docs and will say so in their changelog.

#### 3. Reading order and status

| Doc | Title | Phase | Status |
|---|---|---|---|
| [README.md](#doc-readme) | This index | 0 | Draft, written |
| [GLOSSARY.md](#doc-glossary) | Terms | 0 | Draft, written (status sets provisional) |
| [01-audit.md](#doc-01-audit) | Code audit with `file:line` evidence | 0 | Draft, written |
| [02-decisions/](#doc-02-decisions-index) | ADR-0001…0020 + research register | 0 | Draft, written; **awaiting your approval** |
| AGENTS.md | Rules for AI coding agents | 1 | Not started |
| 03-frontend-architecture.md | Monorepo, features, boundaries, state, routing, i18n, config | 1 | Not started |
| 04-design-system/ (tokens, components, patterns) | Design system | 1 | Not started |
| 05-react-patterns.md | Patterns with where/where-not | 1 | Not started |
| 15-conventions.md | Naming, git, PR, review | 1 | Not started |
| 06-storefront/ | One file per storefront area | 2 | Not started |
| 07-admin/ | One file per admin area | 3 | Not started |
| 08-backend-architecture.md · 11-security-auth.md · 14-devops.md | Backend, security, devops | 4 | Not started |
| 09-data-model/ · 10-api/ · 12-integrations.md | Data, API, integrations | 5 | Not started |
| 13-quality.md · 16-roadmap.md | Quality, roadmap and backlog | 6 | Not started |
| Consistency review | Contradictions, field names, glossary | 7 | Not started |

#### 4. Project inputs and assumptions
The input block in the brief was blank. Defaults below are **assumptions**, each with a revisit trigger. They are the only place these values are stated.

| ID | Input | Assumption | Revisit trigger |
|---|---|---|---|
| A-01 | Team | 2–3 developers plus AI coding agents; one person acts as tech lead and reviewer | Team changes by one person, either way |
| A-02 | Hosting and budget | ≤ US$150/month at launch, always-on container hosting, one region; ability to pay a foreign provider in USD is **unknown** | Real budget or payment constraint stated (CQ-2) |
| A-03 | Scale target | ~3,000 products / ~25,000 variants; ~150 orders/day normal, up to 1,500 on sale or drop days; ~2,000 concurrent sessions at peak | Real traffic data, or a planned campaign above these numbers |
| A-04 | Languages | English at launch; Urdu/RTL-ready in code from day one, Urdu content after launch; admin English only | Urdu launch date set, or Urdu traffic over 20% |
| A-05 | Deadline | Public MVP about 12 weeks after M0 starts; no hard external date | A fixed launch date (e.g., a lawn season) is stated |

#### 5. Clarifying questions (answers change the design)
| # | Question | Why it matters |
|---|---|---|
| CQ-1 | Team size and launch date: is it really 2–3 developers and about 12 weeks? | ADR-0001 (build vs adopt) is the riskiest decision and flips toward Medusa if the team is one person or the date is under about 8 weeks |
| CQ-2 | Real monthly hosting budget, and can the business pay foreign services in USD (cards/PayPal)? | Chooses the host, object storage and image-transform provider (ADR-0011, ADR-0019) and whether Pakistani-only vendors are required |
| CQ-3 | Which payment methods must work at launch, and do you already hold merchant accounts (JazzCash, Easypaisa, a card gateway, bank transfer details)? | Gateways have gated docs and onboarding lead time; this sets the Phase 5 integrations scope (ADR-0017) |

I proceeded under the assumptions above rather than blocking Phase 0 on them.

#### 6. Rules
**Always:** update the status table and the changelog of every doc you change. **Never:** copy a spec into a second doc; leave "TBD" (write the assumption and trigger). **Common mistake:** treating the v2/v3 `.docx` files as truth; see DOC-01 §5 for where they disagree with the code.

#### 7. Acceptance checklist
- [ ] Every doc listed in §3 exists once it is marked written.
- [ ] Each written doc has the header table, scope, rules, acceptance checklist, open questions and changelog.
- [ ] Assumptions A-01…A-05 are referenced, never restated.

#### 8. Open questions and assumptions
CQ-1…CQ-3 above; audit questions Q-1…Q-3 are in DOC-01 §9.

#### 9. Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Phase 0 delivered: README, GLOSSARY, 01-audit, 02-decisions (ADR-0001…0020) |
| 2026-10-02 | Owner decision: backend is Node.js + **MySQL** (was PostgreSQL). Amended in place while still Proposed: ADR-0001, 0008, 0009, 0010, 0012, 0015, 0019, 0020, glossary, research register |


---

<a id="doc-glossary"></a>

### Glossary

| Field | Value |
|---|---|
| ID | DOC-GLOSSARY |
| Title | Domain and technical terms |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | — |
| Decisions used | ADR-0013, ADR-0014, ADR-0017, ADR-0020 |

#### 1. Purpose and scope
One definition per term, used identically in every doc, code identifier and UI string. **Governs:** meaning of terms. **Does not govern:** how a term is implemented (see the doc named in "Where").

#### 2. Specification

##### 2.1 Domain terms
| Term | Definition | Where |
|---|---|---|
| Bridal | Premium made-to-order or limited-stock occasion wear; typically has deposits, long lead times and custom fitting | ADR-0014 |
| Bundle | A product `kind` that sells several child products together at one price; each child keeps its own stock check | ADR-0014 |
| Colorway | One colour treatment of a style, modelled as its own product with its own handle, gallery and SEO | ADR-0014 |
| Component | One physical piece inside a product (shirt, dupatta, trouser, shalwar, slip, lehnga, blouse, jacket, scarf, shoes, bag, other) with fabric, colour, technique and quantity. Not a UI component | contract `Component` |
| COD (cash on delivery) | Payment collected by the courier on delivery; the default method | ADR-0017 |
| COD confirmation | A human or WhatsApp check that a COD order is genuine before dispatch; orders wait in `pending_confirmation` | ADR-0017 |
| Custom size | Customer-supplied measurements captured against a product's form schema and stored on the order line as `customization` | ADR-0014 |
| Deposit | The part of a made-to-order price charged up front (`madeToOrder.depositPercent`); the rest is paid on delivery or by transfer | ADR-0014 |
| Drop | A scheduled release of a collection that causes traffic and stock spikes (lawn season, Eid) | ADR-0020 |
| Dupatta | The scarf/stole piece of a 3-piece suit; a `Component` type | — |
| Fit note | `runs_small`, `true_to_size` or `runs_large` shown on a product | contract `Fit` |
| Kind | Product class that drives behaviour: `stitched`, `unstitched`, `made-to-order`, `footwear`, `accessory`, `bundle`, `home`, `beauty` | ADR-0014 |
| Lawn | Light cotton fabric; the seasonal summer unstitched line that dominates the catalog | — |
| Lead time | Days from order to dispatch for made-to-order items (`minDays`–`maxDays`) | ADR-0014 |
| Made-to-order (MTO) | Product produced after the order; never has a counted stock quantity | ADR-0014 |
| Order number | Human-readable sequential number `NC-10001…`, from the `counters` table (MySQL has no sequences); not secret | ADR-0020 |
| Preorder | Item sold before stock arrives; has an expected date, no counted stock | ADR-0014 |
| Roman Urdu | Urdu written in Latin letters; common in search queries; handled as search synonyms, not as a locale | ADR-0010 |
| Shalwar kameez | Traditional outfit (kameez = shirt, shalwar = trouser); a stitched or unstitched product | — |
| Size chart | Measurement tables for a product (`SizeChart`), in inches or cm | contract `SizeChart` |
| Size system | Ordered list of size labels (XS…XXL, EU shoe sizes); a product's size option points to one | contract `SizeSystem` |
| Stitched | Ready-to-wear item sold by size | ADR-0014 |
| Style | A design shared by several colorways (`styleId`) | ADR-0014 |
| Tracking token | Unguessable string in the confirmation link and WhatsApp message that lets a customer view an order without typing a phone number | ADR-0012 |
| Unstitched | Fabric sold as a set to be tailored; sold per set with `components[]`, no size chart | ADR-0014 |
| Wishlist | Saved products for a browser (and later an account) | DOC-06 |
| WhatsApp link | `https://wa.me/<digits>?text=…` link; number in E.164 digits without `+` | DOC-06 |
| Zone (shipping) | A named set of cities with delivery methods, fees, free-shipping thresholds and ETAs | DOC-09 |

##### 2.2 Commerce and money terms
| Term | Definition | Where |
|---|---|---|
| Basis points (bps) | 1/100 of a percent; 12.5% = 1250 bps; used for percentage maths | ADR-0013 |
| Cart (server) | The persisted basket whose totals are computed by the API | ADR-0020 |
| Idempotency key | Client-generated UUID sent with an order-creating request so retries replay one result | ADR-0020 |
| Invoice number | `INV-<year>-<6 digits>` from a per-year row in the `counters` table, assigned at first dispatch | ADR-0020 |
| Minor unit / paisa | 1/100 of a rupee; all stored and transmitted amounts are integer paisa | ADR-0013 |
| Money | `{ amount: integer paisa, currency: "PKR" }` | ADR-0013 |
| Order status | `pending`, `pending_confirmation`, `confirmed`, `dispatched`, `delivered`, `cancelled`, `returned` (final set in DOC-09) | DOC-09 |
| Payment status | `initiated`, `pending_confirmation`, `authorized`, `captured`, `failed`, `refunded`, `partially_refunded`, `expired` (final set in DOC-09) | ADR-0017 |
| Payment session | A provider-specific attempt to collect money for an order | ADR-0017 |
| PKR | Pakistani rupee; the only currency in v1 | ADR-0001 |
| Reservation | Stock held for an order between creation and dispatch or expiry | ADR-0020 |
| Server-priced | Totals, discounts and shipping are computed by the API, never accepted from a client | ADR-0020 |
| SKU | Merchant stock-keeping code of one variant, unique | DOC-09 |
| Variant | A buyable combination of option values (e.g., size M) with its own SKU, price and stock | ADR-0014 |

##### 2.3 Technical terms
| Term | Definition | Where |
|---|---|---|
| ADR | Architecture decision record: one decision, options, consequences, revisit trigger | DOC-02 |
| Admin panel | The staff web app (`apps/admin`) | DOC-07 |
| Audit log | Append-only record of every admin mutation (actor, entity, diff) | ADR-0012 |
| BFF (backend for frontend) | The storefront server that calls the API on behalf of the browser | ADR-0004 |
| CDN | Network that caches public responses close to users | ADR-0004 |
| Contract (package) | `packages/contract`: Zod schemas, route table and money helpers shared by all apps | ADR-0005 |
| Facet | A filter group on a listing (fabric, colour) with live counts | ADR-0010 |
| Framework mode | React Router's full-stack mode with `routes.ts`, loaders, SSR and pre-render | ADR-0004 |
| Handle | URL-safe unique slug of a product, category or collection | DOC-06 |
| Logical property | CSS that uses start/end instead of left/right so layouts mirror in RTL | ADR-0006 |
| Module (backend) | A folder under `apps/api/src/modules` with a public `index.ts`; the only legal import target between modules | ADR-0016 |
| Outbox | Table of domain events written in the same transaction as the change that caused them | ADR-0009 |
| Prerender | Generating HTML at build time for static pages | ADR-0004 |
| Primitive token | Raw design value (a grey, a spacing step); never used directly in components | ADR-0006 |
| RBAC | Role-based access control: roles hold `resource:action` permissions | ADR-0012 |
| Route table | The typed map in the contract of every endpoint (method, path, auth, schemas) | ADR-0005 |
| RTL | Right-to-left layout, needed for Urdu | ADR-0018 |
| Semantic token | Role-named design value a component uses (`--color-fg`, `--color-accent`) | ADR-0006 |
| SSR | Rendering HTML on the server per request | ADR-0004 |
| State machine | Defined set of states and allowed transitions, stored as a table | DOC-09 |
| Storefront | The customer web app (`apps/storefront`) | DOC-06 |
| Webhook | Provider-to-us HTTP callback reporting an event; verified, stored and processed idempotently | ADR-0017 |

#### 3. Rules
**Always:** reuse these terms in identifiers (`colorway`, `reservation`, `paisa`). **Never:** use "component" for a garment piece in code outside the `Component` contract type; use "price" for a float. **Common mistake:** calling the order number a secret; it is public, the `tracking_token` is the secret.

#### 4. Acceptance checklist
- [ ] Every domain/technical term introduced in a new doc is added here in the same PR.
- [ ] No term has two definitions across docs.

#### 5. Open questions and assumptions
Order and payment status sets are provisional until DOC-09 (Phase 5); Phase 7 reconciles them.

#### 6. Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Initial glossary (Phase 0) |


---

<a id="doc-01-audit"></a>

### 01 — Code Audit

| Field | Value |
|---|---|
| ID | DOC-01 |
| Title | Audit of the attached codebases |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | README (assumptions A-01…A-05) |
| Decisions used | ADR-0001 … ADR-0020 (each finding names the ADR that resolves it) |

#### 1. Purpose and scope

**Governs:** what is true of the three uploaded codebases today, with `file:line` evidence, so every later doc can say "replace X" rather than "improve things".
**Does not govern:** target design (docs 03–14), migration order (DOC-16), or the reasoning behind decisions (ADRs).

Line numbers refer to the uploaded archives as received (files dated 21–29 Sep 2026). They will drift; the finding ID is the stable handle.

#### 2. Inputs inventory

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

#### 3. Verification of the findings you asked me to check

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

#### 4. New findings

Severity: **C** critical (money or access), **H** high, **M** medium, **L** low.

##### 4.1 Orders, pricing, money integrity

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

##### 4.2 Data layer and integration

| ID | Sev | Finding | Evidence | Fix |
|---|---|---|---|---|
| F-09 | H | **Most admin data never reaches the storefront.** Only products, categories, orders and site settings are remote; promos, pages, menus, templates, reviews, attributes, sizes, size charts, collections and `storeConfig` stay in the admin's own localStorage | `admin lib/db.js:2,8,46-54` | ADR-0005, ADR-0008 |
| F-10 | H | **Storefront drops the domain model.** The adapter flattens each product to one "cheapest" variant and a size list; `kind`, `components`, `colorway`, `madeToOrder`, `sizeChartId`, `fit`, `customSizeSchemaId`, `seo` are never read anywhere in storefront `src/` (only in the adapter's input) | `catalogAdapter.js:63-95`; grep for those fields returns nothing | ADR-0014, DOC-06 PDP |
| F-11 | H | **Dual-mode code paths everywhere.** With `VITE_API_URL` unset the storefront runs on `mockData.js` and creates orders in the browser; every context branches on `apiEnabled`. Local orders never reach the admin | `utils/api.js:2-4`; `CatalogContext.jsx:13-21`; `OrdersContext.jsx:62-72` | ADR-0015 |
| F-12 | M | **Catalog endpoint returns everything, unpaginated.** The storefront then filters, sorts and searches in memory. Payload grows with catalog size | `server.js:63,69`; `Shop.jsx:19-34` | ADR-0010, DOC-10 |
| F-13 | M | **Admin writes each whole collection as one JSON blob** on every change; localStorage is ~5 MB. Fine for 30 KB fixtures, not for thousands of products with media arrays | `db.js:94-96` | ADR-0008 |
| F-14 | M | **Error contract is ad hoc.** Server returns `{error, issues?}` with English prose; storefront reads only `error` (`utils/api.js:58`) and shows it to customers; admin maps `issues` (`lib/api.js:52`). No codes, so no localization and no programmatic handling | `server.js:204-210` | DOC-10 conventions, ADR-0018 |
| F-15 | L | **zod version skew**: admin `^3.24.1`, mock-api `^3.25.76`, storefront none | three `package.json` files | ADR-0005 |

##### 4.3 Security

| ID | Sev | Finding | Evidence | Fix |
|---|---|---|---|---|
| F-16 | C | **No admin authentication, no roles, no audit trail** (see K8). Every admin user is a superuser with one shared secret | `App.jsx:26-64`; `server.js:37-42` | ADR-0012, DOC-11 |
| F-17 | M | **Uploads: in-memory, lost on restart, MIME trusted from the client header only**, 2 MB cap, no magic-byte check, no dimension limit | `server.js:17-19,179-193,198` | ADR-0011 |
| F-18 | M | **No rate limiting, no security headers/CSP, CORS `*`** on public order and tracking endpoints | `server.js:26-27` | DOC-11 |
| F-19 | L | `trust proxy` is hard-coded to 1 hop | `server.js:25` | DOC-14 |

##### 4.4 Frontend, quality and i18n

| ID | Sev | Finding | Evidence | Fix |
|---|---|---|---|---|
| F-20 | M | **Storefront has no React Compiler** while both docs imply it does; manual memoization is sparse (39 `useMemo/useCallback/memo` across both apps) | `storefront vite.config.js:6` is plain `react()`; admin `vite.config.js:7-10` has the compiler | DOC-05 |
| F-21 | M | **Fonts load via render-blocking cross-origin CSS `@import`** from Google Fonts on the storefront; admin self-hosts via `@fontsource`. No Urdu-capable font in either | `storefront index.css:1`; `admin package.json` | ADR-0018, DOC-04 |
| F-22 | M | **Not RTL-ready.** `<html lang="en">` fixed, no `dir`, no i18n library; 16 (storefront) and 18 (admin) physical-direction CSS declarations (`margin-left`, `padding-right`, `left:` …) and zero logical ones | `index.html:2`; grep of both `index.css` | ADR-0018, ADR-0006 |
| F-23 | M | **Tests: ~67 unit cases in two admin files, all in `lib/`.** No component tests; storefront zero; no CI or lint gate in any archive; no `tsconfig`/`jsconfig`/Prettier | `admin lib/__tests__/` (42 + 25 `test/it` calls); directory listing | DOC-13 |
| F-24 | L | **Storefront CMS pages are hard-coded**, so admin-authored `CmsPage` records and `Menu` records are never fetched | `CmsPage.jsx:4-22`; no pages route in `server.js` | DOC-06 CMS |
| F-25 | L | Contact and policy copy duplicate store config (`store.phone`, `store.email`) rather than reading one source | `CmsPage.jsx:29-36` | DOC-06 |

#### 5. Documentation drift (inputs that disagree with code)

| ID | Claim | Reality |
|---|---|---|
| D-01 | v3 §A1: "React Compiler enabled via @vitejs/plugin-react" for the storefront | `storefront vite.config.js:6` has no compiler preset. Only the admin has one. The storefront `README.md` repeats the Vite template sentence "React Compiler is enabled on this template" |
| D-02 | `CHANGELOG_THIS_PASS.md` (21 Sep) describes `SellerContext`, `SellerLayout`, `SellerLogin` | None of these exist in the received storefront. v3 says seller routes were removed in "Pass 4". The CHANGELOG is stale |
| D-03 | Progress doc (29 Sep): 75 Playwright tests, lint failing in `helpers.js`/`playwright.config.js`, image library "lost" | The admin zip contains no Playwright files, no `helpers.js`; but it **does** contain `lib/images.js`, `lib/imageFile.js`, `components/ImageUpload.jsx`, `__tests__/images.test.js`, and no IndexedDB usage. Either the zip is a different snapshot than the report measured, or the report is stale. Cannot verify either way |
| D-04 | v2 §2 row 2: React Router "v8 (8.4.0 current)" | Supported by an independent July 2026 source (v8.0.0 on 17 Jun 2026, v8.2.0 then) so v8 is real; the 8.4.0 number could not be checked and may be right for 21 Sep. Floors: Node ≥ 22.22, React ≥ 19.2.7, Vite ≥ 7. Storefront already meets them |

#### 6. What is good and must be kept

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

#### 7. Rules

**Always**
- Cite a finding ID (`F-xx`, `K-x`, `D-xx`) in any PR that fixes one.
- Treat §3 and §4 as a backlog source for DOC-16; every Critical and High finding must map to a roadmap task.

**Never**
- Copy code from these archives into the new apps without re-reading the finding that covers it (K4 and F-01 live inside "working" code).
- Rely on the v2/v3 docs for what the code does; use this audit.

**Common mistakes**
- Treating K9/K10 as concurrency bugs in the mock; they are design gaps that appear the moment a real DB or second instance exists.
- Fixing money by rounding better; the fix is to stop converting (ADR-0013).

#### 8. Acceptance checklist

- [ ] Every Critical/High row maps to a DOC-16 task ID.
- [ ] Every row names the doc or ADR that resolves it.
- [ ] No finding is marked fixed without a merged PR referencing its ID.

#### 9. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-1 | Is the uploaded admin zip the same snapshot the Progress doc measured? (D-03) | Treat the zip as the truth | You supply `pass6-wip.patch` or newer zips |
| Q-2 | Are `mock-api/.env` and `.env.local` committed to git? | Assume yes until shown otherwise; rotate any non-dev key | You confirm repo history |
| Q-3 | Does a repo root exist with a combined `npm run dev`? | Yes, per `mock-api/README.md` | You upload it |

#### 10. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial audit (Phase 0) |


---

<a id="doc-02-decisions-index"></a>

### 02 — Decision records (index and research register)

| Field | Value |
|---|---|
| ID | DOC-02 |
| Title | ADR index and research register |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 |
| Decisions used | ADR-0001 … ADR-0020 |

#### 1. Purpose and scope

Index of every architecture decision record (ADR) and the single place where research evidence is logged. **Governs:** ADR numbering, template, lifecycle. **Does not govern:** the decisions themselves (each ADR file does).

#### 2. ADR index

| ADR | Decision | Status | Resolves |
|---|---|---|---|
| [0001](#adr-0001) | Build a modular-monolith commerce backend; borrow Medusa's patterns, not its code | Proposed | K8, F-09 |
| [0002](#adr-0002) | Strict TypeScript for all new code; admin migrated incrementally | Proposed | K3, F-15, F-23 |
| [0003](#adr-0003) | pnpm workspaces + Turborepo | Proposed | K2, K3 |
| [0004](#adr-0004) | Storefront on React Router v8 framework mode, SSR + CDN caching | Proposed | K7 |
| [0005](#adr-0005) | REST + OpenAPI, one Zod 4 contract package | Proposed | K2, F-14, F-15 |
| [0006](#adr-0006) | Tailwind v4 + three-tier CSS-variable tokens, logical properties only | Proposed | K1, F-22 |
| [0007](#adr-0007) | Owned shadcn-style components on Base UI | Proposed | K1 |
| [0008](#adr-0008) | MySQL 8.4 + Drizzle (pinned 0.45.x) | Proposed | F-13 |
| [0009](#adr-0009) | MySQL-backed jobs + transactional outbox; HTTP/CDN cache first | Proposed | — |
| [0010](#adr-0010) | MySQL FULLTEXT + synonyms + SQL facets at launch | Proposed | F-12 |
| [0011](#adr-0011) | S3-compatible object storage + on-the-fly image transforms | Proposed | F-17 |
| [0012](#adr-0012) | Server sessions, Argon2id, TOTP, RBAC; no shared key | Proposed | K8, F-16 |
| [0013](#adr-0013) | Integer paisa everywhere; no float rupees | Proposed | K4, F-01 |
| [0014](#adr-0014) | Style → Colorway → Size catalog model | Proposed | F-08, F-10 |
| [0015](#adr-0015) | Loaders on storefront, TanStack Query/Table/Virtual in admin, Zustand for cart UI state | Proposed | K3, K5, F-11 |
| [0016](#adr-0016) | Fastify 5 modular monolith with enforced module boundaries | Proposed | — |
| [0017](#adr-0017) | COD-first; provider interface; hosted-redirect gateways; signed idempotent webhooks | Proposed | F-02 |
| [0018](#adr-0018) | English at launch, Urdu/RTL-ready from day one | Proposed | F-14, F-21, F-22 |
| [0019](#adr-0019) | Single-region container host + managed MySQL + CDN | Proposed | F-19 |
| [0020](#adr-0020) | Server-side pricing, idempotent order creation, stock reservation, sequence order numbers | Proposed | K9, K10, K11, F-01…F-03 |

Status values: **Proposed** (this phase), **Accepted** (you approve), **Superseded by ADR-xxxx**.

#### 3. ADR template (every ADR file follows it)

1. Header table (ID, title, status, owner, last updated, depends on, decisions used)
2. Purpose and scope
3. Context
4. Options considered (at least two, with a comparison)
5. Decision (the specification)
6. Examples (config, code, paths)
7. Consequences
8. Rules (Always / Never, common mistakes)
9. Acceptance checklist
10. Revisit trigger
11. Open questions and assumptions
12. Changelog

#### 4. Research register

Confidence: **P** primary doc read; **S** secondary (blog, comparison, vendor marketing); **A** author judgement, not researched this phase. Vendor-authored comparisons are marked *(vendor)* because they have an interest.

| Topic | Finding | Source and date | Conf. | Verdict |
|---|---|---|---|---|
| React Router | v8.0.0 shipped 17 Jun 2026; v8.2.0 was current in July 2026; floors Node ≥ 22.22, React ≥ 19.2.7, Vite ≥ 7 in framework mode. 7.18.1 (29 Jun 2026) is the last 7.x seen | scrimba.com "React Router: A Complete Guide [2026]" (Jul 2026); react-router CHANGELOG (raw.githubusercontent.com, v7.18.1) | S / P | **Adopt** (ADR-0004) |
| Medusa v2 | v2.18.0 on 23 Jul 2026; Node/TS/Postgres, REST, modules + workflows. Stripe is the only first-party payment provider; local providers are custom or community plugins | stork.ai Medusa page (Jul 2026); hyperswitch.io blog "Add multiple payment providers…" (Jun 2026) *(vendor)* | S | **Adapt** patterns, **reject** adoption (ADR-0001) |
| Vendure | TypeScript/NestJS, GraphQL, Angular admin; core is open-core not permissive; no managed cloud | vendure.io "Best headless commerce platforms" (19 Jun 2026) *(vendor)*; contracollective.com (14 Jun 2026) | S | **Reject** (ADR-0001) |
| Saleor | Python/Django, GraphQL-first, needs Redis + Celery worker; strong attribute/variant model | openreplay.com "5 open source e-commerce platforms" (2026) | S | **Reject**; **adapt** attribute-schema idea (ADR-0014) |
| Sylius | PHP/Symfony | same openreplay article | S | **Reject** (stack mismatch) |
| Shopify Polaris/Hydrogen | Not researched this phase | — | A | Polaris **adapt** as admin UX reference in DOC-04/07 (to be researched there) |
| shadcn/ui, Radix, Base UI | From 3 Jul 2026 `shadcn init` defaults to Base UI; Radix not deprecated and still supported (`-b radix`); Base UI 1.0 stable Dec 2025, 1.8.0 on 4 Sep 2026. One GitHub PR author claims "Radix is no longer being developed" — not corroborated by the shadcn changelog summary | blog.openreplay.com "shadcn/ui Has Switched From Radix to Base UI" (Sep 2026); ui.aceternity.com alternatives (Jul 2026); github.com/rustfs/console PR #115 (May 2026) | S | **Adopt** shadcn-style + Base UI; **reject** new Radix (ADR-0007) |
| Zod 4 | Stable; package root exports v4; `@hookform/resolvers` ≥ 5.1.0 supports v4 and v3; codemod `npx zod-v3-to-v4`; Zod tested on TypeScript ≥ 5.5 | zod.dev (seen in search results, Oct 2026; not fetched); zenn.dev RHF/Zod 4 article (2025); playbooks.com zod-4 skill | P / S | **Adopt** (ADR-0005) |
| Drizzle vs Prisma | Sep 2026: Drizzle 0.45.2 stable, 1.0 in beta, Drizzle team now at PlanetScale; Prisma 7.10 stable, Prisma 8 in RC | makerkit.dev "Drizzle vs Prisma ORM in 2026" (updated Sep 2026) | S | **Adopt** Drizzle pinned 0.45.x (ADR-0008) |
| MySQL vs PostgreSQL vs MongoDB | Owner requires Node.js + MySQL or MongoDB. MySQL chosen: order/stock/promo writes need multi-row transactions, row locks, FKs and `CHECK` constraints (ADR-0020), and the DOC-09 model is relational. MongoDB rejected: those invariants would move back into application code. MySQL 8.4 LTS feature claims used here (`CHECK`, `SKIP LOCKED`, `JSON`, InnoDB `FULLTEXT`) and Drizzle's `mysql-core` + `mysql2` driver were **not re-verified against primary docs** | Owner decision, 2 Oct 2026 | A | **Adopt** MySQL 8.4 (ADR-0008); verify in the DOC-08 spike |
| Pakistan payment gateways | JazzCash Online Payment Gateway advertises hosted checkout with cards, mobile account, voucher; Easypay publishes integration guides; SBP documents Raast P2M. No primary API docs were readable: merchant docs are gated behind onboarding | tessl.io/openskillindex summaries (Jul–Aug 2026) *(third-party, low quality)*; official URLs named in them not fetched | S (weak) | **Provisional**; DOC-12 must verify from merchant-portal docs before any adapter is built (ADR-0017) |
| React Compiler | `babel-plugin-react-compiler ^1.0.0` is already used in the admin (stable line) | `admin-panel/package.json` | P (code) | **Adopt** for all new apps (DOC-05) |
| Tailwind v4, TanStack Query/Table/Virtual, React Hook Form, Turborepo, pnpm, Fastify, Meilisearch, Base UI RTL behaviour | **Not researched in Phase 0** | — | A | Flagged inside the ADR; verification is a named task in the phase that first depends on it |
| Reference storefronts (Nike, IKEA, Zalando, ASOS, Khaadi, Sapphire, Gul Ahmed, Alkaram), bulletproof-react, Feature-Sliced Design | **Not researched in Phase 0.** The v2 doc already tore down Akbar Aslam and Sana Safinaz (text/structure only) | v2 doc §3 | — | Done in Phase 1 (bulletproof-react, FSD) and Phase 2 (storefronts) |

Anything older than 12 months must be flagged here. None of the sources above is older than 12 months except the Zod 4 resolver note (mid-2025), which is cross-checked against zod.dev.

#### 5. Rules

**Always:** one decision per ADR; at least two real options; a revisit trigger with a measurable condition; update the index and the superseded ADR when a decision changes.
**Never:** edit an Accepted ADR in place to change its meaning (supersede it); record a decision only in chat.
**Common mistake:** writing "TBD" for a value; instead state the assumption (README A-xx) and the trigger that reopens it.

#### 6. Acceptance checklist

- [ ] ADR file exists for every row in §2 and follows §3.
- [ ] Every research claim in an ADR appears in §4 with source and date.
- [ ] Every ADR has a revisit trigger.

#### 7. Open questions and assumptions

See README CQ-1…CQ-3.

#### 8. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Created with ADR-0001…0020 (Phase 0) |


---

<a id="adr-0001-build-vs-adopt"></a>

### ADR-0001 — Build a modular-monolith commerce backend; borrow Medusa's patterns, not its code

| Field | Value |
|---|---|
| ID | ADR-0001 |
| Title | Build vs adopt the commerce engine |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01, README A-01, A-02, A-03, A-05 |
| Decisions used | ADR-0002, ADR-0008, ADR-0016, ADR-0017 |

#### Purpose and scope
Decides whether Noor & Co. builds its own commerce backend or adopts an engine. Governs the backend only; storefront and admin UI are separate decisions (ADR-0004, ADR-0007).

#### Context
- Team is 2–3 developers plus AI coding agents (A-01). Existing assets: a 19-screen admin with a domain-specific product editor and a rich Zod contract (DOC-01 §6); no backend beyond an in-memory mock.
- Domain is unusual for off-the-shelf engines: product kinds (stitched/unstitched/made-to-order/footwear/bundle), per-piece components, Style→Colorway→Size, custom measurements, deposits and lead times, city-based COD shipping, COD confirmation, tracking by order number + phone.
- Payments are COD plus local wallets/gateways (JazzCash, Easypaisa, Raast, bank transfer). Medusa's only first-party provider is Stripe; local providers are custom work in any engine.
- The audit shows the dangerous code is exactly cart, pricing, promos, stock and order state (F-01…F-03, K9…K11): the part an engine would give us.

#### Options considered

| Criterion (weight) | A. Custom modular monolith | B. Medusa v2 (2.18.0, Jul 2026) | C. Vendure | D. Saleor | E. Sylius | F. Shopify + Hydrogen |
|---|---|---|---|---|---|---|
| Fit to our domain model (high) | Exact | Good via custom modules + links | Good (plugins) | Best variants/attributes | Good | Metafield workarounds |
| Time to a safe checkout (high) | Slowest | Fast for cart/promo/inventory/order | Fast | Fast | Fast | Fastest |
| Local payments/COD logic (high) | Ours | Custom provider needed | Custom | Custom | Custom | Gateway availability unverified |
| Team skills (TS) (high) | Match | Match | Match (NestJS, Angular admin) | Python/Django: mismatch | PHP: mismatch | Liquid/Hydrogen |
| Reuse of existing admin UI (med) | High | Low: Medusa Admin replaces it or we extend it | Low | Low | Low | None |
| Ops burden (med) | One Node process + MySQL | One Node process + Postgres (+ Redis) | Node + DB | Python + Redis + Celery | PHP stack | None |
| Lock-in / data ownership (med) | None | Low (MIT) | Open-core licence | Low (BSD-3) | Low | High |

#### Decision
**Option A: build a modular monolith (ADR-0016) on Node + TypeScript + MySQL.** Copy Medusa's *patterns*: independent modules with explicit public interfaces, workflows with compensation steps, domain events through an outbox (ADR-0009). Do not install Medusa.

**v1 scope cut (what we will not build):** multi-currency, multi-warehouse, B2B price lists, gift cards, subscriptions, marketplace/multi-vendor, loyalty points. The contract's `features.multiCurrency` flag stays `false`.

**Buy, don't build:** payment gateways (hosted redirect), courier booking/tracking (adapter per courier, DOC-12), email/SMS/WhatsApp delivery, image transforms (ADR-0011).

**Honesty note:** this is the highest-risk decision in the set and the one most sensitive to team size and deadline. It is made under assumptions A-01 and A-05; CQ-1 in the README asks you to confirm them.

#### Examples
Module boundary rule that stands in for the engine's isolation (enforced in ADR-0016):
```
apps/api/src/modules/
  catalog/  pricing/  inventory/  cart/  orders/  payments/  shipping/
  customers/  promotions/  content/  identity/  audit/
# a module may import only another module's `index.ts` (its public API)
```

#### Consequences
**Positive:** exact domain fit; one Zod contract end to end; admin UI reused; no engine upgrade treadmill.
**Negative:** we own cart totals, promotion stacking, refunds, returns and inventory correctness; estimated cost is the largest line in DOC-16.
**Mitigations:** v1 scope cut above; property-based tests on pricing and stock (DOC-13); the consistency rules in ADR-0020.

#### Rules
**Always:** put money-moving logic behind a module's public API with tests. **Never:** add a feature from the cut list without a new ADR. **Common mistake:** re-implementing a hosted-gateway feature (retries, 3-D Secure) in our code.

#### Acceptance checklist
- [ ] Every module in `apps/api/src/modules` has an `index.ts` and a README row in DOC-08.
- [ ] No imports cross module internals (lint rule, DOC-08).
- [ ] Cut-list features are absent from the contract.

#### Revisit trigger
Reopen with a 3-day Medusa spike if **any**: (a) checkout + orders + inventory do not pass the DOC-13 acceptance suite within 6 weeks of backend start; (b) team drops to one developer; (c) a required feature on the cut list becomes launch-critical; (d) COD/shipping logic turns out to fit Medusa workflows without forking.

#### Open questions and assumptions
Assumes A-01 (2–3 devs), A-05 (about 12 weeks to a public MVP). Medusa and Vendure facts come from secondary and vendor sources (see DOC-02 §4); a spike would verify them first-hand.

#### Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |
| 2026-10-02 | Datastore named in Option A changed to MySQL (ADR-0008) |


---

<a id="adr-0002-typescript"></a>

### ADR-0002 — Strict TypeScript for all new code; admin migrated incrementally

| Field | Value |
|---|---|
| ID | ADR-0002 |
| Title | TypeScript migration |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (K3, F-15, F-23), ADR-0003 |
| Decisions used | ADR-0005 |

#### Purpose and scope
Governs language and compiler settings for `apps/*` and `packages/*`. Does not govern lint style (DOC-15).

#### Context
All three codebases are untyped JavaScript (`.jsx`, `.js`; no `tsconfig`/`jsconfig`, F-23). The contract is the integration point, and its drift (K2) is a typing problem. v2 already chose TypeScript; this ADR fixes *how*. Zod is tested against TypeScript ≥ 5.5 (zod.dev).

#### Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Stay JS + JSDoc | No migration | Contract types unenforced; agents guess shapes |
| B. Big-bang TS rewrite of admin | Clean | Weeks of zero feature progress |
| C. Strict TS for everything new; migrate admin file by file | Value early; low risk | Mixed codebase for a while |

#### Decision
**Option C.**
- New: `apps/storefront`, `apps/api`, `packages/*` are TypeScript only.
- Admin: becomes `apps/admin`; `allowJs: true`, `checkJs: false` during migration. Any file edited by more than 10 lines is renamed to `.ts/.tsx` in the same PR. A CI counter (`scripts/ts-ratio.mjs`) fails if the TS share of admin `src/` goes down.
- Compiler: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax`, `moduleResolution: "bundler"` (apps) / `"NodeNext"` (api). TypeScript ≥ 5.5, pinned in the root `package.json`.
- Types derive from Zod: `type Product = z.infer<typeof Product>`; hand-written duplicates of contract types are forbidden.

#### Examples
`packages/config/tsconfig.base.json`:
```json
{ "compilerOptions": { "target": "ES2023", "strict": true, "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true, "verbatimModuleSyntax": true, "skipLibCheck": true, "isolatedModules": true } }
```

#### Consequences
Typed contract end to end; first weeks of admin work include rename noise in diffs; agents get compile errors instead of silent shape drift.

#### Rules
**Always:** `unknown` plus a Zod parse at every boundary (network, storage, URL). **Never:** `any`, `// @ts-ignore` (use `@ts-expect-error` with a reason), non-null `!` outside tests. **Common mistake:** casting API JSON to a type instead of parsing it.

#### Acceptance checklist
- [ ] `pnpm typecheck` passes in CI for every package.
- [ ] ESLint `@typescript-eslint/no-explicit-any` is `error`.
- [ ] Admin TS ratio never decreases.

#### Revisit trigger
Admin TS share below 50% six weeks after M1 starts, or TypeScript's native compiler becoming the default toolchain (re-evaluate settings).

#### Open questions and assumptions
Assumes TypeScript ≥ 5.5 is available. Native-compiler status not researched.

#### Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |


---

<a id="adr-0003-monorepo"></a>

### ADR-0003 — pnpm workspaces + Turborepo

| Field | Value |
|---|---|
| ID | ADR-0003 |
| Title | Monorepo tool |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (K2, K3), ADR-0002 |
| Decisions used | ADR-0005, ADR-0007 |

#### Purpose and scope
Repository layout, workspace tool and task runner. Does not govern branching (DOC-15) or CI jobs (DOC-14).

#### Context
Three separate projects copy the contract and utilities by hand (K2, K3; `mock-api/schemas.js:1-2`). The brief requires one Zod contract package and a shared UI package. A root repo already exists informally (`mock-api/README.md` refers to one) but was not supplied.

#### Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Polyrepo + published packages | Isolation | Version dance for a 3-person team; the exact drift we have now |
| B. pnpm workspaces only | Simple | No task graph/caching; manual ordering |
| C. pnpm workspaces + Turborepo | Task graph, caching, small config | One more tool |
| D. Nx | Rich generators, boundaries | Heavier; more concepts for agents to learn |

#### Decision
**Option C.** Package manager pinned with the `packageManager` field; Node pinned to **22.22** in `.nvmrc` (React Router v8 floor, ADR-0004).

```
noor/
  apps/ storefront/  admin/  api/
  packages/ contract/  ui/  config/  i18n/
  docs/
  turbo.json  pnpm-workspace.yaml  package.json  .nvmrc
```
- `packages/contract`: Zod schemas, route table, `Money` helpers. No React, no Node APIs.
- `packages/ui`: tokens + components (ADR-0006/0007). Depends on React only.
- `packages/config`: `tsconfig.base.json`, ESLint flat config, Tailwind preset.
- `packages/i18n`: message catalogs and formatters (ADR-0018).
- Import direction: `apps/*` → `packages/*`; packages never import apps; `contract` imports nothing internal.

#### Examples
`turbo.json` tasks: `build` (dependsOn `^build`), `typecheck`, `lint`, `test`, `dev` (persistent, not cached).

#### Consequences
One place for the contract; atomic cross-app changes; CI can run only affected tasks.

#### Rules
**Always:** declare workspace deps as `workspace:*`. **Never:** deep-import another package's `src/` path; copy code between packages. **Common mistake:** putting a helper in an app because "only one app uses it today"; if two apps do, move it in the same PR.

#### Acceptance checklist
- [ ] `pnpm install && pnpm turbo run build typecheck lint test` passes on a clean clone.
- [ ] No duplicated `Money`, `ApiError`, `usePersistentState` implementations remain (K3).

#### Revisit trigger
More than 8 workspaces, or CI over 10 minutes with Turborepo caching on, or a need for enforced module boundaries beyond ESLint (consider Nx).

#### Open questions and assumptions
Turborepo and pnpm were **not researched in Phase 0** (author judgement); verify current majors during M0 repo setup. Assumes the team accepts a single repo.

#### Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |


---

<a id="adr-0004-storefront-rendering"></a>

### ADR-0004 — Storefront on React Router v8 framework mode, SSR with CDN caching

| Field | Value |
|---|---|
| ID | ADR-0004 |
| Title | Storefront rendering |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (K7), README A-03, ADR-0003, ADR-0005 |
| Decisions used | ADR-0015, ADR-0018, ADR-0019 |

#### Purpose and scope
How storefront pages are rendered and cached. Not the page designs (DOC-06) or SEO details (DOC-06 SEO).

#### Context
The current storefront is client-rendered (`index.html:7` title `ecommerce-website`, no meta; catalog fetched in `CatalogContext.jsx:28-50`). Fashion e-commerce lives on search and social links, so crawlers and link previews must see real HTML. Customers are mostly on mid-range Android and mobile data, so JavaScript and payload size matter. The team already uses Vite 8, React 19.2.8 and React Router (6.28), which meet v8's floors (Node ≥ 22.22, React ≥ 19.2.7, Vite ≥ 7).

#### Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Next.js (App Router, RSC) | Largest ecosystem; ISR/on-demand revalidation built in | New mental model (server/client components) for a team on RR; heavier framework surface; bigger lock-in to its caching semantics |
| B. React Router v8 framework mode | Same router the team knows; loaders/actions; SSR + pre-render; Vite-based; v2 doc already chose it | v8 is young (8.0.0 on 17 Jun 2026); no built-in ISR |
| C. SPA + prerender | Smallest change | Product/listing pages change daily; prerender staleness; still CSR for most routes |
| D. Astro + React islands | Best baseline performance | Cart/checkout/account are heavily interactive; two component models |

#### Decision
**Option B.** `apps/storefront` is a React Router v8 framework-mode app deployed as a Node server (ADR-0019), behind a CDN.

| Route class | Rendering | Cache-Control (origin) |
|---|---|---|
| Home, category/PLP, collection, PDP | SSR, streamed | `public, s-maxage=60, stale-while-revalidate=600`; purge by tag on publish (DOC-08) |
| CMS pages, policies, size guide | Pre-rendered at build + SSR fallback | `public, s-maxage=3600, stale-while-revalidate=86400` |
| Cart, checkout, order confirmation, track order, account | SSR shell, client interactivity | `private, no-store` |
| `sitemap.xml`, `robots.txt`, product feeds | Resource routes | `public, s-maxage=3600` |

- **Data path:** loaders run on the storefront server and call the API over the internal network (BFF). No credentials ship to the browser; the admin key concern (K8) cannot recur here.
- Loaders parse every API response with `packages/contract` schemas (ADR-0005).
- Store theme tokens from the API are injected as an inline `<style>` in the root loader so there is no flash of default theme (DOC-04).
- Budgets: JS per route ≤ 170 kB gzip on PLP/PDP, LCP ≤ 2.5 s on throttled 4G mid-range Android (DOC-13).

#### Examples
`apps/storefront/app/routes.ts`:
```ts
import { type RouteConfig, route, index, layout } from "@react-router/dev/routes";
export default [
  layout("routes/_shell.tsx", [
    index("routes/home.tsx"),
    route("c/:handle", "routes/category.tsx"),
    route("p/:handle", "routes/product.tsx"),
    route("cart", "routes/cart.tsx"),
    route("checkout", "routes/checkout.tsx"),
    route("track", "routes/track.tsx"),
    route("pages/:slug", "routes/page.tsx"),
  ]),
] satisfies RouteConfig;
```
Product URLs use `handle`, not the id (today `/product/:id`, `App.jsx:20`).

#### Consequences
SEO and link previews work; first paint no longer waits for JS. We operate a Node server for the storefront and own cache invalidation. Existing React Router 6 declarative code is rewritten into route modules.

#### Rules
**Always:** return `Cache-Control` explicitly from every loader/route; use `handle` URLs; validate loader data. **Never:** read `localStorage` during render; put customer data in a cacheable response. **Common mistake:** caching a page that embeds the cart count.

#### Acceptance checklist
- [ ] `curl -s <pdp-url> | grep '<title>'` shows the product title (no JS needed).
- [ ] JSON-LD `Product` present in server HTML.
- [ ] No route in the `no-store` class is cacheable by the CDN.

#### Revisit trigger
Reconsider Next.js if **any**: two or more production regressions traced to React Router upgrades in 90 days; a hard need for on-demand per-page revalidation that tag purging cannot meet; React Server Components become necessary for the JS budget.

#### Open questions and assumptions
v2's Google "dynamic rendering is a workaround" quote and the Baymard "load more" evidence were not re-verified. React Router's experimental RSC support (noted in 7.x changelogs) is not relied upon.

#### Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed; keeps v2's decision, adds cache classes and data path |


---

<a id="adr-0005-api-and-contract"></a>

### ADR-0005 — REST + OpenAPI with one Zod 4 contract package

| Field | Value |
|---|---|
| ID | ADR-0005 |
| Title | API style and contract |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (K2, F-14, F-15), ADR-0002, ADR-0003 |
| Decisions used | ADR-0013, ADR-0016 |

#### Purpose and scope
API style, contract ownership, validation and versioning rule. Endpoint lists are DOC-10; error and pagination conventions are `10-api/conventions.md`.

#### Context
The contract exists in three drifting forms (K2). Zod 3 is used today (admin ^3.24.1, mock ^3.25.76, F-15). Zod 4 is stable; its package root exports v4; `@hookform/resolvers` ≥ 5.1.0 supports Zod 4 (DOC-02 §4).

#### Options considered
| Option | Pros | Cons |
|---|---|---|
| A. REST + OpenAPI generated from Zod | Cacheable GETs (CDN), simple clients, tool-friendly for agents, third parties can integrate | Route table must be maintained |
| B. GraphQL | Flexible reads | Harder CDN caching; resolver/N+1 discipline; extra stack for a small team |
| C. Typed RPC (tRPC-style) | Least boilerplate | Couples clients to server code; weak for public/third-party and CDN-cacheable reads |

#### Decision
**Option A.**
- One package, `packages/contract`, written in **Zod 4** (`import { z } from "zod"`): entity schemas, request/response schemas, and a **route table**:
```ts
export const routes = {
  "catalog.listProducts": { method: "GET", path: "/api/v1/products", auth: "public",
    query: ListProductsQuery, response: Page(ProductSummary) },
  "orders.create": { method: "POST", path: "/api/v1/orders", auth: "public", idempotent: true,
    body: CreateOrderBody, response: OrderPublic },
} as const;
```
- Server registers handlers from the table and validates request input in every environment; validates responses in dev/test only. Storefront and admin call a typed client built from the same table.
- OpenAPI 3.1 is generated from the table (`z.toJSONSchema`) in CI and published as an artifact; hand-edited OpenAPI is forbidden.
- Versioning: path prefix `/api/v1`. Breaking change = new prefix; additive changes are not breaking.
- Money in JSON is `{ "amount": <int paisa>, "currency": "PKR" }` (ADR-0013).
- All admin routes live under `/api/v1/admin/*`; public under `/api/v1/*`.
- Error format: RFC 9457 `application/problem+json` with a stable `code` (DOC-10 conventions), replacing today's ad hoc `{error, issues}` (F-14).
- Migrating from Zod 3: run the official codemod `npx zod-v3-to-v4`, then fix `.email()`→`z.email()` style changes by hand; use `@hookform/resolvers` ≥ 5.1.0.

#### Examples
`packages/contract/src/money.ts`:
```ts
import { z } from "zod";
export const Money = z.object({ amount: z.number().int().safe(), currency: z.literal("PKR") });
export type Money = z.infer<typeof Money>;
```

#### Consequences
One source of truth; drift (K2) becomes a compile error. Contract package changes ripple to all apps, which is the point. The v1 contract is PKR-only (multi-currency is on the cut list, ADR-0001).

#### Rules
**Always:** add the route to the table first, then the handler, then the client call. **Never:** define a request/response shape inside an app; return a bare string error. **Common mistake:** adding a field to the DB and forgetting the contract (response validation in tests catches it).

#### Acceptance checklist
- [ ] `packages/contract` has no dependency except `zod`.
- [ ] CI regenerates OpenAPI and fails on diff against the committed snapshot.
- [ ] No app imports `zod` schemas that duplicate a contract schema.

#### Revisit trigger
Reconsider GraphQL if three or more distinct client apps with very different read shapes appear; reconsider RPC if no third-party consumer exists after 12 months and CDN caching of GETs is not used.

#### Open questions and assumptions
The implementation helper (hand-rolled route table vs a library) is decided in DOC-08 after a spike; the *contract shape above* is the fixed part. Zod 4 `z.toJSONSchema` availability is taken from secondary skill docs and must be confirmed against zod.dev during M0.

#### Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |


---

<a id="adr-0006-styling-and-tokens"></a>

### ADR-0006 — Tailwind v4 with three-tier CSS-variable tokens; logical properties only

| Field | Value |
|---|---|
| ID | ADR-0006 |
| Title | Styling and design tokens |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (K1, F-21, F-22), ADR-0003, ADR-0007 |
| Decisions used | ADR-0018 |

#### Purpose and scope
How styles are authored and how tokens, brand themes and light/dark are layered. The token values themselves live in DOC-04 `tokens.md`.

#### Context
Two token systems exist: storefront gold/Playfair, no dark mode (`index.css:1,3-57`); admin burgundy/Instrument Sans with dark mode (`index.css:7-141`). The admin contract already carries a storefront theme (`ThemeTokens`, `admin schemas.js:235-250`) that the admin edits at runtime. Both apps use physical-direction CSS (16 and 18 declarations) which breaks Urdu/RTL (F-22). v2 chose CSS Modules + tokens; the admin uses plain global CSS (35 KB `index.css`).

#### Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Tailwind v4 (CSS-first `@theme`) + CSS variables | Matches shadcn-style components (ADR-0007); unused utilities are not shipped; logical utilities (`ms-*`, `ps-*`, `start-*`); agents know it well | Class-heavy markup; build dependency |
| B. CSS Modules + CSS variables (v2 choice) | Plain CSS; scoped | Slower to build many primitives; no ready logical-property utilities; shadcn components would need translating |
| C. vanilla-extract / Panda (typed CSS-in-TS) | Typed tokens | Extra build complexity; smaller agent familiarity |
| D. Keep global CSS | No migration | Two systems stay; no guardrail against physical properties |

#### Decision
**Option A. This supersedes v2's "CSS Modules + tokens".**

Three tiers, defined once in `packages/ui/src/tokens.css`:
1. **Primitive** — raw scales (`--gray-50…950`, `--space-1…`, `--radius-*`). Never used directly in components.
2. **Semantic** — what a component uses: `--color-bg`, `--color-surface`, `--color-fg`, `--color-muted`, `--color-line`, `--color-accent`, `--color-on-accent`, `--color-sale`, `--color-success`, `--color-warning`, `--color-danger`, `--color-focus`, plus `--font-heading`, `--font-body`, `--radius-control`, `--radius-card`. Light values on `:root`; dark overrides under `[data-theme="dark"]` and `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`.
3. **Brand** — per-app/per-store overrides on `[data-brand="storefront-gold"]`, `[data-brand="admin-burgundy"]`. Store theme from the API sets semantic variables at request time.

- Tailwind `@theme` maps utilities to the semantic variables (`bg-bg`, `text-fg`, `border-line`).
- **Logical properties only.** Use `ms-/me-/ps-/pe-/start-/end-`, `text-start`, `border-s`. Physical utilities (`ml-`, `pr-`, `left-`, `text-left`) are lint errors (DOC-15 rule `no-physical-direction`). Exceptions are listed in DOC-04.
- Store theme injection: the API returns `ThemeTokens`; the storefront root loader validates every color against `^#[0-9a-f]{6}$` and every font against an allow-list before writing `<style>`; any invalid value falls back to the brand default (prevents CSS injection from admin data).
- Fonts are self-hosted (`@fontsource-variable/*` or files in `public/fonts`), `font-display: swap`, subset by `unicode-range`; no Google Fonts `@import` (F-21).

#### Examples
```css
/* packages/ui/src/tokens.css */
@import "tailwindcss";
@theme {
  --color-bg: var(--sem-bg);
  --color-fg: var(--sem-fg);
  --color-accent: var(--sem-accent);
}
:root { --sem-bg: #FBF8F3; --sem-fg: #141210; --sem-accent: #886615; }
[data-theme="dark"] { --sem-bg: #141210; --sem-fg: #F3EEE6; --sem-accent: #E8C766; }
```
(Values are illustrative; DOC-04 holds the real, contrast-checked set. Note the storefront's own comment that `#C9A227` is ~2.3:1 and unsafe for text, `index.css:15`.)

#### Consequences
One token vocabulary across apps; dark mode and RTL are properties of the system, not per-page work; existing admin CSS is migrated component by component.

#### Rules
**Always:** use semantic tokens; verify 4.5:1 text contrast in both schemes. **Never:** hard-code hex in components; use physical-direction utilities; interpolate admin-supplied strings into CSS without validation. **Common mistake:** using a primitive token directly "just once".

#### Acceptance checklist
- [ ] `grep -rE "(^|[^-a-z])(ml|mr|pl|pr|left|right)-" apps packages` returns nothing (outside DOC-04 exceptions).
- [ ] Both schemes pass axe contrast checks on every shipped component story.
- [ ] No `@import url(https://fonts.googleapis…)` anywhere.

#### Revisit trigger
Tailwind build or upgrade cost exceeds 2 dev-days twice in 6 months, or admin-driven theming needs more than CSS variables can express.

#### Open questions and assumptions
Tailwind v4 specifics were not researched in Phase 0; the first task of Phase 1 verifies the `@theme` syntax against tailwindcss.com before DOC-04 is finalised. Assumes the team accepts utility classes.

#### Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed; supersedes v2's CSS Modules choice |


---

<a id="adr-0007-component-foundation"></a>

### ADR-0007 — Owned shadcn-style components on Base UI

| Field | Value |
|---|---|
| ID | ADR-0007 |
| Title | Component foundation (Radix vs shadcn-style, which primitives) |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (K1), ADR-0006 |
| Decisions used | ADR-0018 |

#### Purpose and scope
Which headless primitive library and distribution model back `packages/ui`. Component APIs are DOC-04 `components.md`.

#### Context
The admin uses seven `@radix-ui/*` packages (`admin package.json`: collapsible, dialog, dropdown-menu, switch, tabs, toast, tooltip). Since 3 Jul 2026 `shadcn init` defaults to Base UI; Radix is not deprecated and remains selectable. Base UI reached 1.0 in Dec 2025 and 1.8.0 on 4 Sep 2026 (DOC-02 §4; secondary sources). One GitHub PR author says Radix "is no longer being developed"; this is uncorroborated and is not used as evidence.

#### Options considered
| Option | Pros | Cons |
|---|---|---|
| A. shadcn-style on Radix | Largest example base; admin already uses Radix | Maintenance-pace concern; ecosystem defaults moving away |
| B. shadcn-style on Base UI | Current default; actively released; same authors' lineage | Younger; API differs (`render` prop vs `asChild`); fewer snippets |
| C. React Aria Components | Strong accessibility and i18n story | Different styling model; more rewrite |
| D. Keep current hand-rolled + Radix | No work | Two primitive stacks (hand-rolled `ui.jsx`, Radix); no system |

#### Decision
**Option B.** `packages/ui` holds **owned** components (copied via the shadcn CLI with a `base-*` style, then edited), built on `@base-ui/react`, styled with Tailwind tokens (ADR-0006).
- No new `@radix-ui/*` dependencies. Existing admin Radix usage is replaced when that component is rebuilt in `packages/ui`; a component never mixes both libraries.
- Composition uses Base UI's `render` prop, not Radix's `asChild`.
- **Mandatory spike (first task of Phase 1/M0):** verify in an RTL Urdu page that Dialog, Menu, Tabs, Combobox/Select and Tooltip mirror correctly and keep keyboard behaviour. If any fails without a small patch, fall back to Option A for that component only and record it here.

#### Examples
```
packages/ui/src/components/button.tsx
packages/ui/src/components/dialog.tsx      // wraps @base-ui/react Dialog
packages/ui/components.json                // shadcn config: style "base-nova"
```

#### Consequences
We own the code of every primitive wrapper (more maintenance, full control); upgrades are deliberate. The admin is migrated gradually.

#### Rules
**Always:** keep the public props of each component stable and documented in DOC-04; include keyboard and RTL tests. **Never:** import a primitive library directly in an app; style with hard-coded values. **Common mistake:** copying a Radix-flavoured snippet from an older tutorial into a Base UI project.

#### Acceptance checklist
- [ ] `grep -r "@radix-ui" apps/*/package.json packages/*/package.json` is empty after the admin migration milestone.
- [ ] Each component has Storybook stories for all states and an axe test.
- [ ] RTL spike result is recorded in DOC-04.

#### Revisit trigger
Spike fails on two or more components; Base UI ships a breaking major that costs more than 3 dev-days; or shadcn changes its default again.

#### Open questions and assumptions
Base UI RTL behaviour is **not verified**. Base UI tooltip delay default (50 ms vs Radix 200 ms) will be set explicitly in DOC-04.

#### Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |


---

<a id="adr-0008-database-and-orm"></a>

### ADR-0008 — MySQL 8.4 + Drizzle ORM (pinned 0.45.x)

| Field | Value |
|---|---|
| ID | ADR-0008 |
| Title | Database, ORM, migrations |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | ADR-0001, ADR-0002, ADR-0013, README A-03 |
| Decisions used | ADR-0016, ADR-0020 |

#### Purpose and scope
System of record, data-access library and migration workflow. Table definitions are DOC-09.

#### Context
Today data is an in-memory array (`server.js:9-16`) or a localStorage JSON blob per collection (`db.js:94-96`, F-13). Orders need transactions, row locks and gap-safe counters (ADR-0020). The owner requires Node.js with MySQL or MongoDB. Scale assumption A-03: about 3,000 products / 25,000 variants, up to 1,500 orders/day on sale days.

#### Options considered
| Option | Pros | Cons |
|---|---|---|
| A. MySQL 8.4 (InnoDB) + Drizzle | Owner's stack; SQL-first, typed, light runtime, SQL migrations; cheap managed and shared hosting everywhere, including Pakistan | Drizzle 1.0 in beta; API churn risk; no sequences, no partial indexes, no trigram search, DDL is not transactional |
| B. MySQL + Prisma (7.10 stable, 8 RC) | Mature DX, migrations | Heavier; major rewrite in flight (v8 RC); schema DSL |
| C. MySQL + Kysely/raw SQL (`mysql2`) | Maximum control | More boilerplate; fewer helpers |
| D. MongoDB + Mongoose | Flexible documents; fits the nested product shape | Stock, promo usage and order numbers need multi-document transactions and constraints we would hand-write; no FKs or `CHECK`; facet counts and reporting are harder than SQL |
| E. PostgreSQL + Drizzle (the original proposal) | Sequences, partial indexes, `pg_trgm`, transactional DDL | Outside the owner's chosen stack |
| F. SQLite/other | Simple | Not suited to concurrent order writes at our scale |

#### Decision
**Option A**: Drizzle (`drizzle-orm/mysql-core`, `mysql2` driver) pinned to the stable **0.45.x** line until 1.0 is stable; **MySQL 8.4 LTS**, InnoDB, managed (ADR-0019). Charset `utf8mb4`, collation `utf8mb4_0900_ai_ci` (Urdu-safe, ADR-0018).
- Migrations: `drizzle-kit generate` produces numbered SQL committed to `apps/api/drizzle/`; `drizzle-kit push` is forbidden outside a local scratch DB.
- IDs: UUIDv7 generated in the app, stored as `char(36)` (time-ordered, so the clustered index stays local). Human-facing numbers come from the `counters` table (order numbers, ADR-0020); MySQL has no sequences.
- Time: `datetime(3)`, always UTC (connection `timezone: "Z"`); never `timestamp` (2038 limit, session-zone conversion); display in `Asia/Karachi` (UTC+5, no DST).
- Structured blobs (event payloads, block settings): `json` columns. Anything filtered or sorted on gets a real column.
- Money: `bigint` columns named `*_minor` plus a `currency` char(3) where more than one currency could exist; PKR only in v1 (ADR-0013).
- DB access only inside a module's `repository.ts`; no ORM types leave a module (keeps an ORM swap contained).
- Enums: `varchar` + `CHECK` (enforced from MySQL 8.0.16); no native `ENUM` columns (changing them rewrites the table).
- Migrations are **not transactional** in MySQL (DDL auto-commits): one schema change per migration file, and every migration must be safe to re-run after a partial failure.

#### Examples
```ts
// apps/api/src/modules/orders/schema.ts
export const orders = mysqlTable("orders", {
  id: char("id", { length: 36 }).primaryKey(),
  orderNumber: bigint("order_number", { mode: "number" }).notNull().unique(),
  status: varchar("status", { length: 32 }).notNull(),
  totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
});
```

#### Consequences
Real transactions and constraints replace client-side invariants. We carry a small risk from Drizzle's pre-1.0 churn, bounded by pinning and repository isolation.

#### Rules
**Always:** write the migration, then the code; wrap order/stock writes in a transaction. **Never:** edit an applied migration; use `float`/`double`/`decimal` for money; use `timestamp` or a native `ENUM`; use `SELECT *` in repositories. **Common mistake:** relying on ORM defaults for `updated_at`.

#### Acceptance checklist
- [ ] `pnpm db:migrate` on an empty database yields the schema in DOC-09.
- [ ] Every FK and every column used in a `WHERE`/`ORDER BY` of a list endpoint has an index (DOC-09 tables).
- [ ] No `push` in scripts or CI.

#### Revisit trigger
Drizzle 1.0 stable migration costs more than 2 dev-days, a security or maintenance event hits the project, or Prisma 8 stable removes the reasons in the table. Reopen the engine choice only if search (ADR-0010) or the job queue (ADR-0009) hits its own revisit trigger and the fix needs a Postgres-only feature.

#### Open questions and assumptions
`drizzle-zod` compatibility with Zod 4 was **not verified**; the plan does not depend on it (the contract package is the schema source). Assumes the managed provider offers MySQL 8.4 LTS; MariaDB is **not** a drop-in substitute (different `JSON`, `CHECK` and `SKIP LOCKED` behaviour) and is out of scope. Drizzle's MySQL column API in the example was not checked against the pinned version (DOC-08 spike).

#### Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |
| 2026-10-02 | Owner decision: MySQL 8.4 instead of PostgreSQL; MongoDB considered and rejected; ids, time, enum and migration rules rewritten for MySQL |


---

<a id="adr-0009-jobs-events-cache"></a>

### ADR-0009 — MySQL-backed jobs and transactional outbox; HTTP/CDN cache first

| Field | Value |
|---|---|
| ID | ADR-0009 |
| Title | Jobs, events, caching |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | ADR-0008, ADR-0016, README A-02 |
| Decisions used | ADR-0017, ADR-0020 |

#### Purpose and scope
How background work, domain events and caches are done. Job catalogue and cache keys are DOC-08.

#### Context
Needed async work: send order SMS/WhatsApp/email, COD-confirmation reminders, payment webhook processing, courier status sync, image processing, stock-low alerts, scheduled publish (`Product.status: 'scheduled'`, `publishedAt`). Each must be triggered atomically with the state change that caused it. Team is small and budget-limited (A-01, A-02): fewer moving services is a feature.

#### Options considered
| Option | Pros | Cons |
|---|---|---|
| A. MySQL `jobs` table polled with `FOR UPDATE SKIP LOCKED` + outbox table | Same transaction as the order write; no extra service | Lower throughput than Redis; polling load; we own a small worker loop (no pg-boss equivalent for MySQL) |
| B. Redis + BullMQ | High throughput, rich features | Extra service to run, monitor, back up; dual-write problem with the DB |
| C. Managed queue (SQS etc.) | No ops | Cloud lock-in; foreign payment for a Pakistani business (A-02 risk) |
| D. In-process timers/cron | Trivial | Lost on restart; no retries |

#### Decision
**Option A.** Domain events are rows in `outbox_events` written in the same transaction as the change; a relay job turns them into jobs; handlers are idempotent and keyed by `event_id`. The worker is our own loop over a `jobs` table: claim a batch with `SELECT … WHERE run_at <= now() AND locked_at IS NULL ORDER BY run_at LIMIT n FOR UPDATE SKIP LOCKED`, mark it locked, run, then delete or reschedule. DOC-08 specifies the table and includes a 1-day spike on it.
- Retries: exponential backoff, max 8 attempts, then a dead-letter row visible in the admin (DOC-07 audit/ops).
- **Cache layers, in order:** (1) CDN via `Cache-Control` and tag purge (ADR-0004); (2) in-process LRU for tiny hot config (store config, categories) with a 30 s TTL; (3) Redis only when a measured need appears (rate-limit counters across instances, session store at scale).
- Never cache anything per-customer at the CDN.

#### Examples
```sql
create table outbox_events (
  id char(36) primary key, type varchar(64) not null, payload json not null,
  created_at datetime(3) not null, processed_at datetime(3) null,
  index outbox_unprocessed (processed_at, created_at) -- MySQL has no partial indexes
);
```

#### Consequences
One datastore to run and back up; exactly-once-effect through idempotency, at-least-once delivery. Throughput ceiling is far above A-03.

#### Rules
**Always:** write the event in the same transaction; make handlers idempotent. **Never:** call an external provider inside a request transaction; publish events after commit from app code. **Common mistake:** a handler that sends an SMS then crashes before recording success (use an idempotency key per message).

#### Acceptance checklist
- [ ] Killing the worker mid-job and restarting does not duplicate or lose a notification (integration test).
- [ ] Every event type in DOC-08 has a handler test.

#### Revisit trigger
Job latency p95 over 30 s at normal load, queue table over 5 GB, or more than 50 jobs/s sustained.

#### Open questions and assumptions
`SKIP LOCKED` needs MySQL ≥ 8.0.1 (assumed, not re-verified). Processed outbox rows are deleted by a nightly job so the composite index stays small. Redis is not provisioned in v1.

#### Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |
| 2026-10-02 | Queue is our own `jobs` table with `SKIP LOCKED` (pg-boss is Postgres-only); outbox DDL rewritten for MySQL |


---

<a id="adr-0010-search-and-filtering"></a>

### ADR-0010 — MySQL FULLTEXT + synonyms + SQL facets at launch

| Field | Value |
|---|---|
| ID | ADR-0010 |
| Title | Search and filtering |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (F-12), ADR-0008, ADR-0014, ADR-0018 |
| Decisions used | ADR-0005 |

#### Purpose and scope
Product search and listing filters (facets). Query API shape is DOC-10 catalog.

#### Context
The storefront downloads every product and filters in the browser with `String.includes` (`Shop.jsx:19-34`, `server.js:63`). At A-03 scale (3,000 products) that payload is too large for mobile data. v2 requires facets from an admin-defined attribute schema (`AttributeDefinition`, `category.filterSchema`) rather than free text.

#### Options considered
| Option | Pros | Cons |
|---|---|---|
| A. MySQL InnoDB `FULLTEXT` + synonyms table + SQL facet counts | No new service; transactionally consistent | Weak relevance tuning; **no typo tolerance** (MySQL has no trigram index); Urdu/Roman-Urdu synonyms manual |
| B. Meilisearch | Typo tolerance, fast facets | Extra service and sync; not researched this phase |
| C. Algolia/Typesense Cloud | Managed | Cost and foreign payment (A-02) |

#### Decision
**Option A** at launch. A `product_search` table (one row per product: a `search_text` column holding title/subtitle/brand/category names/attribute labels, with a `FULLTEXT` index; queried with `MATCH … AGAINST (… IN BOOLEAN MODE)` and a trailing `*` for prefix match) refreshed by an outbox handler on product publish. Facets are computed with `GROUP BY` over a `product_attribute_values` table restricted to attributes with `filterable = true` for the current category's `filterSchema`. Roman-Urdu spelling variants ("shalwar/shalwaar", "dupatta/dupata") are handled by a `search_synonyms` table, which also stands in for the fuzzy matching MySQL lacks.
- API: cursor pagination, `limit` ≤ 48, sort ∈ {relevance, newest, price_asc, price_desc, bestselling}; filters in the query string; URL is the state (shareable, crawlable canonical rules in DOC-06).

#### Examples
`GET /api/v1/products?category=lawn&attr.fabric=cotton&price_min=500000&price_max=1500000&sort=newest&limit=24&cursor=…` (prices are paisa, ADR-0013).

#### Consequences
Good enough for 3,000 products; relevance is basic. Search and listing share one code path.

#### Rules
**Always:** return facet counts for the *current* filter set; cap `limit`. **Never:** return unpaginated product arrays; expose internal tags as facets (v2 evidence from a live 865-product listing). **Common mistake:** facet counts that ignore the active filters.

#### Acceptance checklist
- [ ] PLP/PDP payloads for 3,000 products stay under 60 kB per page of 24 (DOC-13 budget).
- [ ] Search for "shalwar" and "shalwaar" returns the same set.
- [ ] `EXPLAIN` shows index use on listing queries (DOC-13).

#### Revisit trigger
More than 10,000 products, search "zero result" rate over 8%, listing p95 over 300 ms, or a need for typo tolerance (any script): move search to Meilisearch (option B), fed from the outbox.

#### Open questions and assumptions
Meilisearch capabilities and Urdu-script tokenization were not researched. Assumes Roman-Urdu is the dominant query script at launch. InnoDB ignores words shorter than `innodb_ft_min_token_size` (default 3) and a stopword list; both must be checked against real queries in DOC-13.

#### Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |
| 2026-10-02 | InnoDB `FULLTEXT` replaces Postgres FTS + trigram; typo tolerance dropped until Meilisearch |


---

<a id="adr-0011-media-storage"></a>

### ADR-0011 — S3-compatible object storage and on-the-fly image transforms

| Field | Value |
|---|---|
| ID | ADR-0011 |
| Title | Media storage and image pipeline |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (F-17), ADR-0009, ADR-0019, README A-02 |
| Decisions used | ADR-0005 |

#### Purpose and scope
Where uploaded media lives, how variants (sizes/formats) are produced and served. Upload endpoint contract is DOC-10 media.

#### Context
Uploads are held in a `Map` capped at 200 and lost on restart (`server.js:17-19,198`); MIME type is trusted from the client header (`:182-185`). The admin resizes in the browser (`db.js:345-349`). Product photography is the main weight of a fashion page; customers are on mobile data.

#### Options considered
| Option | Pros | Cons |
|---|---|---|
| A. S3-compatible bucket + transform proxy (imgproxy-style or CDN transform) | Standard, durable; modern formats on demand | Needs a transform service or CDN feature |
| B. Pre-generate fixed sizes at upload (worker with sharp) | Predictable cost, no runtime service | Many files; new breakpoints need a backfill |
| C. Database/BYTEA or local disk | Simple | Not durable/scalable; blocks horizontal scaling |

#### Decision
**Option A with B as the fallback.** Originals go to a private S3-compatible bucket (provider chosen in ADR-0019). Delivery URLs are `https://img.<domain>/<signature>/<w>x<h>/<format>/<key>`; the transform layer emits AVIF/WebP with JPEG fallback, widths from a fixed allow-list (320, 480, 640, 828, 1080, 1600). If no transform service is available at launch, a worker pre-generates those widths in WebP + JPEG on upload.
- Upload flow: admin requests a pre-signed `PUT` (`POST /api/v1/admin/media/uploads`), uploads directly, then confirms; the server **sniffs magic bytes**, rejects anything but JPEG/PNG/WebP/AVIF, caps 10 MB and 8000 px per side, strips EXIF (location data), records `width`, `height`, `blurhash`/`lqip`.
- `Media` records carry `alt` (required for publish; localizable, ADR-0018).
- Responses use immutable cache headers (`public, max-age=31536000, immutable`) with content-hashed keys.

#### Examples
`<img src=".../w640/webp/…" srcset="… 320w, … 640w, … 1080w" sizes="(min-width: 768px) 25vw, 50vw" width="800" height="1000" loading="lazy" alt="…">` — width/height always present to avoid layout shift.

#### Consequences
Durable media, smaller bytes, safe uploads. Adds a storage account and a transform component to operate.

#### Rules
**Always:** store the original untouched; serve via signed transform URLs. **Never:** trust `Content-Type` or filename; serve user uploads from the API origin; ship an unsized `<img>`. **Common mistake:** loading the original 4000 px file on the PLP.

#### Acceptance checklist
- [ ] A renamed `.exe` with an image MIME is rejected.
- [ ] Uploaded image still resolves after an API redeploy.
- [ ] PLP images over 100 kB each fail the DOC-13 budget test.

#### Revisit trigger
Monthly egress or storage cost over the A-02 budget share, or transform p95 over 400 ms on cache miss.

#### Open questions and assumptions
Provider options (R2/S3/Backblaze/local-region) depend on whether the business can pay in USD (A-02, CQ-2). Transform service choice is deferred to DOC-14.

#### Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |


---

<a id="adr-0012-auth-sessions-rbac"></a>

### ADR-0012 — Server-side sessions, Argon2id, TOTP, RBAC; no shared admin key

| Field | Value |
|---|---|
| ID | ADR-0012 |
| Title | Auth, sessions, RBAC |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (K8, F-16, F-18), ADR-0008, ADR-0016 |
| Decisions used | ADR-0005, ADR-0009 |

#### Purpose and scope
How staff and customers are authenticated and authorised. Full RBAC matrix, 2FA flows and OWASP checklist are DOC-11.

#### Context
The only admin "auth" is a shared `x-admin-key` compiled into the public bundle (`lib/api.js:11`, `server.js:37-42`); the admin UI has no login (`App.jsx:26-64`); there are no roles or audit log (F-16). Customers check out as guests; tracking uses order number + phone (F-07).

#### Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Server-side sessions in MySQL, `HttpOnly; Secure; SameSite=Lax` cookie | Revocable instantly; no token in JS; simple | Needs CSRF defence; sticky to our API |
| B. JWT access + refresh in memory/localStorage | Stateless | Not revocable without a denylist; XSS exposure when in storage |
| C. Hosted identity provider | Less code | Cost, foreign payment, lock-in; overkill for ~5 staff |

#### Decision
**Option A.**
- Staff: email + password hashed with **Argon2id**; TOTP 2FA mandatory for `owner` and `manager`, optional for others; session idle timeout 8 h, absolute 14 d; rotate id on login and privilege change; login rate limit 5/15 min/account + IP; lockout with backoff; all sessions listable and revocable.
- Roles (v1): `owner`, `manager`, `catalog`, `fulfilment`, `support`, `viewer`; permissions are `resource:action` strings checked in route middleware; matrix in DOC-11.
- CSRF: double-submit token header for cookie-authenticated mutating requests plus `Origin` check. Admin and API share a parent domain (`admin.<domain>` → `api.<domain>`), cookie scoped accordingly (ADR-0019).
- Audit: every admin mutation writes `audit_log` (actor, action, entity, before/after diff, IP, user-agent) in the same transaction.
- Customers: guest checkout stays default. Order tracking requires order number + phone **and** is rate-limited (10/hour/IP and 5/hour/order); a signed, unguessable `tracking_token` is added to the confirmation link and WhatsApp message so the common path needs no phone entry. Customer accounts (phone OTP) are post-launch (DOC-16).
- The shared key is deleted from all apps; `VITE_ADMIN_KEY` is banned (lint + secret scan).

#### Examples
```
Set-Cookie: __Host-noor_admin=<opaque 256-bit id>; Path=/; HttpOnly; Secure; SameSite=Lax
```
`__Host-` requires no `Domain` attribute, so if admin and API are different subdomains use `__Secure-` plus `Domain=.example.pk` (decided in DOC-11).

#### Consequences
Real authentication, revocation and auditability. A login screen and 2FA UX must be built; tracking adds a token to messages.

#### Rules
**Always:** check permission server-side on every route; hash with Argon2id; log security events. **Never:** put secrets in `VITE_*` variables; store a session token in `localStorage`; trust client-side role checks. **Common mistake:** hiding a button and calling that authorization.

#### Acceptance checklist
- [ ] `grep -r "ADMIN_KEY\|x-admin-key" apps packages` is empty.
- [ ] Every admin route has a declared permission (contract route table, ADR-0005) and a test that a lower role gets 403.
- [ ] Tracking endpoint returns 429 after the stated limit.

#### Revisit trigger
More than 15 staff, a need for SSO, or a customer-account launch (then add OTP provider ADR).

#### Open questions and assumptions
SMS OTP provider and cost are unresearched (DOC-12). Assumes fewer than 10 staff accounts at launch.

#### Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |
| 2026-10-02 | Session store is MySQL (ADR-0008) |


---

<a id="adr-0013-money"></a>

### ADR-0013 — Integer paisa everywhere; no float rupees

| Field | Value |
|---|---|
| ID | ADR-0013 |
| Title | Money and numeric rules |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (K4, F-01), ADR-0005, ADR-0008 |
| Decisions used | ADR-0020 |

#### Purpose and scope
Representation, arithmetic, rounding and display of money across API, DB and UI.

#### Context
Contract: integer minor units, exponent 2 (`schemas.js:7-11`). Storefront: converts to float rupees (`catalogAdapter.js:16`), does promo math in rupees (`PromoContext.jsx:28`), rounds on display (`utils/format.js:1-3`) and converts back (`orderPayload.js:3`). Prices like Rs 17,759.20 occur in the market (v2 §2 row 4).

#### Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Integer paisa end to end (`number`, safe integer) | Exact; matches contract; trivial JSON | Discipline needed; display must divide |
| B. Float rupees | Easy to read | Rounding drift; the current bug class |
| C. Decimal library (decimal.js/BigInt) | Arbitrary precision | Unneeded: PKR totals stay far below 2^53 paisa; serialization friction |

#### Decision
**Option A.**
- Type: `Money = { amount: int (safe), currency: "PKR" }` from `packages/contract`. DB: `bigint` columns `*_minor`.
- All arithmetic uses helpers in `packages/contract/src/money.ts`: `add`, `sub`, `mulInt`, `percentOf(amount, bps)` (basis points, so 12.5% = 1250), `allocate(total, weights)` (largest-remainder so splits sum exactly).
- **Rounding rule:** compute in paisa; percentage discounts round **half away from zero to the nearest paisa** per order line, then sum. The display rounding (store setting `priceDisplay.rounding`: `none | nearest | up`, `showDecimals`) is **presentation only** and never alters stored amounts; if a store wants whole-rupee *charging*, that is a pricing rule that rounds before storing.
- Display: one formatter `formatMoney(money, locale)` using `Intl.NumberFormat` with `currency: "PKR"`; the storefront and admin both import it (replaces `formatPKR` and admin `formatMoney`).
- Forms: money inputs accept rupees as text with up to 2 decimals and convert with `parseRupees(str)`; the form state is a string until submit.
- No `Number` money arithmetic outside the helpers; ESLint rule `no-restricted-syntax` flags `* 100` and `/ 100` in app code.

#### Examples
```ts
percentOf(1775920, 1000)      // 10% of Rs 17,759.20 → 177592 paisa
formatMoney({ amount: 1775920, currency: "PKR" }, "en-PK") // "Rs 17,759.20" (showDecimals true)
```

#### Consequences
Removes the K4/F-01 class; requires touching every price display and form.

#### Rules
**Always:** pass `Money` objects across module boundaries. **Never:** store or transmit rupees as floats; compute totals in the browser as the source of truth (ADR-0020). **Common mistake:** `Math.round(price * qty * 0.9)` in a component.

#### Acceptance checklist
- [ ] Property test: for random carts, sum of line allocations equals the order discount exactly.
- [ ] `grep -rnE "\* ?100|/ ?100" apps/*/src` finds only the money helpers.
- [ ] Storefront and admin render the same amount for the same `Money`.

#### Revisit trigger
Multi-currency is approved (then add currency exponents and an ADR for FX), or any total can exceed 2^53 paisa (not plausible).

#### Open questions and assumptions
Assumes PKR exponent 2 as stated in the contract. Whether the shop wants whole-rupee *charging* is a pricing-policy choice for the store owner; default is exact paisa.

#### Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed; corrects v1's "minor = 1 rupee" (already corrected in v2) |


---

<a id="adr-0014-catalog-model"></a>

### ADR-0014 — Style → Colorway → Size catalog model

| Field | Value |
|---|---|
| ID | ADR-0014 |
| Title | Catalog model |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (F-08, F-10), ADR-0005, ADR-0010 |
| Decisions used | ADR-0013, ADR-0018 |

#### Purpose and scope
Shape of the product graph: kinds, components, colorways, options, variants, size systems, custom sizes, made-to-order. Tables are DOC-09 catalog; storefront presentation is DOC-06 PDP.

#### Context
The contract already models: `kind` (stitched/unstitched/made-to-order/footwear/accessory/bundle/home/beauty), `components[]` (shirt/dupatta/trouser…), `styleId`, per-product `colorway`, `options` (max 3) → `variants`, `sizeChartId`, `customSizeSchemaId`, `madeToOrder`. The storefront ignores nearly all of it (F-10) and checkout ignores deposit/lead time (F-08). v2 decided each colorway is its own product with its own URL and gallery (Google's ProductGroup markup supports variants with distinct URLs).

#### Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Style → Colorway(product) → Size(variant) (v2) | Separate URLs, galleries, SEO per colorway; stock per size | Editing a style touches several products; need sibling linking |
| B. One product, color+size as options | Simple admin | Single URL for all colors; weak merchandising/SEO |
| C. Fully attribute-driven (Saleor-style) | Flexible | More abstraction than a 3,000-product store needs |

#### Decision
**Option A**, with these fixed rules:
- `style` groups colorway products (`style_id`); each colorway is a `product` with `handle`, gallery and SEO; `SiblingRef` (already in the contract) powers the swatch row.
- **Variant axes:** `size` (from a `SizeSystem`), optionally `material`/`other`. Colour is a product attribute for colorway products; it is a variant option only for simple products with no colorway siblings.
- **Kinds drive behaviour**, not strings in the UI: `unstitched` → sold per set, `components[]` shown as "What's in the set", no size chart, lengths in metres; `stitched` → size system + size chart + fit note; `made-to-order` → `madeToOrder.leadTime`, `depositPercent`, `returnable`, optional custom-size form from `customSizeSchemaId`; `footwear` → EU size system; `bundle` → child product refs with their own stock checks.
- **Stock:** `stock.status` ∈ {in_stock, low_stock, sold_out, made_to_order, preorder}; numeric `quantity` exists only for counted statuses. Made-to-order variants never expose a fake count (today's `stockOf` fabricates one from `maxPerOrder`, `catalogAdapter.js:58`).
- **Custom sizes:** measurements are captured as `OrderLine.customization` validated against the product's `FormSchema` server-side; a custom-size line is never merged with a standard-size line (cart identity includes a hash of customization, DOC-06).
- **Deposit:** if `depositPercent` is set, checkout charges `ceil(total × pct)` online/transfer and the rest on delivery; COD is disabled for deposit lines (ADR-0017).
- Cart line identity = `variantId` + `customizationHash` (replaces `productId__size`, `CartContext.jsx:18-20`).

#### Examples
```json
{ "id":"p_9f1","handle":"mushk-lawn-3pc-sage","styleId":"st_mushk","kind":"unstitched",
  "components":[{"type":"shirt","label":"Embroidered shirt","quantity":"2.5 m"},
                {"type":"dupatta","label":"Chiffon dupatta","quantity":"2.5 m"},
                {"type":"trouser","label":"Dyed trouser","quantity":"2.5 m"}],
  "colorway":{"label":"Sage","family":"green","swatch":{"hex":["#9CAF88"]}},
  "variants":[{"sku":"MUSHK-SAGE-3PC","price":{"amount":1250000,"currency":"PKR"},"stock":{"status":"in_stock","quantity":42}}] }
```

#### Consequences
Product pages can show the real domain (components, colour siblings, lead time). Admin product editor keeps its tabs (DOC-07); bulk edits across a style need a "style" action.

#### Rules
**Always:** read `kind` to decide UI/validation; validate customization server-side. **Never:** flatten a product to "the cheapest variant" for purchase decisions; invent stock counts. **Common mistake:** treating colour as a size-like option on a product that has colorway siblings.

#### Acceptance checklist
- [ ] A made-to-order product cannot reach checkout without its required custom-size fields when `customSizeSchemaId` is set.
- [ ] Two colorways of one style have distinct URLs and canonical tags.
- [ ] Stock for a made-to-order variant is never rendered as a number.

#### Revisit trigger
More than 10% of products need more than one variant axis beyond size, or buyers want mix-and-match across styles (then consider option C).

#### Open questions and assumptions
Assumes catalog size A-03. Size-chart conversion rules (e.g., chest ↔ standard letter size) are specified in DOC-09/DOC-07 after reviewing real charts from you.

#### Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed; keeps v2's decision |


---

<a id="adr-0015-client-state-and-data"></a>

### ADR-0015 — Loaders on the storefront; TanStack Query, Table and Virtual in the admin; Zustand for cart UI state

| Field | Value |
|---|---|
| ID | ADR-0015 |
| Title | Client state and data fetching |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (K3, K5, F-11), ADR-0004, ADR-0005 |
| Decisions used | ADR-0013, ADR-0020 |

#### Purpose and scope
Where server data and client state live in each app. Query-key conventions and code samples are DOC-05.

#### Context
Both apps share the same defect: contexts that read/write localStorage and fall back to seed data when no API is configured (F-11, `db.js:2-8`), duplicated persistence hooks (K3), no pagination or virtualization (K5). Admin lists render full arrays; bulk actions loop with `await` (K6).

#### Options considered
| Option | Pros | Cons |
|---|---|---|
| A. RR loaders/actions (storefront) + TanStack Query v5 + Table + Virtual (admin) | Right tool per app; caching, invalidation, optimistic updates, windowing | Two data patterns, documented once |
| B. TanStack Query everywhere | One pattern | Storefront loses SSR data-flow benefits of loaders |
| C. Redux Toolkit/RTK Query | One store | Heavier, more ceremony |
| D. Keep Context + localStorage | No work | The current defects |

#### Decision
**Option A.**
- **Storefront:** server data comes only from route `loader`s and `action`s (SSR, ADR-0004). Client state is limited to: cart UI (drawer open, optimistic line quantity) in a small **Zustand** store, wishlist ids, and form state (React Hook Form + Zod resolver). **The cart itself lives on the server** (cart id in a cookie); totals come from the server, never computed as the source of truth in the browser (ADR-0020).
- **Admin:** SPA. Server state via **TanStack Query v5**; tables via **TanStack Table**; long lists via **TanStack Virtual**; server-side pagination/sort/filter for anything that can exceed 100 rows (products, orders, customers, audit log).
- **No localStorage-backed domain data and no "mock mode" in apps.** Development runs against the real API with seeded MySQL (DOC-14). Browser storage is allowed only for UI preferences (theme, sidebar, table column widths).
- **Bulk actions** call bulk endpoints (`POST /api/v1/admin/products/bulk`), which return per-item results; the UI shows a summary toast plus a failure list (keeps the per-failure visibility that `ProductsList.jsx:51-62` wanted).
- Lazy routes: every admin route is `React.lazy` behind a `Suspense` boundary; route-level code splitting is the default.
- React Compiler is on in every app (admin already, `vite.config.js:7-10`); manual `useMemo/useCallback` only where the compiler cannot reach (DOC-05).

#### Examples
```ts
// apps/admin/src/features/products/queries.ts
export const productKeys = {
  all: ["products"] as const,
  list: (f: ProductFilters) => [...productKeys.all, "list", f] as const,
  detail: (id: string) => [...productKeys.all, "detail", id] as const,
};
```

#### Consequences
Deletes the dual-mode code paths and ~4 duplicated utilities; admin needs the API to exist before it can run (hence DOC-16 sequencing: backend slice first).

#### Rules
**Always:** one query-key factory per feature; invalidate by key prefix after a mutation. **Never:** copy server data into `useState`; compute prices or stock in the client as truth; read `localStorage` in render. **Common mistake:** fetching in `useEffect`.

#### Acceptance checklist
- [ ] No `apiEnabled` / `API_MODE` branches remain.
- [ ] Admin product and order lists use server pagination and a virtualized body above 100 rows.
- [ ] Every admin route is lazy-loaded; initial admin JS ≤ 200 kB gzip.

#### Revisit trigger
Storefront needs rich client-side caching (e.g., infinite catalog browsing offline) that loaders cannot serve, or Zustand state grows beyond cart UI/wishlist.

#### Open questions and assumptions
TanStack Query/Table/Virtual and Zustand were **not researched this phase** (author judgement; versions pinned in DOC-03).

#### Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |
| 2026-10-02 | Dev database is MySQL (ADR-0008) |


---

<a id="adr-0016-backend-framework"></a>

### ADR-0016 — Fastify 5 modular monolith with enforced module boundaries

| Field | Value |
|---|---|
| ID | ADR-0016 |
| Title | Backend framework and module architecture |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | ADR-0001, ADR-0002, ADR-0005, ADR-0008 |
| Decisions used | ADR-0009, ADR-0012, ADR-0020 |

#### Purpose and scope
HTTP framework and internal structure of `apps/api`. Layering rules and module list are DOC-08.

#### Context
The mock is a single 212-line `server.js` on Express 5 with module-level mutable arrays (`server.js:9-16`). The real backend needs plugin-style cross-cutting concerns (auth, rate limit, request ids, validation, logging) and enforced separation between commerce modules (ADR-0001).

#### Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Fastify 5 | Plugin encapsulation, hooks, built-in structured logging (pino), mature rate-limit/helmet/cookie plugins, schema-first | Smaller mind-share than Express |
| B. Express 5 | Team already knows it (the mock) | Few built-in guardrails; validation/logging by convention |
| C. Hono | Light, portable | Node-server ecosystem for cookies/sessions/rate-limit less established for us |
| D. NestJS | Opinionated modules, DI | Heavy, decorator-based; slower for agents to reason about; Angular-style learning curve |

#### Decision
**Option A**, with a **hand-rolled module convention** (no DI framework):
```
apps/api/src/
  app.ts            // builds Fastify, registers plugins, mounts routes from the contract route table
  modules/<name>/
    index.ts        // PUBLIC API: functions + types other modules may use
    routes.ts       // thin: parse → call service → map to contract
    service.ts      // business rules, transactions
    repository.ts   // the only file that touches Drizzle
    events.ts       // event names + payload schemas this module emits/handles
    *.test.ts
  platform/         // db, logger, config, session, outbox, errors (no business rules)
```
- **Layering:** `routes → service → repository`; services call other modules **only** through their `index.ts`. ESLint `no-restricted-imports` (patterns `modules/*/!(index)`) enforces it; a dependency-cruiser check runs in CI.
- **Config:** one `config.ts` that parses `process.env` with Zod at boot and exits on failure; no `process.env` elsewhere.
- **Errors:** modules throw typed `DomainError(code, status, details)`; one error handler renders RFC 9457 problems (DOC-10).
- **Logging:** pino JSON, request id on every line, PII redaction list (phone, address, email).
- **Transactions:** `service` opens `db.transaction`; `repository` functions accept a `tx`.

#### Examples
```ts
// modules/orders/index.ts  (public)
export { createOrder, getOrderForCustomer } from "./service";
export type { OrderSnapshot } from "./types";
```

#### Consequences
Clear places for code and reviews; agents can follow a fixed template. Fastify's plugin model must be learned.

#### Rules
**Always:** keep routes thin; return contract types. **Never:** import another module's `repository.ts`/`service.ts`; read `process.env` outside `config.ts`; log request bodies. **Common mistake:** adding "just one query" to a route handler.

#### Acceptance checklist
- [ ] CI dependency-cruiser passes with the module rules.
- [ ] App fails fast on invalid config (test).
- [ ] Every route is registered from the contract route table; an unregistered route is a test failure.

#### Revisit trigger
A module needs independent scaling or deployment (extract it behind its `index.ts`), or Fastify maintenance stalls.

#### Open questions and assumptions
Fastify 5 plugin versions and Zod 4 type-provider support were **not researched**; DOC-08 includes a 1-day spike on the route-table-to-Fastify adapter (ADR-0005).

#### Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |


---

<a id="adr-0017-payments"></a>

### ADR-0017 — COD-first payments behind a provider interface; hosted-redirect gateways; signed idempotent webhooks

| Field | Value |
|---|---|
| ID | ADR-0017 |
| Title | Payments architecture |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (F-02), ADR-0009, ADR-0013, ADR-0020 |
| Decisions used | ADR-0014 |

#### Purpose and scope
Payment domain design and provider abstraction. Provider-specific details, signatures and field lists are DOC-12 (to be verified from merchant docs).

#### Context
COD is the default and majority method in Pakistan (v2 evidence, secondary). Wallets and cards run through gateways: JazzCash advertises a hosted checkout with cards, mobile-account and voucher methods; Easypay publishes integration guides; Raast P2M is documented by SBP (DOC-02 §4, weak third-party summaries; primary docs are behind merchant onboarding). The contract has `paymentMethod: cod|card|wallet|bank_transfer|bnpl` (`schemas.js:392`) and store-level `payments[]` and `codLimit` (`schemas.js:283-286,281`) that are not served or enforced today.

#### Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Provider interface; hosted-redirect gateways; COD as a first-class flow | PCI scope stays with gateways; swap providers; COD fraud controls fit | Redirect UX; per-gateway adapter work |
| B. Direct wallet-charge APIs inside our checkout | Smoother UX | More security/compliance surface; gateway-specific |
| C. Payment aggregator (single API for several rails) | One integration | Fees, availability and onboarding unverified |

#### Decision
**Option A.**
- Interface (`modules/payments`): `createSession(order) → { redirectUrl | instructions }`, `handleWebhook(rawBody, headers) → PaymentEvent`, `getStatus(ref)`, `refund(ref, amount)`. Adapters: `cod`, `bank_transfer` (manual proof upload), then `jazzcash`, `easypaisa`, `card-gateway`, later `raast`.
- **Payment and order are separate state machines** (DOC-09): `payment: initiated → authorized|pending_confirmation → captured | failed | refunded | partially_refunded | expired`. An order is `confirmed` only when its payment policy is satisfied (COD: confirmation call/WhatsApp done; online: `captured`).
- **COD controls:** `codLimit` enforced server-side; COD disabled for deposit lines (ADR-0014); phone format validated (`03XXXXXXXXX` / `+923XXXXXXXXX` normalised to E.164); first-time or high-value COD orders enter `pending_confirmation` until a staff action or customer WhatsApp reply (DOC-07 orders).
- **Webhooks:** public endpoint per provider; verify signature over the **raw** body; reject stale timestamps if the provider supplies one; store every inbound payload (`payment_events`) with a unique provider event id → duplicate deliveries are no-ops; processing happens in a job (ADR-0009); respond 2xx fast.
- **Idempotency:** every outbound provider call carries our `payment_id` as the merchant reference; retrying never creates a second charge.
- **Reconciliation:** a daily job lists `pending` payments older than 30 min and calls `getStatus`.
- Secrets in environment/secret store only; never in the contract or logs.

#### Examples
```ts
interface PaymentProvider {
  id: "cod" | "bank_transfer" | "jazzcash" | "easypaisa" | "card";
  createSession(input: { paymentId: string; amount: Money; returnUrl: string; customer: { phone: string } }): Promise<{ redirectUrl?: string; instructions?: string }>;
  handleWebhook(raw: Buffer, headers: Record<string, string>): Promise<{ eventId: string; paymentId: string; status: "captured" | "failed" | "pending" }>;
}
```

#### Consequences
Customers on wallets/cards leave the site briefly; COD gets real fraud controls; adding a gateway is an adapter plus tests. DOC-12 must be completed from official merchant docs before any adapter is coded.

#### Rules
**Always:** verify webhook signatures on raw bytes; make handlers idempotent; keep amounts in paisa. **Never:** trust a redirect/return URL as proof of payment; log full card/wallet data; mark an order paid from the browser. **Common mistake:** parsing JSON before verifying the signature.

#### Acceptance checklist
- [ ] Replaying the same webhook twice changes nothing (test).
- [ ] A forged webhook (bad signature) returns 401 and creates no event.
- [ ] COD above `codLimit` is rejected server-side.

#### Revisit trigger
A gateway lacks a hosted checkout or webhooks (reconsider option B/C for that rail), or COD share drops below 40% for 3 months (invest in prepaid UX).

#### Open questions and assumptions
**Unverified:** exact JazzCash/Easypaisa APIs, signature algorithms, sandbox access, fees and settlement times. Merchant accounts are a business prerequisite (CQ-3). Raast availability for merchants is unverified.

#### Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |


---

<a id="adr-0018-i18n-rtl"></a>

### ADR-0018 — English at launch, Urdu/RTL-ready from day one

| Field | Value |
|---|---|
| ID | ADR-0018 |
| Title | Internationalisation and RTL |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (F-14, F-21, F-22), ADR-0006, README A-04 |
| Decisions used | ADR-0005, ADR-0014 |

#### Purpose and scope
What "Urdu/RTL-ready" means in code now, and what ships later. Message-catalog workflow detail is DOC-03.

#### Context
The storefront hard-codes `<html lang="en">` (`index.html:2`), has no i18n library, shows server English error prose to customers (`utils/api.js:58`), loads Playfair/Inter from Google (`index.css:1`) and uses physical CSS (F-22). Assumption A-04: English at launch, Urdu soon after, so retrofitting must be avoided.

#### Options considered
| Option | Pros | Cons |
|---|---|---|
| A. RTL-ready now (logical CSS, message keys, `dir` from locale), Urdu content later | Cheap now; no rewrite later | Slight discipline cost |
| B. English only, retrofit later | Fastest now | Rewriting every component and string |
| C. Urdu + English at launch | Full coverage | Translation, font and QA cost before launch |

#### Decision
**Option A.**
- `dir` and `lang` set on `<html>` from the locale in the root loader; locale from URL prefix (`/ur/…`) with `/` = English; `hreflang` tags in DOC-06 SEO.
- All UI strings are message keys in `packages/i18n` (ICU MessageFormat via one i18n library fixed in DOC-03; default candidate `i18next`-compatible). **No user-visible string literals in components** (lint rule).
- Server errors return stable `code`s (ADR-0005); the UI maps codes to localised messages. Server prose is for logs and developers only.
- Numbers, dates, plurals, currency via `Intl.*` with `en-PK` and `ur-PK`; digits stay Western (0-9) by default for prices.
- Content fields that customers read are localisable in the contract: `title`, `subtitle`, `descriptionMd`, `highlights`, `care`, `alt`, CMS `title`/`bodyMd`, menus; shape `{ en: string, ur?: string }` with `en` required, fallback to `en`. DOC-09 specifies translation tables vs JSONB.
- Fonts: self-hosted, subset with `unicode-range`; Urdu uses a Nastaliq-capable web font loaded **only** on `/ur` pages with `font-display: swap` and a Naskh fallback; budget ≤ 150 kB for the Urdu font on first load (tested in DOC-13).
- Layout: logical properties only (ADR-0006); icons that imply direction (arrows, chevrons) flip via `rtl:` variants; the Base UI RTL spike (ADR-0007) must pass.
- Phone numbers, order numbers and SKUs render LTR inside RTL text via `<bdi>`/`dir="ltr"`.
- WhatsApp message templates exist per locale.

#### Examples
```html
<html lang="ur" dir="rtl">
<span>{t("cart.total")}</span> <bdi dir="ltr">NC-10458</bdi>
```

#### Consequences
Urdu launch becomes translation + QA work, not engineering. Admin stays English-only in v1 (staff UI), but components are RTL-safe because they are shared.

#### Rules
**Always:** use message keys; use logical utilities; test every new component under `dir="rtl"` in Storybook. **Never:** concatenate translated fragments; embed text in images; hard-code `left/right`. **Common mistake:** formatting prices with string templates instead of `formatMoney`.

#### Acceptance checklist
- [ ] Switching Storybook to RTL shows no overlapping or mirrored-wrong component.
- [ ] Lint finds no JSX string literals in `apps/storefront` and `packages/ui`.
- [ ] A product with only `en` renders on `/ur` using the fallback without errors.

#### Revisit trigger
Urdu share of traffic over 20%, or Urdu launch date set (then schedule translation and font QA).

#### Open questions and assumptions
Assumes A-04. Choice of Urdu font (licence, weight) and i18n library are made in DOC-03/DOC-04. Roman-Urdu *content* is not a locale; it is handled as search synonyms (ADR-0010).

#### Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |


---

<a id="adr-0019-hosting-baseline"></a>

### ADR-0019 — Single-region container host, managed MySQL, CDN

| Field | Value |
|---|---|
| ID | ADR-0019 |
| Title | Hosting baseline |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | README A-02, A-03, ADR-0004, ADR-0008, ADR-0011 |
| Decisions used | ADR-0009, ADR-0012 |

#### Purpose and scope
Deployment topology and the constraints that choose a provider. Environments, CI/CD, backups and runbooks are DOC-14.

#### Context
The hosting and budget inputs were blank (A-02). Today the mock runs on a Render free instance that sleeps and takes 30–60 s to wake (comments in `utils/api.js:6-9`, `lib/api.js:12`). A shop cannot cold-start. Customers are in Pakistan on mobile data; a Pakistani business may be unable to pay some foreign SaaS in USD (unverified; CQ-2).

#### Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Container PaaS (always-on) + managed MySQL + CDN, one region | Low ops; predictable cost | Region latency to Pakistan not guaranteed |
| B. One VPS with Docker Compose | Cheapest; full control | We own patching, backups, failover |
| C. Kubernetes/serverless | Scales | Overkill; cost and complexity |
| D. Local-region (Pakistan) hosting | Lowest latency | Provider quality/tooling unverified |

#### Decision
**Option A, as an assumption pending CQ-2.** Topology: CDN → `storefront` (Node, 2 instances) and `api` (Node, 2 instances) + one `worker` process → managed MySQL 8.4 with daily backups and binlog point-in-time recovery → S3-compatible bucket. `admin` is static assets on the CDN. Region: the nearest available to Pakistan with the budget (candidates: Singapore, Mumbai, Frankfurt, Dubai-adjacent); **latency to Karachi/Lahore must be measured, not assumed** (DOC-14 task M0-07).
- Minimum two instances of `storefront` and `api` (no cold start; rolling deploys).
- Domains: `www.<domain>` (storefront), `admin.<domain>`, `api.<domain>`, `img.<domain>`.
- Budget envelope (assumption A-02): ≤ US$150/month at launch; first lever if exceeded: drop to one VPS (option B) with automated off-site backups.

#### Examples
`docker-compose.yml` (local) mirrors prod services: `mysql`, `api`, `worker`, `storefront`, `mailpit` (dev email).

#### Consequences
Always-on service removes cold starts. Provider choice stays reversible because everything is containers + MySQL + S3 API.

#### Rules
**Always:** keep config in env vars validated at boot; make containers stateless. **Never:** deploy on a free sleeping tier; keep uploads or sessions on local disk. **Common mistake:** choosing a region by price alone.

#### Acceptance checklist
- [ ] p95 TTFB from a Karachi and a Lahore mobile connection measured and recorded in DOC-14.
- [ ] Restore from backup rehearsed once before launch.
- [ ] `api` survives killing one instance without failed checkouts.

#### Revisit trigger
Monthly cost over A-02, p95 TTFB over 600 ms from Pakistan, or an outage traced to single-region failure.

#### Open questions and assumptions
Provider is **not chosen** here on purpose: the candidates depend on CQ-2 (budget, ability to pay in USD). No provider's pricing was researched.

#### Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |
| 2026-10-02 | Managed MySQL replaces managed Postgres |


---

<a id="adr-0020-order-and-inventory-consistency"></a>

### ADR-0020 — Server-side pricing, idempotent order creation, stock reservation, sequence order numbers

| Field | Value |
|---|---|
| ID | ADR-0020 |
| Title | Order and inventory consistency |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (K9, K10, K11, F-01, F-02, F-03), ADR-0008, ADR-0013, ADR-0017 |
| Decisions used | ADR-0005, ADR-0009, ADR-0014 |

#### Purpose and scope
Rules that make checkout correct under retries, concurrency and hostile clients. Tables are DOC-09 orders/inventory; endpoints are DOC-10 cart/orders.

#### Context
The mock accepts client-supplied `discount`, `shippingFee`, `total` (`schemas.js:200-202`; only `subtotal` checked, `server.js:89-90`), never validates promos (F-02), lets duplicate lines for one variant drive stock negative (`server.js:84,94`), derives order numbers from an in-memory max (`:54`), has no idempotency (`:76`) and lets admin PUT overwrite orders without transition rules (`:166-171`).

#### Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Server-priced cart + idempotent create + DB-enforced stock with reservation | Correct by construction | More endpoints and tables |
| B. Keep client totals, verify after | Little change | Still trusts the client; races remain |
| C. Optimistic stock decrement at payment only | Simple | Oversells during checkout; bad for limited lawn drops |

#### Decision
**Option A.**
1. **Server-priced cart.** The cart lives in the DB (`carts`, `cart_lines`). Every response contains server-computed `subtotal`, `discount`, `shipping`, `total`. `POST /orders` takes `cartId` + customer + address + payment method + `Idempotency-Key`; **it accepts no money fields**. Prices come from variants at that instant; if a line's price changed since added, the response is `409 price_changed` with the new cart.
2. **Promotions server-side.** Validation, stacking rules, usage counting and per-customer limits run in `promotions` inside the order transaction; `usage_count` increments with the order, decrements on cancel.
3. **Shipping server-side.** Fee from zone/method by normalised city (DOC-09 shipping); free-shipping thresholds live in settings, not code (F-05).
4. **Idempotency.** `Idempotency-Key` (UUID, client-generated, persisted in session storage per checkout attempt) is stored in `idempotency_keys(key, scope, request_hash, response, expires_at)`. Same key + same body → replay the stored response; same key + different body → `422 idempotency_mismatch`; TTL 24 h. The client UX guard remains.
5. **Stock.** `inventory_levels(variant_id, on_hand, reserved)` with `CHECK (on_hand >= 0 AND reserved >= 0 AND reserved <= on_hand)`. Order creation, in one transaction: lock affected variant rows in ascending id order (`SELECT … FOR UPDATE`), **aggregate quantities per variant across all lines**, check availability (`on_hand - reserved >= qty`), then increase `reserved`. Reservations convert to `on_hand` decrements at dispatch; cancel/expire releases them. Unpaid online-payment reservations expire after 30 min (job). Made-to-order/preorder variants skip counts (ADR-0014).
6. **Order numbers.** Human number from a counter row (MySQL has no sequences): inside the order transaction, `UPDATE counters SET value = LAST_INSERT_ID(value + 1) WHERE name = 'order_number'`, then read `LAST_INSERT_ID()`; `NC-` + that value, starting at 10001. The row lock serialises concurrent orders, so numbers are unique and never derived from order data; a rolled-back order leaves no gap. Public tracking uses a separate unguessable `tracking_token` (ADR-0012).
7. **State machines on the server.** Allowed transitions are a table in `orders` (DOC-09); `POST /admin/orders/:id/transitions` takes `{ to, reason?, courier?, trackingNo? }`, validates the edge and role, appends `order_events`, and runs side effects (stock, invoice number from `counters`, notifications via outbox). There is no endpoint that replaces an order document.
8. **Invoice numbers** come from a per-year counter row, `counters.name = 'invoice_2026'` (`INV-2026-000123`), assigned once at first dispatch (replaces `Math.random()`, F-04).

#### Examples
```sql
create table counters (name varchar(32) primary key, value bigint not null);
insert into counters values ('order_number', 10000);
create table inventory_levels (
  variant_id char(36) primary key,
  on_hand int not null,
  reserved int not null default 0,
  foreign key (variant_id) references variants(id),
  -- table-level: a MySQL column CHECK cannot reference another column
  constraint inventory_levels_chk check (on_hand >= 0 and reserved >= 0 and reserved <= on_hand)
);
```
```http
POST /api/v1/orders
Idempotency-Key: 6f1c0f70-6a7c-4d0b-9d63-2b4e1f1d5e55
{ "cartId":"c_…","customer":{"name":"Ayesha Khan","phone":"+923001234567"},
  "shippingAddress":{"city":"Lahore","address":"…","landmark":"…"},"paymentMethod":"cod" }
```

#### Consequences
Removes K9–K11 and F-01…F-03 by construction. Checkout cost: a few more queries and row locks; contention on hot variants during drops and on the single `order_number` counter row, held until commit (acceptable at A-03; see revisit).

#### Rules
**Always:** compute money on the server; aggregate stock per variant; write `order_events` for every change. **Never:** accept `total`, `discount`, `shippingFee` from a client; update an order status with a bare `UPDATE` outside the transition function; derive identifiers from `max()+1`. **Common mistake:** locking rows in different orders in different code paths (deadlocks); fixed order is `counters` last, variants ascending by id. Retry the transaction on MySQL error 1213 (deadlock), up to 3 times.

#### Acceptance checklist
- [ ] Test: two lines for one variant (2+2) with stock 3 → `409 insufficient_stock`, stock unchanged.
- [ ] Test: 50 concurrent orders for the last unit → exactly one succeeds.
- [ ] Test: same `Idempotency-Key` twice → one order, identical response.
- [ ] Test: posting a body containing `total` is rejected by schema.
- [ ] Test: invalid transition (`pending → delivered`) → `409 invalid_transition`.

#### Revisit trigger
Lock wait p95 over 200 ms during a drop, or a single SKU sees over 20 orders/s (consider a queue-based allocation for that SKU).

#### Open questions and assumptions
Reservation TTL (30 min) and COD confirmation window (DOC-07) are assumptions; tune from real data after launch.

#### Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |
| 2026-10-02 | Order and invoice numbers from a `counters` table (no sequences in MySQL); DDL rewritten; deadlock retry rule added |


---
