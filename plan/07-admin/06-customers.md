# 07.6 — Admin: Customers

| Field | Value |
|---|---|
| ID | DOC-07.6 |
| Title | Customer list, customer detail, COD flags, staff-created orders |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-07.1, DOC-07.5, DOC-07.14, DOC-06.7 |
| Decisions used | ADR-0012, ADR-0017, ADR-0020 |

## 1. Purpose and scope

**Governs:** `/customers` and `/customers/:id`.
**Does not govern:** customer-facing accounts (none in v1, DOC-06.7); privacy rules and retention (DOC-11).

A customer is the record the API keeps **per phone number** (E.164), created or updated by each order. There is no customer login.

## 2. List (`/customers`)

| Column | Content | Sortable |
|---|---|---|
| Customer | Name (latest used), phone | name |
| City | Latest delivery city | yes |
| Orders | Count (excluding cancelled) | yes |
| Delivered | Count | |
| Refused / returned | Count; `danger` tone when > 0 | yes |
| Spent | Sum of delivered order totals | yes |
| Last order | Relative date | yes (default, newest) |
| Customer since | When the customer was first recorded (their first order) | yes |
| Visits | Visits by the browsers this customer ordered from (kept apart from Orders); `Last visit` beside it | yes |
| Flags | "No COD", "VIP", marketing consent, then the **highlight chips** (§2.1) | |

Filters: `q` (name, phone digits, email), `city`, `flag`, `minOrders`, `hasRefusals`, `minVisits`, `rule` (the customers one highlight rule colours). No bulk actions except Export (needs `customers:export`; the export is logged in the audit log with the filter used, and capped at 5,000 rows per request).

### 2.1 Website visits strip and highlight chips (added 2026-10-19)

Above the table, **Website visits** shows, for the last 7, 30 or 90 days (Pakistan days): visits, visitors, new visitors, returning visitors and "Became customers" (visitors who later ordered from that browser). These are totals without names. A visit is the first page of a stay that begins more than 30 minutes after the browser's last page.

Beside the name, a chip per matching **highlight rule** (at most one for orders and one for visits). The chip is the rule's own colour with black or white text, whichever reads better, and always shows the rule's name, so colour is never the only signal. The rules are rows staff edit; nothing about ranges or colours is in the code.

### 2.2 Highlight rules (`/customers/highlights`)

`customers:read` sees the rules, `customers:write` edits them. One form for the whole list: each rule has **Counts** (orders placed or website visits), **From**, **Up to** (empty = no limit), **Name shown**, **Colour** (picker and `#rrggbb`), **On** (a rule that is off colours nobody) and Delete. A live preview chip shows the result. Add a rule with "Add a rule" (at most 30). Nothing is saved until **Save rules**; "Discard changes" returns to the saved list. Save is refused, with the reason beside the field, for a colour that is not `#rrggbb`, a name over 40 characters or an "Up to" below "From". When two enabled rules of one kind overlap, a warning says which one is used (the one that starts lower; ties go to the older rule). Every save is written to the audit log. The first set (1 to 5 orders blue, 6 to 10 amber, 11 and over green, 2 or more visits violet) is only an example: the base seed adds it to a shop with no rules, and staff may change or delete every one.

## 3. Detail (`/customers/:id`)

| Card | Content |
|---|---|
| Header | Name, phone (call, WhatsApp, copy), email, first-order date; actions: **New order**, Edit, flag menu |
| Stats | Orders, delivered, refused/returned, cancelled, total spent, average order value |
| Orders | Table of this customer's orders (number, date, total, status) linking to DOC-07.5 |
| Addresses | Distinct delivery addresses used, newest first (read-only; they come from orders) |
| Notes | Add-only internal notes with author and time |
| Flags | **No COD** (requires a reason; orders from this phone show the marker in DOC-07.5 §5.3, and when a prepaid method exists the storefront quote disallows COD for this phone at order creation with `cod_not_available`); **VIP** (informational); **Marketing consent** (from checkout, editable with a note of how consent was obtained) |
| Activity | Audit entries for this customer record |

Edit (needs `customers:write`): name, email, notes, flags. **The phone number is not editable** (it is the identity); a customer who changes number becomes a new record. "Merge into another customer" is not in v1.

## 4. Staff-created orders

For orders taken by phone or WhatsApp. "New order" (needs `orders:edit`) opens `/orders/new?customer=<id>` (or blank from the orders list):

