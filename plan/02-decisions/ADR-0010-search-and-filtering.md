# ADR-0010 — MySQL FULLTEXT + synonyms + SQL facets at launch

| Field | Value |
|---|---|
| ID | ADR-0010 |
| Title | Search and filtering |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (F-12), ADR-0008, ADR-0014, ADR-0018 |
| Decisions used | ADR-0005 |

## Purpose and scope
Product search and listing filters (facets). Query API shape is DOC-10 catalog.

## Context
The storefront downloads every product and filters in the browser with `String.includes` (`Shop.jsx:19-34`, `server.js:63`). At A-03 scale (3,000 products) that payload is too large for mobile data. v2 requires facets from an admin-defined attribute schema (`AttributeDefinition`, `category.filterSchema`) rather than free text.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| A. MySQL InnoDB `FULLTEXT` + synonyms table + SQL facet counts | No new service; transactionally consistent | Weak relevance tuning; **no typo tolerance** (MySQL has no trigram index); Urdu/Roman-Urdu synonyms manual |
| B. Meilisearch | Typo tolerance, fast facets | Extra service and sync; not researched this phase |
| C. Algolia/Typesense Cloud | Managed | Cost and foreign payment (A-02) |

## Decision
**Option A** at launch. A `product_search` table (one row per product: a `search_text` column holding title/subtitle/brand/category names/attribute labels, with a `FULLTEXT` index; queried with `MATCH … AGAINST (… IN BOOLEAN MODE)` and a trailing `*` for prefix match) refreshed by an outbox handler on product publish. Facets are computed with `GROUP BY` over a `product_attribute_values` table restricted to attributes with `filterable = true` for the current category's `filterSchema`. Roman-Urdu spelling variants ("shalwar/shalwaar", "dupatta/dupata") are handled by a `search_synonyms` table, which also stands in for the fuzzy matching MySQL lacks.
- API: cursor pagination, `limit` ≤ 48, sort ∈ {relevance, newest, price_asc, price_desc, bestselling}; filters in the query string; URL is the state (shareable, crawlable canonical rules in DOC-06).

## Examples
`GET /api/v1/products?category=lawn&attr.fabric=cotton&priceMin=500000&priceMax=1500000&sort=newest&limit=24&cursor=…` (prices are paisa, ADR-0013).

## Consequences
Good enough for 3,000 products; relevance is basic. Search and listing share one code path.

## Rules
**Always:** return facet counts for the *current* filter set; cap `limit`. **Never:** return unpaginated product arrays; expose internal tags as facets (v2 evidence from a live 865-product listing). **Common mistake:** facet counts that ignore the active filters.

## Acceptance checklist
- [ ] PLP/PDP payloads for 3,000 products stay under 60 kB per page of 24 (DOC-13 budget). **Open.**
- [x] Search for "shalwar" and "shalwaar" returns the same set. (`apps/api/test/search.int.test.js`.)
- [x] `EXPLAIN` shows index use on listing queries (DOC-13). (`apps/api/test/search.int.test.js` and the query-plan run (`apps/api/perf`).)

## Revisit trigger
More than 10,000 products, search "zero result" rate over 8%, listing p95 over 300 ms, or a need for typo tolerance (any script): move search to Meilisearch (option B), fed from the outbox.

## Open questions and assumptions
Meilisearch capabilities and Urdu-script tokenization were not researched. Assumes Roman-Urdu is the dominant query script at launch. InnoDB ignores words shorter than `innodb_ft_min_token_size` (default 3) and a stopword list; both must be checked against real queries in DOC-13.

## Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |
| 2026-10-02 | InnoDB `FULLTEXT` replaces Postgres FTS + trigram; typo tolerance dropped until Meilisearch |
| 2026-10-02 | Phase 5: `product_search` (two FULLTEXT indexes), synonyms, zero-result log and the query algorithm in DOC-09.5; facet index in DOC-09.3 §5.8 |
| 2026-10-02 | Phase 7 consistency review: example uses the final camelCase params (DOC-10.2) |
