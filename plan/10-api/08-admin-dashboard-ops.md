# 10.8 — API: Admin Dashboard, Search and Operations

| Field | Value |
|---|---|
| ID | DOC-10.8 |
| Title | Navigation counts, dashboard, global search, background jobs, exports, health |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-10.0, DOC-09.1, DOC-07.1 §3, DOC-07.2, DOC-07.11 §4, DOC-07.15 §6, DOC-08 §9, §14 |
| Decisions used | ADR-0009, ADR-0013 |

## 1. Purpose and scope

**Governs:** the cross-cutting admin endpoints (`reporting` module and platform) and the health endpoints.
**Does not govern:** per-entity lists (DOC-10.5 … 10.7).

Admin paths under `/api/v1/admin`; auth `staff`; `no-store`.

## 2. Navigation and dashboard

| Key | Method & path | Permission | Request | Response | Notes |
|---|---|---|---|---|---|
| `admin.nav.counts` | `GET /nav/counts` | any signed-in user | — | 200 `{ ordersNeedingAction?: int, reviewsPending?: int }` | A field is absent when the user lacks the permission for that area, and `reviewsPending` is also absent while `features.reviews` is off in the store settings (the menu then has no Reviews). One query each, both on indexed status columns |
| `admin.background.status` | `GET /admin/background` | any signed-in user | — | 200 `BackgroundStatus` (`state: ok | idle | stalled | down`, `workers`, `waiting`, `overdue`, `oldestOverdueSeconds`, `dead`, `waitingTypes`) | Read from `worker_heartbeats` and the `jobs` table; the admin shows a strip when the state is `stalled` or `down`. |
| `admin.searchIndex.status` | `GET /admin/search-index` | `settings:manage` | — | 200 `SearchIndexStatus` (`active`, `indexed`, `missing`, `stale`, `orphaned`, `lastIndexedAt?`, `rebuildQueued`) | Counts products that should be in the search index against what it holds. |
| `admin.searchIndex.rebuild` | `POST /admin/search-index/rebuild` | `settings:manage` | — | 202 `{ queued }` | Queues the `search.reconcile` repair (one at a time) and writes an audit entry. |
| `admin.dashboard.todo` | `GET /dashboard/todo` | `dashboard:read` | — | 200 `TodoCounts` | Fields absent by permission |
| `admin.dashboard.summary` | `GET /dashboard/summary` | `dashboard:read` + `orders:read` | Q: `from`, `to` (dates, ≤ 366 days) | 200 `SalesSummary` | Days are Asia/Karachi |
| `admin.dashboard.topProducts` | `GET /dashboard/top-products` | `dashboard:read` + `orders:read` | Q: `from`, `to`, `limit?` (≤ 20, default 10) | 200 `{ items: { productId: Id, title: string, image?: Image, units: int, sales: Money }[] }` | |
| `admin.dashboard.zeroSearches` | `GET /dashboard/zero-searches` | `dashboard:read` | Q: `from`, `to`, `limit?` (≤ 50, default 10) | 200 `{ items: { query: string, count: int }[] }` | From `search_misses` |

```ts
TodoCounts = {
  toConfirm?: { count: int, oldestAt?: IsoDate },
  toDispatch?: { count: int, oldestAt?: IsoDate },
  awaitingPayment?: { count: int },                  // present only when a prepaid method is enabled
  lowStock?: { count: int }, soldOut?: { count: int },
  reviewsPending?: { count: int }, failedJobs?: { count: int },
}

SalesSummary = {
  current: Kpis, previous: Kpis,                     // previous = the period of equal length immediately before
  byDay: { day: string /* YYYY-MM-DD */, sales: Money, orders: int }[],      // weekly buckets when the range exceeds 31 days (bucket: 'day' | 'week')
  bucket: 'day' | 'week',
}
Kpis = { netSales: Money, orders: int, averageOrder?: Money,
         deliveredRate?: number /* 0–1; absent under 20 final-status orders */,
         cancelledRate?: number, cancelledByReason?: Record<CancelReason | ReturnType, int> }
```

KPI definitions are those of DOC-07.2 §4; they are computed in SQL by `reporting` and never by the client.

## 3. Global search

| Key | Method & path | Permission | Request | Response | Notes |
|---|---|---|---|---|---|
| `admin.search` | `GET /search` | any signed-in user | Q: `q` (≥ 2, ≤ 80) | 200 `SearchResults` | Sections are filtered by permission: orders need `orders:read`, customers `customers:read`, products `products:read`. ≤ 5 per section. Bucket `admin` |

