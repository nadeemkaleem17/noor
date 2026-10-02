# 06.3 — Storefront: Listings, Filters and Search

| Field | Value |
|---|---|
| ID | DOC-06.3 |
| Title | Category, collection, new, sale and search listings; product card; filters; sort; pagination |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-06.1, DOC-04b, DOC-04c §7 |
| Decisions used | ADR-0004, ADR-0010, ADR-0013, ADR-0014, ADR-0018 |

## 1. Purpose and scope

**Governs:** the five listing pages (`/c/:handle`, `/collections/:handle`, `/new`, `/sale`, `/search`), the `ProductCard`, filter and sort behaviour, and load-more pagination.
**Does not govern:** how search matches text (ADR-0010, DOC-10 catalog), the index rules for filtered URLs (DOC-06.9 §5).

Replaces the current `Shop.jsx`, which downloads the whole catalog and filters in the browser (F-12).

## 2. Page anatomy

```
360 px                                   ≥ 1024 px
┌──────────────────────────────┐        ┌────────────┬──────────────────────────────────────────┐
│ Home › Women › Lawn          │        │ Home › Women › Lawn                                   │
│ Lawn                (h1)     │        │ Lawn (h1)   intro text (category.description)         │
│ 310 products                 │        ├────────────┬──────────────────────────────────────────┤
│ [Filters (2)]  [Sort: Newest▾]│        │ Size       │ 310 products          Sort: Newest ▾     │
│ ✕ Cotton  ✕ Under 5,000      │        │ ☐ S (40)   │ ✕ Cotton  ✕ Under 5,000   Clear all      │
│ ┌──────┐┌──────┐             │        │ ☐ M (52)   │ ┌────┐┌────┐┌────┐┌────┐                 │
│ │ card ││ card │             │        │ Colour     │ │card││card││card││card│                 │
│ └──────┘└──────┘             │        │ ● ● ● ●    │ └────┘└────┘└────┘└────┘                 │
│ …                            │        │ Fabric     │ …                                        │
│ Showing 24 of 310            │        │ Price      │ Showing 24 of 310                        │
│ [Load more]                  │        │ ☐ In stock │ [Load more]                              │
└──────────────────────────────┘        └────────────┴──────────────────────────────────────────┘
```

| Element | Rule |
|---|---|
| Breadcrumb | Home › ancestors › current. `/new`, `/sale`, `/search`: Home › page name |
| `<h1>` | Category/collection title; "New arrivals"; "Sale"; search: `Results for "<q>"` (the query is rendered as text, escaped) |
| Intro | Category/collection description (plain text, ≤ 300 characters shown, "Read more" expands) |
| Subcategory chips | Direct child categories as links under the title; none on leaf categories |
| Result count | From the API `total`; announced in an `aria-live="polite"` region when it changes |
| Grid | 2 / 3 / 4 columns (DOC-04c §2.1); page size **24** |

## 3. `ProductCard` (`features/catalog/components/ProductCard.tsx`)

Rendered from `ProductSummary` (the listing shape; exact fields in DOC-10): `id`, `handle`, `title`, `brand?`, `primaryImage`, `secondaryImage?`, `priceFrom`, `priceTo?`, `compareAtFrom?`, `badges[]`, `stockStatus`, `colorways[]` (handle + swatch), `kind`.

```
┌────────────────┐
│ [NEW]       ♡  │  badge top-start, wishlist top-end
│                │
│   image 3:4    │  ratio from --media-ratio
│                │
│ ● ● ● +2       │  colourway swatches (max 4, then +N)
├────────────────┤
│ Embroidered    │  title, 2 lines max
│ Lawn 3-Piece   │
│ Rs. 6,990      │  Price; "From Rs. 6,990" when variants differ
│ ~~Rs. 8,490~~  │
└────────────────┘
```

| Rule | Detail |
|---|---|
| Link | The whole card is one `<a href="/p/:handle">`; the wishlist button and swatches are separate controls layered above it (not nested inside the link) |
| Image | `Image` with `sizes="(min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw"`; first 4 cards `priority`, the rest lazy. On pointer devices, hover swaps to `secondaryImage` if present |
| Badges | At most one, by priority: `sold_out` > `sale` (shows `-NN%` computed from `compareAtFrom`) > `made_to_order` > `limited` > `new` > `bestseller` |
| Sold out | Image at 60% opacity + badge; the card still links to the PDP |
| Price | `From` prefix when `priceTo` exists and differs; unstitched and bundle products show the set price |
| Swatches | Each is a link to that colourway's PDP with `aria-label` = colour label; not shown when there is one colourway |
| Wishlist | Toggle button with `aria-pressed`; optimistic (DOC-05 §9); hidden when `features.wishlist` is false |
| No quick-add | v1 has no add-to-cart on the card: most products need a size choice. Revisit: accessories-only listings |

## 4. Filters

Facets come from the API response (`facets[]`), computed for the **current** filter set (ADR-0010). The page never invents a facet.

| Facet | Param | Control | Shown when |
|---|---|---|---|
| Size | `size=S,M` | Chips, in size-system order | The listing's products share a size option |
| Colour family | `color=red,blue` | Swatch chips with labels | ≥ 2 families |
| Category attributes (fabric, technique, pieces, occasion … from `category.filterSchema`) | `attr.<code>=a,b` | Checkbox list; over 8 values → first 8 + "Show all" | Attribute is `filterable` and has ≥ 2 values in the result |
| Price | `priceMin`, `priceMax` (paisa) | Four preset ranges computed by the API from the price distribution + "custom" min/max rupee inputs | always |
| Availability | `inStock=1` | One checkbox "In stock only" | always |
| Product type | `kind=stitched,unstitched` | Checkbox list | `/new`, `/sale`, `/search`, collections (mixed kinds) |

