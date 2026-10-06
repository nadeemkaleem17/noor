# 10.3 — API: Cart, Checkout and Orders (public)

| Field | Value |
|---|---|
| ID | DOC-10.3 |
| Title | Cart, quote, order creation, order by token, tracking, customer order actions, review submission |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-10.0, DOC-09.4, DOC-09.6, DOC-09.7, DOC-09.8, DOC-06.5, DOC-06.6 |
| Decisions used | ADR-0012, ADR-0013, ADR-0014, ADR-0017, ADR-0020 |

## 1. Purpose and scope

**Governs:** the customer-facing write path: everything the storefront's `/cart`, `/checkout` and `/orders/:token` routes call.
**Does not govern:** pricing rules (DOC-09.6 §4), the state machine (DOC-09.7 §5), screens (DOC-06.5, 06.6).

All responses here: `Cache-Control: private, no-store`. No endpoint accepts a price, discount, fee or total.

## 2. Cart endpoints (auth `cart`, bucket `cart`)

| Key | Method & path | Request | Response | Errors | Notes |
|---|---|---|---|---|---|
| `cart.get` | `GET /cart` | Q: `summary?: 1`, `locale?` | 200 `Cart` (or `{ count: int }` with `summary=1`) | — | No token or unknown token → empty cart, no cart is created |
| `cart.addLine` | `POST /cart/lines` | B: `{ variantId: Id, quantity: int (1–99), customization?: LineCustomization }` | 200 `Cart` (+ `cartToken` when a cart was just created) | `variant_unavailable`, `insufficient_stock`, `max_per_order`, `cart_full`, `validation_failed` (customisation does not match the product's form schema) | Creates the cart when there is no valid token. Same variant + same customisation → quantity added to the existing line |
| `cart.setLineQuantity` | `PUT /cart/lines/:lineId` | B: `{ quantity: int (0–99) }` | 200 `Cart` | `not_found`, `insufficient_stock`, `max_per_order` | `0` removes the line |
| `cart.removeLine` | `DELETE /cart/lines/:lineId` | — | 200 `Cart` | `not_found` | |
| `cart.applyPromo` | `PUT /cart/promo` | B: `{ code: string }` | 200 `Cart` | `promo_*` (DOC-10.0 §6.2) | Code is trimmed and upper-cased. One code per cart: replaces the previous one |
| `cart.removePromo` | `DELETE /cart/promo` | — | 200 `Cart` | — | |
| `cart.quote` | `POST /cart/quote` | B: `QuoteBody` | 200 `Cart` (with `shipping`, `shippingOptions`, `paymentOptions`, `total`) | `cart_empty`, `city_not_served`, `shipping_method_invalid` | Read-only: writes nothing except `seen_unit_price_minor` |

```ts
LineCustomization = { measurements?: Record<string, string | number>, notes?: string /* ≤ 500 */,
                      bundle?: { productId: Id, variantId: Id }[] }

QuoteBody = { cityId: Id, shippingMethodId?: Id, paymentMethod?: PaymentMethod, phone?: PkMobile }
// phone, when given, lets the quote apply per-customer promo limits and the customer's no-COD flag early

Cart = {
  id?: Id, cartToken?: string,                    // cartToken only in the response that created the cart
  lines: CartLine[],
  count: int,                                     // sum of quantities
  promo?: { code: string, label: string, discount: Money },
  subtotal: Money, discount: Money,
  shipping?: { methodId: Id, label: string, fee: Money, etaMinDays: int, etaMaxDays: int },   // only after a quote
  total: Money,                                   // subtotal − discount (+ shipping when quoted)
  depositDue?: Money, dueOnDelivery?: Money,
  shippingOptions?: { methodId: Id, label: string, fee: Money, etaMinDays: int, etaMaxDays: int, codAllowed: boolean }[],
  paymentOptions?: { method: PaymentMethod, label: string, description?: string, allowed: boolean,
                     reason?: 'cod_limit_exceeded' | 'cod_not_available' | 'deposit_requires_prepayment' }[],
  messages: { code: 'free_shipping_remaining' | 'free_shipping_applied', amount?: Money }[],
  hasBlockingIssues: boolean,                     // any line sold_out or unavailable
}

CartLine = {
  id: Id, productId: Id, variantId: Id, handle: string, title: string, variantLabel: string,
  image: Image, kind: ProductKind,
  quantity: int, unitPrice: Money, compareAt?: Money, lineSubtotal: Money, lineDiscount: Money,
  available?: int, maxPerOrder: int,
  customization?: LineCustomization & { summary?: string },        // summary: human text of measurements / bundle choices
  madeToOrder?: { leadMinDays: int, leadMaxDays: int, depositPercent?: number },
  issues: ('price_changed' | 'low_stock' | 'sold_out' | 'unavailable')[],
  previousUnitPrice?: Money,                      // with price_changed
}
```

## 3. Order creation

| Key | Method & path | Auth | Request | Response | Errors | Notes |
|---|---|---|---|---|---|---|
| `orders.create` | `POST /orders` | `cart` | Header `Idempotency-Key` (required); B: `CreateOrderBody` | 201 `OrderCreated` | `cart_empty`, `cart_has_issues`, `price_changed`, `insufficient_stock`, `promo_invalid`, `city_not_served`, `shipping_method_invalid`, `payment_method_not_allowed`, `validation_failed` | Bucket `checkout`. Idempotent (DOC-10.0 §8). One transaction (DOC-08 §7). On success the cart is deleted |

```ts
CreateOrderBody = {                                // strict: any money field is a 400
  customer: { name: string /* 2–80 */, phone: PkMobile, email?: string },
  shippingAddress: { cityId: Id, address: string /* 10–250 */, landmark?: string /* ≤ 120 */, notes?: string /* ≤ 250 */ },
  shippingMethodId: Id,
  paymentMethod: PaymentMethod,
  customFields?: Record<string, string | number | boolean>,       // validated against checkout.extraFields
  marketingConsent?: boolean,
  locale?: 'en' | 'ur',
  expectedTotal?: Money,                           // optional guard: the total the customer saw. NOT used as a price:
                                                   // if it differs from the server total the response is 409 price_changed
}

OrderCreated = {
  orderNumber: string,                             // "RB-10458"
  trackingToken: string,                           // returned only here and in notifications
  status: OrderStatus,                             // pending_confirmation (COD) or pending (prepaid)
  total: Money,
  payment?: { redirectUrl?: string, instructions?: string },     // prepaid methods (DOC-12)
}
```

The cart is read from the `X-Cart-Token`; the body has no `cartId` (supersedes the `cartId` field shown in ADR-0020's example). `expectedTotal` is the only money-shaped field and can only cause a refusal, never set a price.

Conflict responses that carry a refreshed cart (`price_changed`, `insufficient_stock`, `promo_invalid`, `cart_has_issues`) include `cart: Cart` already re-priced for the same city and method, so the checkout page can show what changed without another call (DOC-06.5 §4.4).

## 4. Order by token (auth `order-token`)

| Key | Method & path | Request | Response | Errors | Notes |
|---|---|---|---|---|---|
| `orders.getByToken` | `GET /orders/by-token/:token` | Q: `locale?` | 200 `OrderPublic` | `not_found` | Bucket `default` |
| `orders.cancelByToken` | `POST /orders/by-token/:token/cancel` | B: `{ reason?: string /* ≤ 200 */ }` | 200 `OrderPublic` | `action_not_allowed` | Bucket `orderAction`. Allowed in `pending`, `pending_confirmation`. Recorded with `cancel_reason = customer_request` |
| `orders.switchToCod` | `POST /orders/by-token/:token/switch-to-cod` | — | 200 `OrderPublic` | `action_not_allowed`, `payment_method_not_allowed` | Bucket `orderAction` |
| `orders.retryPayment` | `POST /orders/by-token/:token/payments` | — | 200 `{ redirectUrl: string }` | `action_not_allowed` | Only with an online method (inactive at launch, A-07) |
| `orders.track` | `POST /orders/track` | B: `{ orderNumber: string, phone: PkMobile }` | 200 `{ trackingToken: string }` | `order_not_found` (uniform for every failure cause) | Auth `public`. Bucket `track` (10/h/IP, 5/h/order number). `POST` so the phone never appears in a URL or log |
| `reviews.getInvite` | `GET /orders/by-token/:token/lines/:lineId/review` | — | 200 `{ product: { title, image: Image }, displayNameDefault: string, sized: boolean, submitted: boolean }` | `not_found`, `token_expired` | |
| `reviews.createForOrderLine` | `POST /orders/by-token/:token/lines/:lineId/review` | B: `ReviewInput` | 201 `{ status: 'pending' }` | `review_already_submitted`, `token_expired`, `action_not_allowed` (order not delivered) | Bucket `review` |
| `reviews.createPhotoUpload` | `POST /orders/by-token/:token/lines/:lineId/review/uploads` | B: `{ contentType: 'image/jpeg' \| 'image/png' \| 'image/webp', bytes: int (≤ 5 MB) }` | 200 `{ mediaId: Id, uploadUrl: string, expiresAt: IsoDate }` | `validation_failed` | Bucket `review`. Max 3 per review; processed like admin uploads (DOC-08 §11) |

`orders.track` returns the order's token because the order number and phone together are the proof; the storefront then redirects to `/orders/:token`.

**How the token is produced.** The database stores only a hash of the token (DOC-09.7), yet the API must be able to hand the same link out again (after a verified lookup, and in each notification). So the token is derived instead of random: `token = base64url(HMAC-SHA256(TRACKING_KEY, orderId))`, and `orders.tracking_token_hash` stores its SHA-256. The API recomputes the token when needed and never stores it. `TRACKING_KEY` is a secret (added to DOC-11 §7 and DOC-14 §4.1).

```ts
OrderPublic = {
  orderNumber: string, status: OrderStatus, placedAt: IsoDate,
  timeline: { step: 'placed' | 'confirmed' | 'dispatched' | 'delivered', at?: IsoDate, current: boolean }[],
  closed?: { status: 'cancelled' | 'returned', at: IsoDate, reason?: CancelReason },
  lines: { id: Id, title: string, variantLabel: string, image?: Image, quantity: int, unitPrice: Money, lineTotal: Money,
           customizationSummary?: string, leadTime?: { minDays: int, maxDays: int },
           review?: { available: boolean, submitted: boolean } }[],
  subtotal: Money, discount: Money, promoCode?: string, shippingFee: Money, total: Money,
  depositDue?: Money, paid: Money, dueOnDelivery: Money,
  paymentMethod: PaymentMethod, paymentLabel: string, paymentStatus: PaymentStatus,
  bankTransfer?: { accountTitle: string, bank: string, accountNumber: string, instructions?: string },   // only when the method is bank_transfer and unpaid
  customer: { firstName: string, phoneMasked: string },            // "Ayesha K.", "0300 ••••567"
  delivery: { city: string, addressMasked: string, methodLabel: string,
              eta?: { from: string, to: string },                  // dates
              courier?: string, trackingNumber?: string, trackingUrl?: string },
  allowedActions: ('cancel' | 'switch_to_cod' | 'retry_payment')[],
  locale: 'en' | 'ur',
}

ReviewInput = { rating: int (1–5), title?: string /* ≤ 100 */, body: string /* 20–1000 */, fit?: FitNote,
                displayName: string /* 2–40 */, photoMediaIds?: Id[] /* ≤ 3 */ }
```

`OrderPublic` is masked by the API (DOC-06.6 §4.1): no full name, phone, address, email, internal notes, staff names or cost.

## 5. Examples

```http
POST /api/v1/cart/lines
X-Internal-Key: …
{ "variantId": "0192f5aa-…", "quantity": 1 }

200 OK
{ "cartToken": "h3k…", "count": 1,
  "lines": [ { "id": "0192f6…", "title": "Embroidered Lawn 3-Piece", "variantLabel": "M", "quantity": 1,
               "unitPrice": { "amount": 699000, "currency": "PKR" }, "lineSubtotal": { "amount": 699000, "currency": "PKR" },
               "lineDiscount": { "amount": 0, "currency": "PKR" }, "available": 3, "maxPerOrder": 10, "issues": [] } ],
  "subtotal": { "amount": 699000, "currency": "PKR" }, "discount": { "amount": 0, "currency": "PKR" },
  "total": { "amount": 699000, "currency": "PKR" },
  "messages": [ { "code": "free_shipping_remaining", "amount": { "amount": 101000, "currency": "PKR" } } ],
  "hasBlockingIssues": false }
```

```http
POST /api/v1/orders
X-Cart-Token: h3k…
Idempotency-Key: 6f1c0f70-6a7c-4d0b-9d63-2b4e1f1d5e55
{ "customer": { "name": "Ayesha Khan", "phone": "0300 1234567" },
  "shippingAddress": { "cityId": "0192aa…", "address": "House 12, Street 4, DHA Phase 5", "landmark": "near XYZ" },
  "shippingMethodId": "0192bb…", "paymentMethod": "cod",
  "expectedTotal": { "amount": 724000, "currency": "PKR" } }

201 Created
{ "orderNumber": "RB-10458", "trackingToken": "pQ7…", "status": "pending_confirmation",
  "total": { "amount": 724000, "currency": "PKR" } }
```

```http
409 Conflict
Content-Type: application/problem+json
{ "type": "https://rubaya.pk/problems/insufficient_stock", "title": "Insufficient stock", "status": 409,
  "code": "insufficient_stock", "requestId": "…", "variantId": "0192f5aa-…", "available": 0, "cart": { … } }
```

## 6. Rules

**Always:** price inside the request with `cart.price`; require `Idempotency-Key` on `orders.create`; return the refreshed cart with every conflict; mask customer data in `OrderPublic`; answer every tracking failure identically.
**Never:** read a price, discount, fee, status or customer id from the body; create a cart on a GET; reveal whether an order number exists; put the phone or token in a query string.
**Common mistakes:** treating `expectedTotal` as the total; merging a custom-size line into a standard one; returning `trackingToken` from any endpoint other than `orders.create` and `orders.track`.

## 7. Acceptance checklist

- [x] `orders.create` body containing `total`, `discount`, `shippingFee` or `unitPrice` → `400 validation_failed` (ADR-0020). (`orders.int.test.js`.)
- [x] The five ADR-0020 acceptance tests pass against these endpoints (duplicate-variant lines, 50 concurrent last-unit orders, repeated idempotency key, money field rejected, invalid transition). (`orders.int.test.js`, `order-changes.int.test.js`.)
- [x] `expectedTotal` different from the server total → `409 price_changed` with the new cart and no order created. (`orders.int.test.js`.)
- [x] `orders.track`: wrong phone, wrong number and malformed input return byte-identical bodies and the same status. (`public-orders.int.test.js`: six kinds of failure, one answer; five an hour per number, ten per address.)
- [x] `OrderPublic` for any order contains no unmasked phone, address or email (schema-level test plus a regex scan of the response). (`public-orders.int.test.js`: the schema has no field for them, and the answer is scanned for the phone, street, name, email and ids.)
- [x] The derived tracking token for order A never validates order B, and changing `TRACKING_KEY` invalidates all tokens (documented in runbook R-6). (`public-orders.int.test.js`; the runbook entry R-6 is M7.)
- [ ] A review cannot be created for an order that is not `delivered`.

## 8. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-10.3-1 | Derived (HMAC) tracking tokens instead of stored random ones | Lets `orders.track` and notifications reproduce the link without storing a credential; rotating `TRACKING_KEY` breaks all existing links, so it is rotated only on compromise | Need to revoke a single order's link → add a per-order `token_version` to the HMAC input |
| Q-10.3-2 | `phone` in the quote | Optional early check of per-customer promo limits | Privacy concern → remove; limits are enforced at order creation anyway |
| Q-10.3-3 | Customer cancellation reason text | Free text ≤ 200, stored in the event | — |

## 9. Changelog

| Date | Change |
|---|---|
| 2026-10-06 | M4-07 built (`modules/orders/public.js`): `orders.getByToken`, `orders.cancelByToken`, `orders.switchToCod`, `orders.track`. Differences from section 4: `orders.track` takes the phone as a plain string (a malformed phone must fail like a wrong one, so the contract does not reject it with a different answer); the `locale` query is not read (the answer holds nothing that is translated; `locale` is the order's); `orders.retryPayment` is not built (no online method at launch, A-07); `OrderPublic.lines[].review` waits for M4-09; the customer can cancel only while nothing has been paid (otherwise "WhatsApp us"), and the cancel note is kept on the order's event. A link is valid only if its hash is stored **and** it equals the token derived under the current `TRACKING_KEY`, so rotating the key ends every old link. `customizationSummary` is built from the keys stored on the line ("chest 38"), not the form labels. `orders.getByToken` and the actions answer `404 not_found` for an unknown token. |
| 2026-10-06 | M4-04 built (`modules/orders`): `orders.create`. The handler context has `idempotencyKey` (checked to be a UUID) for routes marked `idempotent`. Conflict responses carry `cart` (priced for the same city and method, with pictures). `TRACKING_KEY` is a new setting: required in staging and production, derived from `DATA_ENCRYPTION_KEY` in local and CI. A prepaid method with a bank account shows `payment.instructions`; there are no redirects yet (no provider). A bundle holds its chosen children in stock. The checkout bucket also counts five orders per phone number in ten minutes. |
| 2026-10-06 | M4-03 built (`modules/cart`): the seven cart routes. Handlers read the token from `X-Cart-Token` (new `http.header(name)` in the handler context); every `cart` and `order-token` route answers `Cache-Control: private, no-store`. Additions to the shape: `Cart.promoProblem` (why a code on the cart no longer applies). `QuoteBody.paymentMethod` is accepted and not used yet (every method is listed with whether it is allowed). `locale` is stored as `en` and not used until product translations are read by the cart. Customisation is checked against the product: its custom-size form (`measurements`, `notes` only if the form allows them) and, for a bundle, one variant for every child. Carts idle for 30 days are deleted by the job `cart.cleanup` (02:45 PKT). |
| 2026-10-02 | Initial version (Phase 5, part 2). Order body has no `cartId` (cart from `X-Cart-Token`); tracking token is HMAC-derived; adds `TRACKING_KEY` secret |
