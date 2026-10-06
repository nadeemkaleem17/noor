# 07.5 — Admin: Orders

| Field | Value |
|---|---|
| ID | DOC-07.5 |
| Title | Order list, order detail, COD confirmation, dispatch, delivery, cancel, return, invoice |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-07.1, DOC-07.14, DOC-06.5, DOC-06.6, README (A-07, A-10) |
| Decisions used | ADR-0012, ADR-0013, ADR-0017, ADR-0020 |

## 1. Purpose and scope

**Governs:** `/orders` and `/orders/:id`: the daily workflow from a new order to delivered, cancelled or returned, and every action staff can take.
**Does not govern:** the transition table and side effects themselves (ADR-0020 §7, DOC-09 orders: this document is the UI over that table); courier and messaging integrations (DOC-12); customer-facing order page (DOC-06.6).

Fixes F-03 (admin PUT replaced the whole order with no transition check), F-04 (random invoice numbers) and the no-restock gap of K10: the admin only calls **transition** and **edit** endpoints; it never sends an order document.

Both screens must work at 360 px (DOC-07.1 Q-07.1-3): staff confirm orders from a phone.

## 2. Order list (`/orders`)

Status tabs above the table (counts from `admin.orders.counts`): **To confirm** (`pending_confirmation`), **To dispatch** (`confirmed`), **Dispatched**, **Delivered**, **Cancelled/Returned**, **All**; plus **Awaiting payment** (`pending`) only when a prepaid method is enabled. Default tab: To confirm.

| Column | Content | Sortable |
|---|---|---|
| ☐ | Selection | |
| Order | `RB-10458` (link), placed time (relative; absolute in `title`) | placed (default: oldest first on To confirm / To dispatch, newest first elsewhere) |
| Customer | Name, phone (click-to-copy), repeat-customer and risk markers (§5.3) | |
| City | | yes |
| Items | Count + first item title | |
| Total | `Rs. 7,240` + payment method | yes |
| Status | `StatusBadge` + payment status when not COD | |
| Age | Time in the current status; `warning`/`danger` tones past the thresholds in §5.1 | yes |
| ⋯ | Open, Print invoice, WhatsApp customer | |

Filters (URL): `q` (order number, name, phone digits, tracking number, SKU), `status`, `city`, `payment`, `from`/`to` (placed date), `courier`, `hasDeposit`, `kind` (contains made-to-order). Page size 50. Under `md` the table becomes a card list (number, name, city, total, status, age).

Bulk actions (DOC-07.14 §5): Confirm (COD), Mark dispatched (same courier, tracking numbers via CSV paste), Mark delivered, Print invoices (one print document), Export CSV. Each shows per-order results.

