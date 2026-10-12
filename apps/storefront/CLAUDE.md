# apps/storefront: the customer website "Rubaya" (read this instead of scanning `app/`)

React Router 8 **framework mode, server-rendered** (Vite + `@react-router/serve`), JavaScript + JSDoc, Tailwind v4, `@noor/ui` components (Base UI), `@noor/i18n` (English + Urdu `/ur`).
Dev: `pnpm --filter @noor/storefront dev` -> http://localhost:5174 (needs the API on :3000). Plan: `plan/06-storefront/01..10`. The browser talks to **this server only**; this server talks
to the API (`app/lib/api.server.js`, the typed contract client with an 8 s timeout). `~/` = `app/`.

Every page works without JavaScript (forms are real forms, links are real links); JavaScript only enhances. Pages a cache may keep (`listing`/`content` classes) hold **nothing of a
visitor**: cart count, wishlist hearts, recently viewed are filled in after hydration.

## Routes (`app/routes.js`; every page route exists twice: plain and `/ur/...` with distinct ids)

| URL | Module | Notes |
|---|---|---|
| `/` | `routes/home.jsx` | hero, trust strip, category tiles, new arrivals, promo, bestsellers (streamed `Await`), editorial, collections |
| `/c/:handle`, `/collections/:handle`, `/new`, `/sale`, `/search` | `category/collection/new/sale/search.jsx` | all use `lib/listing.server.js` `loadListing` + `features/catalog/listing.jsx`; search is `private, no-store`, `noindex` |
| `/p/:handle` | `product.jsx` | `features/product/*`; action `intent=notify` (back in stock) |
| `/cart` | `cart.jsx` | loader (`?summary=1` = count for the header), action intents `add setQty remove applyPromo removePromo` |
| `/checkout` | `checkout.jsx` | loader + action `intent=quote | place`; `features/checkout/*` |
| `/orders/:token`, `/orders/:token/review/:lineId`, `.../photo` | `order.jsx order-review.jsx review-photo.js` | token = credential (case-sensitive!) |
| `/track` | `track.jsx` | lookup by order number + phone |
| `/wishlist` | `wishlist.jsx` | cookie `nc_wishlist` read in `lib/wishlist.js` |
| `/pages/:slug`, `/size-guide` | `page.jsx size-guide.jsx` | CMS Markdown via `@noor/ui/markdown`; contact page draws settings |
| `/reviews/:id`, `/recent` | resource routes (JSON) | more reviews; recently viewed by ids |
| `/robots.txt`, `/sitemap.xml`, `/sitemap/:n.xml`, `/healthz` | resource routes | SEO (M5-10) |
| `*` | `not-found.jsx` | the shop's own 404 |

## Layout of `app/`

```
root.jsx                 root loader = shell data (locale, dir, themeCss, config, notices, nav, categories, siteUrl); Layout; ErrorBoundary; language is the route prefix, never a param
entry.server.jsx         security headers (CSP only in production build: nonce for scripts, SHA-256 for the one inline theme <style>), bots get the whole page (onAllReady)
lib/                     server + shared pure code (no features/ imports allowed by lint):
  api.server.js          the API client; handleOf(old product id) for redirects
  shell.server.js        loadShell(locale) cached 30 s per process (`cached`); throws a 503 Response if the API is down
  listing.server.js      loadListing (canonical-query 301, one listProducts call, refused query -> bare path, 404s) + orNotFound
  cart.server.js         cart cookie `nc_cart` (HttpOnly, forwarded as X-Cart-Token), addToCart/cartAction/getCart/cartCount, customizationOf (form -> customization)
  checkout.server.js     deliveryCities, quote, placeOrder (checks CreateOrderBody from the contract BEFORE the API), error mapping
  orders.server.js       loadOrder, orderAction, trackOrder, review (ReviewInput) + photo proxy upload
  seo.server.js          isProductionHost (rubaya.pk only is indexable), robotsTxt, sitemap files
  redirects.js           old-shop URL redirects, clean URL (lower case, no trailing slash, but /orders/ keeps case), canonicalQuery (the one canonical param order)
  paths.js               localePath, pagePath(url) (**use this, never url.pathname, in redirects: the router's data requests end in `.data`**)
  selection.js           PURE: variantFor / valueSoldOut / stockLine / buttonState / maxQuantity (used by PDP and by the no-JS add action)
  wishlist.js, browser-cookie.js, listing-url.js, order-number.js, page-title.js, locale.js, cache.js (cache class strings), env.server.js (Zod env: API_INTERNAL_URL, PUBLIC_SITE_URL, PUBLIC_IMG_URL)
features/                UI by area: layout (shell, header, footer, announcement, checkout-header, use-shell, as-router-link), catalog (product-card, listing, filters, shop-price,
                         listing-memory), product, cart, checkout, order, wishlist, content, home, seo
test/                    unit tests + `shell.server.test.js` (builds the app and runs it against a STAND-IN API server defined in that file: add a stub there for any new API call)
```

## Rules that bite

- **Cache classes** (`lib/cache.js`): `listing` (public, s-maxage 60), `content` (3600), `private` (`no-store`), `resource`. Every route exports `headers`. Cacheable responses never set a cookie.
- **Redirects inside loaders**: `redirect(pagePath(url) + ...)`; the URL parser and RR data requests: compare query by meaning (`new URLSearchParams(a).toString()`), not by string.
- **Money is shown as received** (`ShopPrice` = `Price` with the shop's `priceDisplay`); no arithmetic on money in `features/`. Percent-off only in `product-card.jsx percentOff`.
- **Hydration-safe client state**: `useSyncExternalStore` with a server snapshot of "nothing" (`useHydrated`, `useWishlist`, cookies). No setState-in-effect, no `document.cookie` in components (use `lib/browser-cookie.js`).
- **Bash heredocs mangle backslashes/quotes in this environment**: write scripts/files with the Write/Edit tools, not `cat <<EOF` (regexes lose `\`).
- Forms: validate with the contract schema in the server before calling the API (checkout, review), show each issue beside its field, keep typed values on every error.
- Never put a token, phone, name or address in a URL query, a log, or a WhatsApp text (only the order number goes in).
- i18n keys: `packages/i18n/locales/{en,ur}/storefront.json` (namespaces `storefront`, `common`, `notifications`); add both languages. Logical CSS only (RTL): `node scripts/check-logical.mjs`.
- Dev server HMR does not restart the API; the API (`apps/api`) must be restarted by hand after backend changes.

## Commands

```
pnpm --filter @noor/storefront dev            # :5174, needs API :3000 + MySQL :3307
pnpm --filter @noor/storefront typecheck | lint | test   # test builds the app and starts it (slow, ~1-2 min; one test waits 31 s for the shell cache)
pnpm --filter @noor/storefront build && pnpm --filter @noor/storefront start   # production server (CSP only here)
```
