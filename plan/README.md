# Noor & Co. — Engineering Documentation Set

| Field | Value |
|---|---|
| ID | DOC-README |
| Title | Index, reading order, status, assumptions |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | — |
| Decisions used | ADR-0001 … ADR-0020 |

## 1. Purpose and scope
Entry point to the docs set that a small team and AI coding agents follow as the single source of truth. **Governs:** structure, reading order, status, the project inputs and assumptions. **Does not govern:** any technical specification (each lives in exactly one numbered doc).

## 2. How to use this set
1. Humans: read §3 order. Agents: read `AGENTS.md` first (first version arrives in Phase 1), then only the docs your task cites.
2. One fact lives in one doc. If you need a fact, follow the cross-reference; if two docs disagree, the lower-numbered ADR wins and you open a PR fixing the other.
3. A PR is reviewable against the **Acceptance checklist** at the end of each doc it touches.
4. Findings are cited by ID (`F-01`, `K9`, `D-02` from DOC-01); decisions by ADR number.
5. Phases are delivered one per response; later phases may amend earlier docs and will say so in their changelog.

## 3. Reading order and status

| Doc | Title | Phase | Status |
|---|---|---|---|
| [README.md](README.md) | This index | 0 | Draft, written |
| [GLOSSARY.md](GLOSSARY.md) | Terms | 0 | Draft, written (status sets provisional) |
| [01-audit.md](01-audit.md) | Code audit with `file:line` evidence | 0 | Draft, written |
| [02-decisions/](02-decisions/README.md) | ADR-0001…0020 + research register | 0 | Draft, written; **awaiting your approval** |
| [AGENTS.md](AGENTS.md) | Rules for AI coding agents | 1 | Draft, written (first version) |
| [03-frontend-architecture.md](03-frontend-architecture.md) | Monorepo, features, boundaries, state, routing, i18n, config | 1 | Draft, written |
| 04-design-system/ ([tokens](04-design-system/tokens.md), [components](04-design-system/components.md), [patterns](04-design-system/patterns.md)) | Design system | 1 | Draft, written |
| [05-react-patterns.md](05-react-patterns.md) | Patterns with where/where-not | 1 | Draft, written |
| [15-conventions.md](15-conventions.md) | Naming, git, PR, review | 1 | Draft, written |
| 06-storefront/ ([sitemap](06-storefront/01-sitemap.md), [home](06-storefront/02-home.md), [listings+search](06-storefront/03-plp-search.md), [product](06-storefront/04-pdp.md), [cart+checkout](06-storefront/05-cart-checkout.md), [orders+tracking](06-storefront/06-orders-tracking.md), [account+wishlist](06-storefront/07-account-wishlist.md), [CMS](06-storefront/08-cms-pages.md), [SEO](06-storefront/09-seo.md), [performance](06-storefront/10-performance.md), [storefront v2](06-storefront/11-storefront-v2.md), [admin coverage](06-storefront/12-admin-coverage.md)) | One file per storefront area | 2 | Draft, written |
| 07-admin/ ([ia roles](07-admin/01-ia-roles.md), [dashboard](07-admin/02-dashboard.md), [products](07-admin/03-products.md), [catalog](07-admin/04-catalog.md), [orders](07-admin/05-orders.md), [customers](07-admin/06-customers.md), [promos](07-admin/07-promos.md), [reviews](07-admin/08-reviews.md), [content](07-admin/09-content.md), [shipping payments](07-admin/10-shipping-payments.md), [settings](07-admin/11-settings.md), [staff roles](07-admin/12-staff-roles.md), [audit log](07-admin/13-audit-log.md), [tables bulk](07-admin/14-tables-bulk.md), [shortcuts](07-admin/15-shortcuts.md)) | One file per admin area | 3 | Draft, written |
| [08-backend-architecture.md](08-backend-architecture.md) · [11-security-auth.md](11-security-auth.md) · [14-devops.md](14-devops.md) | Backend, security, devops | 4 | Draft, written |
| 09-data-model/ ([conventions](09-data-model/00-conventions.md), [platform](09-data-model/01-platform.md), [auth audit](09-data-model/02-auth-audit.md), [catalog](09-data-model/03-catalog.md), [inventory](09-data-model/04-inventory.md), [search](09-data-model/05-search.md), [cart promotions](09-data-model/06-cart-promotions.md), [orders payments](09-data-model/07-orders-payments.md), [reviews notifications](09-data-model/08-reviews-notifications.md), [settings shipping content](09-data-model/09-settings-shipping-content.md)) | Data model: 67 tables (one defined in DOC-13 §8.6), enums, state machines | 5 (part 1) | Draft, written |
| 10-api/ ([conventions](10-api/00-conventions.md), [store content](10-api/01-store-content.md), [catalog public](10-api/02-catalog-public.md), [cart orders public](10-api/03-cart-orders-public.md), [admin auth staff](10-api/04-admin-auth-staff.md), [admin catalog](10-api/05-admin-catalog.md), [admin orders customers](10-api/06-admin-orders-customers.md), [admin content settings](10-api/07-admin-content-settings.md), [admin dashboard ops](10-api/08-admin-dashboard-ops.md)) | API: conventions and every endpoint | 5 (part 2) | Draft, written |
| [12-integrations.md](12-integrations.md) | Payments, couriers, messaging, analytics | 5 (part 3) | Draft, written |
| [13-quality.md](13-quality.md) · [16-roadmap.md](16-roadmap.md) | Quality, roadmap and backlog | 6 | Draft, written |
| [consistency-review.md](consistency-review.md) | Contradictions, field names, glossary: findings and fixes | 7 | Written |

