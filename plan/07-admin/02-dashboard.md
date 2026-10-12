# 07.2 — Admin: Dashboard

| Field | Value |
|---|---|
| ID | DOC-07.2 |
| Title | Dashboard: work queue, KPIs, charts |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-07.1, DOC-04c §6 |
| Decisions used | ADR-0013, ADR-0015, ADR-0017, ADR-0020 |

## 1. Purpose and scope

**Governs:** the `/` screen: what it shows, in which order, and where each number links.
**Does not govern:** how numbers are computed in SQL (DOC-10 `admin.dashboard.*`, DOC-09); reporting beyond this page (not in v1).

The dashboard answers two questions in this order: **what needs doing now**, then **how is the shop doing**.

## 2. Layout

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Dashboard                                         Period: [Last 7 days ▾]     │
├───────────────────────────────────────────────────────────────────────────────┤
│ TO DO                                                                         │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│ │ 12 to confirm│ │ 8 to dispatch│ │ 5 low stock  │ │ 3 reviews    │           │
│ │ oldest 3h    │ │ oldest 1d    │ │              │ │ pending      │           │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘           │
├───────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐    │
│ │ Net sales  │ │ Orders     │ │ Avg order  │ │ Delivered  │ │ Cancelled/ │    │
│ │ Rs.412,300 │ │ 64         │ │ Rs. 6,442  │ │ rate 71%   │ │ refused 18%│    │
│ │ ▲ 12%      │ │ ▼ 4%       │ │ ▲ 3%       │ │            │ │            │    │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘    │
├──────────────────────────────────────────────┬────────────────────────────────┤
│ Sales by day (bar chart)                     │ Top products (by net sales)    │
├──────────────────────────────────────────────┼────────────────────────────────┤
│ Recent orders (10)                           │ Searches with no results (10)  │
└──────────────────────────────────────────────┴────────────────────────────────┘
```

## 3. To-do cards

Each card is a link to a pre-filtered list. A card is hidden when its count is 0; when all are 0 the row shows "Nothing waiting. Nice."

| Card | Count | Sub-line | Links to | Needs |
|---|---|---|---|---|
| To confirm | Orders in `pending_confirmation` | Age of the oldest; turns `warning` after 2 h, `danger` after 12 h | `/orders?status=pending_confirmation&sort=createdAt` | `orders:read` |
| To dispatch | Orders in `confirmed` not yet dispatched (excluding made-to-order still within lead time) | Age of the oldest | `/orders?status=confirmed` | `orders:read` |
| Awaiting payment | Orders in `pending` (online/transfer); shown only when a prepaid method is enabled | — | `/orders?status=pending` | `orders:read` |
| Low stock | Variants with `low_stock` or quantity ≤ the store's low-stock threshold (default 3) | — | `/products?stock=low` | `products:read` |
| Sold out | Active products with every variant `sold_out` | — | `/products?stock=sold_out&status=active` | `products:read` |
| Reviews pending | Reviews in `pending` | — | `/reviews?status=pending` | `reviews:read` |
| Failed jobs | Dead-letter jobs (notifications that could not be sent, ADR-0009) | — | `/audit?type=job_failed` | `audit:read` |

## 4. KPI tiles

Period selector: Today, Yesterday, Last 7 days (default), Last 30 days, This month, Custom range (max 366 days). State in the URL (`?period=7d` or `?from=&to=`). Days are Asia/Karachi days. Each tile shows the value and the change against the previous period of equal length.

| Tile | Definition |
|---|---|
| Net sales | Sum of `total` of orders **placed** in the period, excluding `cancelled` and `returned`. Tooltip: "Includes orders not yet delivered" |
| Orders | Count of orders placed in the period, excluding `cancelled` |
| Average order value | Net sales ÷ orders (integer paisa division rounded half up, done by the API) |
| Delivered rate | Delivered ÷ (delivered + cancelled + returned) among orders placed in the period that have reached a final status |
| Cancelled / refused | Share of orders placed in the period that are `cancelled` or `returned`, split in the tooltip by reason group (customer cancelled, unreachable at confirmation, refused at door, other) |

The last two exist because COD cancellation and refusal are the main revenue leak in this market (DOC-06.5 §1); they show "–" until at least 20 orders have a final status.

Money is formatted with `formatMoney`; no rupee arithmetic in the client.

## 5. Panels

| Panel | Content | Notes |
|---|---|---|
| Sales by day | Bars: net sales per day in the period; hovering or focusing a bar shows date, sales and order count. Over 31 days the bars are weeks | One series, `accent` colour; a visually hidden data table follows the chart for screen readers. Implemented as inline SVG (about 60 lines); no chart library in v1 |
| Top products | Top 10 by net sales in the period: thumbnail, title, units, sales; row links to the product | |
| Recent orders | Last 10 orders: number, customer first name, city, total, payment, `StatusBadge`, relative time; row links to the order | Refreshes with the 60 s nav poll |
| Searches with no results | Top 10 storefront queries that returned 0 products in the period, with counts | Tells staff which synonyms or products to add (ADR-0010). Read-only in v1 |

## 6. Data and states

| Query | Route key | Refetch |
|---|---|---|
| To-do counts | `admin.dashboard.todo` | 60 s while visible, and on window focus |
| KPIs + sales by day | `admin.dashboard.summary?from&to` | `staleTime` 60 s |
| Top products, zero-result searches | `admin.dashboard.topProducts`, `admin.dashboard.zeroSearches` | `staleTime` 5 min |
| Recent orders | `admin.orders.list?sort=-placedAt&size=25` (first 10 shown) | 60 s |

Each panel loads and fails independently (its own error boundary and `ErrorState`); a failed panel never blanks the page. Skeletons match the final sizes. A panel is omitted when the user lacks its permission (a `catalog` role sees stock cards and top products only).

## 7. Rules

**Always:** make every number a link to the list that explains it; state the definition in a tooltip; use Karachi days.
**Never:** compute a KPI in the browser from a list of orders; show revenue from cancelled or returned orders; add a chart that has no decision attached to it.
**Common mistakes:** one failed query blanking the dashboard; comparing a partial "today" against a full yesterday without saying so (the tile says "so far today").

## 8. Acceptance checklist

- [x] Each to-do card's count equals the row count of the list it links to. (API: the count of "to confirm" equals the orders tab, `reporting.int.test.js`; each card links to the list with its filter in the address.)
- [x] Killing one dashboard endpoint leaves the other panels working. (`dashboard.test.jsx`: the top-products call fails, the rest stay.)
- [x] Changing the period updates the URL; reloading restores it. (`dashboard.test.jsx`, `period.test.js`.)
- [x] The chart has a text alternative (data table) and bars are focusable. (`dashboard.test.jsx`.)
- [x] A user with only `catalog` permissions sees no sales figures. (The API refuses them the sales calls and the page does not make them: `dashboard.test.jsx` uses a role with `products:read` only and any call that is not allowed fails the test.)
- [x] Net sales for a seeded period matches a hand-computed SQL sum in the test. (API: `reporting.int.test.js`. Looked at once against the real API: the net sales of the period, 53,990, are the sum of the days in the chart.)

## 9. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-07.2-1 | Low-stock threshold | Store setting, default 3 | Owner changes it |
| Q-07.2-2 | Cancellation reason groups | From the reason codes in DOC-07.5 §6 | DOC-09 orders |
| Q-07.2-3 | Chart library | None (inline SVG) | A third chart type is needed |
| Q-07.2-4 | Profit/margin | Not shown (no cost price in the contract) | Owner asks → add `cost` to variants (DOC-09) |

## 10. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 3) |
| 2026-10-02 | Phase 7 consistency review: admin lists page with `size`, not `limit` |
| 2026-10-12 | M6-05 built (`/`). Differences: a role without `orders:read` gets the to-do cards the API gives it and the searches with no results, and no top products (the API needs `orders:read` for them, so "a catalog role sees stock cards and top products only" is "stock cards" in practice); the failed-jobs card links to `/audit` (there is no job filter there); the card for reviews is left out while the store has reviews off (the API gives no count then); the definition of each figure is written under it, not in a tooltip, so it can be read by everyone; the change against the period before is shown only when there was something before. |
