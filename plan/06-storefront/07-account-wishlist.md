# 06.7 — Storefront: Account and Wishlist

| Field | Value |
|---|---|
| ID | DOC-06.7 |
| Title | Customer identity in v1 (guest only) and the wishlist |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-06.1, DOC-06.3 (card), DOC-06.6 |
| Decisions used | ADR-0012, ADR-0015 |

## 1. Purpose and scope

**Governs:** what "account" means for a customer in v1, and the wishlist page and toggle.
**Does not govern:** staff accounts (DOC-11), order lookup (DOC-06.6).

## 2. Customer accounts: none in v1

ADR-0012 keeps customers as guests. There is no sign-up, login, password, profile or saved address in v1.

| Need | How v1 meets it |
|---|---|
| See my order | The link in the confirmation message, or `/track` (DOC-06.6) |
| See all my orders | Not available. Each order has its own link |
| Faster repeat checkout | The browser's own autofill (`autoComplete` attributes, DOC-04c §3) and the checkout draft within a session |
| Saved items | Wishlist in a cookie (§3) |
| Marketing consent | An optional checkbox at checkout "Send me offers on WhatsApp/SMS" stored on the order's customer record (DOC-09) |

The API still keeps a `customers` row per phone number (for the admin's customer list and per-customer promo limits, ADR-0020); the storefront never exposes it.

Revisit trigger for real accounts (phone + OTP login, order history, saved addresses): repeat-customer share above 25% of orders, or the owner asks. That change needs an ADR superseding the guest-only part of ADR-0012 and adds routes `/account`, `/account/orders`, `/login`.

## 3. Wishlist

Shown only when `StoreConfig.features.wishlist` is true.

| Item | Rule |
|---|---|
| Storage | Cookie `nc_wishlist`: comma-separated **product ids**, newest first, max 100; `Secure; SameSite=Lax; Path=/; Max-Age=31536000`; **not** `HttpOnly` (the client toggles it without a round trip). It holds no personal data |
| Granularity | Product (a colourway), not variant |
| Toggle | `WishlistButton` on cards and the PDP: `aria-pressed`, label "Save <title>" / "Remove <title> from wishlist". Writes the cookie, updates a tiny client store so every instance and the header badge re-render; no network call |
| Header badge | Count from the cookie, rendered after hydration (cached HTML must not contain it, DOC-06.1 §3) |
| Server-rendered state | Cards in cached L pages render the button unpressed; a hydration effect marks saved ones. This avoids varying the cache by cookie |
| At the limit | Adding the 101st drops the oldest |
| Page `/wishlist` | Loader reads the cookie and calls `catalog.listProducts?ids=<ids>` (max 100, one call), returns cards in saved order. `private, no-store`, `noindex` |
| Stale ids | Products that are no longer active are not returned; the loader rewrites the cookie without them |
| Card on this page | The standard `ProductCard` plus "Remove" and a "View product" primary link (no add-to-cart: a size is usually required) |
| Sold out | Shown with the sold-out badge; if `features.notifyMe`, a "Notify me" link to the PDP |
| Empty | `EmptyState`: "Nothing saved yet" + link to `/new` |
| Share | Not in v1 |

```
┌──────────────────────────────┐
│ Wishlist (3)           (h1)  │
│ ┌──────┐┌──────┐             │
│ │ card ││ card │             │
│ │Remove││Remove│             │
│ └──────┘└──────┘             │
└──────────────────────────────┘
```

## 4. Cookies set by the storefront (complete list)

| Cookie | Purpose | HttpOnly | Lifetime | Spec |
|---|---|---|---|---|
| `nc_cart` | Cart id | yes | 30 days | DOC-06.5 §2 |
| `nc_wishlist` | Saved product ids | no | 1 year | §3 |
| ~~`nc_recent`~~ | Recently viewed: **not a cookie**. The last 8 product ids are in `localStorage` under `nc_recent` and sent to `/recent?ids=` after hydration, so no cookie rides on every request | n/a | until cleared | DOC-06.4 §9 |
| `nc_dismissed` | Dismissed announcement ids | no | session | DOC-06.1 §3 |
| ~~`nc_flash`~~ | Not used: a refused no-JS form post comes back with the reason in the address (`?error=...`) of a private page | n/a | n/a | DOC-06.5 §2.1 |
| ~~`nc_locale`~~ | Not set yet: the language is the `/ur` prefix of the address, which is all a link or a cache needs | n/a | n/a | ADR-0018 |

All are first-party, `Secure`, `SameSite=Lax`. None is set on a cacheable (L or S) response: they are written by actions or by client script. Analytics cookies, if any, are defined in DOC-12 and require the consent rules there.

## 5. Rules

**Always:** keep customer-specific UI (wishlist state, counts) out of server HTML for cacheable pages; cap and validate every cookie value with a Zod schema when reading it.
**Never:** store names, phones, addresses or tokens in a readable cookie or in `localStorage`; build login or profile screens in v1; vary a cached response by cookie.
**Common mistakes:** rendering the pressed heart on the server for a cached listing; trusting ids from the cookie without the API filtering inactive products.

## 6. Acceptance checklist

- [x] Toggling a heart updates the header badge and every other heart for that product without a network request. (By hand in the browser pane: two hearts on `/new` pressed, the header read "Wishlist, 2 saved items", a third press took one away, and no request was made.)
- [x] `/wishlist` with a cookie containing an archived product id renders without it and rewrites the cookie. (`shell.server.test.js` with a stand-in API: an unknown id, text that is not an id and a repeat are left out and the `Set-Cookie` has only the live ids, not `HttpOnly`; by hand with the real API the cookie was rewritten to the one live id.)
- [x] A hand-edited cookie with 500 ids or non-id text is truncated/ignored without an error. (`wishlist.test.js`: 500 ids give the first 100, rubbish gives none, 100,000 rubbish pieces cost nothing; `shell.server.test.js`: 300 ids and `<script>,,;;,12` give a page, not an error. A cookie over about 16 kB never reaches the page: the server answers 431 at the HTTP level, which is what Node does for any header that large.)
- [x] With `features.wishlist` false, no heart, badge or `/wishlist` link is rendered and `/wishlist` returns 404. (`shell.server.test.js`, in the Urdu test, which is the one that sees a fresh shop configuration: no `aria-pressed` anywhere on the page, no `/ur/wishlist` link, and `/ur/wishlist` is a 404.)
- [x] No L or S response carries `Set-Cookie`. (The URL-map test of `shell.server.test.js` now checks every address whose cache class is public: none sets a cookie. The hearts of a cached page are drawn unpressed whatever cookie came with the request: tested on `/c/lawn`.)

## 7. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-06.7-1 | Customer accounts | None in v1 | Trigger in §2 |
| Q-06.7-2 | Marketing consent checkbox | Unchecked by default | Legal advice for Pakistan says otherwise |

## 8. Changelog

| Date | Change |
|---|---|
| 2026-10-07 | M5-08 built (`lib/wishlist.js`, `lib/browser-cookie.js`, `features/wishlist/*`, `routes/wishlist.jsx`). Notes: (1) The one reading of `nc_wishlist` is `parseWishlist`: ids that look like ids, once each, at most 100, never an error; the server and the browser both use it. The cookie is written by the browser (`Max-Age` a year, `SameSite=Lax`, `Secure` on https, never `HttpOnly`). (2) A heart on a card, the "Save" of the product page and the heart of the header (with its number) read the cookie through `useSyncExternalStore`, whose server answer is "nothing saved": a cached page is the same for everyone and the saved ones are marked after hydration. The announcement's `nc_dismissed` uses the same helpers (`browser-cookie.js`). (3) `/wishlist` asks the API for the ids in chunks of 48 (the most one answer gives; the plan said one call for 100), keeps the order they were saved in, and writes the cookie again when the shop no longer sells something in it. Taking a product away on this page works at once in the browser and needs JavaScript, like every change to the list. (4) A sold-out product's link says "Notify me" when the shop has back-in-stock messages on, and goes to its page. (5) The list of cookies in section 4 is corrected to what is built: three of its six are not cookies here (see the table). | 2026-10-02 | Initial version (Phase 2). Supersedes DOC-03 §6 wording "server when signed in" for the wishlist: v1 is cookie-only |
