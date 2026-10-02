# ADR-0009 — MySQL-backed jobs and transactional outbox; HTTP/CDN cache first

| Field | Value |
|---|---|
| ID | ADR-0009 |
| Title | Jobs, events, caching |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | ADR-0008, ADR-0016, README A-02 |
| Decisions used | ADR-0017, ADR-0020 |

## Purpose and scope
How background work, domain events and caches are done. Job catalogue and cache keys are DOC-08.

## Context
Needed async work: send order SMS/WhatsApp/email, COD-confirmation reminders, payment webhook processing, courier status sync, image processing, stock-low alerts, scheduled publish (`Product.status: 'scheduled'`, `publishedAt`). Each must be triggered atomically with the state change that caused it. Team is small and budget-limited (A-01, A-02): fewer moving services is a feature.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| A. MySQL `jobs` table polled with `FOR UPDATE SKIP LOCKED` + outbox table | Same transaction as the order write; no extra service | Lower throughput than Redis; polling load; we own a small worker loop (no pg-boss equivalent for MySQL) |
| B. Redis + BullMQ | High throughput, rich features | Extra service to run, monitor, back up; dual-write problem with the DB |
| C. Managed queue (SQS etc.) | No ops | Cloud lock-in; foreign payment for a Pakistani business (A-02 risk) |
| D. In-process timers/cron | Trivial | Lost on restart; no retries |

## Decision
**Option A.** Domain events are rows in `outbox_events` written in the same transaction as the change; a relay job turns them into jobs; handlers are idempotent and keyed by `event_id`. The worker is our own loop over a `jobs` table: claim a batch with `SELECT … WHERE run_at <= now() AND locked_at IS NULL ORDER BY run_at LIMIT n FOR UPDATE SKIP LOCKED`, mark it locked, run, then delete or reschedule. DOC-08 specifies the table and includes a 1-day spike on it.
- Retries: exponential backoff, max 8 attempts, then a dead-letter row visible in the admin (DOC-07 audit/ops).
- **Cache layers, in order:** (1) CDN via `Cache-Control` and tag purge (ADR-0004); (2) in-process LRU for tiny hot config (store config, categories) with a 30 s TTL; (3) Redis only when a measured need appears (rate-limit counters across instances, session store at scale).
- Never cache anything per-customer at the CDN.

## Examples
```sql
create table outbox_events (
  id char(36) primary key, type varchar(64) not null, payload json not null,
  created_at datetime(3) not null, processed_at datetime(3) null,
  index outbox_unprocessed (processed_at, created_at) -- MySQL has no partial indexes
);
```

## Consequences
One datastore to run and back up; exactly-once-effect through idempotency, at-least-once delivery. Throughput ceiling is far above A-03.

## Rules
**Always:** write the event in the same transaction; make handlers idempotent. **Never:** call an external provider inside a request transaction; publish events after commit from app code. **Common mistake:** a handler that sends an SMS then crashes before recording success (use an idempotency key per message).

## Acceptance checklist
- [ ] Killing the worker mid-job and restarting does not duplicate or lose a notification (integration test).
- [ ] Every event type in DOC-08 has a handler test.

## Revisit trigger
Job latency p95 over 30 s at normal load, queue table over 5 GB, or more than 50 jobs/s sustained.

## Open questions and assumptions
`SKIP LOCKED` needs MySQL ≥ 8.0.1 (assumed, not re-verified). Processed outbox rows are deleted by a nightly job so the composite index stays small. Redis is not provisioned in v1.

## Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |
| 2026-10-02 | Queue is our own `jobs` table with `SKIP LOCKED` (pg-boss is Postgres-only); outbox DDL rewritten for MySQL |
| 2026-10-02 | Phase 4: jobs table, claiming, retry, dead-letter, scheduling and the job catalogue specified in DOC-08 §8–9 |
| 2026-10-02 | Phase 5: notification channels, routing and templates in DOC-12 §4; launch path is the `log` channel (messages rendered and stored as skipped) |
