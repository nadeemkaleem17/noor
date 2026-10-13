# ADR-0015 — Loaders on the storefront; TanStack Query, Table and Virtual in the admin; Zustand for cart UI state

| Field | Value |
|---|---|
| ID | ADR-0015 |
| Title | Client state and data fetching |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (K3, K5, F-11), ADR-0004, ADR-0005 |
| Decisions used | ADR-0013, ADR-0020 |

## Purpose and scope
Where server data and client state live in each app. Query-key conventions and code samples are DOC-05.

## Context
Both apps share the same defect: contexts that read/write localStorage and fall back to seed data when no API is configured (F-11, `db.js:2-8`), duplicated persistence hooks (K3), no pagination or virtualization (K5). Admin lists render full arrays; bulk actions loop with `await` (K6).

## Options considered
| Option | Pros | Cons |
|---|---|---|
| A. RR loaders/actions (storefront) + TanStack Query v5 + Table + Virtual (admin) | Right tool per app; caching, invalidation, optimistic updates, windowing | Two data patterns, documented once |
| B. TanStack Query everywhere | One pattern | Storefront loses SSR data-flow benefits of loaders |
| C. Redux Toolkit/RTK Query | One store | Heavier, more ceremony |
| D. Keep Context + localStorage | No work | The current defects |

## Decision
**Option A.**
- **Storefront:** server data comes only from route `loader`s and `action`s (SSR, ADR-0004). Client state is limited to: cart UI (drawer open, optimistic line quantity) in a small **Zustand** store, wishlist ids, and form state (React Hook Form + Zod resolver). **The cart itself lives on the server** (cart id in a cookie); totals come from the server, never computed as the source of truth in the browser (ADR-0020).
- **Admin:** SPA. Server state via **TanStack Query v5**; tables via **TanStack Table**; long lists via **TanStack Virtual**; server-side pagination/sort/filter for anything that can exceed 100 rows (products, orders, customers, audit log).
- **No localStorage-backed domain data and no "mock mode" in apps.** Development runs against the real API with seeded MySQL (DOC-14). Browser storage is allowed only for UI preferences (theme, sidebar, table column widths).
- **Bulk actions** call bulk endpoints (`POST /api/v1/admin/products/bulk`), which return per-item results; the UI shows a summary toast plus a failure list (keeps the per-failure visibility that `ProductsList.jsx:51-62` wanted).
- Lazy routes: every admin route is `React.lazy` behind a `Suspense` boundary; route-level code splitting is the default.
- React Compiler is on in every app (admin already, `vite.config.js:7-10`); manual `useMemo/useCallback` only where the compiler cannot reach (DOC-05).

## Examples
```ts
// apps/admin/src/features/products/queries.ts
export const productKeys = {
  all: ["products"] as const,
  list: (f: ProductFilters) => [...productKeys.all, "list", f] as const,
  detail: (id: string) => [...productKeys.all, "detail", id] as const,
};
```

## Consequences
Deletes the dual-mode code paths and ~4 duplicated utilities; admin needs the API to exist before it can run (hence DOC-16 sequencing: backend slice first).

## Rules
**Always:** one query-key factory per feature; invalidate by key prefix after a mutation. **Never:** copy server data into `useState`; compute prices or stock in the client as truth; read `localStorage` in render. **Common mistake:** fetching in `useEffect`.

## Acceptance checklist
- [x] No `apiEnabled` / `API_MODE` branches remain. (Run at M7-07: no match.)
- [ ] Admin product and order lists use server pagination and a virtualized body above 100 rows. **Server pagination yes; no virtualised body (dropped, DOC-07.14). TanStack Table and Virtual and Zustand are not used: the admin has its own `DataTable`, and the cart drawer is a React context.**
- [ ] Every admin route is lazy-loaded; initial admin JS ≤ 200 kB gzip. **Every admin route is lazy; the initial admin JavaScript is 222.6 kB gzip against 200 (M7-09).**

## Revisit trigger
Storefront needs rich client-side caching (e.g., infinite catalog browsing offline) that loaders cannot serve, or Zustand state grows beyond cart UI/wishlist.

## Open questions and assumptions
TanStack Query/Table/Virtual and Zustand were **not researched this phase** (author judgement; versions pinned in DOC-03).

## Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |
| 2026-10-02 | Dev database is MySQL (ADR-0008) |
| 2026-10-02 | Phase 1: versions pinned in DOC-03 §2 (Query 5.104, Table 9, Virtual 3.14, Zustand 5); patterns in DOC-05 |
| 2026-10-02 | Phase 3: admin lists are fully server-driven (DOC-07.14); whether TanStack Table stays is reviewed after the first three list screens (Q-07.14-2) |
