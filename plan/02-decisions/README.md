# 02 — Decision records (index and research register)

| Field | Value |
|---|---|
| 2026-10-13 | M7-07: the state of every ADR after the local build (section 5), for the owner to accept them; the acceptance boxes of the ADRs were reviewed one by one |
| ID | DOC-02 |
| Title | ADR index and research register |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 |
| Decisions used | ADR-0001 … ADR-0020 |

## 1. Purpose and scope

Index of every architecture decision record (ADR) and the single place where research evidence is logged. **Governs:** ADR numbering, template, lifecycle. **Does not govern:** the decisions themselves (each ADR file does).

## 2. ADR index

| ADR | Decision | Status | Resolves |
|---|---|---|---|
| [0001](ADR-0001-build-vs-adopt.md) | Build a modular-monolith commerce backend; borrow Medusa's patterns, not its code | Proposed | K8, F-09 |
| [0002](ADR-0002-typescript.md) | ~~Strict TypeScript for all new code~~ (superseded by 0021) | Superseded | K3, F-15, F-23 |
| [0003](ADR-0003-monorepo.md) | pnpm workspaces + Turborepo | Proposed | K2, K3 |
| [0004](ADR-0004-storefront-rendering.md) | Storefront on React Router v8 framework mode, SSR + CDN caching | Proposed | K7 |
| [0005](ADR-0005-api-and-contract.md) | REST + OpenAPI, one Zod 4 contract package | Proposed | K2, F-14, F-15 |
| [0006](ADR-0006-styling-and-tokens.md) | Tailwind v4 + three-tier CSS-variable tokens, logical properties only | Proposed | K1, F-22 |
| [0007](ADR-0007-component-foundation.md) | Owned shadcn-style components on Base UI | Proposed | K1 |
| [0008](ADR-0008-database-and-orm.md) | MySQL 8.4 + Drizzle (pinned 0.45.x) | Proposed | F-13 |
| [0009](ADR-0009-jobs-events-cache.md) | MySQL-backed jobs + transactional outbox; HTTP/CDN cache first | Proposed | — |
| [0010](ADR-0010-search-and-filtering.md) | MySQL FULLTEXT + synonyms + SQL facets at launch | Proposed | F-12 |
| [0011](ADR-0011-media-storage.md) | S3-compatible object storage + on-the-fly image transforms | Proposed | F-17 |
| [0012](ADR-0012-auth-sessions-rbac.md) | Server sessions, Argon2id, TOTP, RBAC; no shared key | Proposed | K8, F-16 |
| [0013](ADR-0013-money.md) | Integer paisa everywhere; no float rupees | Proposed | K4, F-01 |
| [0014](ADR-0014-catalog-model.md) | Style → Colorway → Size catalog model | Proposed | F-08, F-10 |
| [0015](ADR-0015-client-state-and-data.md) | Loaders on storefront, TanStack Query/Table/Virtual in admin, Zustand for cart UI state | Proposed | K3, K5, F-11 |
| [0016](ADR-0016-backend-framework.md) | Fastify 5 modular monolith with enforced module boundaries | Proposed | — |
| [0017](ADR-0017-payments.md) | COD-first; provider interface; hosted-redirect gateways; signed idempotent webhooks | Proposed | F-02 |
| [0018](ADR-0018-i18n-rtl.md) | English at launch, Urdu/RTL-ready from day one | Proposed | F-14, F-21, F-22 |
| [0019](ADR-0019-hosting-baseline.md) | Single-region container host + managed MySQL + CDN | Proposed | F-19 |
| [0020](ADR-0020-order-and-inventory-consistency.md) | Server-side pricing, idempotent order creation, stock reservation, sequence order numbers | Proposed | K9, K10, K11, F-01…F-03 |
| [0021](ADR-0021-javascript-with-jsdoc.md) | JavaScript with JSDoc types (supersedes 0002) | Accepted | Owner decision |

Status values: **Proposed** (this phase), **Accepted** (you approve), **Superseded by ADR-xxxx**.

### 2.1 State of every ADR after the local build (M7-07)

