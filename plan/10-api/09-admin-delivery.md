# 10.9 — API: Delivery people, runs, rider ledger and receipts (admin)

| Field | Value |
|---|---|
| ID | DOC-10.9 |
| Title | Delivery assignment, ledger, receipts |
| Status | Built 2026-10-20 |
| Depends on | DOC-10.0, DOC-18 (the design and its decisions), DOC-10.6 (orders) |

All routes are `auth: staff`. Money in responses is `Money`; amounts in cash requests are integer paisa. A positive ledger amount is cash the rider owes the shop. The ledger is append-only. The order's status and its cash on delivery are changed only through `orders.transition`; this module never writes an order.

## Routes

| Key | Method & path | Permission | Request | Response | Errors |
|---|---|---|---|---|---|
| `admin.delivery.people.list` | `GET /delivery/people` | `deliveries:read` | — | 200 `{ items: DeliveryPerson[] }` (with `balance`, `ordersOut`) | — |
| `admin.delivery.people.create` | `POST /delivery/people` | `deliveries:assign` | B: `DeliveryPersonInput` (`name`, `phone`, `kind`, `courierId?`, `fee?`, `active`, `note?`) | 201 `DeliveryPerson` | `validation_failed` (phone not a mobile number) |
| `admin.delivery.people.update` | `PUT /delivery/people/:id` | `deliveries:assign` | B: input + `version` | 200 `DeliveryPerson` | `stale_write`, `not_found` |
| `admin.delivery.assign` | `POST /delivery/assign` | `deliveries:assign` | B: `{ personId, orderIds[1..100], runDate?, note? }` | 200 `{ runId?, number?, assigned[], skipped[{ id, code, detail? }] }` | `validation_failed` (person not active), `not_found` (person). Per order: `not_found`, `already_assigned`, `not_assignable` (only `confirmed` orders) |
| `admin.delivery.runs.list` | `GET /delivery/runs` | `deliveries:read` | Q: `page`, `size`, `status?`, `personId?` | 200 `Page<RunRow>` | — |
| `admin.delivery.runs.get` | `GET /delivery/runs/:id` | `deliveries:read` | — | 200 `Run` (assignments, `shop`) | `not_found` |
| `admin.delivery.runs.sendOut` | `POST /delivery/runs/:id/send-out` | `deliveries:assign` | — | 200 `Run` | `action_not_allowed` (not open), `validation_failed` (nothing to send) |
| `admin.delivery.runs.close` | `POST /delivery/runs/:id/close` | `deliveries:assign` | — | 200 `Run` | `action_not_allowed` (already closed, or an order still out) |
| `admin.delivery.assignments.deliver` | `POST /delivery/assignments/:id/deliver` | `deliveries:assign` | — | 200 `Run` | `action_not_allowed` (not out or failed) |
| `admin.delivery.assignments.fail` | `POST /delivery/assignments/:id/fail` | `deliveries:assign` | B: `{ reason }` | 200 `Run` | `action_not_allowed` |
| `admin.delivery.assignments.return` | `POST /delivery/assignments/:id/return` | `deliveries:assign` | — | 200 `Run` | `action_not_allowed` |
| `admin.delivery.assignments.remove` | `POST /delivery/assignments/:id/remove` | `deliveries:assign` | — | 200 `Run` | `action_not_allowed` (already out) |
| `admin.delivery.ledger.statement` | `GET /delivery/people/:id/ledger` | `ledger:read` | Q: `from?`, `to?` (Pakistan days) | 200 `Statement` (`opening`, `closing`, entries with running `balance`) | `not_found` |
| `admin.delivery.ledger.deposit` | `POST /delivery/people/:id/deposit` | `ledger:write` | B: `{ amount, note? }` | 201 `Receipt` (`DP-…`) | — |
| `admin.delivery.ledger.payFee` | `POST /delivery/people/:id/pay-fee` | `ledger:write` | B: `{ amount, note? }` | 201 `Receipt` (`FP-…`) | — |
| `admin.delivery.ledger.adjust` | `POST /delivery/people/:id/adjust` | `ledger:write` | B: `{ amount (signed, not 0), note }` | 200 `Statement` | — |
| `admin.delivery.receipts.list` | `GET /delivery/receipts` | `ledger:read` | Q: `page`, `size`, `kind?`, `personId?`, `status?` | 200 `Page<ReceiptRow>` | — |
| `admin.delivery.receipts.get` | `GET /delivery/receipts/:id` | `ledger:read` | — | 200 `Receipt` (with `shop`) | `not_found` |
| `admin.delivery.receipts.void` | `POST /delivery/receipts/:id/void` | `receipts:void` | B: `{ reason }` | 200 `Receipt` | `action_not_allowed` (already void) |
| `admin.orders.delivery` | `GET /orders/:id/delivery` | `deliveries:read` | — | 200 `{ items }` (every run the order was on) | — |

## Rules

- A person who has a ledger is never deleted, only made not active.
- An order is in at most one live assignment (`delivery_assignments.open_key` is unique); an order that is not `confirmed` is skipped with a reason, the rest are assigned.
- Send out: each order is dispatched through `orders.transition` (courier = the person's, or the shop's "Own delivery", made the first time; tracking = the run number) and the cash to collect is put on the rider's ledger. An order that changed meanwhile leaves the run and is not sent.
- Deliver: `orders.transition(to: 'delivered', cashReceived)` records the cash on delivery; a customer receipt (`RC-…`) is made when there was cash to collect; the person's fee is credited.
- Return: `orders.transition(to: 'returned', returnType: 'undelivered')` for all lines with restock; the cash is taken off the rider.
- Voiding a deposit or fee receipt posts a reversing ledger entry; a customer receipt has no ledger entry of its own.
- Every step writes an audit entry (category `money` for the ones that move cash).

## Acceptance

- [x] The flow assign → send out → deliver → deposit → void is covered through HTTP (`apps/api/test/delivery.int.test.js`), including permissions, stale writes and the audit entries.
- [x] The balance is the sum of the ledger; the statement carries a running balance on every line.
