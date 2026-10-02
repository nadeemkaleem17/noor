# 04c — Design System: Patterns

| Field | Value |
|---|---|
| ID | DOC-04c |
| Title | Forms, overlays, toasts, tables, lists, empty/loading/error states, layout |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-04a, DOC-04b |
| Decisions used | ADR-0006, ADR-0007, ADR-0013, ADR-0015, ADR-0018 |

## 1. Purpose and scope

**Governs:** how components are combined: which one to pick, how a form behaves, how every async surface shows loading, empty and error, and layout rules for both apps.
**Does not govern:** component APIs (DOC-04b), the React code behind a pattern (DOC-05), page content (DOC-06, DOC-07).

## 2. Layout

### 2.1 Storefront (mobile-first, designed at 360 px)

| Rule | Value |
|---|---|
| Page gutter | `px-4` under `md`, `px-6` from `md`, `px-8` from `lg` |
| Max content width | 1280 px (`max-w-7xl mx-auto`); text blocks 65 ch |
| Product grid | 2 columns under `md`, 3 from `md`, 4 from `lg`; gap from density (DOC-04a §5) |
| Vertical rhythm | Sections separated by `py-10` (mobile) / `py-16` (from `md`); inside a section `space-y-4` |
| Header | 56 px, sticky when `ThemeTokens.header.sticky`; contains menu button, logo, search, wishlist, cart |
| Sticky purchase bar | On PDP and cart under `md`: fixed to the bottom, 64 px plus `env(safe-area-inset-bottom)`; page content gets matching bottom padding |
| Touch targets | 44 × 44 px minimum, 8 px minimum gap between adjacent targets |

```
360 px PDP                          360 px cart
┌──────────────────────────┐        ┌──────────────────────────┐
│ ☰  NOOR & CO.     🔍 ♡ 🛒 │        │ ←  Cart (3)              │
├──────────────────────────┤        ├──────────────────────────┤
│ ┌──────────────────────┐ │        │ ┌────┐ Lawn 3-pc  Rs.6,990│
│ │      gallery 3:4     │ │        │ │img │ Size M            │
│ │      ● ○ ○ ○         │ │        │ └────┘ [-] 1 [+]  Remove │
│ └──────────────────────┘ │        │ …                        │
│ Embroidered Lawn 3-Piece │        │ Promo code  [______][Apply]
│ Rs. 6,990  ~~Rs. 8,490~~ │        │ Subtotal        Rs.20,970│
│ Colour  ● ● ●            │        │ Shipping   calculated next│
│ Size   [S][M][L][XL]     │        ├──────────────────────────┤
│ Size guide               │        │ Total Rs.20,970 [Checkout]│
│ ▸ Details ▸ Fabric ▸ Care│        └──────────────────────────┘
├──────────────────────────┤
│ Rs. 6,990   [Add to cart]│  ← sticky bar
└──────────────────────────┘
```

### 2.2 Admin (desktop-first, usable from 768 px)

| Rule | Value |
|---|---|
| Shell | Sidebar 240 px (collapsed 64 px; a `Drawer` under `lg`) + content |
| Content padding | `p-6`; max width 1440 px for tables, 880 px for single-column forms |
| Page header | `PageHeader`: title, optional description, primary action at inline-end; sticky under the top bar |
| Form page | Two columns from `lg`: main (2/3) and side panel (1/3: status, organisation, SEO). One column below `lg` |
| Density | Body `text-base` (14 px), controls 36 px, table rows 44 px |

```
┌────────┬──────────────────────────────────────────────────────────┐
│ NOOR   │ Products                              [Export] [+ New]   │
│        ├──────────────────────────────────────────────────────────┤
│ ▣ Dash │ [Search…]  Status ▾  Category ▾  Stock ▾     Columns ▾   │
│ ▣ Prod │ ┌──┬────────────────┬────────┬───────┬────────┬────────┐ │
│ ▣ Ord  │ │☐ │ Product        │ Status │ Stock │ Price  │ Updated│ │
│ ▣ Cat  │ ├──┼────────────────┼────────┼───────┼────────┼────────┤ │
│ …      │ │☐ │ Lawn 3-pc      │ Active │   42  │ 6,990  │ 2h ago │ │
│        │ └──┴────────────────┴────────┴───────┴────────┴────────┘ │
│        │ 3 selected: [Publish] [Archive] [Delete]   1–50 of 2,310 │
└────────┴──────────────────────────────────────────────────────────┘
```

## 3. Forms

