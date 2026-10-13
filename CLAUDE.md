# noor

Online fashion store for Pakistan (PKR). Customers see the name **Rubaya** (domain `rubaya.pk`);
"noor" is only the internal project, repo and package name (`@noor/*`).

Everything is built and run **locally** first. Production is a separate, later phase.

## How to work here

1. **Read [plan/AGENTS.md](plan/AGENTS.md) first**, then only the doc your task cites. The plan in `plan/` is the
   source of truth (81 files; do not read it whole). [plan/README.md](plan/README.md) is the index.
2. **Take the next task from [plan/16-roadmap.md](plan/16-roadmap.md) §5**, in order. Each task names the doc
   sections that specify it and what "done" means. Tick it in §8 when finished.
3. **Before writing code, answer in one or two lines each** (skip only for typo-level edits):
   - Which task id and doc section is this?
   - Does it already exist here? Extend it with a prop instead of writing a sibling.
   - Does the platform, the standard library or an installed dependency already do it?
   - What is the smallest change that satisfies the doc, and what am I deliberately not building?
   - Will two places use it? Then it goes in `packages/` or a shared folder and takes props.
4. **Ponytail mode is on**: simplest solution that works, no speculative abstractions, no new dependency
   without a stated reason. Never simplify away validation, error handling, security or accessibility.
5. If the plan is wrong or silent, fix the doc in the same change. If code and plan disagree, the plan wins.
6. Report honestly: what was verified, what was not, and any failing check with its output.

## Map of the system (read this first; the details are in the nested CLAUDE.md of each part)

Three apps and four packages in one pnpm + Turborepo monorepo. Everything is JavaScript with JSDoc types (no `.ts`), money is integer paisa, one Zod contract is shared by all.

```
                 browser (customers)                         browser (staff)
                       |                                          |
        apps/storefront  (React Router 8, SSR, :5174)     apps/admin (React SPA, :5173)
        server-side only talks to the API ->               talks to the API with a session cookie + CSRF header
                       \                                          /
                        apps/api  (Fastify 5 modular monolith, :3000, /api/v1)  <-- packages/contract (the route table + Zod schemas)
                                  |                         \--> background process: outbox relay, scheduler, job worker (same code, `src/worker.js`)
                          MySQL 8.4 (:3307, Drizzle)        local file storage `apps/api/.data/storage` (served at /img)
```

| Part | Read | One-paragraph summary |
|---|---|---|
| **Backend** `apps/api` | [apps/api/CLAUDE.md](apps/api/CLAUDE.md) | Every endpoint is a key of `packages/contract` `routes`; handlers live in `src/modules/<area>` (service + repository + routes), listed once in `modules/index.js` and wired in `modules/services.js`. Business invariants have ONE writer each (order status, payment status, stock, product price cache, promo discount, cart price). M0, M1, M4 done: auth/staff, audit, settings+content, shipping, catalog+inventory+search, media, customers, promotions, cart, orders, payments, notifications, reviews, reporting. |
| **Admin panel** `apps/admin` | [apps/admin/CLAUDE.md](apps/admin/CLAUDE.md) | Staff SPA. `lib/screens.js` is the registry of every URL with its permission; features per area (`features/products`, `catalog`, `content`, `settings`, `staff`, `audit`, `auth`). M3 done (catalog, content, settings, staff, audit). **M6 started**: Orders, Customers, Promos, Reviews and the Dashboard done (M6-01 to M6-05): every screen is built. |
| **Website (storefront)** `apps/storefront` | [apps/storefront/CLAUDE.md](apps/storefront/CLAUDE.md) | Customer site "Rubaya", SSR, works without JS. M5 done: shell, home, listings (category/collection/new/sale/search), product page, cart (+drawer), checkout (guest, COD), order page + track + review, wishlist, CMS pages, size guide, SEO (meta, JSON-LD, sitemap, robots), performance tooling. M7 hardening remains (CSP script hashes, visitor IP to the API, bundle reductions). |
| **Shared** `packages/*` | [packages/CLAUDE.md](packages/CLAUDE.md) | `contract` (API truth), `ui` (components + tokens + Storybook), `i18n` (en/ur catalogs, money/date formatting), `config`. |

