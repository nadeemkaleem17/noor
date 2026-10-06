# 10.6 — API: Admin Orders, Customers, Promotions and Reviews

| Field | Value |
|---|---|
| ID | DOC-10.6 |
| Title | Order list and detail, transitions, edits, payments, staff-created orders, customers, promo codes, review moderation |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-10.0, DOC-10.3, DOC-09.6, DOC-09.7, DOC-09.8, DOC-07.5 … 07.8 |
| Decisions used | ADR-0012, ADR-0013, ADR-0017, ADR-0020 |

## 1. Purpose and scope

**Governs:** admin endpoints of `orders`, `payments`, `customers`, `promotions` and `reviews`.
**Does not govern:** which transitions exist (DOC-09.7 §5.1) or the screens.

All paths under `/api/v1/admin`; auth `staff`; `no-store`; every non-GET is audited. **Masking:** without `customers:read`, every customer field in these responses is masked exactly like `OrderPublic` (DOC-11 §4.2).

## 2. Orders

| Key | Method & path | Permission | Request | Response | Errors | Notes |
|---|---|---|---|---|---|---|
| `admin.orders.list` | `GET /orders` | `orders:read` | Q: `q?`, `status?` (multi), `cityId?`, `paymentMethod?`, `paymentStatus?`, `courierId?`, `from?`, `to?`, `promo?`, `hasDeposit?: 1`, `customerId?`, `channel?`, `page`, `size`, `sort` (`placedAt`, `total`, `city`, `statusAge`; default per status tab) | 200 `Page<AdminOrderRow>` | — | |
| `admin.orders.counts` | `GET /orders/counts` | `orders:read` | — | 200 `Record<OrderStatus, int>` | — | Status tabs |
| `admin.orders.get` | `GET /orders/:id` | `orders:read` | — | 200 `AdminOrder` | `not_found` | `:id` accepts the UUID or the display number (`RB-10458`) |
| `admin.orders.transition` | `POST /orders/:id/transitions` | by target: `orders:confirm` (to `confirmed`, and back to `pending_confirmation`), `orders:dispatch`, `orders:deliver`, `orders:cancel`, `orders:return` | B: `TransitionBody` | 200 `AdminOrder` | `invalid_transition`, `stale_write`, `deposit_unpaid`, `validation_failed` | The only way status changes |
| `admin.orders.edit` | `PUT /orders/:id` | `orders:edit` | B: `OrderEditBody` | 200 `AdminOrder` | `action_not_allowed` (status), `stale_write`, `insufficient_stock`, `city_not_served`, `promo_invalid` | Re-prices on the server (DOC-09.7 §6) |
| `admin.orders.previewEdit` | `POST /orders/:id/edit-preview` | `orders:edit` | B: `OrderEditBody` | 200 `{ before: Totals, after: Totals, promoStillApplies: boolean, issues: string[] }` | same | Writes nothing |
| `admin.orders.addNote` | `POST /orders/:id/notes` | `orders:note` | B: `{ body: string /* 1–1000 */ }` | 201 `OrderEvent` | — | |
| `admin.orders.logAttempt` | `POST /orders/:id/confirmation-attempts` | `orders:note` | B: `{ channel: 'call' \| 'whatsapp', outcome: AttemptOutcome, note?: string }` | 201 `OrderEvent` | `action_not_allowed` (not `pending_confirmation`) | |
| `admin.orders.recordPayment` | `POST /orders/:id/payments` | `orders:payments` | Header `Idempotency-Key`; B: `{ kind: 'deposit' \| 'balance' \| 'full' \| 'refund', amount: Money, method: 'cash' \| 'bank_transfer' \| 'wallet' \| 'card' \| 'other', reference?: string, paidAt?: IsoDate, proofMediaId?: Id }` | 201 `AdminOrder` | `validation_failed` (amount exceeds balance, or refund exceeds paid) | The one admin route where staff enter an amount: it records money that changed hands; it never changes what the order costs |
| `admin.orders.updateTracking` | `PUT /orders/:id/tracking` | `orders:dispatch` | B: `{ courierId: Id, trackingNumber?: string, version }` | 200 `AdminOrder` | `action_not_allowed` (not `dispatched`) | |
| `admin.orders.create` | `POST /orders` | `orders:edit` | Header `Idempotency-Key`; B: `AdminCreateOrderBody` | 201 `AdminOrder` | same as `orders.create` | Staff-created order (DOC-07.6 §4); channel `admin` |
| `admin.orders.quote` | `POST /orders/quote` | `orders:edit` | B: `{ lines: { variantId, quantity, customization? }[], cityId: Id, shippingMethodId?: Id, paymentMethod?: PaymentMethod, promoCode?: string, phone?: PkMobile }` | 200 `Cart` | cart/promo codes | Server totals for the staff order form; no cart is stored |
| `admin.orders.invoice` | `GET /orders/:id/invoice` | `orders:read` | — | 200 `InvoiceData` | `not_found` | Data for the print view; assigns nothing |
| `admin.orders.bulk` | `POST /orders/bulk` | per action | B: bulk body; `action`: `confirm` (`params.via`), `dispatch` (`params.courierId`, `params.tracking: { orderNumber, trackingNumber }[]`), `deliver` (`params.cashReceived: boolean`) | 200 bulk result or 202 | — | Each item runs the same transition function |
| `admin.orders.export` | `POST /orders/exports` | `orders:export` | B: list filters (date range ≤ 366 days) | 200 CSV or 202 `{ jobId }` | — | Audited (personal data) |

