# 06.1 — Storefront: Sitemap, Shell and Navigation

| Field | Value |
|---|---|
| ID | DOC-06.1 |
| Title | URL map, route modules, header, footer, menus, redirects |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-03, DOC-04a/b/c, DOC-05, README (A-04, A-06) |
| Decisions used | ADR-0004, ADR-0005, ADR-0012, ADR-0015, ADR-0018 |

## 1. Purpose and scope

**Governs:** every storefront URL, which route module serves it, its cache class, the shell (announcement bar, header, footer, mobile menu), and redirects from today's URLs.
**Does not govern:** page content (DOC-06.2 … 06.8), meta tags and structured data (DOC-06.9), budgets (DOC-06.10), endpoint definitions (DOC-10; the route-table keys named in DOC-06 are provisional until DOC-10 is written, and Phase 7 reconciles them).

## 2. URL map

Cache classes are those of ADR-0004: **L** = listing/detail (`public, s-maxage=60, stale-while-revalidate=600`), **S** = static content (`public, s-maxage=3600, stale-while-revalidate=86400`), **P** = private (`private, no-store`), **R** = resource (`public, s-maxage=3600`).

| URL | Route module (`app/routes/`) | Page | Cache | Indexable | Spec |
|---|---|---|---|---|---|
| `/` | `home.tsx` | Home | L | yes | 06.2 |
| `/c/:handle` | `category.tsx` | Category listing | L | yes | 06.3 |
| `/collections/:handle` | `collection.tsx` | Collection listing | L | yes | 06.3 |
| `/new` | `new.tsx` | New arrivals (last 30 days) | L | yes | 06.3 |
| `/sale` | `sale.tsx` | Products with a compare-at price | L | yes | 06.3 |
| `/search?q=` | `search.tsx` | Search results | P | no (`noindex, follow`) | 06.3 |
| `/p/:handle` | `product.tsx` | Product detail | L | yes | 06.4 |
| `/cart` | `cart.tsx` | Cart page and all cart actions | P | no | 06.5 |
| `/checkout` | `checkout.tsx` | Checkout | P | no | 06.5 |
| `/orders/:token` | `order.tsx` | Order confirmation and status | P | no | 06.6 |
| `/orders/:token/review/:lineId` | `order-review.tsx` | Review form (only when `features.reviews`) | P | no | 06.6 §6 |
| `/track` | `track.tsx` | Track by order number + phone | P | no | 06.6 |
| `/wishlist` | `wishlist.tsx` | Wishlist | P | no | 06.7 |
| `/pages/:slug` | `page.tsx` | CMS page | S | yes | 06.8 |
| `/size-guide` | `size-guide.tsx` | All size charts | S | yes | 06.8 |
| `/sitemap.xml`, `/sitemap-:n.xml` | `sitemap[.]xml.ts`, `sitemap-$n[.]xml.ts` | Sitemap index and parts | R | — | 06.9 |
| `/robots.txt` | `robots[.]txt.ts` | Robots | R | — | 06.9 |
| `/healthz` | `healthz.ts` | Liveness for the host | no-store | — | DOC-14 |
| `*` | `not-found.tsx` | 404 | `public, s-maxage=60` | no | §6 |

Every URL above also exists under `/ur/…` once Urdu is switched on (ADR-0018). Until `StoreConfig.locale.supported` contains `ur`, any `/ur/…` URL returns 404.

