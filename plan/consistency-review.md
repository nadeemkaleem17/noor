# Consistency Review (Phase 7)

| Field | Value |
|---|---|
| ID | DOC-REVIEW |
| Title | Cross-document consistency review: method, findings, fixes, what was not checked |
| Status | Written |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | Every other document |
| Decisions used | — |

## 1. Purpose and scope

**Governs:** the record of the Phase 7 review: what was compared, what disagreed, what was changed, and what a reader must still treat as unverified.
**Does not govern:** any specification. Where this file and a numbered doc differ, the numbered doc wins.

Set reviewed: 81 Markdown files, about 13,000 lines (everything in `plan/` except the `NOOR_DOCS.md` snapshot).

## 2. Method

A script scanned every file and compared names across documents; each hit was then read in context and either fixed or classified as intentional.

| Check | How | Result |
|---|---|---|
| Route keys used in DOC-03 … DOC-16 exist in DOC-10 | Every code-formatted `module.verb` token outside `10-api/` compared with the keys defined in the DOC-10 tables (214 keys) | 4 mismatches, fixed (F-4, F-8, F-12, F-15) |
| Permissions | Every `resource:action` token compared with the DOC-11 §4.1 matrix | No mismatch |
| Document ids | Every `DOC-…` reference compared with the ids that exist | No dangling reference |
| Table names | Every table-like token compared with the 67 tables defined in DOC-09 (+ DOC-13 §8.6) | 2 mismatches, fixed (F-5, F-10) |
| Enum values | Known renames searched: product kind, badges, payment statuses, promo type | Fixed (F-1, F-2, F-11, F-17) |
| Field and parameter names between DOC-06/07, DOC-09 and DOC-10 | Searched: listing params, cart and order body fields, cookie contents | Fixed (F-3, F-6, F-7, F-9) |
| Error codes | Codes used outside DOC-10.0 compared with its registry | Fixed (F-14, F-19) |
| Glossary | Abbreviations and terms used in several docs without a definition | Fixed (F-20) |
| Stale values | Old order prefix, placeholder domain, old cookie name, table counts, PostgreSQL mentions, tracking rate limits | Fixed where live (F-16, F-18); the rest are intentional (§4) |

Limits of the method are in §5.

## 3. Findings and fixes

All fixes were applied in the named files, each with a changelog row starting "Phase 7 consistency review".

| # | Finding | Where | Fix |
|---|---|---|---|
| F-1 | Product kind written `made-to-order`; the data model stores `made_to_order` | DOC-06.3, 06.4, 07.3, GLOSSARY, ADR-0014 | Changed to `made_to_order` |
| F-2 | Badge values `sold-out`, `made-to-order` differ from the API's `sold_out`, `made_to_order` | DOC-06.3, 07.3 | Changed |
| F-3 | Listing parameters `price_min`, `price_max`, `in_stock` differ from the API's `priceMin`, `priceMax`, `inStock` | DOC-06.1, 06.3, ADR-0010 | Changed; `kind` added to the list in DOC-06.1 |
| F-4 | `store.getSiteSettings` does not exist; the API has `content.getHome` | DOC-06.1 | Changed |
| F-5 | Table called `product_handle_redirects`; the data model has `handle_redirects` | DOC-06.1 | Changed |
| F-6 | The cart cookie was described as holding the cart id; the data model stores a hash of a random token | DOC-06.5, DOC-03 | Reworded: cookie holds the token, forwarded as `X-Cart-Token` |
| F-7 | Order request described with `cartId` and `city`; the API takes the cart from the header, `cityId`, and an optional `expectedTotal` guard | DOC-06.5, DOC-05, ADR-0020, DOC-08 sample | Changed to the DOC-10.3 shape |
| F-8 | `admin.me` used as a route key; the key is `admin.me.get` | DOC-07.1, DOC-16 | Changed |
| F-9 | `admin.orders.list?limit=10`; admin lists page with `size` | DOC-07.2 | Changed to `size=25`, first 10 shown |
| F-10 | `order_event` used as a table name | DOC-07.5 | `order_events` |
| F-11 | `StatusBadge` mapped the old single payment-status list and lacked `preorder` | DOC-04b §6 | Replaced with the order-level payment statuses; `preorder` added |
| F-12 | Samples used `admin.products.setStatus`, which does not exist | DOC-05, DOC-15 | DOC-05 uses `admin.products.bulk`; DOC-15 example is `admin.orders.transition` |
| F-13 | `reporting` module listed with no tables although it owns `web_vitals_daily`; `nodemailer` and `dependency-cruiser` used but not in the backend dependency list | DOC-08 §2, §5 | Added |
| F-14 | Error codes `size_value_in_use`, `media_in_use` not in the registry | DOC-09.3, 09.9 | Use the generic `in_use` |
| F-15 | Rate-limit bucket named a route `catalog.search` that does not exist | DOC-11 §5.4 | `catalog.listProducts` when `q` is set |
| F-16 | Cookie example `__Host-noor_admin` with `Domain=.example.pk` contradicted DOC-11 | ADR-0012 | `__Host-rb_admin`, no `Domain` |
| F-17 | Payment state list included `refunded`/`partially_refunded` as payment states; the data model makes a refund its own row and derives an order-level status | ADR-0017 | Decision text updated |
| F-18 | Repository tree showed `docs/`; the folder is `plan/` | ADR-0003 | Changed |
| F-19 | Field-level codes (`phone_invalid`, `address_too_short` …) used in DOC-06.5 with no registry | DOC-10.0 | New §6.3 "Field issue codes" |
| F-20 | CSP, CSRF, E.164, LQIP, PDP, PLP, TOTP used without a glossary entry; "colourway" and `colorway` both used | GLOSSARY | Seven entries added; rule recorded: prose "colourway", identifiers `colorway` |
| F-21 | `pnpm test:integration` and `pnpm test:e2e` required by DOC-13 but missing from the agent command list | AGENTS.md | Added |

