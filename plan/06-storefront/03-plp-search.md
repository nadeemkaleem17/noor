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

- [x] `curl /c/<handle>` returns HTML containing 24 product titles and prices. (`apps/storefront/test/shell.server.test.js`, and by hand against the real API: 24 `<article>`s with titles and prices.)
- [x] A listing response for 3,000 seeded products is ≤ 60 kB compressed per page (ADR-0010). (By hand with the `--perf` seed, 434 new arrivals in 3,000 products: the HTML of `/new` is 130 kB, 14 kB gzipped, 28 kB of it the page data. The development server's HTML, not the production build's.)
- [x] Selecting two sizes and one fabric yields a URL with params in canonical order; reloading shows the same result and chips. (`shell.server.test.js` and `listing-url.test.js`: any order, `utm_*` and repeated parameters are sent to the canonical form with a 301; reloading shows the same checked boxes and chips. Checked in the browser pane with sizes M and L.)
- [x] Back from a PDP after two "Load more" clicks restores 72 items and the scroll position. (By hand in the browser pane with the `--perf` seed: four loads, a product, then Back gave 120 items and the same scroll position. Not an automated test: it needs a real browser and 3,000 products. See changelog, note 4.)
- [x] Filtering works with JavaScript disabled. (The filters are a real `<form method="get">`, with an "Apply filters" button until the page is hydrated; the sort has its own form; the price ranges and the chips are links; "Load more" is a link. Tested as HTML in `shell.server.test.js`, not with a browser that has JavaScript off.)
- [x] Keyboard: every filter control and the load-more link are reachable; the result count change is announced. (Every control is a native input, link or select, in the page order; the count is a `role="status"` region that stays in place while the page changes. Not tried with a screen reader.)
- [x] `/search?q=shalwar` and `/search?q=shalwaar` list the same products. (By hand against the API with the `--perf` seed: both give 267 products in the same order. That is the API's synonyms (ADR-0010); the storefront sends `q` unchanged.)

## 12. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-06.3-1 | `ProductSummary` fields | As listed in §3; final in DOC-10 | DOC-10 catalog |
| Q-06.3-2 | Reference storefronts (Khaadi, Sapphire, Gul Ahmed, Alkaram, Nike, IKEA, Zalando, ASOS) | Their live pages were **not inspected** (search summaries only confirmed stitched/unstitched ranges and COD). Patterns here rest on Baymard's guideline and the v2 doc's teardown | A team member records screenshots of 3 local competitors' PLP and filter drawers; differences reviewed here |
| Q-06.3-3 | Price presets from the API | 4 ranges by quartile | DOC-10 |
| Q-06.3-4 | A page for all products | None yet; the home's "View all" under Bestsellers goes to `/new?sort=bestselling`, which is only the new arrivals | M5-10 |

## 13. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 2) |
| 2026-10-02 | Phase 5 part 2: route keys, parameter names and error codes in this document are provisional where they differ from DOC-10; DOC-10 is authoritative and Phase 7 reconciles the names |
| 2026-10-02 | Phase 7 consistency review: param names and badge values match DOC-10.2 |
| 2026-10-07 | M5-03 built (`app/routes/{category,collection,new,sale,search}.jsx`, `app/lib/listing.server.js`, `listing-url.js`, `features/catalog/{listing,filters,listing-memory}`). Notes: (1) One loader helper, `loadListing`, does what the five pages share: the canonical address (a 301 when the parameters are not in the one form, compared by what they say, so `,` and `%2C` do not bounce), one `catalog.listProducts` call for items, total and facets, a query the API refuses sends the visitor to the listing without it, a missing category or collection is a 404. A category or collection that was renamed answers its redirect. (2) "Load more" is a real link; with JavaScript each page is a `Chunk` with its own fetcher asking the same address with `cursor` and `chunk=1`; `chunk` makes the loader answer with `failed: true` instead of throwing, so a failed page shows an inline error with Retry and the loaded ones stay. Skeleton cards (4) show while it loads. After 240 products the button becomes "Refine your results". (3) Facets: native checkboxes (chips for size and colour), values with count 0 are greyed out, over 8 values "Show all", each group a `<details>`. The desktop sidebar applies each change at once and shows what the address says (even while the next page is loading); on a phone the filters are a bottom `Drawer` that applies with its button, and before JavaScript is there an ordinary `<details>` with the same form. (4) Back: the number of pages loaded and the scroll position are kept in `sessionStorage` per listing address; on Back the pages are fetched again and the scroll position is applied when the last of them is in. Only Back and reload restore; arriving by a link or a new filter starts afresh. The position is saved only after the visitor's own scrolling. The plan said "ids only"; the cursors are cheaper and the products come from the API as they are now. (5) Not built: the custom min/max price inputs (the four ranges from the API are links; a range is two parameters, which one checkbox cannot send), the live "Show N products" count in the phone sheet (its button says "Show results"), the wishlist heart on the card (M5-08), canonical, `rel=prev/next` and the robots rules of filtered pages (M5-10; the search page is already `noindex,follow`). (6) The search page under two letters asks nothing of the API and shows the field and the categories; with no results it shows the tips, the four newest products and the WhatsApp link with the query as its text. (7) Q-06.3-4: the home page's "View all" under Bestsellers goes to `/new?sort=bestselling`, which lists only the new arrivals; there is no page for all products. Decide in M5-10 whether `/search` or a category of everything takes that link. |