`app/routes.ts`:
```ts
import { type RouteConfig, route, index, layout, prefix } from '@react-router/dev/routes'

const pages = [
  layout('routes/_shell.tsx', [
    index('routes/home.tsx'),
    route('c/:handle', 'routes/category.tsx'),
    route('collections/:handle', 'routes/collection.tsx'),
    route('new', 'routes/new.tsx'),
    route('sale', 'routes/sale.tsx'),
    route('search', 'routes/search.tsx'),
    route('p/:handle', 'routes/product.tsx'),
    route('cart', 'routes/cart.tsx'),
    route('checkout', 'routes/checkout.tsx'),
    route('orders/:token', 'routes/order.tsx'),
    route('orders/:token/review/:lineId', 'routes/order-review.tsx'),
    route('track', 'routes/track.tsx'),
    route('wishlist', 'routes/wishlist.tsx'),
    route('pages/:slug', 'routes/page.tsx'),
    route('size-guide', 'routes/size-guide.tsx'),
    route('*', 'routes/not-found.tsx'),
  ]),
]

export default [
  route('sitemap.xml', 'routes/sitemap[.]xml.ts'),
  route('sitemap-:n.xml', 'routes/sitemap-$n[.]xml.ts'),
  route('robots.txt', 'routes/robots[.]txt.ts'),
  route('healthz', 'routes/healthz.ts'),
  ...pages,
  ...prefix('ur', pages.map(/* same routes with ids suffixed "-ur" */)),
] satisfies RouteConfig
```

## 3. The shell (`routes/_shell.tsx`)

The shell loader runs on every page and must stay cacheable for L and S pages, so it loads **only non-personal data**:

| Data | Provisional route key | Cached in the storefront server |
|---|---|---|
| Store config (brand, logo, theme, contact, features, price display, locale, payment labels) | `store.getConfig` | 30 s in-process |
| Home and shell content (announcement, notices, footer text) | `content.getHome` | 30 s |
| Menus `main` and `footer` | `content.getMenu` ×2 | 30 s |
| Category tree (for the mobile menu and footer) | `catalog.listCategories` | 30 s |

**Cart count and wishlist count are not in the shell loader.** They are fetched after hydration by a client `useFetcher().load('/cart?summary=1')` (P class) and rendered into the header badges, so cached HTML never contains customer data (ADR-0004 common mistake). Until the fetch returns, the badge is hidden, not "0".

```
360 px                                   ≥ 1024 px
┌──────────────────────────────┐        ┌───────────────────────────────────────────────────────┐
│ Free delivery over Rs. 5,000 │ ← bar  │            Free delivery over Rs. 5,000           ✕  │
├──────────────────────────────┤        ├───────────────────────────────────────────────────────┤
│ ☰   RUBAYA     🔍  ♡  🛒² │        │ RUBAYA   New  Women ▾  Unstitched ▾  Sale   🔍 ♡ 🛒²│
├──────────────────────────────┤        ├───────────────────────────────────────────────────────┤
│           <main>             │        │                        <main>                         │
├──────────────────────────────┤        ├───────────────────────────────────────────────────────┤
│ Shop · Help · Contact        │        │ About │ Shop │ Help │ Contact + WhatsApp + socials     │
│ WhatsApp  ·  © Rubaya    │        │ © 2026 Rubaya            Cash on delivery · …      │
└──────────────────────────────┘        └───────────────────────────────────────────────────────┘
```

| Part | Behaviour |
|---|---|
| Skip link | First focusable element, targets `<main id="main">` |
| Announcement bar | `SiteSettings.announcement`; hidden when empty. Plus active `StoreConfig.notices` (within `startsAt`/`endsAt`), rotated every 6 s, paused on focus/hover and under reduced motion. Dismiss stores the notice id in a session cookie `nc_dismissed` |
| Logo | `brand.logo.light`; falls back to the site title as text. Links to `/` |
| Header layout | `ThemeTokens.header.layout`: `left` (logo at inline-start) or `center`; sticky when `header.sticky` |
| Main navigation | Menu `main` from the API (`Menu.items`, two levels). Desktop: top-level links; a link with children opens a panel on click (not hover) listing its children. Mobile: `Drawer side="end"` with an accordion per parent |
| Fallback navigation | If menu `main` is empty: `New` (`/new`), each top-level category (`/c/:handle`), `Sale` (`/sale`) |
| Search | Icon opens a full-width search field under the header; submits to `/search?q=` (works without JS: it is a `<form method="get" action="/search">`). No autocomplete in v1 |
| Wishlist icon | Links to `/wishlist`; shown only when `features.wishlist` |
| Cart icon | Opens the cart drawer (JS) and is a real link to `/cart` (no JS) |
| Footer | Columns: about text (`SiteSettings.footer.about`), menu `footer`, contact (`StoreConfig.contact`: phone, email, address, WhatsApp link, socials), payment methods enabled in `StoreConfig.payments` as text labels. Bottom line: © year + brand name |
| WhatsApp button | Floating button at the block-end/inline-end corner, 56 px, on all pages except `/checkout`; links to `https://wa.me/<digits>` with a per-page prefilled message (DOC-06.6 §5). Sits above the sticky purchase bar when one is present |
| Language switch | Shown only when more than one locale is supported; links to the same path in the other locale |