Every ADR below is still **Proposed**: moving it to **Accepted** is the owner's act, not ours. This table is what the owner needs to do it: what was decided, whether it was built as decided, and what differs. The build is the local one; the production phase (hosting, CDN, S3, backups) is not yet.

| ADR | Built as decided? | What differs or is still to come |
|---|---|---|
| 0001 custom modular monolith | Yes | The revisit trigger (a) was not hit: checkout, orders and inventory pass their acceptance tests (M4). |
| 0002 TypeScript | Superseded by 0021 | |
| 0003 pnpm + Turborepo | Yes | Four apps now: `apps/e2e` was added at M7-01. |
| 0004 storefront on React Router 8, SSR, CDN cache | Yes, SSR and cache classes | No CDN yet (production). The shop keeps its settings 30 s in memory. |
| 0005 REST, OpenAPI, one Zod contract | Yes | OpenAPI is a snapshot test, not a published page. |
| 0006 Tailwind v4, tokens, logical properties | Yes | `check-logical` and the contrast gate are in `pnpm check`. |
| 0007 owned components on Base UI | Yes | 50 components; stories in 7 files, all axe-checked. |
| 0008 MySQL 8.4 + Drizzle | Yes | Drizzle `~0.45.3`. |
| 0009 MySQL jobs and outbox; HTTP cache first | Yes | No test kills the worker mid-job (open box). |
| 0010 FULLTEXT, synonyms, SQL facets | Yes | |
| 0011 S3 and on-the-fly transforms | **In part** | Local storage and sizes made with `sharp` (M0-08 skipped: no Docker); the S3 driver and imgproxy are for the production phase. |
| 0012 sessions, Argon2id, TOTP, RBAC | Yes | `RELAXED_PASSWORDS` (local only) was added at the owner's request; the `__Host-` cookie prefix applies where there is HTTPS. |
| 0013 money in paisa | Yes | |
| 0014 style, colourway, size | Yes | |
| 0015 loaders, TanStack Query/Table/Virtual, Zustand | **In part** | Loaders and TanStack Query yes. The admin has its own `DataTable` (no TanStack Table), no virtualised bodies (dropped), and the cart drawer is a React context (no Zustand). The admin's initial JavaScript is over its budget (M7-09). |
| 0016 Fastify 5 modular monolith | Yes | Module boundaries are by convention and review; `dependency-cruiser` was not set up. |
| 0017 COD first, provider interface, signed webhooks | Yes | COD only at launch; `manual`, `bank_transfer` and a test provider exist. |
| 0018 English, Urdu and RTL ready | Yes | Urdu is switched on in Settings and its texts are partly translated; E2E-16 checks RTL. |
| 0019 single-region host, managed MySQL, CDN | Not built | Production phase. |
| 0020 order and inventory consistency | Yes | All five acceptance tests are ticked in the ADR. |
| 0021 JavaScript with JSDoc | Yes (Accepted) | |

## 3. ADR template (every ADR file follows it)

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

