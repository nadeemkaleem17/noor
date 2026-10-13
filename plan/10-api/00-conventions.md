# 10.0 — API: Conventions

| Field | Value |
|---|---|
| ID | DOC-10.0 |
| Title | URL scheme, auth classes, request/response rules, errors, pagination, sorting, idempotency, versioning, rate limits, caching |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-08 §6, §13, DOC-09.0, DOC-11 §4–5 |
| Decisions used | ADR-0005, ADR-0012, ADR-0013, ADR-0018, ADR-0020 |

## 1. Purpose and scope

**Governs:** rules every endpoint follows and the notation used in DOC-10.1 … 10.8. Those files list endpoints; they do not repeat what is here.
**Does not govern:** how handlers are implemented (DOC-08), tables (DOC-09).

The source of truth at build time is the route table in `packages/contract` (ADR-0005). These documents specify what that table must contain; OpenAPI is generated from it.

## 2. URL scheme

| Rule | Detail |
|---|---|
| Base | `/api/v1`. A breaking change means `/api/v2`; adding fields, endpoints or optional params is not breaking |
| Public | `/api/v1/<resource>` |
| Admin | `/api/v1/admin/<resource>` |
| Webhooks | `/api/v1/webhooks/<provider>` (DOC-12) |
| Resources | Plural `kebab-case` nouns; ids in the path; actions that are not CRUD are sub-resources named with a noun or verb: `/orders/:id/transitions`, `/products/bulk` |
| Methods | `GET` read (never changes state); `POST` create or command; `PUT` full replace of an editable document; `PATCH` not used (forms save whole documents with a `version`); `DELETE` delete |
| Route key | `<module>.<verbNoun>`; admin keys start with `admin.` (DOC-15 §2.2). The key is what clients call: `api('catalog.listProducts', { query })` |

## 3. Auth classes

Each route declares exactly one (`auth` in the route table).

| Class | Meaning | How identified |
|---|---|---|
| `public` | Anyone | — |
| `cart` | Holder of a cart | Header `X-Cart-Token` (the storefront server copies it from the `nc_cart` cookie). Missing or unknown token = empty cart |
| `order-token` | Holder of an order's tracking token | `:token` path parameter |
| `staff` | Signed-in staff with the route's `permission` | Session cookie + `X-CSRF-Token` on non-GET (DOC-11 §3.4, §5.1) |
| `staff-pending` | Staff between password and second factor | Pending-session cookie |
| `webhook` | Payment provider | Signature (ADR-0017) |

Public, `cart` and `order-token` routes are normally called by the storefront server with `X-Internal-Key` and `X-Forwarded-For` (DOC-11 §2).

## 4. Requests

| Topic | Rule |
|---|---|
| Body | JSON, `Content-Type: application/json`, UTF-8, ≤ 1 MB. Field names `camelCase` |
| Strictness | Body schemas are strict: an unknown key is `400 validation_failed` (DOC-11 §5.5) |
| Query | `camelCase`; arrays as comma-separated values (`size=S,M`); booleans `1`/`0`; attribute filters `attr.<code>=a,b` |
| Ids | UUID strings. Public catalog routes accept a `handle` where stated |
| Money | `{ "amount": <integer paisa>, "currency": "PKR" }` in bodies and responses (ADR-0013). Query params that carry money are bare integer paisa (`priceMin=500000`) |
| Dates | ISO 8601 UTC with milliseconds (`2026-10-02T10:45:00.000Z`). Date-only filters (`from`, `to`) are `YYYY-MM-DD` interpreted in Asia/Karachi |
| Phone | Accepted in any Pakistani mobile format; normalised to E.164 by the `PkMobile` schema; always returned as E.164 (or masked) |
| Locale | Public routes: `?locale=en|ur` (default: store default). Translatable fields are returned already resolved for that locale with English fallback. Admin routes return the base fields plus `i18n` |
| Headers | `X-Request-Id` (optional, echoed), `Idempotency-Key` (where required, §8), `X-CSRF-Token` (staff, non-GET), `X-Cart-Token`, `X-Internal-Key` |

## 5. Responses

