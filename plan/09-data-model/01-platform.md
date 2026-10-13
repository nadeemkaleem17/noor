# 09.1 — Data Model: Platform

| Field | Value |
|---|---|
| ID | DOC-09.1 |
| Title | Outbox, jobs, counters, idempotency keys, rate-limit counters, exports |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-09.0, DOC-08 §8–9, DOC-11 §5.4 |
| Decisions used | ADR-0008, ADR-0009, ADR-0020 |

## 1. Purpose and scope

**Governs:** the tables owned by `apps/api/src/platform` (no business module owns them).
**Does not govern:** which events and jobs exist (DOC-08 §8–9).

## 2. Tables

### 2.1 `outbox_events`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | char(36) | NN | | PK. UUIDv7, so id order = creation order |
| `type` | varchar(64) (bin) | NN | | e.g. `order.placed` |
| `payload` | json | NN | | Schema: the event's payload schema in the emitting module's `events.ts`. Ids only, no personal data |
| `request_id` | char(36) | NULL | | Request that caused it |
| `created_at` | datetime(3) | NN | | |
| `processed_at` | datetime(3) | NULL | | Set by the relay |

Indexes: `outbox_events_unprocessed_idx (processed_at, id)`. The relay reads `WHERE processed_at IS NULL ORDER BY id LIMIT 100`.

### 2.2 `jobs`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | char(36) | NN | | PK |
| `type` | varchar(64) (bin) | NN | | DOC-08 §9.2 |
| `payload` | json | NN | | Schema per job type |
| `unique_key` | varchar(190) (bin) | NULL | | UQ `jobs_unique_key_uq`. Dedupes relay inserts and scheduled jobs |
| `run_at` | datetime(3) | NN | | Earliest start |
| `attempts` | int | NN | 0 | |
| `max_attempts` | int | NN | 8 | |
| `locked_at` | datetime(3) | NULL | | |
| `locked_by` | varchar(64) | NULL | | Worker id (`hostname:pid`) |
| `last_error` | varchar(500) | NULL | | Message only |
| `created_at` | datetime(3) | NN | | |

Indexes: `jobs_claim_idx (run_at)`, `jobs_type_idx (type)`. (Changed at M1-01 from `(locked_at, run_at)`: the claim query orders by `run_at, id`, and an index that does not match the order makes MySQL read and lock every due row before applying `LIMIT`, which starved the second worker. See DOC-08 section 9.1.)

### 2.3 `jobs_dead`

Same columns as `jobs` except `locked_at`/`locked_by`, plus `died_at datetime(3) NN`. PK `id` (the original job id). Index `jobs_dead_type_idx (type, died_at)`. Rows are removed by `cli jobs:retry` (moved back) or after 90 days.

### 2.4 `counters`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `name` | varchar(32) (bin) | NN | | PK. `order_number`, `invoice_2026`, `invoice_2027`, … |
| `value` | bigint | NN | | Last issued value |

Seed: `('order_number', 10000)`. Invoice rows are created on first use of a year with value 0.

```sql
-- inside the order transaction, after variant locks (lock order: variants → counters)
UPDATE counters SET value = LAST_INSERT_ID(value + 1) WHERE name = 'order_number';
SELECT LAST_INSERT_ID();
-- invoice (first dispatch): create the year row if missing, then the same UPDATE
INSERT INTO counters (name, value) VALUES ('invoice_2026', 0) ON DUPLICATE KEY UPDATE value = value;
```

A rolled-back transaction rolls the counter back, so numbers have no gaps (ADR-0020 §6).

### 2.5 `idempotency_keys`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `scope` | varchar(40) (bin) | NN | | PK part. Route key, e.g. `orders.create` |
| `key` | char(36) (bin) | NN | | PK part. Client UUID |
| `request_hash` | char(64) (bin) | NN | | SHA-256 of the canonical request body |
| `status` | varchar(16) (bin) | NN | | `in_progress`, `done` |
| `response_status` | smallint | NULL | | HTTP status of the stored response |
| `response_body` | json | NULL | | Stored response (success or domain error). Contains the order's `trackingToken`, so this table is as sensitive as `orders` |
| `created_at` | datetime(3) | NN | | |
| `expires_at` | datetime(3) | NN | | `created_at` + 24 h |