## 4. Hits that are intentional (not changed)

| Hit | Why it stays |
|---|---|
| "PostgreSQL" in ADR-0001, 0008, 0009, 0010, 0019 and the decisions index | Rejected options, comparisons with Medusa, and changelog rows that record the switch to MySQL |
| "66 tables" in two changelog rows | History: the count at the time of that row; the current count (67) is in DOC-09.0 |
| `made-to-order`, `flat` in DOC-09.0 §5–6 and the ADR-0014 changelog | They document the renames themselves |
| `cartId` in DOC-08 and DOC-10.3 | The internal service argument (resolved from the token by the route) and the sentence saying the body has none |
| `qty` in prose and local variable names | Not a contract field; the contract field is `quantity` (DOC-09.0 §6) |
| `orders.transition`, `cart.price`, `shipping.quote`, `orders.status` and similar | Service functions and table columns, not route keys |
| `authorized`, `refunded` in DOC-09 | Values of the per-payment state enum |

## 5. What this review did not check

| Not checked | Why it matters | Where it gets checked |
|---|---|---|
| Whether any of it works | Nothing in the set has been executed; the code samples and SQL were written, not run | The six M0 spikes and every task's "done when" (DOC-16) |
| Every schema field, one by one, between DOC-09 columns and DOC-10 shapes | The script compared names it was told to look for, plus route keys, tables, permissions and ids. A field present in one doc and absent or differently named in the other can remain | At M0-04 and M1: the contract is code, and response validation in tests fails on any mismatch (DOC-10.0 §5) |
| Route keys inside fenced code blocks | Only code-formatted tokens in running text and tables were compared | Type checking: `api('…')` accepts only keys in the route table |
| Numbers that depend on each other (limits, timeouts, budgets) | Checked by reading for the cases noticed (tracking rate limits, image widths); not exhaustively | Acceptance tests cite the owning doc |
| Section-number references (`DOC-08 §9.2`) | Ids were validated, section numbers were not | Fix on sight (README §2, rule 2) |
| The `NOOR_DOCS.md` snapshot | It is Phase 0 only and already stale by design | Delete it once nobody needs the single-file copy |

## 6. State of the set

| Item | State |
|---|---|
| Documents | All phases 0–7 written. Status of every doc: Draft |
| Decisions | ADR-0001 … 0020 are **Proposed**. The owner has decided these explicitly: Node.js + MySQL, cash on delivery only at launch, Pakistan-only market, store name Rubaya, domain `rubaya.pk`, local build first. Moving all ADRs to Accepted is task M7-07, or earlier if the owner says so |
| Open questions | 206 doc-level questions (`Q-…` tables at the end of each doc) plus 6 in the README and audit. Each has an assumption and a revisit trigger, so none blocks the build; the ones that affect the first milestone are resolved by the M0 spikes |
| Unanswered owner questions | CQ-1 team size and hours (affects dates, DOC-16 Q-16-1); CQ-2 hosting budget and ability to pay foreign providers (production phase only); whether Docker is installed on the development machine (DOC-14 §3.4 covers both cases) |
| Research not done from primary sources | Payment gateways, courier APIs, WhatsApp pricing, managed-database prices, data-protection law in Pakistan, competitor storefronts (each flagged in DOC-02 §4 and its own doc) |

## 7. Rules for keeping the set consistent from here

**Always:** change the owning doc and its changelog in the same PR as the code; add a new route to DOC-10, a new table to DOC-09 and a new term to the GLOSSARY when introducing them; re-run the name comparison when a batch of docs changes (the script is small: compare route keys, tables, permissions and doc ids).
**Never:** restate a specification in a second doc; leave a renamed value in an older doc.
**Common mistake:** fixing the code and the API doc but not the storefront or admin spec that mentions the same name.

## 8. Acceptance checklist

- [x] No route key used outside DOC-10 is missing from DOC-10 (re-scan after the fixes).
- [x] No permission outside the DOC-11 matrix; no dangling `DOC-` id; no undefined table name.
- [x] Every fix has a changelog row in the file it changed.
- [ ] Field-by-field agreement between DOC-09, DOC-10 and the Zod contract: provable only once the contract exists (M0-04, M1). **Open: the contract exists, and `pnpm route-keys --check` ties each route to its doc; a field-by-field comparison has not been done.**

## 9. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Review performed; 21 findings fixed |
