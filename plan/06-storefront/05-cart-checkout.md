# 06.5 — Storefront: Cart and Checkout

| Field | Value |
|---|---|
| ID | DOC-06.5 |
| Title | Server cart, cart drawer and page, promo codes, guest checkout, placing an order |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-06.1, DOC-06.4 §8, DOC-04c §3, DOC-05 §3, §9, README (A-06) |
| Decisions used | ADR-0012, ADR-0013, ADR-0015, ADR-0017, ADR-0020 |

## 1. Purpose and scope

**Governs:** everything between "Add to cart" and the redirect to the order page: the `/cart` route and its actions, the cart drawer, promo entry, the checkout form, payment-method choice, error handling and the idempotent order submission.
**Does not govern:** how totals, promos, shipping and stock are computed (ADR-0020, DOC-09, DOC-10); payment-provider flows (DOC-12); the order page (DOC-06.6).

Fixes K4, K11, F-01, F-02, F-05, F-06, F-08 on the client side: the browser no longer holds the cart, computes totals, validates promos or sends money fields.

**Why the flow is built around COD.** Published 2026 figures for Pakistan put COD at roughly 70% to 95% of orders, fashion COD refusal/return rates at 18–25%, and most COD cancellations at the confirmation stage before dispatch (sources in DOC-02 §4; secondary, vendor-published). So: COD is the default method, the phone number is validated strictly, and every COD order enters `pending_confirmation` (ADR-0017) with the customer told what happens next.

## 2. The cart is on the server

| Item | Rule |
|---|---|
| Identity | Cookie `nc_cart` = the cart token (random, unguessable; the API stores only its hash, DOC-09.6 §2.1) which the storefront server forwards as `X-Cart-Token`. `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000` (30 days). Created by the first `add` action, never by a page view |
| Source of truth | The API. Every cart response is the full `Cart`: `lines[]` (variant, title, option labels, image, unit price, quantity, line total, `available`, `issues[]`), `promo?`, `subtotal`, `discount`, `shipping?`, `total`, `depositDue?`, `messages[]` |
| Line identity | `variantId` + a hash of `customization`. Adding the same pair again increases quantity; a different customisation is a new line (fixes the `productId__size` key, F-08) |
| Limits | 50 lines; per line `maxPerOrder`; quantity capped at `available` |
| Expiry | Carts untouched for 30 days are deleted by a job (DOC-08); an expired or unknown cookie yields an empty cart and a fresh cookie on next add |
| Client state | Zustand holds only `drawerOpen`. Quantities shown optimistically via `useOptimistic` (DOC-05 §9) |

### 2.1 `/cart` route

`loader` returns the cart (`private, no-store`). With `?summary=1` it returns only `{ count }` for the header badge (DOC-06.1 §3).

`action` handles one `intent` per request; each calls one API route and returns the new `Cart`, so every UI showing the cart revalidates from the same response:

| `intent` | Fields | Provisional route key | Errors (stable codes) |
|---|---|---|---|
| `add` | `variantId`, `quantity`, `customization?` | `cart.addLine` | `insufficient_stock`, `variant_unavailable`, `max_per_order`, `cart_full` |
| `setQty` | `lineId`, `quantity` (0 removes) | `cart.setLineQuantity` | `insufficient_stock`, `max_per_order` |
| `remove` | `lineId` | `cart.removeLine` | — |
| `applyPromo` | `code` | `cart.applyPromo` | `promo_not_found`, `promo_expired`, `promo_not_started`, `promo_min_spend` (with `minSpend`), `promo_usage_limit`, `promo_not_applicable` |
| `removePromo` | — | `cart.removePromo` | — |

Without JavaScript each action redirects back to `/cart` (POST-redirect-GET) and errors are shown from a flash cookie.

## 3. Cart drawer and cart page

Same components (`features/cart/components/CartLines.tsx`, `CartSummary.tsx`) in two containers: the drawer (`Drawer side="bottom"` under `md`, `side="end"` from `md`) and `/cart`.