## 4. Research register

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
| Tailwind v4 | CSS-first config: `@theme` defines variables that create utilities; `@custom-variant dark (&:where(.dark, .dark *))` for attribute/class dark mode; logical utilities `ms-/me-/ps-/pe-` built in | tailwindcss.com/docs/theme and /docs/padding (seen via search, Oct 2026; pages not fetched) | P (summary) | **Adopt** as specified in DOC-04a |
| Base UI RTL | `DirectionProvider` switches component behaviour (arrow keys, submenu side, slide direction); it does not set `dir`, the app must | base-ui.com/react/utils/direction-provider (seen via search, Oct 2026) | P (summary) | **Adopt**; spike still required (DOC-04b §8) |
| TanStack | Query 5.104.0 (26 Sep 2026); Table **v9 stable** (4 Aug 2026; new state model, tree-shakable features); Virtual 3.14.x | github.com/TanStack/query releases; tanstack.com/blog/announcing-tanstack-table-v9; InfoQ (Jul 2026) | P / S | **Adopt** Query 5, Table 9, Virtual 3 (DOC-03 §2) |
| React Hook Form | 7.89.0 stable; 8.0.0-beta.4 (26 Sep 2026); `@hookform/resolvers` 5.9.1 | npmjs.com package pages (Oct 2026) | P | **Adopt** 7.x; **reject** v8 beta |
| Zustand | 5.0.15 | npmjs.com (Oct 2026) | P | **Adopt** for storefront cart UI state only |
| pnpm / Turborepo | pnpm 11.28.3 (30 Sep 2026); pnpm **12.0** released 26 Aug 2026 as a Rust rewrite; Turborepo 2.11.x, `turbo.json` uses `tasks` | endoflife.date/pnpm; pnpm.io/blog; turborepo.dev/blog/2-11 | S / P | **Adopt** pnpm 11 and turbo 2.11; **defer** pnpm 12 (DOC-03 §2) |
| React Router | 8.4.0 on 15 Sep 2026; ESM-only, `react-router-dom` removed, middleware on by default | reactrouter.com/changelog; remix.run/blog/react-router-v8 (seen via search) | P (summary) | Confirms D-04; pin `~8.4` |
| i18n for React Router framework mode | `remix-i18next` ≥ 7 targets React Router framework mode; works with i18next/react-i18next; compatibility with RR 8 not stated | locize.com blog; npmjs.com/package/remix-i18next | S | **Adopt** i18next stack with a spike and a fallback (DOC-03 §9) |
| Storybook | 10.x (ESM-only, since Oct 2025); `@storybook/addon-vitest` 10.6, a11y addon | github.com/storybookjs/storybook releases; npmjs.com | P / S | **Adopt** (DOC-04b §2) |
| bulletproof-react | Features folder, no cross-feature imports, compose at app level, unidirectional flow, avoid barrel files with Vite | github.com/alan2207/bulletproof-react docs/project-structure.md | P | **Adopt** structure (DOC-03 §5) |
| Feature-Sliced Design | Seven layers (app, processes (deprecated), pages, widgets, features, entities, shared) | feature-sliced.design/docs/reference/layers | P | **Reject** (too many layers for A-01); idea of separating entities kept via the contract package |
| Noto Nastaliq Urdu | OFL-1.1, available as `@fontsource/noto-nastaliq-urdu`; file size not found | npmjs.com, fontsource.org | P | **Adopt** provisionally; size check open (DOC-04a Q-04a-1) |
| Product list pagination | Baymard recommends a "Load more" button with lazy-loading over numbered pages and infinite scroll, loading fewer items per step on mobile; infinite scroll loses position on back navigation | baymard.com/blog (product-list articles), Smashing Magazine summary (2016, **older than 12 months**; Baymard pages current) | S | **Adopt** load more, 24 per step (DOC-06.3 §6) |
| Core Web Vitals | Good: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at p75 | several 2026 guides citing Google | S | **Adopt** as budgets (DOC-06.10) |
| Product structured data | Merchant listings need `price`, `priceCurrency`, `availability`; `ProductGroup` + `hasVariant` documented for variants | developers.google.com/search/docs/appearance/structured-data/merchant-listing and /product-variants (seen via search, Oct 2026) | P (summary) | **Adopt** (DOC-06.9 §4) |
| Pakistan e-commerce behaviour | COD about 70% of orders by market estimates and 94.5% in one 170,000-order dataset (Jun 2025–May 2026); COD cancellation 37.3% in that dataset, about three-quarters before dispatch; fashion COD return/refusal 18–25%; mobile over 80% of orders | ordernation.com "State of Online Shopping in Pakistan 2026" *(vendor)*; wobooks.com statistics page; easysellapp.com *(vendor)*; DHL Pakistan seller guide | S (vendor-heavy, figures vary) | **Adopt** direction, not exact numbers: COD default, strict phone validation, confirmation step (DOC-06.5, ADR-0017) |
| Reference storefronts (Khaadi, Sapphire, Gul Ahmed, Alkaram, Nike, IKEA, Zalando, ASOS) | Search confirmed only that the local brands sell stitched and unstitched ranges online with COD (Alkaram also instalments). **Their pages were not inspected**; no UX claim in DOC-06 rests on them | alkaramstudio.com, khaadi.com (search snippets), Wikipedia entries | S (weak) | **Open**: competitor screenshots task (DOC-06.3 Q-06.3-2) |
| TanStack Table v9 API | `useTable` hook; features registered explicitly with `tableFeatures({ … })` (e.g. `rowPaginationFeature`, `createPaginatedRowModel()`); state on TanStack Store with fine-grained subscriptions; a React migration guide exists | tanstack.com/blog/announcing-tanstack-table-v9 (fetched 2 Oct 2026) | P | **Adopt** behind our own `DataTable` props; question whether the dependency is needed once all data operations are server-side (DOC-07.14 Q-07.14-2) |
| Fastify | 5.12.5 on 16 Sep 2026; 6.0 in alpha. `@fastify/cookie` 11.1.2, `@fastify/helmet` 13.1.1, `@fastify/rate-limit` 11.2.0. `fastify-type-provider-zod`: v5–6 support Zod 4, v7 requires Zod ≥ 4.2 | npmjs.com package pages; github.com/fastify/fastify releases; github.com/turkerdev/fastify-type-provider-zod README (seen via search, Oct 2026) | P (summary) | **Adopt** (DOC-08 §2); spike `M0-API-SPIKE-1` |
| Drizzle on MySQL | `drizzle-orm/mysql2`, `mysqlTable`, `drizzle-kit generate` + `migrate` documented for MySQL; `FOR UPDATE SKIP LOCKED` support not confirmed by the search | orm.drizzle.team/docs (MySQL get-started, generate, migrate; seen via search) | P (summary) | **Adopt**; unconfirmed parts in spike `M0-API-SPIKE-3` |
| Password hashing | OWASP minimum for Argon2id: 19 MiB memory, 2 iterations, parallelism 1. `@node-rs/argon2` 2.2.1 (prebuilt binaries); `argon2` 0.45.1 (Node ≥ 22); Node built-in `crypto.argon2` only from v24.7 | cheatsheetseries.owasp.org Password Storage; npmjs.com; nodejs.org/api/crypto | P | **Adopt** `@node-rs/argon2` with OWASP parameters (DOC-11 §3.1); revisit when the runtime moves to Node 24 |
| TOTP | `otplib` 13.5.0 | npmjs.com | P | **Adopt** (DOC-11 §3.3) |
| Session timeouts | OWASP: idle 15–30 min for low-risk apps, 2–5 min for high-value | cheatsheetseries.owasp.org Session Management | P | **Adapt**: keep ADR-0012 8 h idle with compensating controls (DOC-11 §3.4) |
| OWASP Top 10:2025 | A01 Broken Access Control … A03 Software Supply Chain Failures (new) … A10 Mishandling of Exceptional Conditions (new) | owasp.org/Top10/2025 | P | **Adopt** as the release checklist (DOC-11 §11) |
| MySQL 8.4 lifecycle | LTS; premier support to April 2029, extended to April 2032 | end-of-life tracking pages citing Oracle (Oct 2026) | S | Confirms ADR-0008 |
| Managed MySQL | DigitalOcean from US$15/month single node, daily backups, 7-day PITR; Aiven PITR up to 30 days | docs.digitalocean.com pricing; aiven.io/mysql (search summaries) | S | **Open**: provider chosen in task `LAUNCH-01` (DOC-14 §8) |
| WhatsApp Business Cloud API | Template categories marketing/utility/authentication; 24-hour customer service window in which utility templates and free-form replies are free; Pakistan utility rate about US$0.015 per message from 1 Oct 2026 | engagelab.com, flowcall.co, sleekflow.io pricing pages (Oct 2026) *(vendor)*; techx.pk | S | **Adopt later** as the automated customer channel; launch uses manual `wa.me` links (DOC-12 §4) |
| JazzCash | Hosted checkout; `pp_SecureHash` = HMAC-SHA256 with the integrity salt over sorted non-empty `pp_*` fields; sandbox and production base URLs | sandbox.jazzcash.com.pk documentation (seen via search), third-party libraries | S | **Provisional**; DOC-12 §8 checklist before any adapter |
| Easypaisa (Easypay) | Hosted checkout and direct REST; IPN listener URL registered in the merchant portal | Copies of "Merchant Integration Guide v4.1.x" (**older than 12 months**); a 2026 integration blog | S (weak) | **Provisional** |
| PayFast (GoPayFast, Pakistan) | Aggregator: cards, wallets, bank transfer, Raast QR; redirect or API; docs at gopayfast.com/docs | gopayfast.com (seen via search); Pakistan Today, May 2024 (**older than 12 months**) | S | **Evaluate** against direct wallet integrations when online payment is wanted |
| Courier APIs | PostEx merchant API (cities, create, track, cancel); Leopards COD API (book, track); TCS described as offering booking, label, tracking APIs. "Trax" not confirmed (results were unrelated companies) | Third-party trackers, wrapper libraries, document copies | S (weak) | **Defer**: manual tracking numbers at launch (DOC-12 §5) |
| SMS in Pakistan | Local aggregators with REST APIs and PTA-registered sender masks; one quotes Rs 5,000 one-time + Rs 5,000/year per mask | sendpk.com, brain.net.pk, robosms.pk, sms2connect.com *(vendor)* | S | **Defer**; fallback channel only |
| GA4 ecommerce and Meta Conversions API | GA4 `purchase` needs `transaction_id`, `value`, `currency`, `items[]`; Meta deduplicates Pixel and server events on identical `event_name` + `event_id` within 48 hours | Several 2026 implementation guides citing the platforms | S | **Adopt later**, server-side purchase events, behind consent (DOC-12 §6.2) |
| imgproxy, MinIO, Meilisearch | **Not researched yet** | — | A | imgproxy/MinIO: spike `M0-API-SPIKE-4`; Meilisearch: ADR-0010 revisit |
| Reference storefronts (Nike, IKEA, Zalando, ASOS, Khaadi, Sapphire, Gul Ahmed, Alkaram), bulletproof-react, Feature-Sliced Design | **Not researched in Phase 0.** The v2 doc already tore down Akbar Aslam and Sana Safinaz (text/structure only) | v2 doc §3 | — | Done in Phase 1 (bulletproof-react, FSD) and Phase 2 (storefronts) |