| Topic | Rule |
|---|---|
| Success | `200` with a JSON object; `201` on create (with the created resource); `202` for accepted background work (`{ jobId }`); `204` for delete and commands with nothing to return |
| Envelope | None: the resource is the body. Lists use the page shapes in §7 |
| Nulls | Optional fields are omitted when absent; `null` is used only where "explicitly none" differs from "not set" (documented per field) |
| Images | Image fields are objects `{ src, srcset, width, height, alt, lqip? }` built by the API (DOC-08 §11); clients never construct image URLs |
| `Cache-Control` | Public catalog/content GETs: `public, s-maxage=60, stale-while-revalidate=600` with cache tags; everything `cart`, `order-token` or `staff`: `private, no-store` |
| Validation of responses | In development and test every response is parsed with its schema; a mismatch is a 500 and a failing test |

## 6. Errors

`Content-Type: application/problem+json` (RFC 9457).

```json
{
  "type": "https://rubaya.pk/problems/insufficient_stock",
  "title": "Insufficient stock",
  "status": 409,
  "code": "insufficient_stock",
  "requestId": "0192f6a2-…",
  "detail": "Only 2 available",
  "variantId": "0192f5…",
  "available": 2
}
```

| Field | Rule |
|---|---|
| `code` | Stable `snake_case`; the only field clients branch on. Registered in `@noor/contract` `errorCodes` |
| `title`, `detail` | English, for developers and logs. **Never shown to customers**: the UI maps `code` to a localised message (ADR-0018) |
| `issues` | Only on `validation_failed`: `[{ "path": "customer.phone", "code": "phone_invalid" }]` |
| Extra members | Per code, listed in §6.2 |
| `requestId` | Always present |

### 6.1 Generic codes (any route)

| Status | Code | When |
|---|---|---|
| 400 | `validation_failed` | Params, query or body failed the schema (`issues[]`) |
| 401 | `unauthenticated` | No valid session |
| 401 | `invalid_credentials` | Login failed (DOC-11 §3.2) |
| 403 | `forbidden` | Session lacks the permission |
| 403 | `csrf_failed` | Origin or CSRF token check failed |
| 403 | `step_up_required` | Recent password confirmation needed |
| 403 | `two_factor_required` | Role requires 2FA enrolment first |
| 404 | `not_found` | Unknown route, id, handle, slug or token |
| 409 | `stale_write` | `version` mismatch (`currentVersion`) |
| 409 | `invalid_transition` | State machine refused (`from`, `to`) |
| 409 | `request_in_progress` | Same idempotency key still running |
| 409 | `in_use` | Delete blocked by references (`usedBy: { type, count }[]`) |
| 413 | `payload_too_large` | |
| 422 | `idempotency_mismatch` | Same key, different body |
| 429 | `rate_limited` | `Retry-After` header and `retryAfter` seconds |
| 429 | `too_many_attempts` | Login throttle (`retryAfter`) |
| 500 | `internal_error` | Unexpected |
| 503 | `unavailable` | Dependency down (`Retry-After`) |

### 6.2 Domain codes