## 4. Project inputs and assumptions
The input block in the brief was blank. Defaults below are **assumptions**, each with a revisit trigger. They are the only place these values are stated.

| ID | Input | Assumption | Revisit trigger |
|---|---|---|---|
| A-01 | Team | 2–3 developers plus AI coding agents; one person acts as tech lead and reviewer | Team changes by one person, either way |
| A-02 | Hosting and budget | ≤ US$150/month at launch, always-on container hosting, one region; ability to pay a foreign provider in USD is **unknown** | Real budget or payment constraint stated (CQ-2) |
| A-03 | Scale target | ~3,000 products / ~25,000 variants; ~150 orders/day normal, up to 1,500 on sale or drop days; ~2,000 concurrent sessions at peak | Real traffic data, or a planned campaign above these numbers |
| A-04 | Languages | English at launch; Urdu/RTL-ready in code from day one, Urdu content after launch; admin English only | Urdu launch date set, or Urdu traffic over 20% |
| A-06 | Market | **Owner input (2 Oct 2026): local customers in Pakistan for now.** Delivery inside Pakistan only, PKR only, Pakistani mobile numbers only, COD-first; no international shipping, no multi-currency | International orders are wanted |
| A-07 | Payments at launch | **Owner input (2 Oct 2026): cash on delivery only at launch; online payment is added later.** `cod` is the only enabled method in the seed; `bank_transfer`, `wallet`, `card` stay in the contract and UI but disabled until DOC-12 adapters exist | Owner obtains a merchant account |
| A-08 | Domain and go-live | **Owner input (2 Oct 2026): production domain `rubaya.pk`; production comes later. Confirmed again the same day: the whole site is built and finished locally first; production planning and checks are a separate phase after that.** Hosts: `www.rubaya.pk`, `admin.rubaya.pk`, `api.rubaya.pk`, `img.rubaya.pk` (ADR-0019). Until then everything runs locally; no deploy task is scheduled before the launch milestone (DOC-16) | Owner sets a go-live date |
| A-09 | Legal pages | **Owner input (2 Oct 2026): we draft privacy policy and terms ourselves.** Standard drafts are written with the seed data (DOC-06.8 §3); they are not legal advice and the owner reads them before go-live | Owner supplies lawyer-reviewed text |
| A-10 | Store name | **Owner input (2 Oct 2026): the store is called "Rubaya"** (domain `rubaya.pk`). `StoreConfig.brand.name = "Rubaya"`, order numbers `RB-10001…`, invoice numbers unchanged. "Noor" remains only the internal project/repo/package name (`noor`, `@noor/*`); it is never shown to customers | Owner renames the project too |
| A-05 | Deadline | Public MVP about 12 weeks after M0 starts; no hard external date | A fixed launch date (e.g., a lawn season) is stated |

