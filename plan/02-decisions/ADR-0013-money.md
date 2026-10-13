# ADR-0013 — Integer paisa everywhere; no float rupees

| Field | Value |
|---|---|
| ID | ADR-0013 |
| Title | Money and numeric rules |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (K4, F-01), ADR-0005, ADR-0008 |
| Decisions used | ADR-0020 |

## Purpose and scope
Representation, arithmetic, rounding and display of money across API, DB and UI.

## Context
Contract: integer minor units, exponent 2 (`schemas.js:7-11`). Storefront: converts to float rupees (`catalogAdapter.js:16`), does promo math in rupees (`PromoContext.jsx:28`), rounds on display (`utils/format.js:1-3`) and converts back (`orderPayload.js:3`). Prices like Rs 17,759.20 occur in the market (v2 §2 row 4).

## Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Integer paisa end to end (`number`, safe integer) | Exact; matches contract; trivial JSON | Discipline needed; display must divide |
| B. Float rupees | Easy to read | Rounding drift; the current bug class |
| C. Decimal library (decimal.js/BigInt) | Arbitrary precision | Unneeded: PKR totals stay far below 2^53 paisa; serialization friction |

## Decision
**Option A.**
- Type: `Money = { amount: int (safe), currency: "PKR" }` from `packages/contract`. DB: `bigint` columns `*_minor`.
- All arithmetic uses helpers in `packages/contract/src/money.ts`: `add`, `sub`, `mulInt`, `percentOf(amount, bps)` (basis points, so 12.5% = 1250), `allocate(total, weights)` (largest-remainder so splits sum exactly).
- **Rounding rule:** compute in paisa; percentage discounts round **half away from zero to the nearest paisa** per order line, then sum. The display rounding (store setting `priceDisplay.rounding`: `none | nearest | up`, `showDecimals`) is **presentation only** and never alters stored amounts; if a store wants whole-rupee *charging*, that is a pricing rule that rounds before storing.
- Display: one formatter `formatMoney(money, locale)` using `Intl.NumberFormat` with `currency: "PKR"`; the storefront and admin both import it (replaces `formatPKR` and admin `formatMoney`).
- Forms: money inputs accept rupees as text with up to 2 decimals and convert with `parseRupees(str)`; the form state is a string until submit.
- No `Number` money arithmetic outside the helpers; ESLint rule `no-restricted-syntax` flags `* 100` and `/ 100` in app code.

## Examples
```ts
percentOf(1775920, 1000)      // 10% of Rs 17,759.20 → 177592 paisa
formatMoney({ amount: 1775920, currency: "PKR" }, "en-PK") // "Rs 17,759.20" (showDecimals true)
```

## Consequences
Removes the K4/F-01 class; requires touching every price display and form.

## Rules
**Always:** pass `Money` objects across module boundaries. **Never:** store or transmit rupees as floats; compute totals in the browser as the source of truth (ADR-0020). **Common mistake:** `Math.round(price * qty * 0.9)` in a component.

## Acceptance checklist
- [ ] Property test: for random carts, sum of line allocations equals the order discount exactly. **Open: no property test; the discount sums are tested on examples (`packages/contract/test/money.test.js`).**
- [ ] `grep -rnE "\* ?100|/ ?100" apps/*/src` finds only the money helpers. **Open: `percentOff` (a display number) and a few others match.**
- [ ] Storefront and admin render the same amount for the same `Money`. **Open.**

## Revisit trigger
Multi-currency is approved (then add currency exponents and an ADR for FX), or any total can exceed 2^53 paisa (not plausible).

## Open questions and assumptions
Assumes PKR exponent 2 as stated in the contract. Whether the shop wants whole-rupee *charging* is a pricing-policy choice for the store owner; default is exact paisa.

## Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed; corrects v1's "minor = 1 rupee" (already corrected in v2) |
| 2026-10-02 | Phase 5: exact pricing computation and per-line discount allocation in DOC-09.6 §4 |
| 2026-10-02 | M0-04: helpers operate on bare integers (`add`, `sub`, `mulInt`, `percentOf`, `allocate`, `parseRupees`, `moneyToDecimalString`, BigInt inside); `Money` is the JSON boundary shape. `formatMoney` lives in `@noor/i18n` (DOC-03 section 4), not in the contract, so the contract has no display code. The `* 100` / `/ 100` lint rule is not added yet (task M0-02 left it out; add with the first app code that does money) |
| 2026-10-02 | M0-12: `formatMoney(money, locale, priceDisplay)` implemented in `@noor/i18n`; passes an exact decimal string to `Intl.NumberFormat`, so no float rupees. ICU gives PKR no decimals by default, so the fraction digits are set explicitly (2 or 0). `rounding` and `showDecimals` are presentation only |
