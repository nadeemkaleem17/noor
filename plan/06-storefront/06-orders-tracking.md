# 06.6 — Storefront: Order Page and Tracking

| Field | Value |
|---|---|
| ID | DOC-06.6 |
| Title | Order confirmation, order status, track by number + phone, WhatsApp, review link |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-06.1, DOC-06.5, DOC-04b §6 |
| Decisions used | ADR-0012, ADR-0013, ADR-0017, ADR-0018, ADR-0020 |

## 1. Purpose and scope

**Governs:** `/orders/:token` (confirmation and live status) and `/track` (lookup), what a customer may do there, and the WhatsApp links.
**Does not govern:** order state machine and who may transition it (ADR-0020, DOC-09 orders, DOC-07 orders); notification templates and sending (DOC-12).

Fixes F-07: tracking today compares phone digits literally, uses sequential guessable numbers with no rate limit, and returns the full address.

## 2. Two ways in, one page

| Entry | How | Notes |
|---|---|---|
| Link with token | `/orders/:token`, sent in the confirmation SMS/WhatsApp/email and used as the post-checkout redirect | `trackingToken` is unguessable (≥ 128 bits, URL-safe). Possessing it shows the full order page |
| Lookup form | `/track`: order number + mobile number → `orders.track` → on match, 303 redirect to `/orders/:token` | The order number is public and sequential (`RB-10458`); the phone is the second factor |

There is **one** order page; `?placed=1` only switches the heading to the thank-you variant.

## 3. `/track`

```
┌──────────────────────────────┐
│ Track your order      (h1)   │
│ Order number  [RB-______]    │  accepts "nc-10458", "10458", "NC 10458"
│ Mobile number [03________]   │  PhoneInput; compared after normalising to +92…
│ [ Track order ]              │
│ Can't find it? WhatsApp us   │
└──────────────────────────────┘
```

| Rule | Detail |
|---|---|
| Normalisation | Order number: strip spaces, upper-case, add `RB-` if only digits. Phone: E.164 via `PkMobile` (so `0300…`, `300…`, `+92300…` all match) |
| No match | One generic message for every failure cause: "We couldn't find an order with that number and mobile number." (`order_not_found`). Never reveals which field was wrong |
| Rate limit | API returns `429` beyond 10 attempts per hour per IP or 5 per hour per order number (ADR-0012; DOC-11); UI: "Too many attempts. Try again in a few minutes or WhatsApp us" |
| No JS | Plain form post |
| Cache | `private, no-store`; `noindex` |

## 4. `/orders/:token`

```
┌──────────────────────────────────┐
│ ✓ Thank you, Ayesha!       (h1)  │  ?placed=1 variant; otherwise "Order RB-10458"
│ Order RB-10458 · 2 Oct 2026      │
│ ┌──────────────────────────────┐ │
│ │ We'll call or WhatsApp you   │ │  next-step panel, by status (§4.2)
│ │ on 0300 ••••567 to confirm.  │ │
│ └──────────────────────────────┘ │
│ ● Placed      2 Oct, 3:45 pm     │  timeline
│ ○ Confirmed                      │
│ ○ Dispatched                     │
│ ○ Delivered                      │
│ Items                            │
│ ┌──┐ Lawn 3-Piece · M  ×1  6,990 │
│ Subtotal 6,990 · Shipping 250    │
│ Total Rs. 7,240 · Cash on delivery│
│ Delivering to                    │
│ Ayesha K. · Lahore · House 12 ••• │
│ [WhatsApp us about this order]   │
│ [Cancel order]                   │
└──────────────────────────────────┘
```

### 4.1 Data shown (`orders.getByToken` → `OrderPublic`)

