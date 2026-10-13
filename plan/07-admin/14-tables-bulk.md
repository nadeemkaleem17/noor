# 07.14 — Admin: Tables and Bulk Actions

| Field | Value |
|---|---|
| ID | DOC-07.14 |
| Title | The `DataTable` component, list-screen conventions, bulk actions, exports |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-07.1, DOC-04b, DOC-04c §6–7, DOC-05 §2, §8, §10 |
| Decisions used | ADR-0005, ADR-0009, ADR-0015 |

## 1. Purpose and scope

**Governs:** how every list screen in the admin is built: the shared `DataTable`, URL state, selection, bulk-action flow and exports. Each list screen (DOC-07.3 … 07.13) only declares its columns, filters and actions.
**Does not govern:** bulk endpoint contracts (DOC-10 conventions; shape summarised in §5.2); which bulk actions a screen has (that screen's doc).

Fixes K5 (lists render full arrays, no pagination or virtualization) and K6 (bulk actions loop one request per row).

## 2. `DataTable` (`apps/admin/src/components/DataTable.tsx`)

One component used by every list. Screens pass configuration; they never build a `<table>` by hand.

```tsx
<DataTable
  query={productQueries.list}            // (params) => queryOptions; params come from the URL
  columns={columns}                      // module-scope constant (DOC-05 §4)
  filters={filters}                      // declarative filter definitions (§3)
  defaultSort={{ id: 'updatedAt', desc: true }}
  rowId={(p) => p.id}
  rowHref={(p) => `/products/${p.id}`}
  bulkActions={bulkActions}              // §5
  empty={{ title: 'No products yet', action: <NewProductButton /> }}
  cardBelow="md"                         // optional: render rows as cards on small screens
/>
```

| Prop | Type | Notes |
|---|---|---|
| `query` | `(params: ListParams) => QueryOptions<Page<T>>` | From the feature's `api.ts`. `Page<T>` = `{ items, total, page, pageSize }` (admin lists use page numbers, so "1–50 of 2,310" and jump-to-page work) |
| `columns` | `ColumnDef<T>[]` | `{ id, header, cell, sortable?, align?: 'start' \| 'end', width?, hideable?: boolean, defaultHidden? }` |
| `filters` | `FilterDef[]` | §3 |
| `rowId`, `rowHref` | functions | `rowHref` makes the first cell a real link and the row clickable |
| `bulkActions` | `BulkAction<T>[]` | Omit for no selection column |
| `rowActions` | `(row) => MenuItem[]` | The ⋯ menu |
| `empty` | `{ title, body?, action? }` | For the unfiltered-empty case |
| `cardBelow` | breakpoint | Orders use `md` (DOC-07.5) |

**As built (M3-02):** `components/data-table.jsx` does not use TanStack Table (Q-07.14-2: with the server doing sort, filter and paging, the library would only have kept selection and column visibility, which are a few lines of state; no dependency was added). Column widths by dragging, the card layout (`cardBelow`, with Orders), the `async` filter and a "jump to page" box are not built; the footer uses the shared `Pagination` (previous, numbers, next). Rows are not virtualised: 100 plain rows render without delay, and `VirtualRows` stays in DOC-05 §2 for a table that needs it. The old text follows.

Built on TanStack Table v9 (`useTable` with explicitly registered features via `tableFeatures`, per the v9 announcement) for column definitions, visibility, sizing and row selection. Sorting, filtering and pagination are **server-side**: the table is told the current state from the URL and reports changes; it never sorts or filters rows itself. The body is virtualized (`VirtualRows`, DOC-05 §2) when the page size is 100.

## 3. URL state (every list)

| Param | Meaning | Default (omitted from the URL) |
|---|---|---|
| `q` | Search text | empty |
| `page` | 1-based page | 1 |
| `size` | 25 / 50 / 100 | 50 |
| `sort` | `<columnId>` or `-<columnId>` (descending) | the screen's default |
| `<filterKey>` | Filter value; multi-select as comma-separated | none |
| `edit`, `new`, `entry`, `review` | Open drawer (screen-specific) | closed |

| Rule | Detail |
|---|---|
| Parsing | One Zod schema per screen parses `URLSearchParams`; invalid values are dropped (not errors) and the URL is rewritten |
| Writing | `setSearchParams(next, { replace: true })` for typing (debounced 300 ms) and `replace: false` for discrete changes (filter pick, sort, page) so Back undoes them |
| Reset | Any change to `q`, a filter or `sort` resets `page` to 1 |
| Query key | The parsed params object is the query key input, so each distinct URL has its own cache entry (`placeholderData: keepPreviousData`) |
| Saved views | Not in v1; a filtered URL can be bookmarked |

Filter definitions:

| `type` | Control | Example |
|---|---|---|
| `select` | `NativeSelect` | status |
| `multi` | `Menu` with checkboxes | kind, city |
| `async` | `Combobox` with server search | category, product, customer |
| `dateRange` | Two `<input type="date">` + presets (Today, 7 days, 30 days, This month) | placed date |
| `boolean` | Toggle chip | has issues, has photos |

Applied filters render as removable chips with "Clear all". The search box has `role="search"`, minimum 2 characters, and shows what it searches in its placeholder ("Search order no., name, phone…").

## 4. Table behaviour

| Topic | Rule |
|---|---|
| Header | Sticky. Sortable headers are buttons cycling ascending → descending → default, with `aria-sort` |
| Columns menu | Show/hide hideable columns; widths adjustable by dragging header edges and by keyboard (`Alt + ←/→` on a focused header). Visibility and widths are saved per table in `noor.admin.prefs` |
| Alignment | Text `start`; numbers, money and dates `end` with `tabular-nums` |
| Row | 44 px; hover `bg-surface-2`; the first cell contains the link; clicking elsewhere on the row navigates too (but not on controls); middle-click and `Ctrl/⌘`-click open a new tab because the link is real |
| Selection | Checkbox column; header checkbox selects the **page**; then a line offers "Select all N matching this filter"; `Shift`-click selects a range; selection clears when filters change and persists across pages |
| Footer | "1–50 of 2,310", page-size select, First / Prev / page input / Next / Last |
| Loading | First load: 10 skeleton rows. Refetch or page change: previous rows at 60% opacity + header spinner (DOC-04c §6) |
| Empty | No data and no filters: `empty` prop. No results with filters: "No results" + "Clear filters" |
| Error | `ErrorState` in the body with Retry; toolbar stays usable |
| Stale data | Lists refetch on window focus; orders also every 60 s (DOC-05 §10) |
| Accessibility | A real `<table>` with `<caption class="sr-only">`, `scope` on headers, `aria-rowcount` when virtualized; result count announced politely after each change |
| Keyboard | DOC-07.15 §3 |

## 5. Bulk actions

### 5.1 Flow

```
select rows ──► bar appears: "3 selected  [Publish] [Archive] [⋯]  ✕ clear"
            └─► (destructive or > 50 rows) ConfirmDialog with the count
                 └─► POST …/bulk ──► result
                      ├─ all ok      → toast "3 published"
                      ├─ mixed       → toast "48 published, 2 failed" [View failures]
                      └─ all failed  → Dialog listing the reasons
```

| Rule | Detail |
|---|---|
| Bar | Replaces the filter row while a selection exists; sticky; shows the count and whether it is "all matching" |
| Permission | Only actions the user may perform are rendered |
| Confirmation | Required for delete, archive, cancel, and any action on more than 50 rows; delete of more than 20 requires typing the count |
| One request | The client sends **one** request: `{ action, ids: [...] }` or, for "all matching", `{ action, filter: <the current list params> }` with the `total` the user saw (the server refuses with `selection_changed` if the match count now differs by more than the action's tolerance of 0) |
| Limits | Up to 500 items run synchronously. Larger selections become a background job (ADR-0009): the response is `202 { jobId }`, a toast says "Working on 2,310 products…", and completion arrives as a toast with the result (polled via `admin.jobs.get`) |
| Atomicity | Per item: each succeeds or fails on its own; the response lists both. An action that must be all-or-nothing is not offered as a bulk action |
| After | Selection is cleared for succeeded ids and **kept for failed ids**; the list and counts are invalidated |
| Failures dialog | Table: item label, reason (from the stable error code), link to the item; "Copy list" |
| Undo | Not offered; reversible actions are their own bulk actions (Publish ↔ Unpublish) |

### 5.2 Response shape (summary; DOC-10 owns it)

```json
{ "succeeded": ["p_1", "p_2"],
  "failed": [{ "id": "p_3", "code": "publish_checks_failed", "message": "Missing image alt text" }] }
```

### 5.3 Catalogue of bulk actions

| Screen | Actions | Permission |
|---|---|---|
| Products | Publish, Unpublish, Archive, Add to collection, Remove from collection, Delete, Export | `products:publish`, `products:write`, `products:delete`, `products:export` |
| Orders | Confirm, Mark dispatched (courier + tracking paste), Mark delivered, Print invoices, Export | `orders:confirm`, `orders:dispatch`, `orders:deliver`, `orders:export` |
| Reviews | Approve, Reject (one reason for all) | `reviews:moderate` |
| Promos | Enable, Disable | `promos:write` |
| Customers | Export | `customers:export` |
| Collection members | Remove | `catalog:write` |

## 6. Exports

| Rule | Detail |
|---|---|
| Scope | The current filter (or the selection when one exists); the dialog states the row count |
| Format | CSV, UTF-8 with BOM (opens correctly in Excel), ISO dates, money as rupees with two decimals in separate numeric columns (no currency symbol) |
| Formula safety | Cells beginning with `=`, `+`, `-`, `@` or a tab are prefixed with `'` (CSV-injection protection) |
| Size | ≤ 1,000 rows: generated in the request and downloaded. More: background job, link in a toast and in `/settings/data` (DOC-07.11 §4) |
| Personal data | Order and customer exports need their export permission and write an audit entry with the filter used |

## 7. Rules

**Always:** keep table state in the URL; send one bulk request; report per-item results; build lists with `DataTable`.
**Never:** sort, filter or paginate in the browser; loop `await` over selected rows; fetch all rows to "select all" (send the filter); offer a bulk action the role cannot perform.
**Common mistakes:** defining `columns` inside the component (re-initialises the table each render); losing the selection on page change; an export that ignores the active filters; a toast-only failure report with no way to see which rows failed.

## 8. Acceptance checklist

- [x] (so far) Every list screen is a `DataTable`; (Products is the first, M3-02) `grep -rn "<table" apps/admin/src/features` matches only print views and the size-chart grid.
- [x] Reloading any list URL restores search, filters, sort, page, page size and open drawer. (Tested; also seen on the real product list. No screen has a drawer yet.)
- [x] Network panel: a bulk action on 30 rows is exactly one request. (Tested with a fake action: `data-table.test.jsx`. No bulk endpoint exists yet; `admin.products.bulk` comes with M3-03.)
- [x] "Select all 2,310 matching" sends the filter, not 2,310 ids, and completes as a job with a result toast. (Tested with a fake action and job; `admin.jobs.get` is not built yet.)
- [x] A mixed result keeps the failed rows selected and lists their reasons.
- [ ] With 100 rows per page the body is virtualized and arrow-key row navigation still works. **Dropped for now**: not virtualised, see section 2; keyboard use is the native one (Tab through links, checkboxes and buttons). Arrow-key row navigation arrives with DOC-07.15. **Decided: dropped.**
- [x] An exported cell containing `=HYPERLINK(...)` opens as text in a spreadsheet. (Server side: arrives with the export endpoints. `DataTable` already downloads a `download` outcome and reports a job that ends in an export.) (`apps/api/src/platform/csv.js` prefixes a cell that starts like a formula, tested through the exports (`apps/api/test/admin-orders.int.test.js`).)
- [x] Sort headers expose `aria-sort`; the result count change is announced. (`role="status"` line, tested for aria-sort.)

## 9. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-07.14-1 | TanStack Table v9 API | Only `useTable` + `tableFeatures` with explicitly registered features were confirmed (announcement post, read 2 Oct 2026); exact feature names for column visibility, sizing and row selection are taken from the docs at implementation | First `DataTable` build |
| Q-07.14-2 | Is the table library needed at all? | With sorting, filtering and pagination on the server, the library only manages column visibility, sizing and selection. `DataTable`'s own props (§2) hide it, so it can be removed without touching screens. If the wrapper ends up using fewer than three library features, drop the dependency and record it in ADR-0015 | After the first three list screens |
| Q-07.14-3 | Page-number pagination for admin lists vs cursor | Page numbers (staff need "page 7 of 47"); the audit log uses a cursor because it is append-only and large | List queries slower than 300 ms at depth |

## 10. Changelog

| Date | Change |
|---|---|
| 2026-10-06 | M4-10: the order and customer exports are built on the server as `200 { filename, rowCount, csv }` (at most 5,000 rows) with the formula guard and the byte order mark of section 6; the screen downloads the text as a file, so the `download` outcome of `DataTable` fits. Order bulk actions take at most 500 ids; "select all matching" and the `202 { jobId }` path wait for the jobs endpoints (DOC-10.8). |
| 2026-10-02 | Initial version (Phase 3). Resolves DOC-05 Q-05-1 as far as the announcement allows |
| 2026-10-05 | M3-02 built: `DataTable`, URL state (`lib/list-params.js`), filters (select, multi, boolean, date range) with chips, selection, bulk bar, failures dialog, job polling, column visibility in prefs. No TanStack Table, no virtualisation (section 2) |