| Status | Code | Extra members | Raised by |
|---|---|---|---|
| 409 | `insufficient_stock` | `variantId`, `available` | cart, orders |
| 409 | `variant_unavailable` | `variantId` | cart, orders |
| 409 | `max_per_order` | `variantId`, `max` | cart |
| 409 | `cart_full` | `max` | cart |
| 409 | `cart_empty` | | orders |
| 409 | `price_changed` | `cart` | orders.create |
| 409 | `cart_has_issues` | `cart` | orders.create (a line is sold out or unavailable) |
| 422 | `promo_not_found`, `promo_not_started`, `promo_expired`, `promo_usage_limit`, `promo_not_applicable`, `promo_customer_limit`, `promo_first_order_only` | | cart, orders |
| 422 | `promo_min_spend` | `minSpend: Money` | cart, orders |
| 409 | `promo_invalid` | `cart`, `reason` (one of the promo codes above) | orders.create when a previously valid promo no longer applies |
| 422 | `city_not_served` | | quote, orders |
| 422 | `shipping_method_invalid` | | quote, orders |
| 422 | `payment_method_not_allowed` | `reason`: `cod_limit_exceeded`, `cod_not_available`, `deposit_requires_prepayment`, `method_disabled` | quote, orders |
| 404 | `order_not_found` | | orders.track (uniform, DOC-06.6 §3) |
| 409 | `action_not_allowed` | `allowedActions` | order actions |
| 409 | `deposit_unpaid` | `depositDue: Money`, `paid: Money` | confirm |
| 409 | `stock_below_reserved` | `reserved` | inventory.adjust |
| 409 | `publish_checks_failed` | `checks: { code, path? }[]` | product publish |
| 409 | `sku_taken`, `handle_taken`, `code_taken`, `email_taken`, `slug_taken` | | uniqueness |
| 409 | `media_not_ready`, `media_rejected` | `reason?` | media, product save |
| 409 | `selection_changed` | `expected`, `actual` | bulk by filter |
| 409 | `last_owner` | | staff |
| 409 | `review_already_submitted` | | reviews |
| 409 | `page_locked` | | content |
| 422 | `theme_contrast_failed` | `pairs: { pair, ratio, min }[]` | settings |
| 422 | `no_payment_method`, `no_deliverable_city` | | settings |
| 422 | `password_too_weak` | `reason` | auth |
| 422 | `invalid_code` | | 2FA |
| 410 | `token_expired` | | invite, reset, review links |

### 6.3 Field issue codes (`issues[].code` inside `validation_failed`)

These name what is wrong with one field; the UI maps them to localised messages exactly like error codes.

| Code | Meaning |
|---|---|
| `required` | Missing or empty |
| `too_short`, `too_long` | Length outside the limits (`min`/`max` in the issue) |
| `too_small`, `too_big` | Number outside the limits |
| `invalid_format` | Pattern, enum value, id, date or URL not valid |
| `unrecognized_keys` | Body contains keys the schema does not define |
| `name_invalid` | Customer name not 2–80 characters |
| `phone_invalid` | Not a Pakistani mobile number |
| `email_invalid` | Not an email address |
| `address_too_short` | Address under 10 characters |
| `city_not_served` | City not in any delivery zone |
| `link_invalid` | Href not an allowed link form (DOC-07.9 §2) |
| `color_invalid` | Not `#RRGGBB` |
| `handle_invalid`, `sku_invalid`, `code_invalid` | Slug, SKU or code pattern not met |
| `not_unique` | Duplicate inside the same document (two variants with one SKU, two menu items with one id) |

## 7. Lists

### 7.1 Public lists: cursor pagination

Query: `limit` (default and max stated per endpoint), `cursor` (opaque string from the previous page).

```json
{ "items": [ … ], "nextCursor": "eyJ…", "total": 310 }
```

`nextCursor` is absent on the last page. `total` is present where stated (product listings need it for "Showing 24 of 310"). The cursor encodes the sort key and id of the last item, so results are stable while products are added.

### 7.2 Admin lists: page pagination

Query: `page` (1-based, default 1), `size` (25, 50, 100; default 50), `sort` (`field` or `-field`; allowed fields per endpoint), `q` (search text, ≥ 2 characters), plus the endpoint's filters.

```json
{ "items": [ … ], "total": 2310, "page": 1, "size": 50 }
```

Exception: `admin.audit.list` uses a cursor (DOC-07.14 Q-07.14-3).

### 7.3 Sorting and filtering

An unknown `sort` field, filter key or filter value is `400 validation_failed` (never silently ignored). Multi-value filters are OR within the field and AND across fields.

## 8. Idempotency

| Rule | Detail |
|---|---|
| Required on | `orders.create`, `admin.orders.create`, `admin.orders.recordPayment` (stated per endpoint). Missing header → `400 validation_failed` |
| Header | `Idempotency-Key: <UUID>` |
| Behaviour | Same key + same body within 24 h → the stored response is replayed (same status and body). Same key + different body → `422 idempotency_mismatch`. Still running → `409 request_in_progress` (DOC-09.1 §2.5) |
| Naturally idempotent routes | `PUT` documents (guarded by `version`), transitions (guarded by the state machine), deletes. They need no key |

## 9. Optimistic concurrency

Editable resources return `version`. A write sends it back in the body; a mismatch is `409 stale_write` with `currentVersion`. The client refetches and lets the user choose (DOC-07.3 §9).

