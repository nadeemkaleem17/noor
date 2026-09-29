# noor

Two independent React 19 + Vite 8 apps (JSX, no TypeScript) for a Pakistani fashion
store (PKR). Each has its own `package.json` and git repo — run commands inside the
project folder. No backend: both persist to browser `localStorage`.

## admin-panel/ — store admin dashboard
Manages products (options/variants, media, components), categories, collections,
attributes, size charts, orders (with invoices), promos, reviews, CMS pages,
menus, templates, shipping, settings and appearance, plus a "Data Publishing" page.
Uses React Router, Radix UI, zod and the React Compiler.

```
npm install
npm run dev      # Vite dev server
npm run build    # production build
npm run lint     # eslint
npm test         # vitest run (tests in src/lib/__tests__)
```

```
admin-panel/src/
  App.jsx, main.jsx    routes (/products, /orders, /promos, /settings, ...)
  components/          AdminLayout, Toast, TabBar, Field, ui primitives
  pages/               one folder per area: products, catalog, orders, promos,
                       content, store, data (+ Dashboard, Reviews, NotFound)
  contract/            schemas.js (zod, shared with storefront) + fixtures.js (seed data)
  lib/                 db.js (localStorage "admin API", keys prefixed `admin:`),
                       validate, orders, invoice, variants, csv, format, ...
```
Note: `db.js` is the one adapter to swap for real HTTP later; components must not
touch `localStorage` directly.

## ecommerce-website/ — customer storefront
Home, Shop, Product, Cart, Checkout, Order confirmation, Track order, Wishlist and CMS
pages. State lives in React contexts backed by localStorage; React Router only.

```
npm install
npm run dev
npm run build
npm run lint     # (no tests configured)
```

```
ecommerce-website/src/
  App.jsx, main.jsx    routes
  components/          StorefrontLayout, CartDrawer, ProductCard, ui
  context/             Cart, Catalog, Orders, Promo, Wishlist (+ AppProviders)
  pages/storefront/    Home, Shop, Product, Cart, Checkout, OrderConfirmation,
                       TrackOrder, Wishlist, CmsPage, ComingSoon
  data/mockData.js     seed catalog
  hooks/               usePersistentState, useStoreConfig
  utils/               format.js, images.js
```
Note: `CHANGELOG_THIS_PASS.md` mentions a seller dashboard/login (`SellerContext`,
`/seller/*`), but those files are not in the current `src/` — treat it as stale.

The apps don't talk to each other yet; admin `contract/` defines the future shared API shape.
