# ADR-0004 — Storefront on React Router v8 framework mode, SSR with CDN caching

| Field | Value |
|---|---|
| ID | ADR-0004 |
| Title | Storefront rendering |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (K7), README A-03, ADR-0003, ADR-0005 |
| Decisions used | ADR-0015, ADR-0018, ADR-0019 |

## Purpose and scope
How storefront pages are rendered and cached. Not the page designs (DOC-06) or SEO details (DOC-06 SEO).

## Context
The current storefront is client-rendered (`index.html:7` title `ecommerce-website`, no meta; catalog fetched in `CatalogContext.jsx:28-50`). Fashion e-commerce lives on search and social links, so crawlers and link previews must see real HTML. Customers are mostly on mid-range Android and mobile data, so JavaScript and payload size matter. The team already uses Vite 8, React 19.2.8 and React Router (6.28), which meet v8's floors (Node ≥ 22.22, React ≥ 19.2.7, Vite ≥ 7).

## Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Next.js (App Router, RSC) | Largest ecosystem; ISR/on-demand revalidation built in | New mental model (server/client components) for a team on RR; heavier framework surface; bigger lock-in to its caching semantics |
| B. React Router v8 framework mode | Same router the team knows; loaders/actions; SSR + pre-render; Vite-based; v2 doc already chose it | v8 is young (8.0.0 on 17 Jun 2026); no built-in ISR |
| C. SPA + prerender | Smallest change | Product/listing pages change daily; prerender staleness; still CSR for most routes |
| D. Astro + React islands | Best baseline performance | Cart/checkout/account are heavily interactive; two component models |

## Decision
**Option B.** `apps/storefront` is a React Router v8 framework-mode app deployed as a Node server (ADR-0019), behind a CDN.

| Route class | Rendering | Cache-Control (origin) |
|---|---|---|
| Home, category/PLP, collection, PDP | SSR, streamed | `public, s-maxage=60, stale-while-revalidate=600`; purge by tag on publish (DOC-08) |
| CMS pages, policies, size guide | Pre-rendered at build + SSR fallback | `public, s-maxage=3600, stale-while-revalidate=86400` |
| Cart, checkout, order confirmation, track order, account | SSR shell, client interactivity | `private, no-store` |
| `sitemap.xml`, `robots.txt`, product feeds | Resource routes | `public, s-maxage=3600` |

- **Data path:** loaders run on the storefront server and call the API over the internal network (BFF). No credentials ship to the browser; the admin key concern (K8) cannot recur here.
- Loaders parse every API response with `packages/contract` schemas (ADR-0005).
- Store theme tokens from the API are injected as an inline `<style>` in the root loader so there is no flash of default theme (DOC-04).
- Budgets: JS per route ≤ 170 kB gzip on PLP/PDP, LCP ≤ 2.5 s on throttled 4G mid-range Android (DOC-13).

## Examples
`apps/storefront/app/routes.ts`:
```ts
import { type RouteConfig, route, index, layout } from "@react-router/dev/routes";
export default [
  layout("routes/_shell.tsx", [
    index("routes/home.tsx"),
    route("c/:handle", "routes/category.tsx"),
    route("p/:handle", "routes/product.tsx"),
    route("cart", "routes/cart.tsx"),
    route("checkout", "routes/checkout.tsx"),
    route("track", "routes/track.tsx"),
    route("pages/:slug", "routes/page.tsx"),
  ]),
] satisfies RouteConfig;
```
Product URLs use `handle`, not the id (today `/product/:id`, `App.jsx:20`).

## Consequences
SEO and link previews work; first paint no longer waits for JS. We operate a Node server for the storefront and own cache invalidation. Existing React Router 6 declarative code is rewritten into route modules.

## Rules
**Always:** return `Cache-Control` explicitly from every loader/route; use `handle` URLs; validate loader data. **Never:** read `localStorage` during render; put customer data in a cacheable response. **Common mistake:** caching a page that embeds the cart count.

## Acceptance checklist
- [ ] `curl -s <pdp-url> | grep '<title>'` shows the product title (no JS needed).
- [ ] JSON-LD `Product` present in server HTML.
- [ ] No route in the `no-store` class is cacheable by the CDN.

## Revisit trigger
Reconsider Next.js if **any**: two or more production regressions traced to React Router upgrades in 90 days; a hard need for on-demand per-page revalidation that tag purging cannot meet; React Server Components become necessary for the JS budget.

## Open questions and assumptions
v2's Google "dynamic rendering is a workaround" quote and the Baymard "load more" evidence were not re-verified. React Router's experimental RSC support (noted in 7.x changelogs) is not relied upon.

## Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed; keeps v2's decision, adds cache classes and data path |