```ts
TransitionBody = { version: int } & (
  | { to: 'confirmed', via: 'call' | 'whatsapp' | 'customer_message', note?: string, codOverrideReason?: string }
  | { to: 'pending_confirmation', reason: string }
  | { to: 'dispatched', courierId: Id, trackingNumber?: string, dispatchedAt?: IsoDate }
  | { to: 'delivered', deliveredAt?: IsoDate, cashReceived?: boolean }
  | { to: 'cancelled', reason: CancelReason, note?: string, refundAcknowledged?: boolean }
  | { to: 'returned', returnType: ReturnType, lines: { lineId: Id, quantity: int, restock: boolean }[], refundAmount?: Money, note?: string }
)   // a 'returned' body with fewer than all remaining quantities records a partial return and leaves status 'delivered'

OrderEditBody = { version: int,
  shippingAddress?: { cityId: Id, address: string, landmark?: string, notes?: string },
  shippingMethodId?: Id,
  customer?: { name: string, email?: string },                    // phone is the identity and cannot be edited
  lines?: { lineId?: Id, variantId?: Id, quantity: int, customization?: LineCustomization }[],   // full list; only in pending_confirmation
}

AdminCreateOrderBody = CreateOrderBody (DOC-10.3 §3, without expectedTotal) & {
  lines: { variantId: Id, quantity: int, customization?: LineCustomization }[],
  promoCode?: string, confirmedOnCall?: boolean, note?: string }

AdminOrder = {
  id: Id, orderNumber: string, status: OrderStatus, channel: OrderChannel, version: int,
  placedAt: IsoDate, statusChangedAt: IsoDate, confirmedAt?: IsoDate, dispatchedAt?: IsoDate, deliveredAt?: IsoDate, closedAt?: IsoDate,
  customer: { id: Id, name: string, phone: string, email?: string, ordersCount: int, deliveredCount: int, refusedCount: int,
              noCod: boolean, vip: boolean },
  riskMarkers: ('repeat_customer' | 'refused_before' | 'cod_blocked' | 'duplicate_suspect' | 'high_value')[],
  duplicateOf?: { id: Id, orderNumber: string },
  shippingAddress: { cityId: Id, city: string, address: string, landmark?: string, notes?: string },
  shipping: { methodId?: Id, label: string, fee: Money, etaMinDays: int, etaMaxDays: int },
  customFields?: Record<string, string | number | boolean>,
  lines: { id: Id, productId: Id, variantId: Id, title: string, variantLabel: string, sku: string, image?: Image, kind: ProductKind,
           quantity: int, returnedQuantity: int, unitPrice: Money, lineSubtotal: Money, lineDiscount: Money, deposit: Money,
           customization?: LineCustomization & { summary?: string }, leadTime?: { minDays: int, maxDays: int },
           stockTracked: boolean }[],
  subtotal: Money, discount: Money, promoCode?: string, shippingFee: Money, total: Money,
  depositDue: Money, paid: Money, refunded: Money, dueOnDelivery: Money,
  paymentMethod: PaymentMethod, paymentStatus: PaymentStatus,
  payments: { id: Id, kind: PaymentKind, method: string, state: PaymentState, amount: Money, reference?: string,
              recordedBy?: string, createdAt: IsoDate, proof?: Image }[],
  invoiceNumber?: string, courier?: { id: Id, name: string }, trackingNumber?: string, trackingUrl?: string,
  cancelReason?: CancelReason,
  confirmationAttempts: int,
  events: OrderEvent[],                                            // newest first
  allowedActions: ('confirm' | 'revert_confirmation' | 'dispatch' | 'deliver' | 'cancel' | 'return' | 'edit_address' | 'edit_items'
                   | 'record_payment' | 'switch_to_cod' | 'update_tracking')[],     // from the state machine and data; the UI intersects with permissions
  customerLink: string,                                            // storefront /orders/:token URL, for staff to resend
  whatsappConfirmUrl?: string,                                     // wa.me link with the confirmation message prefilled
}

OrderEvent = { id: Id, type: string, fromStatus?: OrderStatus, toStatus?: OrderStatus, actorType: ActorType, actorLabel?: string,
               data?: Record<string, unknown>, createdAt: IsoDate }
AdminOrderRow = { id: Id, orderNumber: string, status: OrderStatus, placedAt: IsoDate, statusChangedAt: IsoDate,
                  customerName: string, customerPhone: string, city: string, itemCount: int, firstItemTitle: string,
                  total: Money, paymentMethod: PaymentMethod, paymentStatus: PaymentStatus, riskMarkers: string[] }
Totals = { subtotal: Money, discount: Money, shippingFee: Money, total: Money, depositDue: Money }
InvoiceData = { store: { name: string, phone?: string, email?: string, address?: string, logo?: Image },
                invoiceNumber?: string, orderNumber: string, placedAt: IsoDate, dispatchedAt?: IsoDate,
                customer: { name: string, phone: string }, shippingAddress: {…}, lines: {…}[], totals: Totals,
                paid: Money, amountToCollect: Money, paymentMethod: PaymentMethod, courier?: string, trackingNumber?: string }
```