Data flow of one purchase, so you do not have to trace it again: PDP form -> storefront `/cart` action -> `cart.addLine` (cart token cookie `nc_cart` -> `X-Cart-Token`) -> `/checkout` action
`quote` (`cart.quote`) and `place` (contract-checked `CreateOrderBody`, `Idempotency-Key` bound to the cart) -> `orders.create` in ONE transaction (price via `cart.price`, stock `reserve`, promo `redeem`,
customer upsert, outbox event) -> redirect `/orders/<token>?placed=1` (token derived from order id + `TRACKING_KEY`) -> job `notify.order` (writes `notification_log`) -> staff change status via `orders.changes`.

**Environment quirks of this machine** (they cost time every session):
- noor's MySQL (:3307) and the API/dev servers die when the session that started them ends. Start MySQL: `"C:/Program Files/MySQL/MySQL Server 8.4/bin/mysqld.exe" --defaults-file=.data/mysql-noor.ini`
  (background, then wait for :3307). Start servers with `preview_start` (names `api`, `storefront`, `admin` in `.claude/launch.json`); integration tests that look "skipped" mean MySQL is down.
- The API does NOT reload on change: restart it after backend edits. The storefront and admin dev servers do hot-reload.
- Shell here mangles backslashes/quotes in `cat <<EOF` and `node -e` scripts: create files and patch scripts with the Write/Edit tools. Run long checks in the background and read the output file.
- Full check (serial, ~10 min): `pnpm exec turbo run typecheck lint test --concurrency=1 --filter=@noor/api --filter=@noor/admin --filter=@noor/ui --filter=@noor/i18n --filter=@noor/config --filter=@noor/contract --filter=@noor/storefront`, then `node scripts/check-logical.mjs`.
- The dev database holds test data from manual runs (about 5 orders, 2 reviews, 3,000 `perf-*` products, a size chart attached to nothing). Admin login: `owner@rubaya.test`.

## Current state (update when it changes)