PK `(scope, key)`. Index `idempotency_keys_expires_idx (expires_at)`.

Protocol (ADR-0020 §4): insert `in_progress` in its **own** short transaction before the command; a duplicate-key error means a retry: if `done` and hashes match → replay; hashes differ → `422 idempotency_mismatch`; `in_progress` and younger than 30 s → `409 request_in_progress`; older → treated as crashed and taken over. The command's transaction updates the row to `done` with the response as its last statement, so order and stored response commit together.

### 2.6 `rate_limit_hits`

For the database-backed buckets of DOC-11 §5.4 (`checkout`, `track`, `notify`, `login`).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `bucket` | varchar(24) (bin) | NN | | PK part |
| `subject` | varchar(100) (bin) | NN | | PK part. `ip:<addr>`, `phone:<sha256 prefix>`, `order:<number>`, `email:<sha256 prefix>` — phones and emails are hashed, never stored in clear |
| `window_start` | datetime(3) | NN | | PK part. Start of the fixed window |
| `count` | int | NN | 1 | |

PK `(bucket, subject, window_start)`. One statement per hit: `INSERT … ON DUPLICATE KEY UPDATE count = count + 1`, then compare. Rows older than 24 h are deleted hourly by `idempotency.cleanup`.

### 2.7 `exports`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | char(36) | NN | | PK |
| `type` | varchar(32) (bin) | NN | | `products`, `orders`, `customers`, `audit`, `bulk_result` |
| `params` | json | NN | | The filter used |
| `status` | varchar(16) (bin) | NN | `'queued'` | `export_status` |
| `row_count` | int | NULL | | |
| `file_key` | varchar(500) | NULL | | Private object key (`exports/…`) |
| `error` | varchar(500) | NULL | | |
| `requested_by` | char(36) | NN | | FK → `staff_users.id` |
| `created_at` | datetime(3) | NN | | |
| `finished_at` | datetime(3) | NULL | | |
| `expires_at` | datetime(3) | NULL | | Download link valid until (24 h) |

Indexes: `exports_requested_idx (requested_by, created_at)`, `exports_expires_idx (expires_at)`. Expired rows and their objects are deleted daily.

## 3. Rules

**Always:** write `outbox_events` and `jobs` rows through `platform/outbox.ts` and `platform/jobs.ts` with the caller's `tx`; take counters last in the lock order; hash personal identifiers used as rate-limit subjects.
**Never:** derive an order or invoice number from `MAX()+1`; store a job payload containing personal data; read these tables from a business module's repository.
**Common mistakes:** creating the idempotency row inside the command transaction (a rollback then forgets the attempt); a `unique_key` longer than the 190-character index limit.

## 4. Acceptance checklist

- [x] 50 concurrent `orders.create` calls produce 50 consecutive order numbers with no duplicate and no gap. (`apps/api/test/orders.int.test.js` (50 orders at once, no gap) and `platform.int.test.js` (50 concurrent callers).)
- [ ] A rolled-back order does not consume a number. **Open: no test of a rolled-back order and its number.**
- [x] Same idempotency key and body twice → one order, identical response; same key, different body → `422`. (`apps/api/test/orders.int.test.js` ("the same Idempotency-Key twice").)
- [x] Inserting two jobs with the same `unique_key` leaves one row. (`apps/api/test/platform.int.test.js`.)
- [ ] `rate_limit_hits` contains no phone number or email in clear. **Open: subjects are hashed (`subjectHash`); no test reads the table.**

## 5. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-09.1-1 | Counter row as a single lock point | Fine at A-03 (peak 1,500 orders/day) | Lock wait p95 over 200 ms during a drop (ADR-0020) |
| Q-09.1-2 | Fixed-window rate limiting (allows up to 2× at a window edge) | Acceptable for abuse control | Abuse at window edges observed |

## 6. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 5, part 1) |
| 2026-10-04 | M1-01: `jobs_claim_idx` is `(run_at)`; tables `idempotency_keys` (hash column `ascii_bin`, status CHECK) and `rate_limit_hits` (extra index `rate_limit_hits_window_idx (window_start)` for the cleanup) built; `exports` waits for `staff_users` (M1-02) |
