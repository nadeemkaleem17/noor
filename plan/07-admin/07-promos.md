# 07.7 — Admin: Promo Codes

| Field | Value |
|---|---|
| ID | DOC-07.7 |
| Title | Promo code list, form, rules and usage |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-07.1, DOC-07.14, DOC-06.5 §2–3 |
| Decisions used | ADR-0013, ADR-0020 |

## 1. Purpose and scope

**Governs:** `/promos`: creating and managing discount codes.
**Does not govern:** how a discount is calculated and enforced (ADR-0013 rounding, ADR-0020 §2, DOC-09/DOC-10 promotions); sale prices (compare-at prices on variants, DOC-07.3).

Fixes F-02: codes and usage counts live in the storefront's localStorage today; here they are server records and the storefront only sends a code.

## 2. List

| Column | Content |
|---|---|
| Code | `EID10` (monospace), click to edit |
| Type / value | "10% off", "Rs. 500 off", "Free shipping" |
| Conditions | Min spend, scope summary ("Lawn, Stitched" / "3 products" / "Everything") |
| Usage | `used / limit` (or `used` when unlimited), linking to the orders that used it (`/orders?promo=EID10`) |
| Window | Start – end, or "No end" |
| Status | `StatusBadge`: active, scheduled, expired, disabled |
| ⋯ | Edit, Duplicate, Disable/Enable, Delete |

Filters: `q`, `status`, `type`. Status is **derived** by the API from the enabled flag and the dates; staff set only "Enabled" and the window.

## 3. Form (drawer, `?edit=<id>` / `?new=1`)

| Field | Control | Rules |
|---|---|---|
| Code | `Input` | Required, unique, 3–20 of `A–Z 0–9 - _`, upper-cased as typed. "Generate" makes a random 8-character code. **Immutable once used by an order** |
| Type | `RadioGroup`: Percentage / Fixed amount / Free shipping | Immutable once used |
| Value | Percentage: `NumberInput` 1–90 (whole percent; stored as basis points). Fixed: `MoneyInput` > 0. Free shipping: none | |
| Maximum discount | `MoneyInput`, optional, percentage type only | Caps the discount amount |
| Minimum spend | `MoneyInput`, optional | Compared with the subtotal of **eligible** lines |
| Applies to | `RadioGroup`: Everything / Categories / Products, then a multi `Combobox` | Categories include descendants |
| Exclude sale items | Checkbox, default on | Lines whose variant has a compare-at price are not discounted and do not count toward min spend |
| Total usage limit | `NumberInput`, optional | |
| Per-customer limit | `NumberInput`, optional, default 1 | Counted per phone number |
| First order only | Checkbox | Phone has no previous non-cancelled order |
| Starts / Ends | date-time, optional | End after start; Asia/Karachi |
| Enabled | `Switch` | |
| Internal note | `Textarea` | Why the code exists (campaign, compensation) |

A live sentence under the form reads the rule back: "10% off Lawn and Stitched, up to Rs. 2,000, on orders over Rs. 5,000. Once per customer. 1–15 Oct 2026."

## 4. Behaviour

| Topic | Rule |
|---|---|
| One code per cart | Fixed in v1 (DOC-06.5 Q-06.5-3) |
| Editing a used code | Value, conditions, limits and window can change (affects future orders only; past orders keep their stored discount). Code and type cannot |
| Delete | Only when never used; otherwise Disable. Dialog explains |
| Usage count | Read-only; incremented inside the order transaction and decremented on cancellation (ADR-0020 §2) |
| Test | "Try this code" box: paste a cart total and category to see whether it would apply and the discount, computed by `admin.promos.preview` (server), not in the browser |
| Compensation codes | "Duplicate" + per-customer limit 1 + usage limit 1 is the pattern for a one-off goodwill code |

## 5. Rules

**Always:** state the rule back in words before saving; keep past orders' discounts unchanged; use the server preview.
**Never:** compute a discount in the admin client; allow two active codes with the same text; delete a used code.
**Common mistakes:** a percentage code with no maximum on high-value bridal items; forgetting the end date; expecting codes to stack.

## 6. Acceptance checklist

- [ ] Creating `eid10` saves as `EID10`; a second `EID10` is rejected.
- [ ] A scheduled code shows `scheduled` and is refused by the storefront before its start with `promo_not_started`.
- [ ] After one use, the code and type fields are read-only and Delete is replaced by Disable.
- [ ] Cancelling an order that used the code decrements its usage.
- [ ] The preview result equals the discount the storefront cart shows for the same cart.
- [ ] Every storefront error code in DOC-06.5 §2.1 can be produced by a configuration made on this screen.

## 7. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-07.7-1 | New promo fields (`maxDiscount`, `excludeSaleItems`, `firstOrderOnly`, `enabled`, note; value as basis points) | Added to the contract in DOC-09/DOC-10 promotions | DOC-09 |
| Q-07.7-2 | Automatic discounts without a code | Not in v1 (use compare-at prices) | Owner asks for "buy 2 get 10%" |
| Q-07.7-3 | Bulk code generation | Not in v1 | Influencer campaigns need 50+ unique codes |

## 8. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 3) |
