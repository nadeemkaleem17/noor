# 09.5 — Data Model: Search

| Field | Value |
|---|---|
| ID | DOC-09.5 |
| Title | Product search rows, synonyms, zero-result log |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-09.0, DOC-09.3, DOC-06.3 §7, DOC-07.2 §5 |
| Decisions used | ADR-0010 |

## 1. Purpose and scope

**Governs:** the three tables of the `search` module and how a text query is executed.
**Does not govern:** filters and facets (they run on catalog tables, DOC-09.3 §5.8; query shape in DOC-10 catalog).

## 2. Tables

### 2.1 `product_search`

One row per **active** product, rebuilt by the `search.reindex_product` job (DOC-08 §9.2).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `product_id` | char(36) | NN | | PK; FK → `products.id` CASCADE |
| `title_text` | varchar(400) | NN | | Title, subtitle, brand, colourway label |
| `body_text` | text | NN | | Category names (with ancestors), attribute value labels, component fabrics and techniques, SKUs, plain text of the first 500 characters of the description, and the Urdu title when present |
| `updated_at` | datetime(3) | NN | | |

Indexes: `FULLTEXT product_search_title_ft (title_text)`, `FULLTEXT product_search_all_ft (title_text, body_text)`.

Server setting `innodb_ft_min_token_size = 2` (DOC-14 §3.2). The default InnoDB stopword list is replaced by an empty custom list (`innodb_ft_server_stopword_table`) so words like "in" or "for" inside product names are not dropped; DOC-14 Q-14-5 covers providers that do not allow this.

### 2.2 `search_synonyms`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `term` | varchar(60) | NN | | PK. Lower-case, as a customer might type it: `shalwaar`, `dupata`, `kurti` |
| `expands_to` | varchar(200) | NN | | Space-separated terms that replace it: `shalwar`, `dupatta`, `kurta kurti` |
| `created_at` | datetime(3) | NN | | |

Seeded with common Roman-Urdu spelling variants; staff cannot edit it in v1 (the dashboard's zero-result list tells developers what to add, DOC-07.2 §5). Loaded into memory with a 5-minute TTL.

### 2.3 `search_misses`

Daily counts of queries that returned nothing.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `day` | date | NN | | PK part (Asia/Karachi day) |
| `query` | varchar(80) | NN | | PK part. Normalised (lower-case, trimmed, single spaces). Queries containing 7 or more consecutive digits are not logged (they are likely phone numbers) |
| `count` | int | NN | 1 | |

Written with `INSERT … ON DUPLICATE KEY UPDATE count = count + 1`. Rows older than 180 days are deleted.

## 3. Query execution

1. Normalise `q`: lower-case, strip characters other than letters, digits, spaces and hyphens, collapse spaces, cap at 80 characters and 8 words.
2. Expand each word through `search_synonyms`.
3. Build a boolean-mode expression: every original word group is required, alternatives inside a group are OR-ed, and the last word gets a prefix wildcard: `shalwaar kam` → `+(shalwaar shalwar) +(kam*)`.
4. Run:
```sql
SELECT p.id,
       MATCH(s.title_text) AGAINST (:expr IN BOOLEAN MODE) * 3
     + MATCH(s.title_text, s.body_text) AGAINST (:expr IN BOOLEAN MODE) AS score
FROM product_search s JOIN products p ON p.id = s.product_id
WHERE p.status = 'active'
  AND MATCH(s.title_text, s.body_text) AGAINST (:expr IN BOOLEAN MODE)
  /* + the same facet/price/stock predicates as a listing */
ORDER BY score DESC, p.sales_count DESC, p.id
LIMIT 25;
```
5. An exact SKU match (`variants.sku = :q`, upper-cased) is checked first and, when found, that product is returned first.
6. Zero results → upsert into `search_misses`.

The expression is built from sanitised tokens and passed as a bound parameter; boolean-mode operators typed by a customer (`+ - * " ( ) ~ < > @`) are stripped in step 1.

## 4. Rules

**Always:** reindex through the job when a product, its categories, attributes or status change; pass the search expression as a parameter; keep the same filter predicates for search and listings (one query builder).
**Never:** search with `LIKE '%…%'` on product tables; let customer input reach the boolean-mode syntax unfiltered; log queries that look like phone numbers.
**Common mistakes:** forgetting to remove the `product_search` row when a product is archived (the job deletes it for non-active products); expecting typo tolerance (not available: synonyms and prefix matching are the substitutes, ADR-0010).

## 5. Acceptance checklist

- [ ] "shalwar" and "shalwaar" return the same products (ADR-0010).
- [ ] A two-letter size or word ("xl", "3 pc") matches.
- [ ] Typing a full SKU returns that product first.
- [ ] A query of `+++"` or `*` returns an empty result, not an SQL error.
- [ ] Archiving a product removes it from results within the job latency.
- [ ] `EXPLAIN` shows the FULLTEXT index in use.

## 6. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-09.5-1 | Relevance quality of InnoDB FULLTEXT | Adequate for about 3,000 products with title weighting | Zero-result rate over 8% or owner complaints → Meilisearch (ADR-0010) |
| Q-09.5-2 | Urdu-script queries | Indexed as-is (Urdu title in `body_text`); tokenisation quality not verified | Urdu launch |
| Q-09.5-3 | Custom empty stopword table | Settable on the chosen database | DOC-14 Q-14-5 |
| Q-09.5-4 | Staff-editable synonyms | Not in v1 | Frequent synonym requests |

## 7. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 5, part 1) |
