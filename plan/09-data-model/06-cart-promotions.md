# 09.6 — Data Model: Cart and Promotions

| Field | Value |
|---|---|
| ID | DOC-09.6 |
| Title | Carts, cart lines, promo codes, promo targets, redemptions, pricing rules |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-09.0, DOC-09.3, DOC-09.4, DOC-06.5, DOC-07.7 |
| Decisions used | ADR-0013, ADR-0014, ADR-0020 |

## 1. Purpose and scope

**Governs:** tables of the `cart` and `promotions` modules, and the exact pricing computation every quote and order uses.
**Does not govern:** shipping fee lookup (DOC-09.9 §4), deposit collection (DOC-09.7, ADR-0017).

## 2. Cart tables

### 2.1 `carts`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | char(36) | NN | | PK |
| `token_hash` | char(64) (bin) | NN | | UQ. SHA-256 of the `nc_cart` cookie value (the cookie is a random token, not the row id) |
| `promo_id` | char(36) | NULL | | FK → `promos.id` SET NULL. One code per cart |
| `locale` | varchar(5) (bin) | NN | `'en'` | |
| `created_at`, `updated_at` | datetime(3) | NN | | `updated_at` = last activity; carts idle 30 days are deleted |

Index: `carts_updated_idx (updated_at)`.

A cart holds no customer data and no money: prices are read from variants every time it is priced.

### 2.2 `cart_lines`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | char(36) | NN | | PK |
| `cart_id` | char(36) | NN | | FK → `carts.id` CASCADE |
| `variant_id` | char(36) | NN | | FK → `variants.id` CASCADE (a deleted variant simply leaves the cart) |
| `quantity` | smallint | NN | | CHECK `BETWEEN 1 AND 99` |
| `customization` | json | NULL | | Schema `LineCustomization`: `{ measurements?: Record<string, string \| number>, notes?: string, bundle?: [{ productId, variantId }] }` |
| `customization_hash` | char(64) (bin) | NN | `''` | SHA-256 of the canonical JSON; `''` when none |
| `seen_unit_price_minor` | bigint | NN | | Unit price shown to the customer when the line was last priced; used only to detect `price_changed` |
| `created_at`, `updated_at` | datetime(3) | NN | | |

Indexes: UQ `cart_lines_identity_uq (cart_id, variant_id, customization_hash)` (line identity, ADR-0014); `cart_lines_cart_idx (cart_id, created_at)`. Max 50 lines per cart (service).

## 3. Promotion tables

### 3.1 `promos`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | char(36) | NN | | PK |
| `code` | varchar(20) (bin) | NN | | UQ. Stored upper-case |
| `type` | varchar(16) (bin) | NN | | `promo_type` |
| `value_bps` | int | NULL | | `percent`: 100–9000 |
| `value_minor` | bigint | NULL | | `fixed`: > 0 |
| `max_discount_minor` | bigint | NULL | | Cap for `percent` |
| `min_spend_minor` | bigint | NULL | | Against the eligible subtotal |
| `scope` | varchar(16) (bin) | NN | `'all'` | `all`, `categories`, `products` |
| `exclude_sale_items` | boolean | NN | true | |
| `first_order_only` | boolean | NN | false | |
| `usage_limit` | int | NULL | | Total |
| `per_customer_limit` | int | NULL | 1 | Per phone |
| `usage_count` | int | NN | 0 | Active (non-reversed) redemptions; maintained in-transaction |
| `starts_at`, `ends_at` | datetime(3) | NULL | | |
| `enabled` | boolean | NN | true | |
| `note` | varchar(300) | NULL | | Internal |
| `version` | int | NN | 1 | |
| `created_at`, `updated_at` | datetime(3) | NN | | |

Check `promos_value_chk`: (`type='percent'` AND `value_bps` IS NOT NULL AND `value_minor` IS NULL) OR (`type='fixed'` AND `value_minor` IS NOT NULL AND `value_bps` IS NULL) OR (`type='free_shipping'` AND both NULL).

Derived status (API output, never stored): `disabled` if not `enabled`; else `scheduled` if `starts_at` in the future; `expired` if `ends_at` in the past or `usage_count >= usage_limit`; else `active`.