| Element | Rule |
|---|---|
| Line | Image (links to PDP), title, option labels ("Size M"), custom-size summary or bundle children, unit `Price`, `QuantityStepper`, line total, Remove (`IconButton`, label "Remove <title>") |
| Line issues | From `line.issues[]`, shown on the line in `text-warning`: `price_changed` ("Price updated to Rs. X"), `low_stock` ("Only N left"), `sold_out` ("Sold out: remove to continue"), `unavailable` (product unpublished) |
| Removal | Immediate (optimistic) with a toast "Removed <title>" and an **Undo** action that re-adds the same variant, quantity and customisation |
| Promo | Collapsed "Have a promo code?" → input + Apply. Applied: chip "EID10 −Rs. 699 ✕". Errors inline under the input, mapped from the codes above. One code per cart |
| Summary | Subtotal, Discount (if any), Shipping ("Calculated at checkout" until a city is known; then the fee or "Free"), **Total**. Under it: free-delivery progress ("Add Rs. 1,010 more for free delivery") from `cart.messages` |
| Deposit note | When `depositDue` exists: "Made-to-order items need a deposit of Rs. X" |
| Checkout button | Primary, full width; disabled only when a line has a blocking issue (`sold_out`, `unavailable`), with the reason stated above it |
| Empty | `EmptyState` + "Continue shopping" → `/new` |
| Drawer footer | Total + "Checkout" + "View cart" link |

Totals and line totals come only from the `Cart` response. While an action is pending they render at 60% opacity; nothing is recomputed locally.

## 4. Checkout (`/checkout`)

Guest checkout, one page, no account (ADR-0012). An empty cart redirects to `/cart`.

```
360 px
┌──────────────────────────────┐
│ ←  Checkout          🔒      │  minimal header: logo, back to cart; no menu, no WhatsApp float
│ ▸ Order summary  Rs. 7,240   │  collapsible on mobile; open sidebar from lg
│ 1 Contact                    │
│   Full name      [_________] │
│   Mobile number  [03xx_____] │  "We'll confirm your order on this number"
│   Email (optional)[________] │
│ 2 Delivery                   │
│   City           [Lahore  ▾] │  Combobox over delivery cities
│   Address        [_________] │
│   Nearest landmark (optional)│
│   Delivery notes (optional)  │
│   ◉ Standard 3–5 days Rs.250 │  methods of the city's zone
│   ○ Express 1–2 days  Rs.450 │
│ 3 Payment                    │
│   ◉ Cash on delivery         │
│   ○ Bank transfer            │
│   ○ JazzCash / Easypaisa/Card│  only methods enabled in StoreConfig.payments
│ Subtotal            Rs. 6,990│
│ Shipping              Rs. 250│
│ Total               Rs. 7,240│
│ [ Place order ]              │
│ By placing the order you     │
│ agree to our terms & returns │
└──────────────────────────────┘
```

### 4.1 Fields

Schema: `CreateOrderBody` from `@noor/contract` (DOC-10.3 §3; it has no cart field, the cart comes from the cookie). Extra fields configured by staff in `StoreConfig.checkout.fields` (a `FormSchema`) render after "Delivery notes" and are sent as `customFields`.

| Field | Required | Validation (error code) | Notes |
|---|---|---|---|
| `customer.name` | yes | 2–80 characters (`name_invalid`) | `autoComplete="name"` |
| `customer.phone` | yes | Pakistani mobile: normalises to `+923XXXXXXXXX` (`phone_invalid`) | `PhoneInput`; hint "We'll confirm your order on this number" |
| `customer.email` | no | Email format (`email_invalid`) | Hint "For your order receipt" |
| `shippingAddress.cityId` | yes | Must be in the delivery city list (`city_not_served`) | `Combobox`; cities = union of `StoreConfig.shipping.zones[].cities`, alphabetical, major cities first. Pakistan only (A-06); no country field |
| `shippingAddress.address` | yes | 10–250 characters (`address_too_short`) | `autoComplete="street-address"`; hint "House, street, area" |
| `shippingAddress.landmark` | no | ≤ 120 | |
| `shippingAddress.notes` | no | ≤ 250 | |
| `shippingMethodId` | yes | One of the zone's methods | Preselected: the cheapest |
| `paymentMethod` | yes | Enabled and allowed for this cart | Preselected: `cod` when allowed |

City not in the list: the combobox shows "We don't deliver to "<text>" yet" with the WhatsApp link; the form cannot be submitted with it.

### 4.2 Live totals

Choosing a city or shipping method submits `intent=quote` to the `/checkout` action (`cart.quote` with `{ city, shippingMethodId, paymentMethod }`), which returns the `Cart` with `shipping`, `total`, the zone's `methods[]` and `paymentOptions[]`. The summary shows the pending style while it loads. The place-order button is enabled as soon as the form is valid; the server re-prices at order creation regardless.