| Shown | Not shown / masked |
|---|---|
| Order number, placed date, status, timeline with timestamps | `internalNotes`, staff names, audit events |
| Lines: image, title, option labels, custom-size summary, quantity, unit price, line total | Cost, SKU |
| Subtotal, discount (+ promo code), shipping, total, deposit paid/due | — |
| Payment method and payment status | Provider references |
| Customer first name + last initial; city; address with everything after the first 12 characters masked; phone as `0300 ••••567` | Full name, full address, full phone, email |
| Courier name, tracking number, courier tracking link (when the courier has a URL pattern, DOC-12) | — |
| Estimated delivery window (from the shipping method's `etaDays`, counted from dispatch; before dispatch, from confirmation) | — |

Masking is done by the API in `OrderPublic` (the storefront never receives the full values). Money is rendered as received.

### 4.2 Status → timeline and next-step panel

| Order status | Timeline step active | Panel text (message key `order.next.<status>`) |
|---|---|---|
| `pending` (awaiting online payment or bank transfer) | Placed | Online: "Complete your payment to confirm this order" + [Pay now]. Bank transfer: account details + "Send the receipt on WhatsApp" |
| `pending_confirmation` | Placed | "We'll call or WhatsApp you on <masked phone> to confirm your order." With a deposit due: adds the deposit amount |
| `confirmed` | Confirmed | "Your order is being prepared." Made-to-order: "Your piece is being made: ready in about N days" |
| `dispatched` | Dispatched | "On its way with <courier>. Tracking no. <n>" + [Track with courier] + ETA; COD: "Please keep Rs. X ready" |
| `delivered` | Delivered | "Delivered on <date>." + [Write a review] per line (§6) + return policy link |
| `cancelled` | — (timeline replaced by a `danger-soft` banner) | "This order was cancelled on <date>." + reason when present + refund note when a payment was captured |
| `returned` | — (banner) | "This order was returned." + refund note |

Statuses and labels render through `StatusBadge` (DOC-04b §6). The four-step timeline is a list (`<ol>`) with the current step marked `aria-current="step"`.

### 4.3 Customer actions

| Action | Available when | Behaviour |
|---|---|---|
| Cancel order | Status `pending` or `pending_confirmation` | `ConfirmDialog` ("Cancel order RB-10458?") → `orders.cancelByToken`; page revalidates. Any later status: the button is replaced by "Need to cancel? WhatsApp us" |
| Pay now / try payment again | Status `pending` with an online method | Creates a new payment session (DOC-12) and redirects |
| Switch to cash on delivery | Status `pending`, COD allowed for this order | `orders.switchToCod` → status `pending_confirmation` |
| WhatsApp us | Always | §5 |
| Print / save | Always | A print stylesheet hides header, footer and buttons; no PDF generation in v1 |

No address or item editing by the customer in v1 (they use WhatsApp; staff edit in the admin).

### 4.4 Freshness

`private, no-store`, `noindex`. The loader always fetches from the API. While the status is not final the page revalidates when the tab regains focus and every 60 s while visible (`useRevalidator`); no websockets.

## 5. WhatsApp links

`https://wa.me/<StoreConfig.contact.whatsapp digits>?text=<encoded message>`; number in E.164 digits without `+` (GLOSSARY). Messages are message keys with ICU variables, per locale (ADR-0018):

| Context | Key | English template |
|---|---|---|
| Floating button, generic pages | `wa.generic` | `Hi, I have a question.` |
| PDP | `wa.product` | `Hi, I have a question about {title} ({url})` |
| Order page | `wa.order` | `Hi, this is about my order {orderNo}.` |
| City not served | `wa.city` | `Hi, do you deliver to {city}?` |
| Zero search results | `wa.search` | `Hi, I'm looking for {query}.` |

Only the order number goes in an order message, never the token, phone or address. The link opens in a new tab with `rel="noopener noreferrer"`. If `contact.whatsapp` is empty, every WhatsApp control is omitted.

## 6. Review link

After `delivered`, the API issues a per-line review token (in the delivery notification and on the order page as [Write a review]). `/orders/:token/review/:lineId` is a small form: rating 1–5 (required), fit (`runs_small` / `true_to_size` / `runs_large`, for sized products), title (optional), body (20–1,000 characters), up to 3 photos, display name (prefilled first name). Submits to `reviews.createForOrderLine`; status starts `pending` (moderated in the admin, DOC-07 reviews). One review per order line; after submission the button reads "Review submitted". The route is added to DOC-06.1 §2 as `orders/:token/review/:lineId` (P class, `noindex`) when `features.reviews` is on.

## 7. Rules

**Always:** treat the token as the credential and the order number as public; show the same generic message for every lookup failure; render status from the API on every load.
**Never:** put the token, phone, name or address in a URL query, an analytics event, a log line or a WhatsApp message; show unmasked personal data on the order page; decide what actions are allowed in the client (the API returns `allowedActions[]`; the UI only reflects it).
**Common mistakes:** reading payment success from the return URL; caching the order page; linking the order number as if it were secret.

## 8. Acceptance checklist

- [x] `/track` finds an order with the phone typed as `0300…`, `300…` and `+92 300…`. (`shell.server.test.js`, with the order number as `rb-10458`, `10458` and `NC 10458`; by hand with the real API: `10002` with `0300 1234567`, `nc 10003` with `+92 300 1234567`.)
- [x] Wrong phone and wrong order number produce the identical response body and status. (Same status and the same sentence for a wrong phone, a wrong number and nonsense, in the test and in the browser. The page is not byte-identical: it gives back what was typed, so a mistyped digit is not typed again.)
- [x] The sixth lookup for one order number within an hour shows the rate-limit message. (The API's `429` is shown as "Too many attempts. Try again in a few minutes or WhatsApp us" (`shell.server.test.js`). Against the real API the per-IP limit was reached while testing, and the same message showed on seven tries in a row; the exact sixth try was not counted.)
- [x] The HTML of `/orders/:token` contains no full phone number, full address or email. (`shell.server.test.js` checks the order page's main content for the full phone; the API sends only `phoneMasked`, `addressMasked` and the first name, so the page cannot hold more. By hand: "0300 ••••567", "Flat 5, Bloc•••".)
- [x] Cancel is offered only in `pending` and `pending_confirmation`, and a cancelled order shows the banner after revalidation. (The page offers what `allowedActions` lists, and "Need to cancel? WhatsApp us" otherwise: `shell.server.test.js` per status. By hand with the real API: the dialog, the confirm, and the banner "This order was cancelled" after the page was read again.)
- [x] Each status in §4.2 has a test of the order page with its panel. (Changed from "a Storybook story": the storefront has no Storybook, the workshop is `@noor/ui`'s. `shell.server.test.js` renders the page for `pending`, `pending_confirmation`, `confirmed`, `dispatched`, `delivered` and `cancelled` and checks each panel. `returned` has the same banner as `cancelled` and no test of its own.)
- [x] Response headers: `Cache-Control: private, no-store`, `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer` on `/orders/*` (the token must not leak through `Referer`). (`shell.server.test.js`; `X-Robots-Tag: noindex` is also sent for `/track`, `/cart` and `/checkout`, and `/ur/orders/` gets the same `no-referrer`.)

## 9. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-06.6-1 | Customer cancellation window | Until staff confirm the order | Owner wants a time limit instead |
| Q-06.6-2 | Courier tracking URLs | Pattern per courier defined in DOC-12 | DOC-12 |
| Q-06.6-3 | `allowedActions[]` on `OrderPublic` | Provided by the API | DOC-10 orders |
| Q-06.6-4 | Returns/exchange request form | Not in v1 (via WhatsApp) | More than 20 return requests a week |

## 10. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 2) |
| 2026-10-02 | Rate limits aligned with ADR-0012; order prefix `RB-` (README A-10) |
| 2026-10-07 | M5-07 built (`routes/{order,track,order-review,review-photo}`, `lib/orders.server.js`, `lib/order-number.js`, `features/order/*`). Notes: (1) The order page reads the order on every visit, shows what the API sent (already masked) and offers what `allowedActions` lists; while the order is not final it asks again every minute and when the tab comes back. Cancel is a `ConfirmDialog` with JavaScript and a fold-out with a button without it. (2) "Pay now" and "try payment again" are not built: no online payment method is enabled and the API has no route to start a new payment session yet; the page shows the bank-transfer details when the API sends them. "Switch to cash on delivery" is built and shown when `allowedActions` has it, and was not tried (no order of that kind exists locally). (3) A cancel reason is shown only for the reasons that are the customer's business (their own request, unreachable, duplicate, out of stock, payment expired). (4) The lookup normalises the order number (`RB-`, digits alone, `NC`, spaces, case) and the phone (`PkMobile`) in the storefront server; the API's answers are told apart only for "too many tries". (5) The review form is checked with the contract's `ReviewInput` before the API is asked; pictures (JavaScript only) are sent to `/orders/:token/review/:lineId/photo` of the storefront, which asks the API for a slot and puts the bytes there itself, so the browser never talks to the storage host and the CSP stays `connect-src 'self'`. A file above 5 MB is refused in the browser, and on the server before it is read. (6) **API change:** the local storage driver's signed upload link refused every PUT without the admin's `Origin`, which would have blocked the storefront's server; with no `Origin` (no browser) the signature alone now decides (`security.js`, tested in `media.int.test.js`). With S3 the question does not arise. (7) After the review is sent the visitor returns to the order page with a thank-you line. (8) Print: the order page has a print button and `print:` styles that hide the actions; the header and footer are not hidden yet (the shell is not print-aware). |
| 2026-10-02 | Phase 5 part 2: route keys, parameter names and error codes in this document are provisional where they differ from DOC-10; DOC-10 is authoritative and Phase 7 reconciles the names |