```ts
SearchResults = {
  orders: { id: Id, orderNumber: string, status: OrderStatus, customerName: string, total: Money }[],
  products: { id: Id, title: string, sku?: string /* the matching SKU */, status: ProductStatus, stockStatus: StockStatus, image?: Image }[],
  customers: { id: Id, name: string, phone: string, city?: string, ordersCount: int }[],
}
```

Matching: orders by exact number (with or without prefix), phone-digit prefix (≥ 4 digits), tracking number, customer-name prefix; products by title prefix/full-text, exact SKU, handle prefix; customers by name prefix and phone-digit prefix (≥ 4 digits). All on indexed columns (DOC-09.3, 09.7).

## 4. Jobs and exports

| Key | Method & path | Permission | Request | Response | Errors | Notes |
|---|---|---|---|---|---|---|
| `admin.jobs.get` | `GET /jobs/:id` | the user who started it, or `settings:manage` | — | 200 `JobStatus` | `not_found` | Polled by the UI every 2 s while `running` (bulk actions, imports, exports) |
| `admin.jobs.listDead` | `GET /jobs/dead` | `audit:read` | Q: `type?`, `page`, `size` | 200 `Page<{ id: Id, type: string, attempts: int, lastError?: string, diedAt: IsoDate, entity?: { type: string, id: string, label: string } }>` | — | "Failed jobs" (DOC-07.2 §3) |
| `admin.jobs.retry` | `POST /jobs/dead/:id/retry` | `settings:manage` | — | 204 | `not_found` | Moves the job back to the queue; audited |
| `admin.exports.list` | `GET /exports` | `settings:manage` | Q: `page`, `size` | 200 `Page<ExportInfo>` | — | Last jobs (DOC-07.11 §4) |
| `admin.exports.download` | `GET /exports/:id/download` | the requester, or `settings:manage` | — | 302 to a signed storage URL (5-minute expiry) | `not_found`, `token_expired` (past `expiresAt`) | Audited when the export contains personal data |
| `admin.system.info` | `GET /system` | `settings:manage` | — | 200 `{ environment: string, version: string /* git SHA */, lastBackupAt?: IsoDate, queue: { pending: int, dead: int, oldestPendingAgeSec?: int } }` | — | |

```ts
JobStatus = { id: Id, type: string, state: 'queued' | 'running' | 'done' | 'failed',
              progress?: { done: int, total: int },
              result?: { succeeded: string[], failed: { id: string, code: string, detail?: string }[] } | { exportId: Id },
              error?: string }
ExportInfo = { id: Id, type: string, status: ExportStatus, rowCount?: int, requestedBy: string, createdAt: IsoDate,
               finishedAt?: IsoDate, expiresAt?: IsoDate, downloadable: boolean }
```

A user-started job's state is stored on its `exports` row (type `bulk_result` for bulk actions, DOC-09.1 §2.7), so it survives the `jobs` row being deleted on success; `:id` in `admin.jobs.get` is that row's id.

### 4.1 Reports from the browsers (public, bucket `default`, answer 204)

| Key | Method & path | Body | Notes |
|---|---|---|---|
| `reporting.vitals` | `POST /vitals` | `{ name: 'LCP' \| 'INP' \| 'CLS', value: number ≥ 0, route: string ≤ 40, navigationType?: string }` | Counted in `web_vitals_daily` by Pakistan day, page (`home`, `category`, `product`, `cart`, `checkout`, `order`, `page`; anything else is `other`), metric and size bucket (DOC-13 §8.6). Nothing about the visitor is stored |
| `reporting.clientError` | `POST /client-errors` | `{ message, stack?, route, app: 'storefront' \| 'admin', release }`; text is cut to 1,000 / 2,500 / 100 / 40 characters | Written to the log at `error` with the request id; not stored |

An extra field in either body is a `400`: nothing that names a person is accepted.

## 5. Health (no auth, not under `/admin`, not rate-limited, not logged at `info`)

| Method & path | Response | Meaning |
|---|---|---|
| `GET /healthz` | 200 `{ "ok": true }` | The process is up. Used as liveness |
| `GET /readyz` | 200 `{ "ok": true }` or 503 `{ "ok": false, "failing": ["database" \| "migrations"] }` | Database reachable (`SELECT 1` within 1 s) and migrations at head. Used as readiness and by `pnpm dev` |

They expose no version, host or configuration detail.

## 6. Route inventory

The route keys are defined across DOC-10.1 … 10.8 and have **not been tallied** in this document. The contract route table is the list: `pnpm route-keys` (`scripts/route-keys.mjs`) writes `plan/10-api/route-keys.txt` from `packages/contract`, and a test fails if a key in that file is not described in one of these documents (matched by the key string) or a documented key is missing from the table. Phase 7 uses that file for the consistency review.

