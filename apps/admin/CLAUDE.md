# apps/admin: the staff admin panel (read this instead of scanning `src/`)

React 19 SPA (Vite, JSX with JSDoc), React Router (data router, lazy routes), TanStack Query, React Hook Form + the contract's Zod schemas, `@noor/ui` components, Tailwind v4 with
logical (RTL-safe) utilities. Dev: `pnpm dev` -> http://localhost:5173, API on :3000. Plan: `plan/07-admin/` (`01-ia-roles.md` = screens + permissions). No localStorage domain data,
no mock mode: everything goes through the real API. The previous dashboard (`apps/admin/old`) is deleted.

Sign in: `owner@rubaya.test` + the password the seed printed once (two-step is off locally: `TWO_FACTOR_REQUIRED=0` in `apps/api/.env`). A forced two-step set-up asks for an
authenticator code when it is on.

## Shape of `src/`

```
main.jsx, app/router.jsx   router built from lib/screens.js (every URL + permission + sidebar group); `routes` is exported for tests
lib/screens.js             THE registry of admin URLs: path, title, permission, sidebar group, icon, lazy route module. Add a screen here, nowhere else for navigation
lib/api.js                 the typed client (createClient(routes)); session is a cookie; `x-csrf-token` from `admin.me.get` is sent on every call (setCsrfToken)
lib/session.js             useMe / useCan(permission) / requireMe (route loader guard) / useLogout; lib/safe-next.js (only same-site `next=` redirects)
lib/errors.js, form.js     ApiError -> field errors for RHF, messages by code; lib/step-up.jsx = password re-check dialog for `stepUp` routes then repeats the call
lib/list-params.js         URL state of every list (page, sort, filters, search) ; lib/use-drawer.js = side-panel form whose open state is in the address
lib/upload.js              image upload: slot -> signed PUT (with the admin Origin) -> confirm; components/picture-field.jsx, ImageUpload from @noor/ui
components/                app-shell, sidebar, top-bar, page-header, data-table.jsx (URL state, filters, selection, bulk bar, job polling), form-drawer, stale-write-dialog
                           (409 stale_write: reload their version or overwrite), history-panel (audit), link-input (validated links), form-fields-editor, section-card...
routes/                    thin lazy modules, one per screen (products, product, categories, attributes, sizes, collections, content-home, pages, menus,
                           settings-store/appearance/shipping/payments/data, account, staff, staff-member, audit, login/2fa/invite/reset)
features/<area>/           api.js (query keys + calls for that area), components/, schemas, tests: products (list, editor sections per product kind, variants table,
                           media, stock dialog; form-values.js converts API document <-> form), catalog, content, settings (cards via SettingsCard; each card saves the
                           latest document with ONLY its own keys), staff, audit, auth
test/app.jsx               mounts the real router over a fake `fetch` (`fakeApi`); component tests are *.test.jsx beside the code (jsdom + Testing Library)
```

## What is built and what is not