Menu `href` values are admin-supplied: they render through `LinkButton`/`Link` validation (DOC-04b §4.1); an invalid href hides the item.

## 4. Redirects from current URLs

Permanent (301), handled in `_shell.tsx` middleware before rendering:

| Old URL (current app) | New URL |
|---|---|
| `/shop` | `/new` when no params; see next rows |
| `/shop?category=<name>[&sub=<name>]` | `/c/<handle of that category or subcategory>`; unknown name → `/search?q=<name>` |
| `/shop?tag=new` | `/new` |
| `/shop?tag=sale` | `/sale` |
| `/shop?q=<text>` | `/search?q=<text>` |
| `/product/:id` | `/p/<handle>` looked up by id (`catalog.getProduct` accepts id or handle); unknown → 404 |
| `/track-order` | `/track` |
| `/order-confirmation/:id` | `/track` (old ids are not tokens) |
| `/pages/size-guide` | `/size-guide` |
| Any URL with a trailing slash or upper-case path | Lower-case, no trailing slash |

Product handle changes: when staff change a handle, the API keeps the old one in `handle_redirects` (DOC-09.3 §6.5) and `catalog.getProduct` answers with `{ redirectTo }`; the loader issues a 301.

## 5. Query-parameter rules

| Rule | Detail |
|---|---|
| Listing state | `sort`, `cursor`, `priceMin`, `priceMax`, `size`, `color`, `kind`, `inStock`, `attr.<code>` (DOC-06.3 §4) |
| Order of params | The loader canonicalises: known params only, alphabetical, values sorted. A request with unknown or out-of-order params gets a 301 to the canonical form (keeps the CDN cache key space small) |
| Tracking params | `utm_*`, `fbclid`, `gclid` are ignored by loaders and stripped from the cache key at the CDN (DOC-14); never used to vary content |
| PDP variant | `/p/:handle?size=<label>` preselects a size; never part of the canonical URL |

## 6. Not found and errors

| Case | Response |
|---|---|
| Unknown URL, unknown handle/slug, draft or archived product | 404 with the `not-found.tsx` page: message, search field, links to `/new` and top categories |
| Archived product that had sales | 404 page that also shows up to 4 products from the same primary category |
| API unreachable or 5xx in a loader | 503 with `Retry-After: 30`, `Cache-Control: no-store`, the shell's `ErrorBoundary`: `ErrorState` with a reload button and the WhatsApp contact |
| Error inside one deferred section | That section is omitted (DOC-05 §7) |

## 7. Rules

**Always:** export `headers`, `meta` and `ErrorBoundary` from every route module; build internal links with the typed `href()` helper so a route rename is a compile error; keep the shell loader free of customer data.
**Never:** link to a product by id; put cart or wishlist data in an L or S response; render an admin-supplied href without validation; add a route here without adding its row to §2 and its spec file.
**Common mistakes:** fetching the cart in the shell loader "for the badge" (makes every page uncacheable); a hover-only mega menu (unusable on touch and keyboard).

## 8. Acceptance checklist

