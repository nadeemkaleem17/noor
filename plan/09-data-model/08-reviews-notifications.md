# 09.8 — Data Model: Reviews and Notifications

| Field | Value |
|---|---|
| ID | DOC-09.8 |
| Title | Reviews, review photos, review invites, notification log |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-09.0, DOC-09.3, DOC-09.7, DOC-06.6 §6, DOC-07.8, DOC-08 §9.2 |
| Decisions used | ADR-0009, ADR-0011, ADR-0018 |

## 1. Purpose and scope

**Governs:** tables of the `reviews` and `notifications` modules.
**Does not govern:** message templates and providers (DOC-12).

## 2. Review tables

### 2.1 `review_invites`

Created by the `review.issue_tokens` job when an order is delivered: one per order line of a reviewable product.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `order_line_id` | char(36) | NN | | PK; FK → `order_lines.id` CASCADE |
| `token_hash` | char(64) (bin) | NN | | UQ. The review URL is reached from the order page, which already proves possession of the order token; this token guards the single line |
| `expires_at` | datetime(3) | NN | | Delivery + 90 days |
| `used_at` | datetime(3) | NULL | | |

### 2.2 `reviews`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | char(36) | NN | | PK |
| `product_id` | char(36) | NN | | FK → `products.id` CASCADE |
| `order_line_id` | char(36) | NN | | UQ; FK → `order_lines.id` RESTRICT. One review per purchased line (verified purchase) |
| `display_name` | varchar(40) | NN | | First name by default; never the phone or full name |
| `rating` | tinyint | NN | | CHECK `BETWEEN 1 AND 5` |
| `title` | varchar(100) | NULL | | |
| `body` | varchar(1000) | NN | | 20–1,000 characters |
| `fit` | varchar(16) (bin) | NULL | | `fit_note` |
| `status` | varchar(16) (bin) | NN | `'pending'` | `review_status` |
| `reject_reason` | varchar(24) (bin) | NULL | | `review_reject_reason` |
| `reject_note` | varchar(300) | NULL | | |
| `reply_body` | varchar(600) | NULL | | Public store reply |
| `reply_at` | datetime(3) | NULL | | |
| `moderated_by` | char(36) | NULL | | FK → `staff_users.id` SET NULL |
| `moderated_at` | datetime(3) | NULL | | |
| `locale` | varchar(5) (bin) | NN | `'en'` | |
| `created_at`, `updated_at` | datetime(3) | NN | | |

Indexes: `reviews_product_idx (product_id, status, created_at)`, `reviews_status_idx (status, created_at)`.
On approve/reject the service recomputes `products.rating_avg_x100` and `rating_count` from approved rows (DOC-09.3 §5.1) and emits `review.approved` / `review.rejected`.

### 2.3 `review_photos`

`review_id` + `media_id` PK (FK → `reviews.id` CASCADE, FK → `media.id` RESTRICT) · `sort_order tinyint NN`. Max 3 per review. Removing a photo deletes the row, then the media.

## 3. Notification table

### 3.1 `notification_log`

One row per message we tried, or would have tried, to send. Written by the `notify.*` jobs.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | char(36) | NN | | PK |
| `unique_key` | varchar(190) (bin) | NN | | UQ. `<template>:<entity id>:<channel>`: a retried job cannot send twice |
| `template` | varchar(40) (bin) | NN | | `order.placed`, `order.confirm_request`, `order.confirmed`, `order.dispatched`, `order.delivered`, `order.cancelled`, `order.returned`, `stock.back`, `staff.new_order`, `staff.low_stock`, `staff.invite`, `staff.password_reset` |
| `channel` | varchar(16) (bin) | NN | | `notification_channel` |
| `audience` | varchar(16) (bin) | NN | | `customer`, `staff` |
| `order_id` | char(36) | NULL | | FK → `orders.id` CASCADE |
| `recipient` | varchar(254) | NN | | Phone or email. Personal data: covered by the retention below and by anonymisation |
| `locale` | varchar(5) (bin) | NN | | |
| `body` | text | NN | | Rendered message. Lets staff copy a `skipped` message into WhatsApp by hand (the launch path while no provider is configured) |
| `status` | varchar(16) (bin) | NN | | `notification_status` |
| `provider` | varchar(24) (bin) | NULL | | |
| `provider_ref` | varchar(120) | NULL | | |
| `error` | varchar(300) | NULL | | |
| `created_at` | datetime(3) | NN | | |
| `sent_at` | datetime(3) | NULL | | |

Indexes: `notification_log_order_idx (order_id, created_at)`, `notification_log_status_idx (status, created_at)`.
Retention: rows are deleted 90 days after creation. Messages containing secrets (`staff.invite`, `staff.password_reset`) store the body with the link replaced by `[link]`.

Each customer message also produces an `order_events` row of type `notification` (`{ template, channel, status }`, not the body) so the admin timeline shows what was sent or skipped.

## 4. Rules

**Always:** tie a review to an order line; recompute product rating from approved rows; dedupe messages with `unique_key`.
**Never:** store a reviewer's phone or full name on a review; keep notification bodies beyond 90 days; store an unredacted invite or reset link.
**Common mistakes:** counting pending or rejected reviews in the average; sending before the order transaction commits (the job runs from the outbox, after commit).

## 5. Acceptance checklist

- [ ] A second review for the same order line is rejected by the unique index (`review_already_submitted`).
- [ ] Approving, then rejecting a review returns the product's rating fields to their previous values.
- [x] Running the same `notify.customer` job twice creates one `notification_log` row. (`notifications.int.test.js`; the job is `notify.order`.)
- [x] With no provider configured, placing an order creates a `skipped` row whose body staff can copy from the order page. (The row and its text are tested; the Copy button on the order page is M6-02.)
- [x] Anonymising a customer clears `recipient` and `body` of their notification rows. (`notifications.int.test.js`.)

## 6. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-09.8-1 | Template list | As §3.1; texts in DOC-12 | DOC-12 |
| Q-09.8-2 | Storing rendered bodies | Needed for the manual-send launch path | A provider sends everything automatically → drop `body` |
| Q-09.8-3 | Reviews for bundle lines | One review on the bundle product | Owner wants per-child reviews |

## 7. Changelog

| Date | Change |
|---|---|
| 2026-10-06 | M4-08: `notification_log` built (migration 0016). `channel` is the intended channel (`whatsapp`, `email`; `sms` unused), so a `skipped` row says which was not available. Only the customer's messages add an `order_events` row of type `notification`; the staff email does not. Anonymising a customer (`orders/customer-view.js`, now wired into `customers`) rewrites the personal fields of the customer's **settled** orders (delivered, cancelled, returned) and sets `recipient` and `body` of those orders' messages to `(removed)`; an order that is still open blocks it. |
| 2026-10-02 | Initial version (Phase 5, part 1) |
