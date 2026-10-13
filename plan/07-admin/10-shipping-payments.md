# 07.10 — Admin: Shipping and Payments

| Field | Value |
|---|---|
| ID | DOC-07.10 |
| Title | Delivery zones, methods, cities, couriers, payment methods, COD rules |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-07.1, DOC-06.5 §4, README (A-06, A-07) |
| Decisions used | ADR-0013, ADR-0017, ADR-0020 |

## 1. Purpose and scope

**Governs:** `/settings/shipping` and `/settings/payments`.
**Does not govern:** fee calculation (ADR-0020 §3, DOC-09 shipping); provider credentials and webhooks (DOC-12, DOC-14 secrets); courier API integrations (DOC-12).

Fixes F-05 (shipping rule hard-coded in five places) and F-06 (city is free text): the storefront's city list, fees, thresholds and ETAs all come from this screen.

View needs `settings:read`; changes need `settings:write`.

## 2. Shipping (`/settings/shipping`)

### 2.1 Zones

A zone is a named set of cities with its delivery methods (GLOSSARY "Zone"). A city belongs to **exactly one** zone. Delivery is inside Pakistan only (A-06).

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Shipping                                                    [+ New zone]  │
├───────────────────────────────────────────────────────────────────────────┤
│ Major cities        Lahore, Karachi, Islamabad +4      2 methods    ✎ ✕  │
│   Standard  3–5 days   Rs. 250   free over Rs. 5,000                      │
│   Express   1–2 days   Rs. 450                                            │
│ Rest of Pakistan    212 cities                         1 method     ✎ ✕  │
│   Standard  4–7 days   Rs. 350   free over Rs. 8,000                      │
├───────────────────────────────────────────────────────────────────────────┤
│ Cities not in any zone: 0                                                 │
└───────────────────────────────────────────────────────────────────────────┘
```

Zone drawer:

| Field | Control | Rules |
|---|---|---|
| Name | `Input` | Required, unique (internal; not shown to customers) |
| Cities | Multi `Combobox` over the **city master list**, with "Paste a list" (one per line or comma-separated; unknown names are listed for correction, not silently added) | A city already in another zone is shown with that zone's name and a "Move here" action |
| Methods | Repeating rows (below), 1–4 | At least one enabled method |

Method row:

| Field | Control | Rules |
|---|---|---|
| Label | `Input` | Required, shown to customers ("Standard delivery") (+ Urdu) |
| Fee | `MoneyInput` | ≥ 0 |
| Free above | `MoneyInput`, optional | Order subtotal after discount at or above this → fee 0 |
| ETA min / max | `NumberInput` days | 0 ≤ min ≤ max ≤ 60 |
| Cash on delivery available | Checkbox, default on | Lets a zone or method be prepaid-only |
| Enabled | `Switch` | |

### 2.2 City master list

A seeded list of Pakistani cities and towns (name, province, optional alternate spellings such as "Lyallpur" for Faisalabad or "Pindi" for Rawalpindi used by the checkout combobox search). Staff can add a city (name + province) and alternate spellings; cities are never deleted once used by an order, only removed from zones. "Cities not in any zone" lists master cities customers cannot order to; the count links to a filtered view.

### 2.3 Couriers

List used by the dispatch dialog (DOC-07.5 §4.1), replacing the hard-coded `COURIERS` array (`lib/orders.js:4`).

| Field | Rules |
|---|---|
| Name | Required, unique (seed: TCS, Leopards, M&P, Trax, PostEx, Own rider) |
| Tracking URL pattern | Optional, must contain `{tracking}` and be `https://`; used for the customer's "Track with courier" link (DOC-06.6) |
| Tracking number required | Checkbox (off for "Own rider") |
| Enabled | `Switch`; a courier used by orders is disabled, never deleted |

### 2.4 Other delivery settings

| Setting | Control | Default |
|---|---|---|
| Dispatch promise | `Input` shown on the PDP and order page ("Dispatched within 1–2 working days") | empty |
| Low-stock threshold | `NumberInput` | 3 (DOC-07.2) |

## 3. Payments (`/settings/payments`)

One card per method defined in the contract (`cod`, `bank_transfer`, `wallet`, `card`, `bnpl`). At launch only **Cash on delivery** is enabled (A-07).