- [x] Every row in §2 responds with the stated `Cache-Control` (integration test iterating the table). (`apps/storefront/test/shell.server.test.js`: the built app against a stand-in API; every row but `sitemap.xml` and `robots.txt`, which come with M5-10. The pages themselves are placeholders until their own tasks.)
- [x] `curl -s /` contains no `Set-Cookie` and no cart count. (same test.)
- [x] Each redirect in §4 returns 301 to the stated target. (same test: thirteen cases, and an unknown old product id is a 404.)
- [x] With JavaScript disabled: navigation links, search, the cart link and all L/S pages work. (The links, the search link, the cart link and the footer are in the server HTML. On a phone the menu is a drawer and needs JavaScript; the footer menu and the search page still work.)
- [x] Keyboard: skip link, menu open/close with `Enter`/`Esc`, focus returns to the menu button. (The skip link is the first element. Open and close, Esc and returning focus to the button are the `Drawer` of `@noor/ui` (tested there); focus returning to the Menu button was also seen in the browser pane.)
- [x] `/ur` returns 404 while `ur` is not in `locale.supported`. (Same test, and with Urdu on `/ur` is Urdu, right to left.)

## 9. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-06.1-1 | Search autocomplete | Not in v1 (plain submit) | Search usage above 15% of sessions |
| Q-06.1-2 | `prefix()` helper for the `/ur` copy of the route list | Available in `@react-router/dev/routes` 8.4 as in v7 | First build; fallback is an optional `:locale?` segment |
| Q-06.1-3 | Route keys (`store.getConfig`, `content.getMenu` …) | Provisional | DOC-10 |

## 10. Changelog

| Date | Change |
|---|---|
| 2026-10-07 | M5-01 built (`apps/storefront/app/features/layout/`, `lib/redirects.js`, `lib/nav.js`, `lib/shell.server.js`). Differences from this document: (1) **The shell data is loaded by the root loader**, not by `_shell`: the theme goes in the head of the document, which only the root can write. `_shell.jsx` is only the frame (skip link, announcement, header, `<main id="main">`, footer, WhatsApp button). The 301 rules of section 4 and the 404 for `/ur` also run there, before anything else. (2) **Languages are two copies of the route list**, English and `prefix('ur', ...)`, each route with an id of its own (`home`, `home-ur`); an optional `:locale?` segment read `/no/such/page` as the language "no". `/en` and every other first segment are ordinary unknown addresses and get the shop's 404 page. (3) The browser is sent only what the frame needs, already processed: the navigation (menu addresses checked with `safeHref`, the fallback New, categories, Sale), the notices, the footer text and the settings, never the raw menus or the theme object. (4) **CSP:** the theme `<style>` is allowed by its SHA-256 hash (computed in `entry.server.jsx` from what the root loader returned), and `style-src` has no nonce at all; scripts still carry a per-request nonce, which a CDN would have to replace by hashes (DOC-11 section 5.3, revisit at M7). (5) `ThemeTokens` has no `header.layout` or `header.sticky`, so the header is always sticky with the logo at the start. (6) The menu: every item is a real link; one with children also has a button that opens a panel on click; on a phone the drawer holds them in groups. The search icon is a link to `/search` that, with JavaScript, opens the search field under the header. (7) The announcement and notices change every six seconds unless the visitor rests on one or prefers less motion; closing one stores its id in the session cookie `nc_dismissed`, which only the browser reads (the page is the same for everyone and cached). (8) `/product/:id` finds the handle with one plain request that reads only `handle`, not the whole product. (9) Not built yet: the cart and wishlist counts (M5-05, M5-08), the sitemap and robots (M5-10), the "archived product that sold" 404 with other products (M5-04), the canonical-query redirect on listings (the helper `canonicalQuery` exists and is tested; M5-03 uses it). The pages other than home are placeholders that answer with the right cache class. |
| 2026-10-02 | Initial version (Phase 2) |
| 2026-10-02 | Phase 5 part 2: route keys, parameter names and error codes in this document are provisional where they differ from DOC-10; DOC-10 is authoritative and Phase 7 reconciles the names |
| 2026-10-02 | Phase 7 consistency review: route key `content.getHome`, camelCase listing params, table name `handle_redirects` (now match DOC-10 and DOC-09) |