Built (M3): sign-in + two-step + invites + reset, shell/sidebar/permissions, products list + full editor (all kinds), variants/options, media, stock adjust, categories,
attributes, sizes + charts, collections, home page content, CMS pages, menus, settings (store, appearance with contrast gate, shipping, payments, data), staff + roles, audit log, my account.
Built (M6-01): Orders list (`features/orders/components/order-list.jsx`: tabs from `admin.orders.counts`, filters in the address, card list under `md`, bulk confirm/dispatch/deliver through `bulk-order-dialog.jsx`, CSV export), order detail (`order-detail.jsx` + `order-actions.jsx` one dialog per action + `order-edit-dialog.jsx` which shows the server's `previewEdit` before saving), print view (`order-print.jsx`, outside the shell: `/orders/:id/print`, `/orders/print?ids=`, Code 128 in `barcode.js`). `labels.js` has the reason texts, `orderMessage` and `describeEvent`; `format.js` has `waLink`/`telLink`/`ageText`. An order is cached under the ref of the URL (number or id): update it with `setQueriesData` (see `useOrderMutations`).
Built (M6-02): Customers list and page (`features/customers/`), staff-created orders (`/orders/new`: `order-new.jsx` + `variant-picker.jsx`). **A feature never imports another** (eslint `no-restricted-imports`): shared reads live in `lib/` (`sales.js`, `phone-links.js`, `catalog.js`) and a route composes features (`routes/customer.jsx` hands the orders block to the customer page).
Built (M6-03): Promo codes (`features/promos/`: list, drawer at `?new=1`/`?edit=<id>` through `useDrawer`, the rule in words, "Try this code" through `admin.promos.preview`). `components/variant-picker.jsx` finds a product and a variant for any screen that needs one (orders, promo preview).
Built (M6-04): Reviews queue and drawer (`features/reviews/`; drawer at `?review=<id>`), and the menu badges (`lib/nav-counts.js`; a screen with `feature: 'reviews'` shows only while `reviewsPending` is given).
**Built (M6-05)**: the Dashboard (`features/dashboard/`: to-do cards, figures, SVG chart, panels; every panel has its own query, its own loading and its own failure). `lib/age.js` has the waiting-time texts.
**Built (M6-06)**: keyboard shortcuts (`lib/shortcuts.js`: register with `useShortcut`, never add a `keydown` listener; `components/global-shortcuts.jsx` has the global ones, `DataTable` the list ones, the order screen its own), the `?` sheet and the Ctrl/Cmd K palette (`components/shortcut-help.jsx`, `command-palette.jsx`); `lib/list-context.js` remembers the rows of the last list for `]` on an order. In tests that change a preference, do it in `beforeEach`, not `afterEach` (a mounted screen would redraw).
**Built (M7-03)**: the admin sends no inline script (its theme is `public/theme-init.js`) and its response headers come from `security-headers.js` (`dist/_headers` at build, `vite preview` in the end-to-end run); `src/lib/env.js` reads its two settings by name, never `import.meta.env` whole.
**Built (M7-03)**: the admin sends no inline script (its theme is `public/theme-init.js`) and its response headers come from `security-headers.js` (`dist/_headers` at build, `vite preview` in the end-to-end run); `src/lib/env.js` reads its two settings by name, never `import.meta.env` whole.
**Built (M7-01)**: bulk Publish / Move to draft / Archive on the products list (`admin.products.bulk`, people with `products:publish`, ids only).
**Built later (2026-10, plan/17)**: customer highlight rules and visits (`features/customers/`), Subcategories and bulk delete (`components/bulk-delete.jsx`, `lib/bulk-delete.js`), Notices and the home page sections (`features/content/`), Delivery runs, people, receipts and the rider ledger (`features/delivery/`, `lib/delivery.js` is what the Orders list shares), Emails (`features/settings/components/emails-page.jsx`), Module access per person (`features/staff/components/module-access.jsx`).
**Not built yet**: Inventory screens beyond the product stock dialog.
The API for all of these already exists (M4: `admin.orders.*`, `admin.customers.*`, `admin.promos.*`, `admin.reviews.*`, `admin.dashboard.*`, `admin.search`...): M6 is screens only.

## Conventions

- Permission gating: the route has `permission` in `screens.js`; inside a screen use `useCan('products:write')` to hide/disable controls (the API enforces anyway). Read-only without `:write`.
- Every save sends the document `version`; a 409 `stale_write` opens the stale-write dialog (never silently overwrite). Sensitive calls (`stepUp: true`) go through `lib/step-up.jsx`.
- Lists = `DataTable` + `list-params` (state in the URL); short unpaged lists are plain tables. Bulk actions return a job; the table polls it.
- Initial JS budget: `node scripts/admin-initial-js.mjs login` (run from the repo root) after a build: 222.3 kB at sign-in and 227.5 at the dashboard against a 230 kB budget (amended at M7-09 from 200, see plan/16): do not grow the login bundle; keep screens lazy.
- Physical CSS directions are banned (`node scripts/check-logical.mjs`): use `ms-/me-/ps-/pe-/start-/end-/text-start`.
- Texts: admin copy lives in `@noor/i18n` staff catalogs (`staff.js`), English only today.

## Commands

```
pnpm dev                       # admin :5173 + API :3000 (start MySQL first)
pnpm --filter @noor/admin test | typecheck | lint | build
node scripts/admin-initial-js.mjs login
```