## 10. Bulk endpoints

`POST …/bulk` with `{ action, ids?: string[] (≤ 500), filter?: <list query>, expectedTotal?: number, params?: {…} }` (exactly one of `ids`, `filter`).

Response `200`:
```json
{ "succeeded": ["…"], "failed": [{ "id": "…", "code": "publish_checks_failed", "detail": "Missing image alt text" }] }
```
More than 500 targets → `202 { "jobId": "…" }`; the result is read from `admin.jobs.get` (DOC-07.14 §5).

## 11. Rate limits

Each route names a bucket from DOC-11 §5.4 (`default` when not stated). Responses include `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`; a refusal is `429 rate_limited`.

## 12. Notation used in DOC-10.1 … 10.8

Endpoint tables have these columns: **Key** (route key) · **Method & path** (relative to `/api/v1`) · **Auth** (class, and permission for staff) · **Request** (params `P`, query `Q`, body `B` schema names) · **Response** (status and schema) · **Errors** (domain codes beyond §6.1) · **Notes** (bucket, cache tags, idempotency).

Schemas are written as TypeScript-like shapes; in the contract they are Zod schemas of the same names:

| Notation | Meaning |
|---|---|
| `string`, `int`, `boolean` | Primitives (`int` = integer) |
| `Id` | UUID string |
| `Money` | `{ amount: int, currency: 'PKR' }` |
| `Image` | `{ src, srcset, width, height, alt, lqip? }` |
| `IsoDate` | ISO timestamp string |
| `T?` | Optional |
| `T[]` | Array |
| `'a' \| 'b'` | Enum (values from DOC-09.0 §5) |
| `CursorPage<T>` / `Page<T>` | §7.1 / §7.2 |

## 13. Rules

**Always:** add the route to the contract table first; return stable codes; make list parameters strict; return `version` on editable resources; set `Cache-Control` explicitly.
**Never:** accept money, status, actor or timestamps from a client where the server owns them; return a bare string or HTML error; expose an internal id that works as a credential (session, token hash); add a `PATCH`.
**Common mistakes:** a new error code used in a handler but missing from the registry; pagination without a stable secondary sort key (`id`); returning customer data on a route whose permission does not include `customers:read`.

## 14. Acceptance checklist

- [ ] Every route in the contract table declares `auth`, and `permission` when staff. **Open: the registrar refuses a route without `auth` at start-up (`app.test.js`); `permission` for staff routes is tested through the role matrix.**
- [ ] Every code thrown anywhere in `apps/api` exists in `errorCodes` (compile-time: `DomainError` takes the union type). **Open: error codes are one union type; `tsc` does not check every `throw` against it.**
- [ ] A request with an unknown query parameter or body key returns `400` on every route (property test over the route table). **Open: strict bodies are tested route by route, not by a property test over the table.**
- [ ] Every error response has `application/problem+json`, `code` and `requestId`. **Open: tested on samples, not on every route.**
- [x] Every `staff` route returns `Cache-Control: no-store`. (`apps/api/test/security.test.js` ("admin responses are never cached").)
- [x] OpenAPI snapshot is regenerated and committed with any route change. (`apps/api/test/app.test.js` (snapshot) and `pnpm route-keys --check` in CI.)

## 15. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-10.0-1 | No response envelope | Simpler clients; pagination data sits beside `items` | — |
| Q-10.0-2 | `PUT` whole documents instead of `PATCH` | Forms already hold the whole document; `version` prevents lost updates | Very large documents (products with 100 variants) prove slow to save |
| Q-10.0-3 | `RateLimit-*` header names | As emitted by `@fastify/rate-limit` defaults (may be `x-ratelimit-*`) | First implementation; clients do not depend on them |

## 16. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 5, part 2) |
| 2026-10-02 | Phase 7 consistency review: field issue codes listed (§6.3); they were used in DOC-06.5 without a registry |
| 2026-10-02 | M0-04: the code registry exists in `@noor/contract` (`errorStatus`, `fieldIssueCodes`); status per code in the table above is now enforced by it. Client-side network failure is reported as `unavailable` with status 0 |