Anything older than 12 months must be flagged here. None of the sources above is older than 12 months except the Zod 4 resolver note (mid-2025), which is cross-checked against zod.dev.

## 5. Rules

**Always:** one decision per ADR; at least two real options; a revisit trigger with a measurable condition; update the index and the superseded ADR when a decision changes.
**Never:** edit an Accepted ADR in place to change its meaning (supersede it); record a decision only in chat.
**Common mistake:** writing "TBD" for a value; instead state the assumption (README A-xx) and the trigger that reopens it.

## 6. Acceptance checklist

- [x] ADR file exists for every row in §2 and follows §3. (21 rows, 21 files; checked at M7-07.)
- [ ] Every research claim in an ADR appears in §4 with source and date. **Open: not re-read at M7-07.**
- [x] Every ADR has a revisit trigger. (Checked at M7-07.)

## 7. Open questions and assumptions

See README CQ-1…CQ-3.

## 8. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Created with ADR-0001…0020 (Phase 0) |
| 2026-10-02 | Phase 5 research added to §4 (WhatsApp Cloud API, JazzCash, Easypaisa, PayFast, courier APIs, SMS aggregators, GA4/Meta). This replaces the weak "Pakistan payment gateways" row as the current state; still no primary merchant documentation read |
| 2026-10-02 | Phase 4 research added to §4 (Fastify and plugins, Drizzle on MySQL, Argon2, TOTP, OWASP guidance, MySQL lifecycle, managed MySQL) |
| 2026-10-02 | Phase 3 research added to §4 (TanStack Table v9 API) |
| 2026-10-02 | Phase 2 research added to §4 (pagination, Core Web Vitals, product structured data, Pakistan COD/mobile figures, reference storefronts status) |
| 2026-10-02 | Phase 1 research added to §4 (Tailwind v4, Base UI RTL, TanStack, RHF, Zustand, pnpm/Turborepo, React Router 8.4, i18n, Storybook, bulletproof-react, FSD, Urdu font) |
