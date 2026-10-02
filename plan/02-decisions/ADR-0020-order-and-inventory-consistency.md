# ADR-0020 — Server-side pricing, idempotent order creation, stock reservation, sequence order numbers

| Field | Value |
|---|---|
| ID | ADR-0020 |
| Title | Order and inventory consistency |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (K9, K10, K11, F-01, F-02, F-03), ADR-0008, ADR-0013, ADR-0017 |
| Decisions used | ADR-0005, ADR-0009, ADR-0014 |

## Purpose and scope
Rules that make checkout correct under retries, concurrency and hostile clients. Tables are DOC-09 orders/inventory; endpoints are DOC-10 cart/orders.

## Context
The mock accepts client-supplied `discount`, `shippingFee`, `total` (`schemas.js:200-202`; only `subtotal` checked, `server.js:89-90`), never validates promos (F-02), lets duplicate lines for one variant drive stock negative (`server.js:84,94`), derives order numbers from an in-memory max (`:54`), has no idempotency (`:76`) and lets admin PUT overwrite orders without transition rules (`:166-171`).

## Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Server-priced cart + idempotent create + DB-enforced stock with reservation | Correct by construction | More endpoints and tables |
| B. Keep client totals, verify after | Little change | Still trusts the client; races remain |
| C. Optimistic stock decrement at payment only | Simple | Oversells during checkout; bad for limited lawn drops |

## Decision
**Option A.**
1. **Server-priced cart.** The cart lives in the DB (`carts`, `cart_lines`). Every response contains server-computed `subtotal`, `discount`, `shipping`, `total`. `POST /orders` takes the cart token (header) + customer + address + shipping method + payment method + `Idempotency-Key`; **it accepts no money fields**. Prices come from variants at that instant; if a line's price changed since added, the response is `409 price_changed` with the new cart.
2. **Promotions server-side.** Validation, stacking rules, usage counting and per-customer limits run in `promotions` inside the order transaction; `usage_count` increments with the order, decrements on cancel.
3. **Shipping server-side.** Fee from zone/method by normalised city (DOC-09 shipping); free-shipping thresholds live in settings, not code (F-05).
4. **Idempotency.** `Idempotency-Key` (UUID, client-generated, persisted in session storage per checkout attempt) is stored in `idempotency_keys(key, scope, request_hash, response, expires_at)`. Same key + same body → replay the stored response; same key + different body → `422 idempotency_mismatch`; TTL 24 h. The client UX guard remains.
5. **Stock.** `inventory_levels(variant_id, on_hand, reserved)` with `CHECK (on_hand >= 0 AND reserved >= 0 AND reserved <= on_hand)`. Order creation, in one transaction: lock affected variant rows in ascending id order (`SELECT … FOR UPDATE`), **aggregate quantities per variant across all lines**, check availability (`on_hand - reserved >= qty`), then increase `reserved`. Reservations convert to `on_hand` decrements at dispatch; cancel/expire releases them. Unpaid online-payment reservations expire after 30 min (job). Made-to-order/preorder variants skip counts (ADR-0014).
6. **Order numbers.** Human number from a counter row (MySQL has no sequences): inside the order transaction, `UPDATE counters SET value = LAST_INSERT_ID(value + 1) WHERE name = 'order_number'`, then read `LAST_INSERT_ID()`; `RB-` + that value, starting at 10001. The row lock serialises concurrent orders, so numbers are unique and never derived from order data; a rolled-back order leaves no gap. Public tracking uses a separate unguessable `tracking_token` (ADR-0012).
7. **State machines on the server.** Allowed transitions are a table in `orders` (DOC-09); `POST /admin/orders/:id/transitions` takes `{ to, reason?, courier?, trackingNo? }`, validates the edge and role, appends `order_events`, and runs side effects (stock, invoice number from `counters`, notifications via outbox). There is no endpoint that replaces an order document.
8. **Invoice numbers** come from a per-year counter row, `counters.name = 'invoice_2026'` (`INV-2026-000123`), assigned once at first dispatch (replaces `Math.random()`, F-04).

## Examples
```sql
create table counters (name varchar(32) primary key, value bigint not null);
insert into counters values ('order_number', 10000);
create table inventory_levels (
  variant_id char(36) primary key,
  on_hand int not null,
  reserved int not null default 0,
  foreign key (variant_id) references variants(id),
  -- table-level: a MySQL column CHECK cannot reference another column
  constraint inventory_levels_chk check (on_hand >= 0 and reserved >= 0 and reserved <= on_hand)
);
```
```http
POST /api/v1/orders
Idempotency-Key: 6f1c0f70-6a7c-4d0b-9d63-2b4e1f1d5e55
X-Cart-Token: h3k…
{ "customer":{"name":"Ayesha Khan","phone":"+923001234567"},
  "shippingAddress":{"cityId":"0192aa…","address":"…","landmark":"…"},"shippingMethodId":"0192bb…","paymentMethod":"cod" }
```

## Consequences
Removes K9–K11 and F-01…F-03 by construction. Checkout cost: a few more queries and row locks; contention on hot variants during drops and on the single `order_number` counter row, held until commit (acceptable at A-03; see revisit).

## Rules
**Always:** compute money on the server; aggregate stock per variant; write `order_events` for every change. **Never:** accept `total`, `discount`, `shippingFee` from a client; update an order status with a bare `UPDATE` outside the transition function; derive identifiers from `max()+1`. **Common mistake:** locking rows in different orders in different code paths (deadlocks); fixed order is `counters` last, variants ascending by id. Retry the transaction on MySQL error 1213 (deadlock), up to 3 times.

## Acceptance checklist
- [ ] Test: two lines for one variant (2+2) with stock 3 → `409 insufficient_stock`, stock unchanged.
- [ ] Test: 50 concurrent orders for the last unit → exactly one succeeds.
- [ ] Test: same `Idempotency-Key` twice → one order, identical response.
- [ ] Test: posting a body containing `total` is rejected by schema.
- [ ] Test: invalid transition (`pending → delivered`) → `409 invalid_transition`.

## Revisit trigger
Lock wait p95 over 200 ms during a drop, or a single SKU sees over 20 orders/s (consider a queue-based allocation for that SKU).

## Open questions and assumptions
Reservation TTL (30 min) and COD confirmation window (DOC-07) are assumptions; tune from real data after launch.

## Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |
| 2026-10-02 | Order and invoice numbers from a `counters` table (no sequences in MySQL); DDL rewritten; deadlock retry rule added |
| 2026-10-02 | Order-number prefix is `RB-` (store name Rubaya, README A-10); the prefix is a store setting, not a constant |
| 2026-10-02 | Phase 5: order transition table (DOC-09.7 §5.1), inventory operations and lock order (DOC-09.4 §3), counters and idempotency protocol (DOC-09.1) |
| 2026-10-02 | Phase 5: `orders.create` body has no `cartId` (the cart comes from `X-Cart-Token`) and may carry `expectedTotal` only as a guard that can refuse, never as a price (DOC-10.3 §3) |
| 2026-10-02 | Phase 7 consistency review: example request matches DOC-10.3 §3 |
