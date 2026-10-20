# 18. Delivery assignment, rider ledger and receipts

| Field | Value |
|---|---|
| ID | DOC-18 |
| Status | Draft: decisions below are the defaults taken to build; the owner can change them |
| Owner | Product owner |
| Last updated | 2026-10-20 |
| Depends on | DOC-09.7 (orders, payments), DOC-07.5 (admin orders), DOC-17 item 14 |

## 1. What the owner asked

After a sales order is placed, **assign its delivery to a specific person**. Keep a **complete ledger** for that person. Generate or record **receipts**. Support **bulk assignment** (select many orders, assign to one person). Keep the **full history** of assignment, delivery, ledger and receipt for every transaction.

The shop takes cash on delivery, so whoever delivers holds the customer's cash until they hand it in. The ledger answers: how much cash does each rider hold, which orders do they have, what failed, what have they paid in.

## 2. Decisions taken (change any of them and say so)

| # | Question (DOC-17 item 14) | Default taken |
|---|---|---|
| 1 | Who are the delivery people? | One record type, **delivery person**: staff, freelancer or a courier company's rider. **Staff operate it for them**; riders do not log in (a phone screen for riders is a later step). |
| 2 | When does the rider owe the cash? | **At hand-over** ("Send out"): the cash to collect is debited to the rider then, so they carry the risk. |
| 3 | Money to riders | An optional **fee per delivery** on the person; a fee is credited when an order is delivered. No salary or commission engine; a payout is a ledger entry (Pay fee). |
| 4 | Failed and returned | **Failed** (with a reason) keeps the cash due on the rider until the parcel is **returned to the shop**, which reverses the debit and sends the order through the existing return flow. No partial deliveries: an order is one unit. |
| 5 | Receipts | A **customer receipt** (`RC-000123`) when cash is collected, a **deposit receipt** (`DP-000045`) when the rider pays in, a **fee receipt** (`FP-000007`) when a fee is paid out. Printable page: shop name and address, number, order, amount, rider, signature line. A receipt is voided (with a reason), never deleted. No QR code, WhatsApp or e-mail sending yet. |
| 6 | Cash handling | The **rider ledger only**, with deposits. No day-end closing, no shop cash book, no bank deposits. |
| 7 | "Sales order" | These are the shop's **Orders**. No customer ledger, invoices or tax in this scope. |
| 8 | Couriers | Unchanged. Tracking numbers stay for courier companies. A run dispatches its orders with the person's courier, or the shop's **Own delivery** courier (added by the seed, tracking not required); the run's number is the tracking number. |

## 3. Model

All amounts are integer paisa. Rows are written only by `modules/delivery`; the order's status is changed only by `orders/changes.js` and its paid amount only by the payments module (this module calls them, never writes their tables).

| Table | Columns | Notes |
|---|---|---|
| `delivery_people` | `id`, `name`, `phone`, `kind` (`employee`, `freelancer`, `courier_rider`), `courier_id` NULL, `fee_minor` (default 0), `active`, `note`, `version`, timestamps | A person with ledger rows cannot be deleted, only deactivated. |
| `delivery_runs` | `id`, `number` (`RUN-0001` from a counter), `person_id`, `run_date`, `status` (`open`, `out`, `closed`), `note`, `created_by`, `out_at`, `closed_at`, timestamps | One run is one sheet for one person. |
| `delivery_assignments` | `id`, `run_id`, `order_id`, `status` (`assigned`, `out`, `delivered`, `failed`, `returned`, `removed`), `cash_due_minor` (snapshot at assignment), `collected_minor`, `fail_reason`, `open_key` (= `order_id` while the assignment is live, else NULL; **unique**), timestamps | An order is in at most one live assignment. |
| `rider_ledger` | `id`, `person_id`, `kind` (`cash_due`, `cash_returned`, `deposit`, `fee`, `fee_paid`, `adjustment`, `reversal`), `amount_minor` signed (**positive = the rider owes the shop**), `order_id`, `assignment_id`, `run_id`, `receipt_id`, `reverses_id`, `note`, `actor_id`, `created_at` | **Append-only.** A mistake is a reversing entry. Balance = sum of `amount_minor`. |
| `receipts` | `id`, `number` (counter), `kind` (`customer`, `deposit`, `fee`), `person_id`, `order_id` NULL, `amount_minor`, `status` (`issued`, `void`), `void_reason`, `issued_by`, `issued_at`, `voided_by`, `voided_at` | A voided receipt posts a reversing ledger entry. |

