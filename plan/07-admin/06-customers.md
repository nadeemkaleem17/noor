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
| Flags | "No COD", "VIP", marketing consent | |

Filters: `q` (name, phone digits, email), `city`, `flag`, `minOrders`, `hasRefusals`. No bulk actions except Export (needs `customers:export`; the export is logged in the audit log with the filter used, and capped at 5,000 rows per request).

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

- [ ] An order from a new phone creates a customer; a second order from the same phone in a different format (`0300…` vs `+92300…`) attaches to the same customer.
- [ ] Flagging No COD shows the marker on that customer's next order.
- [ ] A staff-created order reserves stock and prices exactly like a storefront order with the same cart.
- [ ] Export without `customers:export` is not offered and the endpoint returns 403; a permitted export appears in the audit log.
- [ ] Anonymising a customer removes their name and phone from delivered orders and from search.

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