| Behaviour | Rule |
|---|---|
| Semantics | Values within one facet are OR; facets combine with AND |
| Counts | Every value shows its count for the current selection; a value with count 0 is shown disabled (not removed) so the list does not jump |
| Mobile | `Drawer side="bottom"` (90% height) with facet accordions; footer has "Clear all" and "Show N products". Selections update N live but the grid updates only on "Show" |
| Desktop | Sidebar; each change navigates immediately |
| Navigation | A filter change is a client navigation to the new canonical URL with `replace: false` (back button undoes one filter) and `preventScrollReset`; the grid shows the pending style (DOC-05 §8); focus stays on the control |
| Applied filters | Removable chips above the grid + "Clear all" |
| No JS | The filter form is a real `<form method="get">` with a submit button, so filtering works without JavaScript |
| Persistence | None beyond the URL |

## 5. Sort

`sort` param, `NativeSelect`: `featured` (default on category/collection; staff-defined order then newest), `newest` (default on `/new`), `price_asc`, `price_desc`, `bestselling`, `relevance` (default and only meaningful on `/search`). Changing sort resets `cursor`.

## 6. Pagination: load more

Baymard's testing recommends a "Load more" button over both numbered pages and infinite scroll, with fewer items per load on mobile; this page follows it (source in DOC-02 §4).

| Rule | Detail |
|---|---|
| Mechanism | Cursor pagination (`cursor`, `limit=24`). The button is a real link `<a href="?…&cursor=<next>">` enhanced with `useFetcher`: with JS it appends the next page; without JS it navigates to a page that shows that page's 24 items |
| Label | "Showing 48 of 310" + `[Load more]`; hidden when `nextCursor` is null |
| Back from a PDP | Scroll position and the loaded pages are restored: loaded pages are kept in `sessionStorage` keyed by the listing URL (ids only, max 240), re-fetched on return, then the framework's scroll restoration applies |
| Cap | After 10 loads (240 items) the button becomes "Refine your results" pointing at the filters |
| Crawlers | See the paginated URL through the plain link; canonical rules in DOC-06.9 §5 |

## 7. Search page specifics

| Rule | Detail |
|---|---|
| Query | `q` trimmed, 2–80 characters. Under 2 → the page shows the search field and popular categories, no API call |
| Synonyms and Roman Urdu | Handled by the API (ADR-0010); the storefront sends `q` unchanged |
| Zero results | `EmptyState`: "No results for "<q>"", tips (check spelling, try a general word), the 4 newest products, and the WhatsApp link ("Ask us on WhatsApp") |
| Logging | The API records the query and result count for the zero-result report (DOC-07 dashboard); the storefront sends nothing extra |
| Cache | `private, no-store` (unbounded key space) |

## 8. Loader

```ts
// app/routes/category.tsx
export async function loader({ params, request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const query = ListingQuery.parse(Object.fromEntries(url.searchParams))   // unknown params rejected → canonical redirect (06.1 §5)
  const category = await getCategory(params.handle, request)               // 404 when missing
  const page = await listProducts({ ...query, category: category.id, limit: 24 }, request)
  return data({ category, page, query }, { headers: cache.listing })
}
```

`page` = `{ items: ProductSummary[], total, nextCursor, facets }`. One API call returns items and facets together.

## 9. States

| State | Display |
|---|---|
| Client navigation pending | Grid at 60% opacity, `aria-busy` |
| Loading more | Button `loading`; 4 skeleton cards appended |
| Empty category (no products at all) | `EmptyState` "New pieces are on their way" + link to `/new` |
| Empty after filtering | `EmptyState` "No products match these filters" + "Clear all" |
| Load-more failure | Inline `ErrorState` under the grid with Retry; already loaded items stay |

## 10. Rules

**Always:** take facets, counts and totals from the API; keep all listing state in the URL; render the first page of products in server HTML.
**Never:** filter, sort or search a product array in the browser; request more than 24 products per call; use infinite scroll; nest interactive elements inside the card link.
**Common mistakes:** facet counts that ignore the active filters; resetting scroll to the top after a filter change; a "0 results" flash while the next page loads.

## 11. Acceptance checklist

- [ ] `curl /c/<handle>` returns HTML containing 24 product titles and prices.
- [ ] A listing response for 3,000 seeded products is ≤ 60 kB compressed per page (ADR-0010).
- [ ] Selecting two sizes and one fabric yields a URL with params in canonical order; reloading shows the same result and chips.
- [ ] Back from a PDP after two "Load more" clicks restores 72 items and the scroll position.
- [ ] Filtering works with JavaScript disabled.
- [ ] Keyboard: every filter control and the load-more link are reachable; the result count change is announced.
- [ ] `/search?q=shalwar` and `/search?q=shalwaar` list the same products.

## 12. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-06.3-1 | `ProductSummary` fields | As listed in §3; final in DOC-10 | DOC-10 catalog |
| Q-06.3-2 | Reference storefronts (Khaadi, Sapphire, Gul Ahmed, Alkaram, Nike, IKEA, Zalando, ASOS) | Their live pages were **not inspected** (search summaries only confirmed stitched/unstitched ranges and COD). Patterns here rest on Baymard's guideline and the v2 doc's teardown | A team member records screenshots of 3 local competitors' PLP and filter drawers; differences reviewed here |
| Q-06.3-3 | Price presets from the API | 4 ranges by quartile | DOC-10 |

## 13. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 2) |
| 2026-10-02 | Phase 5 part 2: route keys, parameter names and error codes in this document are provisional where they differ from DOC-10; DOC-10 is authoritative and Phase 7 reconciles the names |
| 2026-10-02 | Phase 7 consistency review: param names and badge values match DOC-10.2 |