### 4.3 Payment methods

`paymentOptions[]` from the quote lists each enabled method with `allowed` and, when not allowed, a `reason` code.

| Method | Shown as | Rules surfaced in the UI |
|---|---|---|
| `cod` | "Cash on delivery: pay when your order arrives" | Not allowed above `StoreConfig.shipping.codLimit` (`cod_limit_exceeded`: "Orders above Rs. X need advance payment"); not allowed as the only payment when a deposit is due |
| `bank_transfer` | "Bank transfer: we'll send account details on WhatsApp" | Order waits in `pending` until staff record the payment |
| `wallet`, `card` | Provider names from `StoreConfig.payments[].label` | After the order is created the browser is redirected to the provider's hosted page (ADR-0017); details in DOC-12 |
| `bnpl` | Label from config | Hidden unless enabled |

A disallowed method is shown disabled with its reason, not hidden. A method that is not **enabled** in `StoreConfig.payments` is not rendered at all; at launch only `cod` is enabled (README A-07), so the wireframe’s other options do not appear and an order above `codLimit` shows the WhatsApp contact instead. If no method is allowed, the page shows an `ErrorState` with the WhatsApp link.

**Deposit (made-to-order):** when `depositDue` exists the payment section says "Deposit of Rs. X now, Rs. Y on delivery". With a prepaid method enabled the deposit is collected through it. With only COD enabled the order is placed and the page states "We'll contact you on WhatsApp to arrange the deposit before we start"; the order stays in `pending_confirmation` until staff confirm it (DOC-07 orders).

### 4.4 Placing the order

1. On first render of `/checkout` the client creates an **idempotency key** (`crypto.randomUUID()`) in `sessionStorage` under `nc_checkout_key`. It is reused for every retry of this checkout and replaced only after a successful order or when the cart contents change.
2. Submit → `/checkout` action `intent=place` → `orders.create` with header `Idempotency-Key` and header `X-Cart-Token` (from the cookie) and body `{ customer, shippingAddress: { cityId, … }, shippingMethodId, paymentMethod, customFields, marketingConsent, locale, expectedTotal }`. **No money fields.**
3. The button shows `loading` and the form is inert until the response; a double tap cannot send twice, and if it does the key makes the second request return the first result.
4. Response handling:

| Result | UI |
|---|---|
| `201` with `{ trackingToken, payment? }` | Clear `nc_cart` cookie and `nc_checkout_key`. COD/bank transfer: redirect to `/orders/:token?placed=1`. Online: redirect to `payment.redirectUrl` |
| `409 price_changed` / `insufficient_stock` / `promo_invalid` (body carries the new `Cart`) | Stay on the page; summary replaced; a `danger-soft` panel above the button lists what changed ("Lawn 3-Piece is now Rs. 7,490", "Only 1 Teal M left: quantity updated", "Promo EID10 no longer applies"); the customer presses "Place order" again. New idempotency key |
| `422` field issues | Mapped to fields (DOC-05 §3); first invalid field focused |
| `422 city_not_served`, `payment_method_not_allowed` | Inline at that section |
| `429` | Inline "Too many attempts. Please wait a minute" |
| Timeout (20 s) or network error | Inline `ErrorState`: "We couldn't confirm your order. Please try again: you will not be charged twice." Retry reuses the same key |
| `5xx` | Same as timeout |

### 4.5 Draft

Field values (not payment data) are saved to `sessionStorage` key `nc_checkout_draft` on blur and restored on load, so a refresh or a return from the cart keeps them. Cleared on success.

### 4.6 Returning from an online payment

The provider redirects to `/orders/:token?payment=return`. The order page (DOC-06.6) shows the payment state from the API, never from the query string. A failed or abandoned payment offers "Try payment again" and "Switch to cash on delivery" (when allowed).

## 5. Rules

**Always:** show money exactly as returned by the API; send the idempotency key on every `orders.create`; keep the customer's input on any error; tell COD customers they will be contacted to confirm.
**Never:** compute subtotal, discount, shipping, deposit or total in the browser; send `total`, `discount`, `shippingFee` or a unit price; validate a promo locally; store the cart, the address or the phone in `localStorage`; ask for an account.
**Common mistakes:** generating a new idempotency key per click; clearing the form on a 409; hiding COD silently when over the limit; hard-coding a city list or a shipping fee (F-05).