## 7. Rules

**Always:** compute figures in SQL in the `reporting` module; filter sections by permission on the server; keep job status readable after the job row is gone.
**Never:** let the client aggregate orders into KPIs; return customers in search to a role without `customers:read`; expose internals from health endpoints.
**Common mistakes:** counting cancelled orders in net sales; an unindexed search path (`LIKE '%…%'`); polling job status faster than 2 s.

## 8. Acceptance checklist

- [x] `admin.dashboard.todo.toConfirm.count` equals `admin.orders.counts.pending_confirmation`. (`reporting.int.test.js`.)
- [x] `netSales` for a seeded range equals a hand-written SQL sum (test), and excludes cancelled and returned orders. (`reporting.int.test.js`: against a sum in SQL, with a cancelled order left out, and with days at the Pakistan day boundary.)
- [x] `admin.search` as a `catalog` user returns only `products`. (`reporting.int.test.js`: orders and customers come back empty.)
- [ ] Every search path uses an index (`EXPLAIN` in the query-plan test set, DOC-13). **Open: `apps/api/perf` covers the listed queries.**
- [ ] A bulk job's result is still readable 10 minutes after it finished. **Open.**
- [ ] `/readyz` returns 503 with `failing: ["migrations"]` when a migration is pending. **Open.**

## 9. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-10.8-1 | Dashboard queries run live on order tables | Fast enough at A-03 with the DOC-09.7 indexes | Summary slower than 300 ms → nightly rollup table |
| Q-10.8-2 | `lastBackupAt` | Provided by the host in production; absent locally | DOC-14 provider choice |
| Q-10.8-3 | Route inventory | Not counted here; generated from the contract at M0 (§6) | — |

## 10. Changelog

| Date | Change |
|---|---|
| 2026-10-06 | M4-11: `modules/reporting` built: `admin.nav.counts`, `admin.dashboard.todo`, `.summary`, `.topProducts`, `.zeroSearches`, `admin.search`, `admin.jobs.listDead`, `admin.jobs.retry`, `admin.system.info` (the real queue numbers), `reporting.vitals`, `reporting.clientError`, the job `reporting.sales_counts` (nightly 01:00 in Pakistan: units in delivered orders of the last 90 days, minus what was returned) and `reporting.cleanup` (counts older than 180 days). **Not built:** `admin.jobs.get` and `admin.exports.*`: nothing starts a user job yet (exports and bulk answer at once, DOC-10.6), so there is no state to report; they come with the first background export. Decisions: the nav badge `ordersNeedingAction` is `pending_confirmation` plus `confirmed`; the to-do `toDispatch` leaves out an order with a made-to-order line whose shortest lead time has not passed since confirmation; `lowStock` and `soldOut` count active products by their stock status, not variants; `summary` and `topProducts` need `orders:read` as well as `dashboard:read` (`403` otherwise); `deliveredRate` and `cancelledRate` are shares of the orders placed in the period that reached a final status (absent below 20); `cancelledByReason` is the cancel reasons plus, for returned orders, the return type of the return event; the week bucket starts on Monday; `topProducts` counts every order not cancelled or returned, delivered or not; the search matches by prefix (`LIKE 'x%'`), by exact SKU, order number and tracking number, and by name or phone only for those who may read customers (an order is then found by name or phone too). The 75th percentile of a metric is `reporting.p75(route, metric, days)`; the table in settings waits for the screen (M6). Every `GROUP BY` uses the same text as the column it lists (the database runs with `ONLY_FULL_GROUP_BY`). |
| 2026-10-02 | Initial version (Phase 5, part 2) |
| 2026-10-02 | Phase 5 part 3: public `POST /api/v1/vitals` (storefront field metrics) is defined in DOC-12 §6.1 and belongs to this file's `reporting` module; body `{ name: 'LCP' | 'INP' | 'CLS', value: number, route: string, navigationType?: string }`, 204, bucket `default` |
| 2026-10-02 | Phase 6: public `POST /api/v1/client-errors` (browser error intake, DOC-13 §8.5) belongs to this file: body `{ message: string, stack?: string, route: string, app: 'storefront' | 'admin', release: string }` (≤ 4 kB), 204, bucket `default` |
| 2026-10-02 | M0-13: `pnpm route-keys --check` fails when a contract route is not described here and reports how many documented routes are not built yet (about 177 at M0; approximate, rows that use shorthand such as `.create` are not expanded) |