### 3.2 `promo_targets`

`promo_id` + `target_type` + `target_id` PK · FK `promo_id` → `promos.id` CASCADE · `target_type` = `promo_target_type` · `target_id char(36)` (category or product id; no FK because it is polymorphic; rows are removed by the service when the target is deleted). A category target includes its descendants.

### 3.3 `promo_redemptions`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | char(36) | NN | | PK |
| `promo_id` | char(36) | NN | | FK → `promos.id` RESTRICT (a used promo cannot be deleted) |
| `order_id` | char(36) | NN | | FK → `orders.id` CASCADE; UQ (one redemption per order) |
| `customer_id` | char(36) | NN | | FK → `customers.id` RESTRICT |
| `discount_minor` | bigint | NN | | Amount given (0 for free shipping; the waived fee is in `shipping_waived_minor`) |
| `shipping_waived_minor` | bigint | NN | 0 | |
| `created_at` | datetime(3) | NN | | |
| `reversed_at` | datetime(3) | NULL | | Set on order cancellation |

Indexes: `promo_redemptions_promo_idx (promo_id, reversed_at)`, `promo_redemptions_customer_idx (customer_id, promo_id, reversed_at)`.

## 4. Pricing computation (the single implementation, `cart.price`)

Runs for every cart read, quote and order creation, inside the caller's transaction for orders. All arithmetic is integer paisa through `@noor/contract` money helpers.

| Step | Rule |
|---|---|
| 1. Lines | For each cart line load the variant (must be `enabled`, product `active`); `unitPrice = variants.price_minor`; `lineSubtotal = unitPrice × quantity`. Attach issues: `unavailable`, `sold_out`, `low_stock` (available < quantity → quantity is **not** silently changed; the line carries `available`), `price_changed` (unit price ≠ `seen_unit_price_minor`; the seen price is then updated) |
| 2. Subtotal | `subtotal = Σ lineSubtotal` |
| 3. Promo eligibility | A line is eligible if it matches the promo's scope (all / category incl. descendants / product) and, when `exclude_sale_items`, its variant has no `compare_at_minor`. `eligibleSubtotal = Σ` eligible `lineSubtotal` |
| 4. Promo validity | In order, first failure wins: `promo_not_found` · disabled → `promo_not_found` · `promo_not_started` · `promo_expired` · `promo_usage_limit` (`usage_count >= usage_limit`) · `promo_not_applicable` (`eligibleSubtotal = 0`) · `promo_min_spend` (`eligibleSubtotal < min_spend_minor`). At **order creation only**, with the customer's phone known: per-customer limit and first-order-only → `promo_customer_limit`, `promo_first_order_only` |
| 5. Discount | `percent`: per eligible line `lineDiscount = roundHalfAwayFromZero(lineSubtotal × bps / 10000)`; `discount = Σ lineDiscount`; if `max_discount_minor` and `discount >` cap, scale the line discounts proportionally (largest-remainder method) so they sum exactly to the cap. `fixed`: `discount = min(value_minor, eligibleSubtotal)`, spread across eligible lines in proportion to `lineSubtotal` (largest remainder). `free_shipping`: `discount = 0` |
| 6. Shipping | Needs a city (else `shipping = null`): `shipping.quote` → method fee; fee is 0 when `(subtotal − discount) >= free_above_minor`, or when the promo is `free_shipping` |
| 7. Total | `total = subtotal − discount + shipping` |
| 8. Deposit | For lines of products with `mto_deposit_bps`: `lineDeposit = ceil((lineSubtotal − lineDiscount) × bps / 10000)`; `depositDue = Σ lineDeposit` (ADR-0014). `dueOnDelivery = total − depositDue` |
| 9. Payment options | Per enabled method: `cod` disallowed when `total > codLimit` (`cod_limit_exceeded`), when the zone/method has `cod_allowed = false` (`cod_not_available`), or when `depositDue > 0` and any prepaid method is enabled (`deposit_requires_prepayment`, ADR-0017 with its launch rule) |
| 10. Messages | Free-shipping progress: `free_above_minor − (subtotal − discount)` when positive |