| Rule | Detail |
|---|---|
| Library | React Hook Form + Zod resolver; the schema is the contract schema or a refinement of it (DOC-05 §2) |
| Layout | One column. Label above the control. Hint below the label, error below the control (error replaces hint) |
| Required | Mark **optional** fields with "(optional)"; required is the default and has no asterisk |
| Validation timing | On blur for a field's first error, then on change for that field; all fields on submit |
| On submit with errors | Focus the first invalid field and scroll it into view; announce "N fields need attention" in an `aria-live` region |
| Server errors | Field issues (`issues[].path`) → that field; anything else → an inline `ErrorState` above the submit button. Never only a toast |
| Submit button | Shows `loading` while pending; stays enabled before that (a disabled submit hides what is wrong) |
| Unsaved changes (admin) | A sticky bar "Unsaved changes: [Discard] [Save]" appears when the form is dirty; navigating away asks for confirmation (`useBlocker`) |
| Autosave | Not used. Admin saves explicitly; storefront checkout keeps a draft in `sessionStorage` (no card data) so a refresh does not lose the address |
| Input types | Table below |

| Field | `type` | `inputMode` | `autoComplete` | Extra |
|---|---|---|---|---|
| Full name | text | text | `name` | |
| Mobile | tel | tel | `tel` | `PhoneInput`; `dir="ltr"` |
| Email (optional at checkout) | email | email | `email` | |
| Address line | text | text | `street-address` | |
| City | — | — | `address-level2` | `Combobox` over the shipping-zone city list (F-06) |
| Postal code (optional) | text | numeric | `postal-code` | |
| Promo code | text | text | `off` | Upper-cased on blur |
| Price (admin) | — | decimal | `off` | `MoneyInput` |
| Quantity / stock | — | numeric | `off` | `NumberInput` |
| Search | search | search | `off` | `enterKeyHint="search"` |

## 4. Choosing an overlay

| Need | Use | Not |
|---|---|---|
| Confirm a destructive or irreversible action | `ConfirmDialog` | A toast with undo, unless the action is truly undoable server-side |
| A short task of up to about 5 fields that keeps page context (add a category, record a dispatch) | `Dialog` | A new page |
| A longer side task or a detail preview next to a list (edit a variant, view an order from the list) | `Drawer side="end"` | `Dialog` with scrolling content |
| Storefront cart, filters, menu on mobile | `Drawer side="bottom"` (cart and filters), `Drawer side="end"` (menu) | Full page for filters |
| A full entity with several sections (product, order) | A page with its own URL | Any overlay |
| Row actions | `Menu` | Inline icon rows with more than 2 icons |
| Extra explanation of a control | Hint text; `Tooltip` only for icon-only buttons | Tooltip holding essential information |

Rules: never open an overlay from an overlay, except `ConfirmDialog` from a `Dialog`/`Drawer`. An overlay that holds a dirty form asks before closing. Overlay open state that should survive a refresh or be linkable (order drawer, filter drawer) is a URL search param.

## 5. Feedback

| Event | Feedback |
|---|---|
| Mutation succeeded and the result is visible on screen (row updated, item in cart) | No toast needed; storefront add-to-cart opens the cart drawer |
| Mutation succeeded, result not visible (saved settings, export started) | Toast, `success` tone |
| Mutation failed, user can fix it | Inline at the field or above the submit button |
| Mutation failed, user cannot fix it (network, 5xx) | Toast `danger` with a Retry action; the form keeps its values |
| Bulk action | One summary toast: "48 published, 2 failed" with a "View failures" action opening a `Dialog` list (ADR-0015) |
| Background job finished (import, export) | Toast with a link |
| Optimistic update rolled back | Toast `danger` explaining what was not saved |

Toast copy: what happened, in the past tense, at most 60 characters; no "Successfully". Error copy says what to do next.

## 6. Loading, empty and error (every async surface has all three)

| Surface | Loading | Empty | Error |
|---|---|---|---|
| Storefront page (SSR) | None on first load (HTML arrives rendered); on client navigation a 2 px top progress bar after 150 ms | — | Route `ErrorBoundary`: `ErrorState` with retry and a link home |
| Storefront product grid | `Skeleton` cards, same count and ratio as the real grid | `EmptyState`: "No products match" + "Clear filters" | `ErrorState` + retry |
| Storefront deferred sections (reviews, recommendations) | `Skeleton` inside `<Suspense>` | Section is not rendered | Section is not rendered; error logged |
| Cart drawer | Line skeletons | `EmptyState` + "Continue shopping" | `ErrorState` + retry |
| Admin table | Skeleton rows (10) on first load; on refetch keep the old rows at 60% opacity with a spinner in the header | `EmptyState`; with filters active: "No results" + "Clear filters"; with none: a create action | `ErrorState` in place of the body, header and filters stay usable |
| Admin detail page | Skeleton of the form layout | 404 `EmptyState` with a link back to the list | `ErrorState` + retry |
| Button action | `loading` on the button | — | See §5 |