| | |
|---|---|
| Roadmap position | Milestone **M0 Foundation**: all of M0 done (M0-08 skipped) (CI never run: needs a GitHub push). M0-03, M0-06, M0-07 need native MySQL 8.4 (no Docker). M1-01 (platform), M1-02 (auth) and M1-03 (audit), M1-04 (security plumbing) and M1-05 (media, local storage) and M1-06 (settings, pages, menus) and M1-07 (shipping) and M1-08 (catalog structure) and M1-09 (products, collections) and M1-10 (inventory) and M1-11 (search) and M1-12 (public catalog) and M1-13 (seed) done: **M1 is complete**. M3-01 (admin shell: sign-in, shell, permissions) done. M3-02 (DataTable, products list) done. M3-03 (products list and editor) done. M3-04 (catalog screens) done. M3-05 (content screens) done. M3-06 (settings screens) and M3-07 (account, staff, audit log) done: **M3 is complete**. M4-01 (customers: `apps/api/src/modules/customers`, `createCustomersService({ db, orders })`; `upsertByPhone` and `applyOrderChange` are for the order transaction) done. M4-02 (promotions: `apps/api/src/modules/promotions`; `evaluatePromo` is the one place promo discounts are computed; `redeem`/`reverse` are for the order transaction) done. Local sign-in: `TWO_FACTOR_REQUIRED=0` in `apps/api/.env`. M4-03 (cart: `apps/api/src/modules/cart`; `priceCart` in `pricing.js` is the one pricing function, `cart.price(x, cartRow, { cityId, methodId, phone })` is what orders call inside their transaction; the cart token travels in `X-Cart-Token`) done. M4-04 (orders create: `apps/api/src/modules/orders`, `POST /orders` with `Idempotency-Key` and `X-Cart-Token`; **never use the shared pool inside a transaction**, read through `tx`: `settings.value(key, tx)`) done. M4-05 (order changes: `modules/orders/changes.js` is the only writer of `orders.status`; `edit.js`, `rules.js`) done. M4-06 (payments: `modules/payments/`; `status.js` is the one `payment_status` formula, `recompute` the only writer of the order's paid and refunded amounts; providers in `providers.js` (`cod`, `manual`, `bank_transfer`, test-only `fake`), webhook `POST /api/v1/webhooks/:provider` outside the contract table; `orders.recordPayment` needs an `Idempotency-Key`; job `orders.expire_unpaid` every 5 minutes) done. M4-07 (public order endpoints: `modules/orders/public.js`; a link is valid only if it equals the token derived under the current `TRACKING_KEY`; `changes.codBlocked` decides cash on delivery for staff and customers) done. M4-08 (notifications: `modules/notifications/`; job `notify.order` writes each message to `notification_log` once, `skipped` while no provider exists, email through `MAIL_URL` when set; texts in `@noor/i18n` `notifications.json`) done. M4-09 (reviews: `modules/reviews/`; a review waits as `pending`, only approved ones count; `catalog/products.js` `recomputeRating` writes the rating columns) done. M4-10 (admin commerce endpoints: `modules/orders/admin.js`; staff-typed orders go through a cart of their own and the same order transaction; exports answer with the CSV text, at most 5,000 rows, audited) done. M4-11 (reporting: `modules/reporting/`; every figure in SQL over Pakistan days; `GROUP BY` must repeat the exact selected expression, MySQL runs with `ONLY_FULL_GROUP_BY`; handlers get `log`) done. M4-12 (performance and plans: `apps/api/perf/` run by `pnpm --filter @noor/api test:perf`, about 2 minutes, not part of `pnpm test`; `pnpm --filter @noor/api test:coverage` enforces the floors) done: **M4 is complete**. Search is by prefix, never `LIKE '%x%'`; `platform/search-text.js` has the helpers. M5-01 (storefront shell: `apps/storefront/app/root.jsx` loads the shell data and the theme, `features/layout/` is the frame; the language is a route prefix (`/ur`), never a parameter; pages other than home are placeholders) done. M5-02 (home page and `features/catalog/product-card.jsx`; the home loader removes unsafe button addresses from the page data) done. M5-03 (listings: `apps/storefront/app/lib/listing.server.js` is the loader every listing uses, `features/catalog/{listing,filters}.jsx` the page; filters are a real GET form, "Load more" a link) done. M5-04 (product page: `routes/product.jsx`, `features/product/`; `lib/selection.js` is the one place a variant, a button state and a stock line are worked out; the cart cookie `nc_cart` and the `add` action of the cart route are in `lib/cart.server.js` and `routes/cart.jsx`) done. M5-05 (cart: `routes/cart.jsx` has the loader and every action, `lib/cart.server.js` talks to the API, `features/cart/` is the page, the drawer (context in the shell) and the header link) done. M5-06 (checkout: `routes/checkout.jsx`, `lib/checkout.server.js`, `features/checkout/`; the order is checked with the contract's `CreateOrderBody` before the API call; the idempotency key lives in `sessionStorage` bound to the cart; **a redirect made in a loader must use `pagePath(url)`, never `url.pathname`, because the router's data requests end in `.data`; an order token keeps its case**) done. M5-07 (order page, lookup and review form: `routes/{order,track,order-review,review-photo}`, `lib/orders.server.js`, `features/order/`; review pictures go through the storefront's own `/photo` route to the API's upload slot) done. M5-08 (wishlist: `lib/wishlist.js` is the one reading of the cookie, `lib/browser-cookie.js` the browser side, `features/wishlist/`; a response a cache may keep sets no cookie) done. M5-09 (CMS pages and size guide: `routes/page.jsx`, `routes/size-guide.jsx`; the API resolves the tokens in a page's text) done. M5-10 (SEO: `features/seo/` has `buildMeta`/`privateMeta`, JSON-LD and `listingIndex`; `lib/seo.js` is the pure robots.txt and sitemap part, `lib/seo.server.js` the API-backed sitemap files; a non-`rubaya.pk` site address gets `X-Robots-Tag: noindex, nofollow` and `Disallow: /`; every route's `meta` goes through `buildMeta`) done. M5-11 (performance: `pnpm --filter @noor/storefront budget` and `lighthouse` hold the first measured numbers as ceilings (DOC-06.10 §2); fonts self-hosted by `lib/fonts.server.js`; `web-vitals` to `/vitals`; Markdown is rendered on the server by `lib/markdown.server.jsx`, so never import `@noor/ui/markdown` in client code) done: **M5 is complete**. M6-01 (admin Orders: `apps/admin/src/features/orders/`, `api.js` has the keys, queries and `useOrderMutations`, `components/order-{list,detail,actions,edit-dialog,print}.jsx`, `barcode.js`; the print pages are routes outside the shell; `DataTable` takes `renderCard` for phones; API route `admin.orders.lookups` feeds the courier and city choices; **the detail cache holds an order under whatever ref the URL used (number or id), so write to it with `setQueriesData`**) done. M6-02 (customers and staff-created orders: `apps/admin/src/features/customers/`, `features/orders/components/{order-new,variant-picker,customer-orders}.jsx`; **features do not import each other (lint rule)**: what two features read lives in `lib/` (`lib/sales.js` has the order lookups and the customer queries, `lib/phone-links.js` the call and WhatsApp links) and the route composes them) done. M6-03 (promo codes: `apps/admin/src/features/promos/`; `promo-form.js` converts the form and writes the rule in words, the discount itself is only ever shown from `admin.promos.preview`; the product and variant picker is `components/variant-picker.jsx`) done. M6-04 (reviews moderation: `apps/admin/src/features/reviews/`; the menu badges and the "reviews off" rule come from `lib/nav-counts.js` over `admin.nav.counts`, which the API now answers without `reviewsPending` when `features.reviews` is off) done. M6-05 (dashboard: `apps/admin/src/features/dashboard/`, one query per panel in `api.js`, `period.js` has the Pakistan-day periods; no placeholder screens are left, `routes/soon.jsx` is gone) done. M6-06 (shortcuts and command palette: **`lib/shortcuts.js` is the only place that reads a key event; a screen asks with `useShortcut(keys, handler, { label, when, group })` and never adds a `keydown` listener (a test greps for it)**; the help sheet and the palette read the same registrations) done. Next: **M6-07** (remove the old admin: `apps/admin/old`, `legacy/mock-api` dependencies on it, Radix, global CSS) |
| Branch | `chore/M0-01-workspace`, one commit per M0 task, not pushed (`master` is the default branch) |
| New code | `packages/config`, `packages/contract`, `apps/api` (Fastify skeleton), `packages/ui` (tokens.css, `cn`, contrast gate, `themeCss`, `DirectionProvider`, `safeHref`, Storybook; components in `src/components/`, one file per family, imported as `@noor/ui/<name>`: Button, Field, Input, Textarea, NativeSelect, Checkbox, RadioGroup, Switch, NumberInput, MoneyInput, PhoneInput, QuantityStepper, OptionChips, Spinner, Dialog, Drawer, ConfirmDialog, Popover, Menu, Tooltip, Toast, Select, Combobox, Tabs, Accordion, Breadcrumb, Pagination, LoadMore, Badge/StatusBadge, Card, Skeleton, EmptyState, ErrorState, Table, Carousel, Link, Ltr, VisuallyHidden, Image, Price, Markdown, RHFField (in field.jsx), ImageUpload). Every story is axe-checked by `test/stories.a11y.test.jsx` (add a story file and it is covered). Component tests: `packages/ui/test/*.test.jsx` use jsdom + Testing Library via `test/dom.tsx` (`renderUi`); put `// @vitest-environment jsdom` at the top of such a file, `packages/i18n` (en/ur catalogs, `createI18n`, `formatMoney/Date/Number`), `apps/storefront` (React Router 8 skeleton: one page, en + `/ur`) |
| Backend platform | `apps/api/src/platform/`: `db.js` (pool, `transaction()` retries deadlocks, `Executor` type for pool-or-tx), `clock.js` (`now()`, freeze in tests), `jobs.js` + `worker.js` (queue), `outbox.js` (`emit(tx, ..)`, relay), `scheduler.js`, `idempotency.js`, `rate-limit.js`, `counters.js`, `cache.js`, `ids.js` (UUIDv7), `runtime.js` (starts relay + scheduler + worker). Schema in `src/db/schema/platform.js`; migrations in `apps/api/drizzle` (`pnpm --filter @noor/api db:generate` then `db:migrate`). Integration tests are `*.int.test.js` and use a scratch database per file; they skip with a warning if MySQL is not running |
| Auth | `apps/api/src/modules/auth/` (service, repository, sessions, http, routes, roles matrix, password, secrets, totp, recovery) and `modules/audit` (`record(tx, ...)`). Staff routes use `auth: 'staff'` + a permission, `'staff-any'` for self-service, `stepUp: true` for password re-check. Create the first owner: `pnpm --filter @noor/api cli owner:create --email .. --name ..` (hidden password prompt). Dev cookie name is `rb_admin_dev` (set in `.env`) |
| Media | `apps/api/src/modules/media/` (upload slot -> signed PUT -> confirm -> job `media.process`). Files live in `apps/api/.data/storage` (`STORAGE_DRIVER=local`); the API serves generated sizes at `/img/...`. Images only; SVG and video are not accepted yet. `src/modules/index.js` `backgroundOf()` lists the job handlers and schedules of all modules |
| Settings and content | `apps/api/src/modules/settings/`: five JSON documents (`store`, `theme`, `checkout`, `payments`, `home`) with versions, pages, menus, public `store.getConfig` and `content.*`. A document never saved reads as its default, version 0. The contrast gate and the link rule live in `@noor/contract` (`contrastFailures`, `isValidLink`); `@noor/ui/contrast` and `@noor/ui/safe-href` re-export them |
| Shipping | `apps/api/src/modules/shipping/`: cities, zones with methods, couriers, `quote(db, { cityId, methodId?, amountAfterDiscount })`. `seedShipping(db)` (242 cities, 6 couriers) is idempotent and is part of the base seed (M1-13). `shipping.facts()` feeds the store configuration |
| Catalog structure | `apps/api/src/modules/catalog/` (categories, attributes, sizes and forms). Counts of products using an item come from a `usage` object passed to `createCatalogService` (zeros until M1-09 supplies real ones); foreign keys are the backstop and map to `409 in_use` |
| Products | `apps/api/src/modules/catalog/products.js`: one document saved whole with `version`; `recomputeProductCache(tx, id, stock)` is the only writer of the derived price and stock columns. Stock comes from `modules/inventory` through the `stock` object given to `createCatalogService`. `catalog/usage.js` gives the structure screens real product counts |
| Inventory | `apps/api/src/modules/inventory/`: on hand and reserved change only there (`reserve`, `release`, `commit`, `restock`, `editReserved`, `adjust`), inside the caller's transaction, variants locked in ascending id order, every on-hand change in the ledger. Orders (M4) call it with already-expanded lines; there are no order tables yet |
| Search | `apps/api/src/modules/search/`: `createSearch({ db }).run({ q, where })` is the one text-search query (FULLTEXT, synonyms, SKU first, miss log). Events `product.updated` and `catalog.structure_changed` start the reindex jobs; the event-to-job map is `eventHandlers` in `src/modules/index.js`, used by `main.js` and `worker.js` |
| Public catalog | `apps/api/src/modules/catalog/public.js` and `public-listing.js` (handlers in `public-routes.js`): the one listing query builder serves items, total and facets; handlers get `limit(bucket, by, subject)` and `http.setHeader()` from the route registrar |
| Seed | `pnpm --filter @noor/api db:seed [--base-only] [--no-demo] [--perf]` (code in `apps/api/src/seed/`: base, owner, demo, perf; entry `runSeed`). Idempotent; never overwrites staff edits; production accepts only `--base-only`. Base = settings, pages, menus, shipping, size systems, synonyms, counters. Owner `owner@rubaya.test` with a random password printed once. Demo = 24 products with generated pictures, built through the real services (~45 s). `--perf` adds 3,000 products / 25,000 variants (80 s in all, no orders until M4). `modules/services.js` `createServices({ db, config })` wires every service for the app, the worker and the seed. `product_sizes` (derived by `recomputeProductCache`) serves the size filter and facet |
| Admin | `apps/admin/src`: `app/router.jsx` (lazy routes; `routes` exported for tests), `lib/` (`api` typed client + CSRF, `session` with `useMe`/`useCan`/`requireMe`/`useLogout`, `screens.js` = every URL with permission and sidebar group, `prefs`, `safe-next`), `components/` (app shell, sidebar, top bar, `PageHeader`, `AppLink`, `FormError`), `DataTable` (`components/data-table.jsx`: URL state, filters, selection, bulk bar, job polling; `lib/list-params.js`), `features/auth/` (sign-in, code, invite, reset, forced two-step set-up), `features/products/` (list, editor sections, variants, media, stock dialog; `form-values.js` converts between the API document and the form), `features/catalog/` (categories, attributes, sizes, collections; short unpaged lists are plain tables, paged ones use `DataTable`), `features/content/` (home form, pages, menus), `features/staff/`, `features/audit/` (+ `components/history-panel.jsx`), my account in `features/auth/`, `lib/step-up.jsx` (password re-check for sensitive calls), `features/settings/` (store cards via `SettingsCard`, appearance, shipping, payments, data; each card saves the latest document with only its own keys), `components/link-input.jsx` + `stale-write-dialog.jsx`, `components/form-drawer.jsx` + `lib/use-drawer.js` (side-panel forms whose open state is in the address), `routes/` (thin lazy modules, one per screen). Tests: `src/test/app.jsx` mounts the real router over a fake `fetch` (`fakeApi`). Initial JS: `node scripts/admin-initial-js.mjs login` after a build (206.8 kB vs the 200 kB budget). Real API: owner `owner@rubaya.test` (password from the seed run), forced set-up asks for an authenticator code |
| Running today | `pnpm dev` = new admin (:5173) + real API (:3000, start MySQL first: `mysqld --defaults-file=.data/mysql-noor.ini`). The website: `pnpm --filter @noor/storefront dev` (:5174, needs the API). The old admin runs with `pnpm --filter @noor/admin dev:old` (:5175) against `legacy/mock-api`. Admin login `owner@rubaya.test` (password printed by the first seed run; two-step off locally) |

Open items on this machine:
- **Database:** noor has its **own MySQL 8.4** on **127.0.0.1:3307**, a plain process with a private data folder `.data/mysql-data` and config `.data/mysql-noor.ini` (both gitignored; it sets `innodb_ft_min_token_size=2` and UTC as DOC-14 section 3.2 requires: a full-text index built without it drops short words, so rebuild with `SET SESSION innodb_ft_enable_stopword=0; ALTER TABLE product_search FORCE`). Start it: `mysqld --defaults-file=.data/mysql-noor.ini` (`C:/Program Files/MySQL/MySQL Server 8.4/bin/mysqld.exe`). It exists because the Windows service `MySQL84` now owns the old data folder and port 3306 (another database; noor's logins do not work there): leave that service alone. Root password: `.data/mysql-root.txt` (the old one is in `mysql-root.old.txt`). Databases `rubaya`, `rubaya_test`; users `rubaya_app` and `rubaya_migrate` (passwords in `apps/api/.env`, made by `.data/mysql-init.sql`). If the process is not running, start it, then `pnpm --filter @noor/api db:migrate` (and `db:seed` on a new data folder). It stops when the session that started it ends. Spikes: `spike:drizzle`, `spike:jobs`.
- **No Docker, by decision.** Local MySQL 8.4 is to be installed natively (plan/14-devops.md §3.4; XAMPP's MariaDB does not work). Use `STORAGE_DRIVER=local`, `IMAGE_TRANSFORM=none`; spike M0-08 (MinIO/imgproxy) is skipped.
- **Writing JavaScript here:** types are JSDoc (`@param`, `@returns`, `@type`, `@template`, `@typedef`; Zod shapes via `z.infer`). Relative imports in Node-run code (`packages/contract`, `packages/i18n`, `apps/api`, `scripts`) need the `.js` extension; Vite code does not. A multi-line JSDoc right after `return` breaks the return (wrap in parentheses). Tuple rest params: `@param {Args<..>} args` without `...`. A converter that did the TS to JS change is not kept; the details are in ADR-0021.
- On Windows pnpm can leave a broken `jsdom` link inside a `vitest` folder in `node_modules/.pnpm` (jsdom tests then fail with "Cannot find package"). `scripts/fix-pnpm-links.mjs` repairs it and runs as `postinstall`; run it by hand if a jsdom test run breaks after `pnpm add`.
- **The API runs on plain Node, not Vite.** A JSON import needs `with { type: 'json' }`, a relative import needs `.js`. Tests run under Vite and hide this; `apps/api/test/node-esm.test.js` loads the entry points under real Node.
- `typescript` (dev tool only) is pinned `~6.0.3` and `typescript-eslint` `~8.70.1`: pnpm's 7-day release-age gate refuses newer ones. Do not disable the gate; pin an older release.
- **Node 24.14** is installed (the plan pinned 22.22; `engines` is `>=22.22`, `.nvmrc` says 24).
- `pnpm` was installed with `npm i -g pnpm@11.28.3` (`corepack enable` needs administrator rights here).

## Layout

```
apps/admin/          the new admin (src/, M3-01 on). apps/admin/old/ is the old dashboard (React 19, Vite 8, JSX, Radix, zod 3, react-router-dom 6),
                     kept runnable (`dev:old`) until its screens are rebuilt in M3; do not add features to it.
legacy/mock-api/     old in-memory Express API. Only here so the old admin runs. Deleted at M7.
apps/storefront/     new customer site (React Router 8, SSR; routes in app/routes.js; `~/` = app/; env in .env, see .env.example).
legacy/storefront/   old customer site. Reference only; no lint script (old lint errors, frozen); it is rewritten as apps/storefront (M5). Deleted at M7.
plan/                the documentation set
package.json  pnpm-workspace.yaml  turbo.json
```

Target layout (plan/03-frontend-architecture.md §3): `apps/{api,admin,storefront}`, `packages/{contract,ui,i18n,config}`; all exist now.

## Commands (repo root)

```
pnpm install
pnpm dev          # new admin (:5173) + real API (:3000); needs MySQL running
pnpm test         # vitest: apps/admin, apps/api, packages/config, packages/contract
pnpm --filter @noor/api start   # API on 127.0.0.1:3000 (needs NODE_ENV, APP_ENV, ADMIN_ORIGIN; see apps/api/.env.example)
pnpm lint
pnpm build
pnpm check        # typecheck (tsc --checkJs) + lint + test + physical-direction (RTL) check
pnpm --filter @noor/api test:perf      # shop at its planned size: query plans and latency budgets (needs MySQL; ~2 min)
pnpm --filter @noor/api test:coverage  # suite with coverage, then the floors of DOC-13 section 5
pnpm --filter @noor/storefront dev     # new storefront on :5174 (the old legacy/storefront also uses 5174: run one); needs the API on :3000
pnpm --filter @noor/storefront build && pnpm --filter @noor/storefront start   # production server: CSP header is sent only here
pnpm --filter @noor/ui storybook   # component workshop on :6006 (toolbars: brand, scheme, direction)
pnpm route-keys   # write plan/10-api/route-keys.txt; --check: contract routes must be documented
pnpm --filter @noor/api db:seed   # base + local owner + demo shop; --perf adds 3,000 products; --base-only is the only layer production accepts
pnpm --filter @noor/admin <script>
```

Env files (gitignored, already present): `legacy/mock-api/.env` (`ADMIN_KEY=dev-key`),
`apps/admin/.env.local` (`VITE_API_URL=http://localhost:3000`, `VITE_ADMIN_KEY=dev-key`).

## Target stack (decisions in plan/02-decisions/)

| Area | Decision |
|---|---|
| Language | **JavaScript with JSDoc types** (ADR-0021). No `.ts`/`.tsx`, no TypeScript syntax. `tsc --checkJs` is the typecheck (`pnpm typecheck`) |
| Backend | Node.js, Fastify 5 modular monolith, plain JavaScript run by Node (no build, no tsx) |
| Database | MySQL 8.4 + Drizzle ORM (`mysql2`). Order and invoice numbers from a `counters` table |
| Jobs / search | Own `jobs` table + outbox in MySQL; InnoDB `FULLTEXT` + synonyms |
| Contract | One Zod 4 package shared by all apps; REST under `/api/v1`; OpenAPI generated |
| Storefront | React Router 8 framework mode, server-rendered |
| Admin | React SPA; TanStack Query; no localStorage domain data, no mock mode |
| UI | `@noor/ui`: owned components on Base UI, Tailwind v4, semantic tokens, logical (RTL-safe) properties |
| Auth | Server sessions, Argon2id, TOTP, role permissions. No shared admin key |
| Money / orders | Integer paisa only; server computes every price; idempotent order creation; stock reserved then committed |
| Launch scope | Cash on delivery only; Pakistan only; no external service needed to run locally |

## Rules that are easy to break

- Money is `{ amount, currency: 'PKR' }` in integer paisa (`699000` = Rs. 6,990). No floats, ever.
- The client never sends a price, discount, fee or total.
- Order status, stock and payment status change only through the functions named in plan/09-data-model/07 and 04.
- Do not copy code from `legacy/` or the old `apps/admin` without reading the audit finding that covers it
  (plan/01-audit.md): several defects live inside working code.
- Cite the finding id (`F-xx`, `K-x`) in any change that fixes an audit item.
- Do not commit or push unless asked. Never push to `master` directly.

## The old admin (`apps/admin/old/src`), until it is replaced

- `lib/db.js` is its only data layer (localStorage, or the mock API when `VITE_API_URL` is set); pages use
  `hooks/useCollection.js` (`useCollection(name)`, `useSingleton(name)`).
- `contract/schemas.js` (zod 3) + `fixtures.js` become `packages/contract` and the seed data (tasks M0-04, M1-13).
- Shared pieces: `components/Field.jsx`, `components/ui.jsx`, `components/ImageUpload.jsx`, `lib/format.js`,
  `lib/variants.js`, `lib/images.js`, `lib/orders.js`, `lib/invoice.js`.
- Tests: `src/lib/__tests__` (vitest). They force local mode.

## Known gotchas

- The mock API loses all data on restart.
- `apps/admin/README.md` and `legacy/storefront/README.md` are the untouched Vite template.
- `legacy/storefront/CHANGELOG_THIS_PASS.md` describes seller features that do not exist.
- `*.zip` archives in the old project folders are ignored by git; do not read or commit them.
- `plan/NOOR_DOCS.md` is a stale single-file snapshot of Phase 0; the split files govern.
