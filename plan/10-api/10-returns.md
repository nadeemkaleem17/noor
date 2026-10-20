# 10.10 — API: Return and exchange requests

| Field | Value |
|---|---|
| ID | DOC-10.10 |
| Title | Return and exchange requests (customer and admin) |
| Status | Built 2026-10-20 (M8-11, rows RT-02 to RT-04 of DOC-06.14) |
| Depends on | DOC-10.0, DOC-10.3 (orders, public), DOC-06.14 §2.11 |

A request records what a customer asked for and what staff decided. It never changes the order, the stock or the money: staff do that on the order screens (return a line, record a payment) after deciding. Tables `return_requests` and `return_request_lines` (migration `0027`), written only by `modules/returns`; numbers `RR-0001` from the `return_request` counter.

## 1. The rules

1. **The window is the shop's own setting** `policies.returnsDays` (Settings > Store, 0 to 90). Empty or 0 means the shop takes no requests: the order page shows nothing and the endpoint answers `action_not_allowed`. The window counts from the day the order was delivered.
2. **Only a delivered order** can be asked about. A line made to measure or to order (`customization` set) is not returnable (the returns page says so).
3. **How many pieces of a line can still be asked for** = quantity bought − already returned by staff − pieces in a request that was not declined. A declined request gives its pieces back. The same `returnableOf` function builds the order page and checks the request, so the page never offers what the endpoint refuses.
4. **Photos of a defect are not part of this slice**: the customer sends them to the shop's WhatsApp (the request form says so). Upload slots exist for review photos; reusing them is a later step if the shop sees the need.
5. Statuses and what staff may do next: `requested` → `approved` | `declined`; `approved` → `received` | `completed` | `declined`; `received` → `completed`. `declined` and `completed` end. A decline needs a note the customer reads.
6. A refund written on a request is only a record (paisa, at most the order's total). The money moves through `orders.recordPayment` by whoever pays it.

## 2. Routes

| Key | Method & path | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| `orders.requestReturn` | `POST /orders/by-token/:token/returns` | order link; bucket `orderAction` | B: `{ kind: 'return' \| 'exchange', reason, note?, exchangeNote?, lines: [{ lineId, quantity }] }` | 201 `{ number }` | `action_not_allowed` (not delivered, window over, shop takes none), `validation_failed` (`lines.i.lineId` not this order's or repeated, `lines.i.quantity` `too_big`), `not_found` |
| `admin.returns.list` | `GET /admin/returns` | `orders:read` | Q: `page`, `size`, `status?`, `orderId?` | 200 `Page<ReturnRow>` + `counts` by status; each row has the order number, customer, lines with their value, the order total and `next` (what staff may do) | — |
| `admin.returns.update` | `POST /admin/returns/:id/update` | `orders:return` | B: `{ status, decisionNote?, pickupOn?, refund? }` | 200 `ReturnRow` | `action_not_allowed` (a step not in `next`), `validation_failed` (`decisionNote` required to decline, `pickupOn` only while approved or received, `refund` above the order total or on a decline), `not_found` |

Every `admin.returns.update` writes an audit entry `return_request.<status>` (category `money` when a refund is written down) in the same transaction.

## 3. On the order page

`orders.getByToken` gains `variantId` on each line that was not made to measure (the storefront's "Buy again" puts those lines in the bag through `cart.addLine`: nothing is priced by the page), and `returns` (`windowDays`, `eligibleUntil` while a request can still be made, `requests[]` with status, the lines, the shop's note, the pickup day and the refund) and `returnable` on each line that can still be asked for. `returns` is absent when the shop takes none and no request exists.
