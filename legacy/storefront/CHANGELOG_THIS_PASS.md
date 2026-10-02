# This pass — fixes & completion

**Date:** 21 Sep 2026
**Context:** `STOREFRONT_PROGRESS.md` (from the previous pass) said the admin/seller panel
was "not started." On inspection, the seller dashboard in this codebase was actually
already built out and genuinely wired to shared state with the storefront (adding a
product shows up in Shop, placing an order shows up in seller Orders, dispatch
decrements stock and issues an invoice, promo codes enforce real usage limits). This
pass verified that, then closed the real gaps found on inspection — it is not a rebuild.

Confirmed working baseline: `npm install && npm run build` succeeds cleanly, no console
errors, no eslint errors before this pass's fixes (aside from the ones listed below).

## Fixes

1. **Checkout ref bug (`src/pages/storefront/Checkout.jsx`)** — the three field refs
   were being built as `{ name: useRef(null), phone: useRef(null), address: useRef(null) }`
   and read back off that object inside JSX (`ref={fieldRefs.phone}`), which the
   `react-hooks/refs` rule correctly flags as unsafe ref access during render. Replaced
   with three plain named `useRef` calls; the lookup object is still used, but only
   inside the `validate()` event handler, which is safe.

2. **Seller dashboard had no login gate (`src/context/SellerContext.jsx`,
   `SellerLayout.jsx`, `SellerLogin.jsx`, `SellerRegister.jsx`)** — `/seller/dashboard`
   only checked `seller.onboarded`, not whether anyone had actually logged in, so it was
   reachable by URL with zero credentials. Added a real (session-only, no backend yet)
   `isAuthenticated` flag with `login()` / `logout()` on `SellerContext`. `SellerLayout`
   now redirects to `/seller/login` if there's no session; `SellerLogin` and the last
   step of `SellerRegister` call `login()`; the sidebar "Log out" button calls `logout()`.

3. **Theme picker in onboarding did nothing (`SellerRegister.jsx`, `index.css`,
   `StorefrontLayout.jsx`)** — sellers could pick "Monochrome Studio" or "Botanical"
   during signup, but `seller.theme` was stored and never read anywhere. Added
   `data-theme={seller.theme}` on the storefront's root element and real CSS variable
   overrides for both alternate themes (`--gold`, `--charcoal`, `--cream`, `--line`,
   `--stone`, `--sale`). Also introduced a `--on-gold` variable for text/icons that sit
   on a `--gold` background (buttons, cart badge, "New" tag, active sub-filter chip) —
   these were hardcoded to a dark color that would've been unreadable against
   Monochrome's near-black accent color.

4. **New: Seller Settings page (`src/pages/seller/Settings.jsx`)** — there was
   previously no way to edit the store name, contact info, or theme after the
   onboarding wizard finished. Added a Settings page (linked from the sidebar) with a
   profile form and a live theme switcher.

5. **Product page kept stale local state across products
   (`src/pages/storefront/Product.jsx`)** — React Router reuses the same component
   instance across `/product/:id` navigations (e.g. clicking a related product), so
   `qty`, the active gallery image, and the size-validation error were all carrying
   over from the previous product. Concretely: qty could stay above a lower-stock
   product's available stock, since the `+`/`-` stepper only guards against *further*
   increments, not the carried-over starting value. Fixed by resetting this local state
   synchronously during render when `id` changes (React's documented pattern for this;
   avoids the extra render an effect-based reset would cause, and the
   `react-hooks/set-state-in-effect` lint rule agrees).

6. **Static contact info that couldn't reflect a seller's real details
   (`CmsPage.jsx`, `OrderConfirmation.jsx`)** — the `/pages/contact` page and the
   WhatsApp "chat with support" link were hardcoded to placeholder numbers/emails
   instead of the seller's own info (now editable in Settings). Both now read from
   `useSeller()`. Added a `toWhatsAppNumber()` helper (`utils/format.js`) to convert a
   local `0300-...` number into the `92...` form `wa.me` links need.

7. **Home hero copy hardcoded the seed store's name** — `Home.jsx` now pulls the
   store name from `useSeller()` and the hero's price tag from the actual featured
   product instead of a hardcoded product name/price.

## Verified, left as-is (not bugs)

- The `react-refresh/only-export-components` eslint errors on the context files
  (`CartContext.jsx`, `CatalogContext.jsx`, `OrdersContext.jsx`, `PromoContext.jsx`,
  `SellerContext.jsx`, `WishlistContext.jsx`) are a Fast-Refresh/HMR-quality lint rule,
  not a runtime bug — these files intentionally export both a Provider component and a
  `useX()` hook, a very common and otherwise-safe React pattern. Fixing it "properly"
  means splitting each hook into its own file for no behavioural benefit, so it was
  left alone to avoid unnecessary churn across six files.