## 3. Customers

| Key | Method & path | Permission | Request | Response | Errors | Notes |
|---|---|---|---|---|---|---|
| `admin.customers.list` | `GET /customers` | `customers:read` | Q: `q?` (name, ≥ 4 phone digits, email), `cityName?`, `flag?: 'no_cod' \| 'vip' \| 'consent'`, `minOrders?`, `hasRefusals?: 1`, `page`, `size`, `sort` (`name`, `city`, `ordersCount`, `refusedCount`, `spent`, `lastOrderAt`) | 200 `Page<AdminCustomerRow>` | — | |
| `admin.customers.get` | `GET /customers/:id` | `customers:read` | — | 200 `AdminCustomer` | `not_found` | |
| `admin.customers.lookup` | `GET /customers/by-phone` | `orders:edit` | Q: `phone` | 200 `{ customer?: AdminCustomerRow }` | — | For the staff order form |
| `admin.customers.update` | `PUT /customers/:id` | `customers:write` | B: `{ name: string, email?: string, noCod: boolean, noCodReason?: string, vip: boolean, marketingConsent: boolean, consentNote?: string, version }` | 200 `AdminCustomer` | `stale_write`, `validation_failed` (`noCod` without a reason) | |
| `admin.customers.addNote` | `POST /customers/:id/notes` | `customers:write` | B: `{ body }` | 201 `{ id, body, staffName, createdAt }` | — | |
| `admin.customers.anonymise` | `POST /customers/:id/anonymise` | `customers:anonymise` | B: `{ confirm: string }` (must equal the phone's last 4 digits) | 204 | `action_not_allowed` (open orders) | Step-up. Irreversible (DOC-11 §8.2) |
| `admin.customers.export` | `POST /customers/exports` | `customers:export` | B: list filters | 202 `{ jobId }` | — | Step-up. ≤ 5,000 rows. Audited |

```ts
AdminCustomerRow = { id: Id, name: string, phone: string, city?: string, ordersCount: int, deliveredCount: int, refusedCount: int,
                     spent: Money, lastOrderAt?: IsoDate, noCod: boolean, vip: boolean, marketingConsent: boolean }
AdminCustomer = AdminCustomerRow & { email?: string, noCodReason?: string, consentNote?: string, cancelledCount: int,
                 averageOrder?: Money, firstOrderAt?: IsoDate, addresses: { city: string, address: string, landmark?: string, lastUsedAt: IsoDate }[],
                 notes: { id: Id, body: string, staffName?: string, createdAt: IsoDate }[], version: int, anonymisedAt?: IsoDate }
```

## 4. Promo codes

| Key | Method & path | Permission | Request | Response | Errors |
|---|---|---|---|---|---|
| `admin.promos.list` | `GET /promos` | `promos:read` | Q: `q?`, `status?: 'active' \| 'scheduled' \| 'expired' \| 'disabled'`, `type?`, `page`, `size`, `sort` (`code`, `-createdAt`, `usageCount`) | 200 `Page<AdminPromo>` | — |
| `admin.promos.get` | `GET /promos/:id` | `promos:read` | — | 200 `AdminPromo` | `not_found` |
| `admin.promos.create` | `POST /promos` | `promos:write` | B: `PromoInput` | 201 `AdminPromo` | `validation_failed` (`code` `not_unique`) |
| `admin.promos.update` | `PUT /promos/:id` | `promos:write` | B: `PromoInput & { version }` | 200 `AdminPromo` | `stale_write`, `validation_failed` (changing `code`/`type` of a used promo) |
| `admin.promos.delete` | `DELETE /promos/:id` | `promos:delete` | — | 204 | `in_use` (has redemptions → disable instead) |
| `admin.promos.preview` | `POST /promos/preview` | `promos:read` | B: `{ promo: PromoInput, lines: { variantId: Id, quantity: int }[] }` | 200 `{ applies: boolean, reason?: string, discount: Money, eligibleSubtotal: Money, lineDiscounts: { variantId: Id, discount: Money }[] }` | — |
| `admin.promos.bulk` | `POST /promos/bulk` | `promos:write` | `action`: `enable`, `disable` | 200 bulk result | — |

```ts
PromoInput = { code: string, type: 'percent' | 'fixed' | 'free_shipping',
               percent?: number /* 1–90, whole numbers; stored as bps */, amount?: Money, maxDiscount?: Money, minSpend?: Money,
               scope: 'all' | 'categories' | 'products', targetIds?: Id[], excludeSaleItems: boolean, firstOrderOnly: boolean,
               usageLimit?: int, perCustomerLimit?: int, startsAt?: IsoDate, endsAt?: IsoDate, enabled: boolean, note?: string }
AdminPromo = PromoInput & { id: Id, status: 'active' | 'scheduled' | 'expired' | 'disabled', usageCount: int, used: boolean,
                            targets: { id: Id, type: 'category' | 'product', label: string }[], summary: string /* rule in words */, version: int }
```

## 5. Reviews

| Key | Method & path | Permission | Request | Response | Errors |
|---|---|---|---|---|---|
| `admin.reviews.list` | `GET /reviews` | `reviews:read` | Q: `q?`, `status?`, `rating?`, `productId?`, `hasPhotos?: 1`, `page`, `size`, `sort` (`createdAt`, `-createdAt`, `rating`) | 200 `Page<AdminReview>` | — |
| `admin.reviews.get` | `GET /reviews/:id` | `reviews:read` | — | 200 `AdminReview` | `not_found` |
| `admin.reviews.moderate` | `POST /reviews/:id/moderation` | `reviews:moderate` | B: `{ status: 'approved' }` or `{ status: 'rejected', reason: ReviewRejectReason, note?: string }` | 200 `AdminReview` | — |
| `admin.reviews.reply` | `PUT /reviews/:id/reply` | `reviews:moderate` | B: `{ body: string /* ≤ 600; '' removes */ }` | 200 `AdminReview` | — |
| `admin.reviews.removePhoto` | `DELETE /reviews/:id/photos/:mediaId` | `reviews:moderate` | — | 200 `AdminReview` | `not_found` |
| `admin.reviews.bulk` | `POST /reviews/bulk` | `reviews:moderate` | `action`: `approve`, `reject` (`params.reason`) | 200 bulk result | — |

```ts
AdminReview = { id: Id, product: { id: Id, title: string, image?: Image }, order: { id: Id, orderNumber: string },
                displayName: string, rating: int, title?: string, body: string, fit?: FitNote, photos: (Image & { mediaId: Id })[],
                status: ReviewStatus, rejectReason?: ReviewRejectReason, rejectNote?: string,
                reply?: { body: string, at: IsoDate }, moderatedBy?: string, moderatedAt?: IsoDate, createdAt: IsoDate }
```

There is no endpoint to create or edit a review's text or rating from the admin (DOC-07.8 §3).

## 6. Example

```http
POST /api/v1/admin/orders/0192f6c1-…/transitions
X-CSRF-Token: …
{ "to": "dispatched", "courierId": "0192aa…", "trackingNumber": "TCS123456789", "version": 4 }

200 OK
{ "id": "0192f6c1-…", "orderNumber": "RB-10458", "status": "dispatched", "version": 5,
  "invoiceNumber": "INV-2026-000123", "courier": { "id": "0192aa…", "name": "TCS" }, "trackingNumber": "TCS123456789",
  "allowedActions": ["deliver", "return", "update_tracking"], … }
```

## 7. Rules

**Always:** change status through `admin.orders.transition`; send `version`; re-price edits on the server and show the preview; mask customer fields by permission; require an idempotency key where staff enter money.
**Never:** add a route that replaces an order (F-03); accept a price, discount or total for an order; let staff type a discount (use a promo code); return unmasked contact data to a role without `customers:read`.
**Common mistakes:** a second code path that sets `status` (bulk must call the same transition function); treating `recordPayment` as a price change; forgetting to recompute `allowedActions` after an edit.

## 8. Acceptance checklist

- [ ] `TransitionBody` variants map one-to-one to the rows of DOC-09.7 §5.1 (test enumerates both).
- [ ] No route in this file can change `subtotal`, `discount`, `shipping fee` or `total` other than `admin.orders.edit` and `admin.orders.create`, and both compute them.
- [ ] `admin.orders.get` for a `viewer` returns masked phone and no email or address line.
- [ ] `admin.orders.bulk` `dispatch` with one unknown order number returns it under `failed` and dispatches the rest.
- [ ] `admin.promos.preview` equals the storefront cart discount for the same lines.
- [ ] `admin.customers.anonymise` with open orders → `409 action_not_allowed`.
- [ ] Repeating `admin.orders.recordPayment` with the same idempotency key records one payment.

## 9. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-10.6-1 | `admin.orders.get` accepts the display number | Convenience for the command palette and barcode scans | Ambiguity if the prefix changes (numbers stay unique regardless) |
| Q-10.6-2 | Refunds recorded manually | No provider refunds while only COD/manual payments exist | DOC-12 gateway adapters |
| Q-10.6-3 | Percent promos limited to whole numbers 1–90 | DOC-07.7 §3 | Owner wants 12.5% |

## 10. Changelog

| Date | Change |
|---|---|
| 2026-10-06 | M4-09: the six `admin.reviews.*` routes built under `/admin/reviews` (`reviews:read`, `reviews:moderate`). `q` searches the text, title, name, product title and order number. Moderating again is allowed (approved to rejected and back); each decision recomputes the product's rating. `bulk` takes `{ ids, action: 'approve' }` or `{ ids, action: 'reject', reason }` and decides each review on its own. `removePhoto` returns the review and deletes the file. `AdminReview.product.image` is the picture of the purchased line. |
| 2026-10-02 | Initial version (Phase 5, part 2) |