## 3. Order detail (`/orders/:id`)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ← Orders › RB-10458   [pending confirmation]      [Print invoice] [⋯] [Confirm ▾]│
├─────────────────────────────────────────────────────┬────────────────────────────┤
│ Items                                               │ Customer                   │
│ ┌──┐ Lawn 3-Piece · M   SKU LWN-3P-M  ×1   Rs.6,990 │ Ayesha Khan  ·  3rd order  │
│ ┌──┐ Bridal · Custom size (view)      ×1  Rs.45,000 │ 0300 1234567 [call][WA][⧉] │
│ Subtotal 51,990 · Discount −0 · Shipping 250        │ COD refused before: 0      │
│ Total Rs. 52,240 · COD · Deposit due Rs. 13,500     │ Delivery                   │
│                                                     │ House 12, Street 4, DHA    │
│ Confirmation                                        │ Lahore · near XYZ  [Edit]  │
│ Attempt 1 · 2 Oct 4:10pm · no answer · AK           │ Standard · 3–5 days        │
│ [Log attempt]                                       │ Payment                    │
│                                                     │ COD · Rs. 52,240 due       │
│ Timeline                                            │ [Record payment]           │
│ ● placed 2 Oct 3:45pm (storefront)                  │ Internal notes             │
│ ● note "asked to deliver after 5pm" · AK            │ [______________] [Add]     │
└─────────────────────────────────────────────────────┴────────────────────────────┘
```

| Card | Content |
|---|---|
| Header | Order number, `StatusBadge`, placed time, the **primary action for the current status** (§4) as a split button with the other allowed transitions in its menu |
| Items | Per line: image, title, variant label, SKU, quantity, unit price, line total, stock indicator while not dispatched ("reserved"), custom-size measurements or bundle children in an expandable row, made-to-order lead time |
| Totals | Subtotal, discount (+ promo code), shipping (method name), total, deposit paid/due, amount due on delivery. Exactly the stored values |
| Customer | Name, phone with call (`tel:`), WhatsApp (`wa.me`, prefilled confirmation message) and copy buttons, email, order count and link to the customer page, risk markers |
| Delivery | Address, city, landmark, customer notes, shipping method and ETA; after dispatch: courier, tracking number, courier link |
| Payment | Method, payment status, payments list (amount, method, reference, recorded by, time), balance due |
| Confirmation | Attempt log (§5.1) while `pending_confirmation`; collapsed afterwards |
| Timeline | Every `order_events` row newest first: transitions, edits, notes, notifications sent (and failures), with actor and time |
| Internal notes | Add-only notes (never shown to the customer; F-03 fix: notes are events, not a free-text blob that can be overwritten) |

Data: `admin.orders.get` returns the order with `allowedActions[]`; the UI renders only those (and only those the user's permissions include). Refetch on focus and every 60 s while open; if the status changed elsewhere a banner says "This order was updated: showing the latest".

## 4. Actions by status

The server validates every transition (ADR-0020 §7). This table is what the UI offers.

| Status | Primary action | Other actions | Permission |
|---|---|---|---|
| `pending` (awaiting prepaid payment) | Record payment | Switch to COD, Cancel | `orders:payments`, `orders:cancel` |
| `pending_confirmation` | **Confirm order** | Log attempt, Edit address/items, Cancel | `orders:confirm`, `orders:note`, `orders:edit`, `orders:cancel` |
| `confirmed` | **Mark dispatched** | Edit address (not items), Revert to pending confirmation, Cancel | `orders:dispatch`, `orders:edit`, `orders:cancel` |
| `dispatched` | **Mark delivered** | Mark returned (refused / undelivered), Edit tracking | `orders:deliver`, `orders:return` |
| `delivered` | — | Mark returned (customer return) | `orders:return` |
| `cancelled`, `returned` | — | — (final) | |

Every action is a `Dialog` (or `ConfirmDialog`) calling `admin.orders.transition` with `{ to, …fields, version }`. `409 invalid_transition` or `stale_write` refetches the order and shows the banner.

### 4.1 Dialog fields

| Action | Fields | Effects (server) |
|---|---|---|
| Confirm order | Confirmed via: call / WhatsApp / customer message (required); note (optional). With a deposit due: a blocking check "Deposit of Rs. X recorded" (the Confirm button is disabled until a payment covering the deposit exists, ADR-0017 launch rule) | → `confirmed`; customer notified |
| Mark dispatched | Courier (`NativeSelect` from DOC-07.10 couriers), tracking number (required unless courier is "Own rider"), dispatch date (default now) | → `dispatched`; reserved stock becomes an on-hand decrement; invoice number assigned from the per-year counter if absent (ADR-0020 §8); customer notified with tracking |
| Mark delivered | Delivered date (default now); COD: "Cash received: Rs. X" checkbox (records the COD payment as captured) | → `delivered`; review links issued (DOC-06.6 §6) |
| Cancel | Reason (required): customer asked, unreachable after attempts, duplicate order, out of stock, suspected fake, other (+ note). Shown: "Stock will be released" and, if money was captured, "Refund of Rs. X must be made" with a required acknowledgement | → `cancelled`; reservations released; promo usage decremented; customer notified |
| Mark returned | Type: refused at door / undelivered / customer return; per line: quantity returned and **Restock?** (yes: back to on hand; no: damaged, writes a non-sellable movement); refund amount if a payment was captured | → `returned` (full) or stays `delivered` with a partial-return event (when not all quantities return); inventory movements |
| Record payment | Amount (`MoneyInput`, ≤ balance), method (cash, bank transfer, JazzCash, Easypaisa, other), reference, date, optional proof image | Adds a manual payment; when it covers the deposit or total the payment status updates |
| Revert to pending confirmation | Reason (required) | Only from `confirmed` and before dispatch |

## 5. COD workflow

### 5.1 Confirmation

Every COD order starts in `pending_confirmation` (ADR-0017).

| Rule | Detail |
|---|---|
| Queue | "To confirm" tab, oldest first. Age tone: `warning` after 2 h, `danger` after 12 h (business hours are not modelled in v1) |
| Contact | WhatsApp button opens `wa.me` with the message from template `order.confirm` (order number, items summary, total, address, "Reply YES to confirm"); call button is a `tel:` link |
| Log attempt | `Dialog`: channel (call / WhatsApp), outcome (no answer, busy, wrong number, asked to call later, declined), note. Stored as order events and counted |
| After 3 failed attempts on 2 different days | The order shows a suggestion chip "Cancel as unreachable" (never automatic) |
| Customer replied on WhatsApp | Staff press Confirm with "customer message". Automatic confirmation from an inbound WhatsApp reply is a DOC-12 feature, off at launch |
| Edits during confirmation | Address, city (re-prices shipping), notes, line quantity, remove a line, add a line by SKU search. Each edit re-prices on the server and shows old → new total before saving (`admin.orders.edit`) |

### 5.2 Dispatch

| Rule | Detail |
|---|---|
| Packing slip / invoice | "Print invoice" opens a print view (`/orders/:id/print`, plain HTML + print CSS, A5 and thermal-friendly): store name and contact, invoice number and date, order number, customer and address, lines, totals, **amount to collect**, and the order number as a Code 128 barcode rendered as inline SVG. Customer text is rendered as React text (escaped) |
| Bulk dispatch | Select orders → "Mark dispatched": choose one courier, then a two-column paste box `order number, tracking number`; rows are validated (order must be `confirmed`) before submit; results listed per order |
| Courier booking by API | Not in v1 (manual tracking numbers); DOC-12 owns the adapters |

### 5.3 Risk markers (shown in list and detail)

| Marker | Rule |
|---|---|
| Repeat customer | ≥ 1 delivered order for this phone: `success` chip "2 delivered" |
| Refused before | ≥ 1 refused/undelivered return for this phone: `danger` chip with the count |
| COD blocked | Customer flagged "no COD" (DOC-07.6): `danger` chip; Confirm asks for an explicit override reason |
| Duplicate suspect | Another order from the same phone within 24 h that is not cancelled: `warning` chip linking to it |
| High value | Total above the store's "high-value COD" threshold (setting, default Rs. 25,000): `warning` chip |

Markers inform; they never block or auto-cancel.

## 6. Reason codes

Stable codes stored on events (labels are message keys): cancel: `customer_request`, `unreachable`, `duplicate`, `out_of_stock`, `suspected_fake`, `other`; return: `refused_at_door`, `undelivered`, `customer_return`; confirmation attempt outcome: `no_answer`, `busy`, `wrong_number`, `call_later`, `declined`. The dashboard groups by them (DOC-07.2 §4).

## 7. Rules

**Always:** go through transitions; require a reason for cancel, return and revert; show the server's totals; record who did what (the API does this from the session, never from a form field).
**Never:** edit a total, discount or shipping fee by hand; change status with a generic "update order" call; delete an order; show internal notes or staff names to the customer; auto-cancel.
**Common mistakes:** marking delivered without recording COD cash; restocking a damaged return; dispatching an order whose deposit is unpaid; editing items after dispatch.

## 8. Acceptance checklist

- [ ] The UI offers exactly the server's `allowedActions` for each status (test iterates all statuses with an `owner` and a `support` user). (The server side exists and is tested per status: `allowedActions` in `modules/orders/rules.js`; the UI check is M6.)
- [x] Confirm is blocked while a deposit is due and unpaid. (API: `deposit_unpaid`; `order-changes.int.test.js`.)
- [x] Dispatch assigns an invoice number once; printing twice shows the same number. (API; the print view is M6.)
- [x] Cancel releases reserved stock (variant "reserved" drops) and the timeline shows the reason and actor. (API: the variant's `reserved` drops; the timeline event carries the reason and the actor.)
- [x] Returning 1 of 2 units with "Restock: no" does not increase on-hand stock. (API.)
- [ ] Two staff acting on one order: the second sees the "order was updated" banner, not a silent overwrite. (API: the second gets `stale_write` and nothing is overwritten; the banner is M6.)
- [ ] Bulk dispatch with one invalid row applies the valid ones and lists the failure. (M4-10 and M6.)
- [ ] List and detail are usable at 360 px; call and WhatsApp buttons work on a phone.
- [ ] The print view contains no unescaped customer input (test with `<script>` in the address).

## 9. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-07.5-1 | Final status and event names | As in GLOSSARY and §6; DOC-09 orders is authoritative | DOC-09 |
| Q-07.5-2 | Partial returns keep the order `delivered` | Yes, with a `partial_return` event and refund record | DOC-09 |
| Q-07.5-3 | Exchanges | Handled as return + new order created by staff from the customer page | More than 10 exchanges a week |
| Q-07.5-4 | Staff-created orders (phone/WhatsApp orders) | "New order" on the customer page uses the same cart and order endpoints with channel `admin`; specified in DOC-07.6 | — |
| Q-07.5-5 | Thresholds (2 h, 12 h, 3 attempts, Rs. 25,000) | Defaults; the last is a store setting | Owner tunes them |

## 10. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 3) |
| 2026-10-02 | Phase 4: `orders:note` permission for attempts and notes (DOC-11) |
| 2026-10-02 | Phase 7 consistency review: table name `order_events` |