## 6. Acceptance checklist

- [x] `grep -rnE "subtotal|total" apps/storefront/app/features/{cart,checkout}` shows no arithmetic on money (only reads of API fields). (Cart half, by hand: `features/cart` only reads `cart.subtotal`, `cart.discount`, `cart.total` and the line fields, and compares `discount.amount > 0` and `shipping.fee.amount === 0` to decide what to show. `features/checkout` does not exist yet: M5-06.) (Checkout half, M5-06: `features/checkout` reads `cart.subtotal`, `cart.discount`, `cart.total`, `shipping.fee`, `depositDue`, `dueOnDelivery` and the line totals, compares `discount.amount > 0` and `fee.amount === 0`, and hands back `cart.total.amount` as `expectedTotal`, the total that was shown. No sum, product or difference of money.)
- [x] Two rapid submits create one order (same `Idempotency-Key`), verified against the API. (By hand against the real API: two simultaneous posts of one checkout with one key made one order (2 to 3 orders in the local database); the second answer was "We could not confirm your order, try again" because the API said `request_in_progress`, and the retry with the same key gets the first order. Not with a real double tap in a browser.)
- [x] A 409 `price_changed` keeps all field values and shows the changed line. (`shell.server.test.js` against a stand-in API that sends the new cart with its refusal: the page stays, the fields are kept, the summary has the new total, the panel lists what changed from the lines' own `issues`, and the next press uses a new key. Not tried with a real price change.)
- [x] A promo with unmet minimum spend shows the `promo_min_spend` message with the amount. (`shell.server.test.js`: the API's `promo_min_spend` with `minSpend` gives "Spend at least Rs 5,000 to use this code."; the other promo errors have their own words in `cart.promo.*`. By hand with the real API: an unknown code shows "We do not know this code." No promo code exists in the demo data, so a code that applies was not tried against the real API, only against the stand-in.)
- [x] Phone `0300 1234567`, `3001234567`, `+92 300 1234567` all submit as `+923001234567`; `051 1234567` is rejected. (`shell.server.test.js`: all three reach the API as `+923001234567`; `051 1234567` is refused on the page with the message, and nothing is sent. The phone is checked with the contract's own `CreateOrderBody` and `PkMobile`, in the storefront server, before the API call. By hand: `0300 1234567` and `3001234567` made real orders.)
- [x] Choosing a city updates shipping and total from the server; a city outside every zone blocks submission. (By hand with the real API: choosing Lahore asked `cart.quote`, the delivery method and a "Free" shipping line appeared (Rs 6,990 is over the free-delivery line) and the total came back from the server. A city with no zone shows "We do not deliver to this city yet." with the WhatsApp link and no method to choose, and the order is refused for the missing method: `shell.server.test.js`.)
- [x] Cart and checkout work with JavaScript disabled (add, change quantity, apply promo, place a COD order). (Cart half done in M5-04 and M5-05: add, change a quantity, remove, apply and remove a promo all work as plain forms that redirect back to `/cart` (`shell.server.test.js`, not with a browser that has JavaScript off). Placing an order is M5-06.) Checkout half (M5-06): the whole page is an ordinary form: "Show delivery options" asks for the quote and "Place order" sends the order, each a plain post (`shell.server.test.js`); not tried in a browser with JavaScript off. The item stays open for that. (E2E-02 buys with JavaScript off: add, checkout and place a cash-on-delivery order.)
- [x] After a successful order, reloading `/checkout` redirects to `/cart` (empty). (An order clears the `nc_cart` cookie, so the next `/checkout` is an empty cart and goes to `/cart`: `shell.server.test.js` for the redirect and the cookie, and by hand.)
- [x] `/cart` and `/checkout` responses are `private, no-store`. (`/cart`, its actions and `?summary=1`: `shell.server.test.js`. `/checkout` is M5-06; its placeholder already sends the same header.)

## 7. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-06.5-1 | Payment methods live at launch | **Answered (README A-07): cash on delivery only.** The payment section shows the single COD option (no radio group when one method is enabled). Other methods render when enabled in `StoreConfig.payments` | Owner obtains a merchant account |
| Q-06.5-2 | Market | Pakistan only (A-06): no country field, PK mobile numbers only | International orders wanted |
| Q-06.5-3 | One promo code per cart | Yes | Owner wants stacking → ADR-0020 §2 rules |
| Q-06.5-4 | OTP on the phone number before placing a COD order | Not in v1; confirmation is by staff/WhatsApp after the order | COD refusal rate above 20% after launch → add SMS OTP (DOC-12) |
| Q-06.5-5 | Route keys and error codes | Provisional | DOC-10 cart and orders |

## 8. Changelog

| Date | Change |
|---|---|
| 2026-10-07 | M5-06 built (`routes/checkout.jsx`, `lib/checkout.server.js`, `features/checkout/*`, `features/layout/checkout-header.jsx`). Notes: (1) The page is one form posting to its own route: `intent=quote` (the cart priced for the city and method: `cart.quote`) and `intent=place` (`orders.create`). With JavaScript a change of city or delivery method asks for the quote on its own through a fetcher; without it a "Show delivery options" button does. The visitor's typing is kept in both cases. (2) The fields are checked with `CreateOrderBody` of the contract in the storefront server before the API is asked, and each issue is written beside its field; the API's own answers (price changed, stock, promo, payment not allowed, city not served, too many tries, cannot confirm) have their own panel. A refusal that carries the cart (409) shows what changed from the lines' `issues` and gets a new key. (3) The key of a checkout is made by the server for each page load and kept in `sessionStorage` (`nc_checkout_key`) together with the cart's id and contents; it is used again only for the same cart, and it is forgotten when the order is placed (the visitor is leaving for the order page) and when the cart is seen empty. The contact and address are kept in `nc_checkout_draft` the same way. (4) The city is a native select (the big cities first, then A to Z), not a `Combobox`: a phone's own picker is what a visitor wants, and it needs no script. (5) `expectedTotal` is the total shown, sent so the API refuses with `price_changed` if it moved. (6) The checkout has a header of its own (back to cart, logo, "Secure") and no footer, menu or chat button. (7) Placing an order clears the cart cookie and goes to `/orders/<token>?placed=1` (or to the payment provider's address when there is one); the order page itself is M5-07. (8) **Two bugs found and fixed on the way:** the clean-URL rule lower-cased the whole path, which would have changed an order's token (it is case-sensitive), and every redirect made inside a loader carried the router's `.data` suffix, so a client navigation that was redirected ended on a `.data` address; `pagePath()` removes the suffix and an order link keeps its case. | 2026-10-07 | M5-05 built (`routes/cart.jsx`, `lib/cart.server.js`, `features/cart/*`). Notes: (1) The cart page, the drawer and the product page share `CartLines` and `CartSummary`; the drawer (`Drawer`, bottom sheet under `md`) is opened by the header's cart link and by a successful add, and reads `/cart` through a fetcher when it opens; the router reads it again after every action. No Zustand: the open state is a small React context in the shell. (2) The header badge is a fetcher on `/cart?summary=1`, asked for after hydration, so the page holds nothing of a visitor. (3) Optimistic UI is the fetcher's own pending form data: the quantity shows the new number and a removed line disappears at once, while the totals stay as they were, dimmed, until the API answers. (4) Removing shows a toast with "Undo", which adds the same variant, quantity and customisation (the `customization` field of the add form carries it as JSON; the API checks it like any other). The toast is shown when the click is made, not when the API has answered. (5) Without JavaScript each action is a form post that redirects back to `/cart`; a failure is in the address (`?error=<code>&n=&amount=`), not in a flash cookie, because the page is private and these carry no personal data. (6) Promo messages: one per API code, `promo_min_spend` with the amount. (7) A line that cannot be bought (`sold_out`, `unavailable`) turns "Checkout" into a disabled button with the reason; `price_changed` and `low_stock` are shown on the line. (8) Prices are drawn with the shop's `priceDisplay` (`ShopPrice`). (9) Not built: a flash cookie, the cart drawer's own promo box (promo is on the page), free-delivery progress as a bar (it is the API's sentence). |
| 2026-10-02 | Initial version (Phase 2) |
| 2026-10-02 | Owner answer: COD only at launch (A-07); other methods stay specified but disabled |
| 2026-10-02 | Phase 5 part 2: route keys, parameter names and error codes in this document are provisional where they differ from DOC-10; DOC-10 is authoritative and Phase 7 reconciles the names |
| 2026-10-02 | Phase 7 consistency review: cart token and order body match DOC-10.3 (no `cartId`; `cityId`; `expectedTotal` guard) |