## 5. Clarifying questions (answers change the design)
| # | Question | Why it matters |
|---|---|---|
| CQ-1 | Team size and launch date: is it really 2–3 developers and about 12 weeks? | ADR-0001 (build vs adopt) is the riskiest decision and flips toward Medusa if the team is one person or the date is under about 8 weeks |
| CQ-2 | Real monthly hosting budget, and can the business pay foreign services in USD (cards/PayPal)? | Chooses the host, object storage and image-transform provider (ADR-0011, ADR-0019) and whether Pakistani-only vendors are required |
| CQ-3 | ~~Which payment methods must work at launch?~~ **Answered 2 Oct 2026:** cash on delivery only; online payment later (A-07) | Phase 5 integrations scope: COD provider first; gateway adapters are specified but not scheduled for launch (ADR-0017) |

I proceeded under the assumptions above rather than blocking Phase 0 on them.

## 6. Rules
**Always:** update the status table and the changelog of every doc you change. **Never:** copy a spec into a second doc; leave "TBD" (write the assumption and trigger). **Common mistake:** treating the v2/v3 `.docx` files as truth; see DOC-01 §5 for where they disagree with the code.

## 7. Acceptance checklist
- [ ] Every doc listed in §3 exists once it is marked written. **Not re-checked.**
- [ ] Each written doc has the header table, scope, rules, acceptance checklist, open questions and changelog. **Not re-checked.**
- [ ] Assumptions A-01…A-05 are referenced, never restated. **Not re-checked.**

## 8. Open questions and assumptions
CQ-1…CQ-3 above; audit questions Q-1…Q-3 are in DOC-01 §9.

## 9. Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Phase 7 delivered: consistency review, 21 findings fixed across the set. **The documentation set is complete** (all phases 0–7) |
| 2026-10-02 | Phase 6 delivered: 13-quality, 16-roadmap. Only the Phase 7 consistency review remains |
| 2026-10-02 | Phase 5 part 3 delivered: 12-integrations. Phase 5 complete |
| 2026-10-02 | Phase 5 part 2 delivered: 10-api (9 files) |
| 2026-10-02 | Phase 5 part 1 delivered: 09-data-model (10 files, 66 tables). Owner confirmed local-first: build everything locally, production phase afterwards (A-08) |
| 2026-10-02 | Phase 4 delivered: 08-backend-architecture, 11-security-auth, 14-devops |
| 2026-10-02 | Store name is Rubaya (A-10): order-number prefix `NC-` → `RB-` across the set; storefront examples renamed. Phase 3 delivered: 07-admin (15 files) |
| 2026-10-02 | Owner answers recorded: CQ-3 (COD only at launch), domain `rubaya.pk` with production later, legal pages drafted by us (A-07, A-08, A-09) |
| 2026-10-02 | Phase 2 delivered: 06-storefront (10 files). Assumption A-06 added from the owner (Pakistan-only market) |
| 2026-10-02 | Phase 1 delivered: 03, 04-design-system (tokens, components, patterns), 05, 15, AGENTS. Folder restructured: ADRs and the decisions index moved to `02-decisions/`. `NOOR_DOCS.md` is a Phase 0 snapshot only; the split files govern |
| 2026-10-02 | Phase 0 delivered: README, GLOSSARY, 01-audit, 02-decisions (ADR-0001…0020) |
| 2026-10-02 | Owner decision: backend is Node.js + **MySQL** (was PostgreSQL). Amended in place while still Proposed: ADR-0001, 0008, 0009, 0010, 0012, 0015, 0019, 0020, glossary, research register |