| Card | Fields | Rules |
|---|---|---|
| Cash on delivery | Enabled; label and description shown at checkout (+ Urdu); **COD order limit** (`MoneyInput`, optional: orders above it cannot use COD); **High-value threshold** (`MoneyInput`, default Rs. 25,000: marks orders for extra care, DOC-07.5 §5.3); "Require confirmation before dispatch" (always on, shown read-only with the reason, ADR-0017) | Cannot be disabled while it is the only enabled method |
| Bank transfer | Enabled; label, description; account title, bank, account number/IBAN, instructions (shown on the order page and in the WhatsApp message) | Enabling requires all account fields |
| JazzCash / Easypaisa / Card gateway | Shown as "Not connected: available when the integration is installed (DOC-12)". No credential fields exist in this UI: provider secrets live in server environment configuration only (ADR-0017) | The toggle is disabled until the API reports the adapter as configured |
| Buy now pay later | Hidden until an adapter exists | |

Display order of enabled methods at checkout: drag-free up/down buttons; COD first by default.

A banner at the top states the current effective set: "Customers can pay with: Cash on delivery."

Deposit behaviour note (read-only help text): "While only cash on delivery is enabled, made-to-order deposits are collected by staff and recorded on the order before confirming" (ADR-0017 launch rule, DOC-07.5 §4.1).

## 4. Saving and safety

| Rule | Detail |
|---|---|
| Save | Each drawer/card saves on its own with `version` (stale-write dialog) |
| Validation | The API rejects a configuration that leaves **no** deliverable city or **no** enabled payment method; the UI shows the same checks before saving |
| Impact preview | Before saving a zone change that removes cities: "N open carts and 0 open orders use these cities" (open orders keep their stored fee and are unaffected) |
| Existing orders | Never re-priced by a settings change (they store their own shipping fee and method label) |
| Audit | Every change here is audit-logged with before/after (DOC-07.13); these are money-affecting settings |
| Cache | Saving purges the storefront `store-config` tag |

## 5. Rules

**Always:** keep every deliverable city in exactly one zone; show the customer-facing effect of a change before saving; keep provider secrets out of the admin UI and database.
**Never:** hard-code a fee, threshold, city or courier anywhere in code; let a save leave the store with no payment method or no deliverable city; re-price placed orders.
**Common mistakes:** the same city in two zones; a free-shipping threshold lower than the fee makes sense for; enabling bank transfer with no account details.

## 6. Acceptance checklist

- [ ] The checkout city list equals the union of zone cities after a save (integration test). (Server side only; not an admin UI item.) **Open: no integration test.**
- [x] Adding a city already in another zone offers "Move here" and never duplicates it. (`shipping.test.jsx`; the picker also says which zone a city is in.)
- [ ] Changing a fee changes the storefront quote for a new cart and leaves an existing order's shipping fee unchanged. (Storefront and orders: M4/M5.) **Open: no test changes a fee and then reads an old order.**
- [x] Disabling the only payment method is refused with an explanation. (The switch of the last method that is on is locked with the reason; the API also answers `no_payment_method`.)
- [ ] An order above the COD limit cannot select COD on the storefront (`cod_limit_exceeded`). (The limit is saved here; the check is in checkout, M4.) **Open: the check is in the order transaction; no test names `cod_limit_exceeded`.**
- [ ] The dispatch dialog lists exactly the enabled couriers; a tracking URL pattern without `{tracking}` is rejected. (The courier list and the `{tracking}` rule are here; the dispatch dialog is M4.) **Open.**
- [x] No input on these screens accepts or displays a provider secret. (Not-connected methods show a note and no fields.)

## 7. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-07.10-1 | Source of the city master list | A seeded list of about 250 cities/towns compiled at M0 from courier coverage lists; not researched in this phase | Seed task in DOC-16 |
| Q-07.10-2 | Weight- or item-based fees | Not in v1 (flat fee per method per zone) | Heavy items (bridal boxes, home textiles) cost more to ship |
| Q-07.10-3 | Per-city COD blocking | Via "Cash on delivery available" per zone/method | Courier refuses COD in specific cities |
| Q-07.10-4 | Courier booking and status sync | Manual in v1 | DOC-12 |

## 8. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 3) |
| 2026-10-05 | M3-06 built: shipping (zones list, zone drawer with a city picker, "Move here", paste a list and the server's impact count before a change; city master list with other spellings; couriers; dispatch promise and low-stock threshold in the store document) and payments (one card per method saved on its own, the last method that is on cannot be switched off, bank transfer needs every account detail, checkout order with up/down, "Customers can pay with" banner). The high-value COD threshold lives in the store document and is saved with the COD card only when changed. "0 open orders" in the impact text is fixed until orders exist (M4); open carts are 0 from the API until the cart module. |
