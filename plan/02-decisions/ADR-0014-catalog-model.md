# ADR-0014 — Style → Colorway → Size catalog model

| Field | Value |
|---|---|
| ID | ADR-0014 |
| Title | Catalog model |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (F-08, F-10), ADR-0005, ADR-0010 |
| Decisions used | ADR-0013, ADR-0018 |

## Purpose and scope
Shape of the product graph: kinds, components, colorways, options, variants, size systems, custom sizes, made-to-order. Tables are DOC-09 catalog; storefront presentation is DOC-06 PDP.

## Context
The contract already models: `kind` (stitched/unstitched/made-to-order/footwear/accessory/bundle/home/beauty), `components[]` (shirt/dupatta/trouser…), `styleId`, per-product `colorway`, `options` (max 3) → `variants`, `sizeChartId`, `customSizeSchemaId`, `madeToOrder`. The storefront ignores nearly all of it (F-10) and checkout ignores deposit/lead time (F-08). v2 decided each colorway is its own product with its own URL and gallery (Google's ProductGroup markup supports variants with distinct URLs).

## Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Style → Colorway(product) → Size(variant) (v2) | Separate URLs, galleries, SEO per colorway; stock per size | Editing a style touches several products; need sibling linking |
| B. One product, color+size as options | Simple admin | Single URL for all colors; weak merchandising/SEO |
| C. Fully attribute-driven (Saleor-style) | Flexible | More abstraction than a 3,000-product store needs |

## Decision
**Option A**, with these fixed rules:
- `style` groups colorway products (`style_id`); each colorway is a `product` with `handle`, gallery and SEO; `SiblingRef` (already in the contract) powers the swatch row.
- **Variant axes:** `size` (from a `SizeSystem`), optionally `material`/`other`. Colour is a product attribute for colorway products; it is a variant option only for simple products with no colorway siblings.
- **Kinds drive behaviour**, not strings in the UI: `unstitched` → sold per set, `components[]` shown as "What's in the set", no size chart, lengths in metres; `stitched` → size system + size chart + fit note; `made_to_order` → `madeToOrder.leadTime`, `depositPercent`, `returnable`, optional custom-size form from `customSizeSchemaId`; `footwear` → EU size system; `bundle` → child product refs with their own stock checks.
- **Stock:** `stock.status` ∈ {in_stock, low_stock, sold_out, made_to_order, preorder}; numeric `quantity` exists only for counted statuses. Made-to-order variants never expose a fake count (today's `stockOf` fabricates one from `maxPerOrder`, `catalogAdapter.js:58`).
- **Custom sizes:** measurements are captured as `OrderLine.customization` validated against the product's `FormSchema` server-side; a custom-size line is never merged with a standard-size line (cart identity includes a hash of customization, DOC-06).
- **Deposit:** if `depositPercent` is set, checkout charges `ceil(total × pct)` online/transfer and the rest on delivery; COD is disabled for deposit lines (ADR-0017).
- Cart line identity = `variantId` + `customizationHash` (replaces `productId__size`, `CartContext.jsx:18-20`).

## Examples
```json
{ "id":"p_9f1","handle":"mushk-lawn-3pc-sage","styleId":"st_mushk","kind":"unstitched",
  "components":[{"type":"shirt","label":"Embroidered shirt","quantity":"2.5 m"},
                {"type":"dupatta","label":"Chiffon dupatta","quantity":"2.5 m"},
                {"type":"trouser","label":"Dyed trouser","quantity":"2.5 m"}],
  "colorway":{"label":"Sage","family":"green","swatch":{"hex":["#9CAF88"]}},
  "variants":[{"sku":"MUSHK-SAGE-3PC","price":{"amount":1250000,"currency":"PKR"},"stock":{"status":"in_stock","quantity":42}}] }
```

## Consequences
Product pages can show the real domain (components, colour siblings, lead time). Admin product editor keeps its tabs (DOC-07); bulk edits across a style need a "style" action.

## Rules
**Always:** read `kind` to decide UI/validation; validate customization server-side. **Never:** flatten a product to "the cheapest variant" for purchase decisions; invent stock counts. **Common mistake:** treating colour as a size-like option on a product that has colorway siblings.

## Acceptance checklist
- [x] A made-to-order product cannot reach checkout without its required custom-size fields when `customSizeSchemaId` is set. (`apps/api/test/cart-customization.test.js` and E2E-05.)
- [ ] Two colorways of one style have distinct URLs and canonical tags. **Open.**
- [ ] Stock for a made-to-order variant is never rendered as a number. **Open.**

## Revisit trigger
More than 10% of products need more than one variant axis beyond size, or buyers want mix-and-match across styles (then consider option C).

## Open questions and assumptions
Assumes catalog size A-03. Size-chart conversion rules (e.g., chest ↔ standard letter size) are specified in DOC-09/DOC-07 after reviewing real charts from you.

## Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed; keeps v2's decision |
| 2026-10-02 | Phase 5: tables in DOC-09.3; kind value renamed `made-to-order` → `made_to_order` (all stored enum values are snake_case); contract changes listed in DOC-09.0 §6 |
| 2026-10-02 | Phase 7 consistency review: kind value in the decision text |