- A couple of `react-hooks/exhaustive-deps` **warnings** (not errors) on `useMemo`
  calls in `CatalogContext`, `PromoContext`, and `WishlistContext` — the omitted
  dependencies are functions defined in the same closure that only change when the
  memo's own listed dependencies change, so they're not stale-closure bugs; left as-is.

## Still not implemented (unchanged from `STOREFRONT_PROGRESS.md` §4, and reasonable
next steps for a real backend/TypeScript phase, not this JS/mock-data phase)

- Real authentication (the seller login accepts any non-empty email/password — there's
  no backend to check credentials against yet)
- Search-suggest overlay, drop/collection countdowns, custom-size orders, reviews,
  recently-viewed, notify-me
- Real payment gateway integration
- TypeScript, SSR, a BFF, Zustand, Radix, CSS Modules, a Zod contract, CI, automated
  tests — all explicitly deferred to a later phase per the v2 documentation, and out of
  scope for this JSX-only pass per your instruction.


---

## Pass 3 — Track A: persistence across refresh

- New `src/hooks/usePersistentState.js`: `useState` backed by `localStorage` (keys prefixed
  `storefront:`, versioned envelope `{ v, data }`). A missing, corrupt, wrong-version or
  validator-failing blob falls back to the seed data and is cleared. Storage being blocked or
  full is tolerated (app keeps working in memory). Changes in another tab sync via the
  `storage` event.
- Persisted: cart lines + applied promo, wishlist, seller profile/theme + login session,
  catalog (products/categories/category tree), orders, promo codes. Cart drawer open state is
  intentionally not persisted.
- `OrdersContext`: order/invoice numbers now continue from the highest existing number instead
  of module-level counters, so they stay unique after a refresh.
- Seller → Settings: new "Demo data" section with **Reset to sample data**.
- Bump `SCHEMA_VERSION` in the hook if a persisted shape changes incompatibly.


---

## Pass 4 — Phase 0, step 1: admin/seller cleanup (doc 07 §1, doc 06 appendix "Removed entirely")

Scope decision from the v2 docs: this repo is the customer-facing storefront only; the admin
panel is a separate project that owns and publishes all data.

**Removed**
- `src/pages/seller/*` (9 files), `DispatchModal`, `OrderDetailModal`, `SellerContext`.
- Seller routes in `App.jsx` and the "Sell on …" header link.
- Write-side of `CatalogContext` (`addProduct`, `updateProduct`, `removeProduct`, `addCategory`),
  `PromoContext` (`addPromo`, `updatePromo`, `removePromo`), `OrdersContext` (`dispatchOrder`,
  `markDelivered`, `cancelOrder`, `stats`, `invoices`).
- Admin-only UI in `components/ui.jsx` (`Modal`, `StatusBadge`, `StatCard`).
- ~110 lines of admin CSS (auth/wizard/dashboard/stat-card/theme-picker/invoice/status-badge/
  "Sell on" link + the orphaned `--panel-side*` vars and `@keyframes spin`).

**Added**
- `useStoreConfig()` (`src/hooks/useStoreConfig.js`) + `STORE_CONFIG` in `data/mockData.js`:
  read-only store name / theme / phone / email. Replaces `useSeller()` in `StorefrontLayout`,
  `Home`, `CmsPage`, `OrderConfirmation`. When the loader/BFF layer lands only this hook's
  body changes.

**Kept on purpose (still needed by cart/checkout until Phase 2 replaces them)**
- `CatalogContext.decrementStock`, `PromoContext.recordUsage/validatePromo`,
  `OrdersContext.placeOrder`, and all `usePersistentState` persistence.

**Result:** bundle JS 326 → 291 kB (gzip 96 → 90), CSS 27.7 → 20.1 kB. Lint: 6 errors → 5
(only the known `react-refresh/only-export-components` ones, replaced in Phase 2), 3 warnings
unchanged. Browser smoke test (27 checks: every storefront route, `/seller/*` now 404s,
full COD purchase, order-number continuity, persistence across reload, mobile overflow) passes.

**Known consequences**
- Orders placed in the demo stay `pending` — nothing can dispatch/deliver them any more.
- "Reset to sample data" lived on the deleted Settings page; `resetPersistedData()` still
  exists in `usePersistentState.js` but has no UI. Clear `storefront:*` keys in DevTools.
- The Monochrome/Botanical theme CSS is intact but the picker is gone; switch by editing
  `STORE_CONFIG.theme` until the ThemeProvider step.
- The 404 route renders outside `StorefrontLayout` (no header/footer) — pre-existing;
  doc 05 §11 specifies proper 404 handling, done with the framework-mode root.
