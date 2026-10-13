# ADR-0001 — Build a modular-monolith commerce backend; borrow Medusa's patterns, not its code

| Field | Value |
|---|---|
| ID | ADR-0001 |
| Title | Build vs adopt the commerce engine |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01, README A-01, A-02, A-03, A-05 |
| Decisions used | ADR-0002, ADR-0008, ADR-0016, ADR-0017 |

## Purpose and scope
Decides whether Noor & Co. builds its own commerce backend or adopts an engine. Governs the backend only; storefront and admin UI are separate decisions (ADR-0004, ADR-0007).

## Context
- Team is 2–3 developers plus AI coding agents (A-01). Existing assets: a 19-screen admin with a domain-specific product editor and a rich Zod contract (DOC-01 §6); no backend beyond an in-memory mock.
- Domain is unusual for off-the-shelf engines: product kinds (stitched/unstitched/made-to-order/footwear/bundle), per-piece components, Style→Colorway→Size, custom measurements, deposits and lead times, city-based COD shipping, COD confirmation, tracking by order number + phone.
- Payments are COD plus local wallets/gateways (JazzCash, Easypaisa, Raast, bank transfer). Medusa's only first-party provider is Stripe; local providers are custom work in any engine.
- The audit shows the dangerous code is exactly cart, pricing, promos, stock and order state (F-01…F-03, K9…K11): the part an engine would give us.

## Options considered

| Criterion (weight) | A. Custom modular monolith | B. Medusa v2 (2.18.0, Jul 2026) | C. Vendure | D. Saleor | E. Sylius | F. Shopify + Hydrogen |
|---|---|---|---|---|---|---|
| Fit to our domain model (high) | Exact | Good via custom modules + links | Good (plugins) | Best variants/attributes | Good | Metafield workarounds |
| Time to a safe checkout (high) | Slowest | Fast for cart/promo/inventory/order | Fast | Fast | Fast | Fastest |
| Local payments/COD logic (high) | Ours | Custom provider needed | Custom | Custom | Custom | Gateway availability unverified |
| Team skills (TS) (high) | Match | Match | Match (NestJS, Angular admin) | Python/Django: mismatch | PHP: mismatch | Liquid/Hydrogen |
| Reuse of existing admin UI (med) | High | Low: Medusa Admin replaces it or we extend it | Low | Low | Low | None |
| Ops burden (med) | One Node process + MySQL | One Node process + Postgres (+ Redis) | Node + DB | Python + Redis + Celery | PHP stack | None |
| Lock-in / data ownership (med) | None | Low (MIT) | Open-core licence | Low (BSD-3) | Low | High |

## Decision
**Option A: build a modular monolith (ADR-0016) on Node + TypeScript + MySQL.** Copy Medusa's *patterns*: independent modules with explicit public interfaces, workflows with compensation steps, domain events through an outbox (ADR-0009). Do not install Medusa.

**v1 scope cut (what we will not build):** multi-currency, multi-warehouse, B2B price lists, gift cards, subscriptions, marketplace/multi-vendor, loyalty points. The contract's `features.multiCurrency` flag stays `false`.

**Buy, don't build:** payment gateways (hosted redirect), courier booking/tracking (adapter per courier, DOC-12), email/SMS/WhatsApp delivery, image transforms (ADR-0011).

**Honesty note:** this is the highest-risk decision in the set and the one most sensitive to team size and deadline. It is made under assumptions A-01 and A-05; CQ-1 in the README asks you to confirm them.

## Examples
Module boundary rule that stands in for the engine's isolation (enforced in ADR-0016):
```
apps/api/src/modules/
  catalog/  pricing/  inventory/  cart/  orders/  payments/  shipping/
  customers/  promotions/  content/  identity/  audit/
# a module may import only another module's `index.ts` (its public API)
```

## Consequences
**Positive:** exact domain fit; one Zod contract end to end; admin UI reused; no engine upgrade treadmill.
**Negative:** we own cart totals, promotion stacking, refunds, returns and inventory correctness; estimated cost is the largest line in DOC-16.
**Mitigations:** v1 scope cut above; property-based tests on pricing and stock (DOC-13); the consistency rules in ADR-0020.

## Rules
**Always:** put money-moving logic behind a module's public API with tests. **Never:** add a feature from the cut list without a new ADR. **Common mistake:** re-implementing a hosted-gateway feature (retries, 3-D Secure) in our code.

## Acceptance checklist
- [ ] Every module in `apps/api/src/modules` has an `index.ts` and a README row in DOC-08. **Open: the modules have an `index.js` (JavaScript); the README rows were not kept.**
- [ ] No imports cross module internals (lint rule, DOC-08). **Open: no `dependency-cruiser`; by convention.**
- [ ] Cut-list features are absent from the contract. **Open: not re-read against the cut-list.**

## Revisit trigger
Reopen with a 3-day Medusa spike if **any**: (a) checkout + orders + inventory do not pass the DOC-13 acceptance suite within 6 weeks of backend start; (b) team drops to one developer; (c) a required feature on the cut list becomes launch-critical; (d) COD/shipping logic turns out to fit Medusa workflows without forking.

## Open questions and assumptions
Assumes A-01 (2–3 devs), A-05 (about 12 weeks to a public MVP). Medusa and Vendure facts come from secondary and vendor sources (see DOC-02 §4); a spike would verify them first-hand.

## Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |
| 2026-10-02 | Datastore named in Option A changed to MySQL (ADR-0008) |
| 2026-10-02 | Phase 6: effort for the custom build estimated in DOC-16 §4; the revisit trigger "(a) checkout + orders + inventory within 6 weeks of backend start" is measured from the start of M1 against M4-05 |