Rules: a spinner alone is used only inside buttons and for waits under about 1 s. A skeleton never shifts layout when content arrives. Nothing shows a loading state for less than 300 ms (delay showing it by 150 ms, then keep it at least 300 ms) to avoid flicker.

## 7. Tables and lists

| Rule | Storefront | Admin |
|---|---|---|
| Pagination | "Load more" with a count; the URL carries `?cursor=` so back/forward restores position | Server-side, page size 50 (options 25/50/100), "1–50 of 2,310" |
| Sorting | A `NativeSelect` | Click a sortable header: ascending → descending → none; state in the URL |
| Filtering | Filter drawer (mobile) / sidebar (from `lg`), each facet shows a count; applied filters shown as removable chips | Filter bar above the table; state in the URL; "Clear" resets |
| Search | Header search → `/search?q=` | Debounced 300 ms, minimum 2 characters, state in the URL |
| Selection | — | Checkbox column; header checkbox selects the page; "Select all N matching" appears after that |
| Bulk actions | — | Bar appears when ≥ 1 row is selected; destructive ones go through `ConfirmDialog` with the count |
| Virtualization | — | Table body virtualized when a page can exceed 100 rows (DOC-05 §1) |
| Numbers | Prices `Price` component | Numeric columns `text-end tabular-nums`; money via `formatMoney`; dates relative under 7 days, absolute after, full timestamp in `title` |
| Row click | Whole card is the link | Opens the detail page; the first cell holds a real link so it works with the keyboard and middle-click |
| Empty cell | — | An en dash "–" with `aria-label="none"` |

## 8. Content and copy

- Sentence case everywhere ("Add to cart", not "Add To Cart").
- Buttons are verbs naming the result ("Place order", "Save product"); never "OK" or "Submit".
- Destructive confirmations name the object and consequence: "Delete 3 products? This cannot be undone."
- Prices always carry the currency prefix `Rs.` and thousands separators: `Rs. 6,990`. Decimals follow `StoreConfig.priceDisplay` (ADR-0013).
- Dates: `2 Oct 2026`; times `3:45 pm`, Asia/Karachi.
- Phone numbers display as `0300 1234567` locally; stored as E.164.

## 9. Accessibility baseline (WCAG 2.2 AA)

| Area | Requirement |
|---|---|
| Contrast | Enforced by the token gate (DOC-04a §9) |
| Keyboard | Every action reachable and operable; visible focus; logical order; no trap except inside open overlays |
| Skip link | "Skip to content" is the first focusable element in both apps |
| Landmarks | One `<header>`, `<nav>`, `<main>`, `<footer>` per page; one `<h1>`; headings do not skip levels |
| Target size | 44 px storefront, 36 px admin; 24 px absolute minimum (WCAG 2.5.8) |
| Forms | Programmatic labels, errors linked with `aria-describedby`, `autoComplete` set (§3) |
| Live regions | Toasts, cart count change, form error summary, table result count after filtering |
| Motion | Honour `prefers-reduced-motion` |
| Images | `alt` required; product images describe the garment ("Teal embroidered lawn kameez, front") |
| Language | `lang`/`dir` on `<html>`; inline switches of language get their own `lang` |

## 10. Rules

**Always:** design at 360 px first on the storefront; keep filter, sort, page, tab and open-drawer state in the URL; give every list a loading, empty and error state before it is reviewed.
**Never:** use a toast as the only place an error appears; disable a submit button to signal invalid input; stack overlays (except confirm); use infinite scroll; hide essential information in a tooltip or behind hover.
**Common mistakes:** an "empty" state shown while still loading; skeletons of a different size than the content; a full-page spinner on client navigation; a drawer that cannot be linked to.

## 11. Acceptance checklist

- [ ] Every list and async section in a PR shows loading, empty and error in Storybook or a test.
- [ ] Reloading any admin list URL restores search, filters, sort and page.
- [ ] Submitting an invalid form focuses the first invalid field.
- [ ] Storefront pages are usable at 360 px with no horizontal scroll (Playwright viewport test, DOC-13).
- [ ] Tabbing through any page shows a visible focus ring on each stop, starting with the skip link.

## 12. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-04c-1 | "Load more" instead of numbered pages on the storefront | Taken from the v2 doc's Baymard reference, not re-verified (ADR-0004 open question) | SEO review in DOC-06 or analytics showing low depth |
| Q-04c-2 | Admin minimum width 768 px | Superseded by DOC-07.1 Q-07.1-3: orders list and order detail must work at 360 px (staff confirm COD orders from a phone); other admin screens stay at 768 px | — |

## 13. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 1) |
| 2026-10-02 | Phase 3: Q-04c-2 superseded by DOC-07.1 |