## 4. Flow

1. **Assign** (Orders list: select rows → *Assign to…*; or one order): choose a person (and optionally a date). Only orders that are `confirmed` and in no live assignment can be assigned; the others are reported with the reason (`not_assignable`, `already_assigned`). Creates one run (or adds to the person's open run for that date) with an assignment per order and the cash to collect (`total - paid` for cash on delivery, 0 for prepaid).
2. **Send out** (run → *Send out*): each assignment becomes `out`; the order is dispatched through `changes.apply(to: 'dispatched')` with the courier and the run number; the ledger gets `+cash_due` for each order. A printable **delivery sheet** lists the orders, addresses, phones and cash to collect.
3. **Deliver** (per order): `changes.apply(to: 'delivered', cashReceived: true)`; the assignment becomes `delivered` with `collected_minor`; a **customer receipt** is issued when cash was collected; the fee (if any) is credited (`-fee` to what the rider is owed, i.e. a `fee` entry that reduces their balance).
4. **Fail** (per order, reason): the assignment becomes `failed`; the cash stays on the rider.
5. **Return to shop** (per failed order): `changes.apply(to: 'returned', returnType: 'refused' ...)` through the existing return rules; the assignment becomes `returned`; a `cash_returned` entry (`-cash_due`) reverses the debit.
6. **Close** (run): allowed when no assignment is `out`; status `closed`.
7. **Deposit** (person page → *Record deposit*): the rider hands cash in: `-amount`, a deposit receipt.
8. **Adjustment** and **Pay fee**: staff entries with a note; a payout issues a fee receipt.
9. **Void a receipt**: a reversing entry; the receipt stays, marked void with the reason.

Every step writes an audit entry and appears in the **history** of the order, the person and the run.

## 5. Screens (admin, group Sales)

- **Delivery people** (`/delivery/people`): list with name, kind, active, balance (cash held), orders out; create/edit in a drawer; person page `/delivery/people/:id` with the **statement** (date range, running balance, opening balance), Record deposit, Adjustment, Pay fee, and their runs.
- **Delivery runs** (`/delivery/runs`, `/delivery/runs/:id`): list by status and date; a run page with its orders, per-order actions (Delivered with cash, Failed with reason, Returned to shop), Send out, Close, Print sheet.
- **Receipts** (`/delivery/receipts`): list and filters, print, void.
- **Orders list**: bulk action **Assign to…**; the order page shows the **Delivery** panel (person, run, state, cash, receipt, history).

## 6. Permissions

`deliveries:read`, `deliveries:assign` (assign, send out, deliver, fail, return, close), `ledger:read`, `ledger:write` (deposits, adjustments, fee payouts), `receipts:void`. Owner and manager have all; `fulfilment` has `deliveries:read` and `deliveries:assign`; `support` has `deliveries:read`.

## 7. Routes

`admin.delivery.people.{list,get,create,update}`, `admin.delivery.assign` (bulk), `admin.delivery.runs.{list,get,sendOut,close}`, `admin.delivery.assignments.{deliver,fail,return,remove}`, `admin.delivery.ledger.{statement,deposit,adjust,payFee}`, `admin.delivery.receipts.{list,get,void}`, `admin.orders.delivery` (the order's panel). Specified in `plan/10-api/09-admin-delivery.md`.

## 8. Not built (say if wanted)

A phone screen for riders, day-end closing and a shop cash book, bank deposits, salaries and commission, expenses (fuel), QR codes and sending receipts by WhatsApp or e-mail, partial deliveries, a customer ledger.