The rounding rule (half away from zero to the paisa, per line, then sum) is ADR-0013's; `ceil` for deposits is ADR-0014's. Per-line discounts are stored on order lines so refunds and partial returns use exact amounts.

At order creation `promotions.redeem(tx, …)` locks the promo row `FOR UPDATE`, re-checks the limits, inserts the redemption and increments `usage_count`; cancellation sets `reversed_at` and decrements it (ADR-0020 §2).

## 5. Rules

**Always:** price through `cart.price`; store the per-line discount on the order; lock the promo row before counting usage.
**Never:** store a price or total on a cart; change a line's quantity without the customer asking; evaluate promo limits outside the order transaction; let two redemptions exist for one order.
**Common mistakes:** computing the percentage on the cart total instead of per eligible line (different rounding); counting reversed redemptions toward limits; applying min spend to the full subtotal instead of the eligible one.

## 6. Acceptance checklist

- [x] Adding the same variant with the same customisation twice yields one line with summed quantity; a different customisation yields two lines. (Cart: M4-03.) (`cart.int.test.js`: the identity is the variant plus the hash of the canonical customisation, so key order does not matter; the unique key `cart_lines_identity_uq` is the backstop.)
- [x] 10% off on lines of Rs. 6,990.00 and Rs. 1,234.56 gives discounts 69900 and 12346 paisa, total 82246 (unit test with these numbers). (`promo-evaluate.test.js`; also through `admin.promos.preview` in `promos.int.test.js`.)
- [x] A fixed Rs. 500 code over three eligible lines produces line discounts summing to exactly 50000 paisa. (`promo-evaluate.test.js`: the spare paisa goes to the earlier of the two largest remainders.)
- [x] Two concurrent orders using the last allowed use of a code → one succeeds, one gets `promo_usage_limit`. (`promos.int.test.js`, repeated; `redeem` locks the promo row `FOR UPDATE`. The per-customer count is also a locking read, so two orders of one customer cannot both pass.)
- [x] Cancelling an order decrements `usage_count` and the customer can use the code again. (`reverse(tx, orderId)`; a second call does nothing; a promo with a reversed redemption still counts as used, so it cannot be deleted.)
- [ ] The storefront quote, the order created from it and the admin preview (`admin.promos.preview`) return identical amounts for the same cart. (The preview and the cart quote both call `evaluatePromo` through `priceCart`; the order created from it is M4-04.)

## 7. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-09.6-1 | Free-shipping threshold compares against subtotal after discount | Yes | Owner prefers before discount |
| Q-09.6-2 | Sale items excluded from promos by default | Yes (`exclude_sale_items` default true) | Owner changes the default |
| Q-09.6-3 | One code per cart | DOC-06.5 Q-06.5-3 | — |

## 8. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 5, part 1) |
| 2026-10-06 | M4-03: `carts` and `cart_lines` built (migration 0013). `modules/cart/pricing.js` `priceCart` is the one pricing function (steps 1 to 10, pure, 100% branch coverage in `cart-pricing.test.js`); the cart service loads the facts and calls it for every read, quote and (M4-04) order. Decisions: lines the customer can no longer buy stay in the subtotal with `sold_out` or `unavailable` and block the order; the cheapest delivery option is chosen by the fee after the free-delivery threshold; payment options appear once a city is quoted; a customer with a No COD flag gets `cod_not_available`; the code on a cart that stops applying is dropped from the price and reported as `promoProblem` (orders will answer `promo_invalid`); the per-order limit and the stock are counted over all lines of the same variant. |
| 2026-10-05 | M4-02: `promos`, `promo_targets`, `promo_redemptions` built (migration 0012). The promo steps of section 4 (3 to 5, and the window checks of step 4) are one pure function, `modules/promotions/evaluate.js` (`evaluatePromo`, `promoStatus`), which `cart.price` will call. `promo_redemptions.order_id` has its unique index but no foreign key to `orders` yet: M4-04 adds it. Target rows whose category or product is gone are ignored and dropped at the next save; nothing is wired into the catalog delete. A disabled code is answered as `promo_not_found`. |