1. Customer: phone (finds or creates the customer), name.
2. Items: async product/SKU search → pick variant and quantity (custom-size form shown when relevant).
3. Delivery: city, address, method. Payment: methods enabled for the store.
4. Summary with server totals (same quote endpoint as the storefront), optional promo code.
5. "Create order" → `admin.orders.create` with an idempotency key; the order is created with channel `admin`, the staff member as creator, and enters `confirmed` directly when the staff member ticks "Customer confirmed on this call" (otherwise `pending_confirmation`).

It uses the same server pricing, stock reservation and promo validation as the storefront (ADR-0020); staff cannot type a price or discount. A manual discount is a promo code created for the purpose.

## 5. Privacy rules in the UI

| Rule | Detail |
|---|---|
| Least exposure | Roles without `customers:read` see only the name, city and masked phone on orders they can access |
| Copy/export | Copy buttons exist for phone and address (needed for couriers); bulk export is permission-gated and audited |
| Deletion request | "Anonymise customer" (needs `customers:anonymise`, owner only, with step-up; DOC-11 §8.2): replaces name, phone, email and addresses on the customer and their **final-status** orders with placeholders, keeps totals for accounting. Blocked while the customer has open orders. Irreversible; `ConfirmDialog` with typed confirmation |
| Search | Phone search requires at least 4 digits |

## 6. Rules

**Always:** treat the phone number as the customer identity; require a reason for the No-COD flag; log exports.
**Never:** let staff edit prices on a staff-created order; show customer data to roles without the permission; delete a customer row (anonymise instead).
**Common mistakes:** merging two people who share a phone; flagging No COD without a reason; exporting the full list "to have a backup".

## 7. Acceptance checklist

- [x] An order from a new phone creates a customer; a second order from the same phone in a different format (`0300…` vs `+92300…`) attaches to the same customer. (M4-01: `customers.upsertByPhone(tx, ..)` inside the order's transaction; `customers.int.test.js` covers three phone formats, the latest name and city, and six orders at once. The order that calls it is M4-04.)
- [x] Flagging No COD shows the marker on that customer's next order. (API: the `cod_blocked` marker of M4-05; the order screen shows it as a chip and asks for an override reason to confirm: `order-detail.test.jsx`. The edit dialog needs a reason for the flag: `customers.test.jsx`.)
- [x] A staff-created order reserves stock and prices exactly like a storefront order with the same cart. (API: M4-10, one order transaction. The screen sends no price and shows the totals of `admin.orders.quote`: `order-new.test.jsx`. Done once against the real API: a staff-typed order came out `confirmed`, channel `admin`, with the placed, note and status events attributed to the staff member.)
- [x] Export without `customers:export` is not offered and the endpoint returns 403; a permitted export appears in the audit log. (The button is hidden without the permission: `customers.test.jsx`; the 403 and the audit entry are API tests of M4-01 and M4-10. The export asks for the password again.)
- [x] Anonymising a customer removes their name and phone from delivered orders and from search. (API: the customer row and, through `orders.anonymise`, the orders in a final status; the admin search reads the customer row. The dialog asks for the last four digits of the number and the password, and says so when an order is still open: `customers.test.jsx`.)

## 8. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-07.6-1 | Blocking COD on the storefront for flagged phones | Applies only when another method is enabled; with COD-only (A-07) the order is accepted and marked for staff | A prepaid method is enabled |
| Q-07.6-2 | Data-protection obligations in Pakistan | Not researched; anonymisation is provided as a capability | DOC-11 |
| Q-07.6-3 | Customer merge | Not in v1 | Duplicate records become a support problem |

## 9. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 3) |
| 2026-10-02 | Phase 4: anonymise permission named per DOC-11 |
| 2026-10-12 | M6-02 built (`/customers`, `/customers/:id`, `/orders/new`). Gaps: the list has no `minOrders` filter control (the API takes it); the made-to-measure form is the same field list the customer sees, and a bundle cannot be taken here yet (the page says so); the customer's order table shows the newest 25 and has no "all orders" link; the customer's Activity is the History panel (audit entries of the customer record). A staff-typed order uses `admin.orders.quote` for the totals and `admin.orders.create` with one idempotency key for each distinct order. |
| 2026-10-05 | M4-01 built (`apps/api/src/modules/customers`): list, detail, lookup by phone, update (flags need a reason for No COD), add-only notes, anonymise (owner, step-up, last four digits typed, refused while an order is open). Audit entries never hold a name, email or phone (the trail cannot be rewritten): a changed name or email is recorded only as "(changed)". |
