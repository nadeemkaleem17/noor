# ADR-0008 — MySQL 8.4 + Drizzle ORM (pinned 0.45.x)

| Field | Value |
|---|---|
| ID | ADR-0008 |
| Title | Database, ORM, migrations |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | ADR-0001, ADR-0002, ADR-0013, README A-03 |
| Decisions used | ADR-0016, ADR-0020 |

## Purpose and scope
System of record, data-access library and migration workflow. Table definitions are DOC-09.

## Context
Today data is an in-memory array (`server.js:9-16`) or a localStorage JSON blob per collection (`db.js:94-96`, F-13). Orders need transactions, row locks and gap-safe counters (ADR-0020). The owner requires Node.js with MySQL or MongoDB. Scale assumption A-03: about 3,000 products / 25,000 variants, up to 1,500 orders/day on sale days.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| A. MySQL 8.4 (InnoDB) + Drizzle | Owner's stack; SQL-first, typed, light runtime, SQL migrations; cheap managed and shared hosting everywhere, including Pakistan | Drizzle 1.0 in beta; API churn risk; no sequences, no partial indexes, no trigram search, DDL is not transactional |
| B. MySQL + Prisma (7.10 stable, 8 RC) | Mature DX, migrations | Heavier; major rewrite in flight (v8 RC); schema DSL |
| C. MySQL + Kysely/raw SQL (`mysql2`) | Maximum control | More boilerplate; fewer helpers |
| D. MongoDB + Mongoose | Flexible documents; fits the nested product shape | Stock, promo usage and order numbers need multi-document transactions and constraints we would hand-write; no FKs or `CHECK`; facet counts and reporting are harder than SQL |
| E. PostgreSQL + Drizzle (the original proposal) | Sequences, partial indexes, `pg_trgm`, transactional DDL | Outside the owner's chosen stack |
| F. SQLite/other | Simple | Not suited to concurrent order writes at our scale |

## Decision
**Option A**: Drizzle (`drizzle-orm/mysql-core`, `mysql2` driver) pinned to the stable **0.45.x** line until 1.0 is stable; **MySQL 8.4 LTS**, InnoDB, managed (ADR-0019). Charset `utf8mb4`, collation `utf8mb4_0900_ai_ci` (Urdu-safe, ADR-0018).
- Migrations: `drizzle-kit generate` produces numbered SQL committed to `apps/api/drizzle/`; `drizzle-kit push` is forbidden outside a local scratch DB.
- IDs: UUIDv7 generated in the app, stored as `char(36)` (time-ordered, so the clustered index stays local). Human-facing numbers come from the `counters` table (order numbers, ADR-0020); MySQL has no sequences.
- Time: `datetime(3)`, always UTC (connection `timezone: "Z"`); never `timestamp` (2038 limit, session-zone conversion); display in `Asia/Karachi` (UTC+5, no DST).
- Structured blobs (event payloads, block settings): `json` columns. Anything filtered or sorted on gets a real column.
- Money: `bigint` columns named `*_minor` plus a `currency` char(3) where more than one currency could exist; PKR only in v1 (ADR-0013).
- DB access only inside a module's `repository.ts`; no ORM types leave a module (keeps an ORM swap contained).
- Enums: `varchar` + `CHECK` (enforced from MySQL 8.0.16); no native `ENUM` columns (changing them rewrites the table).
- Migrations are **not transactional** in MySQL (DDL auto-commits): one schema change per migration file, and every migration must be safe to re-run after a partial failure.

## Examples
```ts
// apps/api/src/modules/orders/schema.ts
export const orders = mysqlTable("orders", {
  id: char("id", { length: 36 }).primaryKey(),
  orderNumber: bigint("order_number", { mode: "number" }).notNull().unique(),
  status: varchar("status", { length: 32 }).notNull(),
  totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
});
```

## Consequences
Real transactions and constraints replace client-side invariants. We carry a small risk from Drizzle's pre-1.0 churn, bounded by pinning and repository isolation.

## Rules
**Always:** write the migration, then the code; wrap order/stock writes in a transaction. **Never:** edit an applied migration; use `float`/`double`/`decimal` for money; use `timestamp` or a native `ENUM`; use `SELECT *` in repositories. **Common mistake:** relying on ORM defaults for `updated_at`.

## Acceptance checklist
- [x] `pnpm db:migrate` on an empty database yields the schema in DOC-09. (Every integration test and `pnpm test:e2e` migrate an empty database.)
- [ ] Every FK and every column used in a `WHERE`/`ORDER BY` of a list endpoint has an index (DOC-09 tables). **Open: no test of the indexes.**
- [x] No `push` in scripts or CI. (Run at M7-07: no `push` in scripts or CI.)

## Revisit trigger
Drizzle 1.0 stable migration costs more than 2 dev-days, a security or maintenance event hits the project, or Prisma 8 stable removes the reasons in the table. Reopen the engine choice only if search (ADR-0010) or the job queue (ADR-0009) hits its own revisit trigger and the fix needs a Postgres-only feature.

## Open questions and assumptions
`drizzle-zod` compatibility with Zod 4 was **not verified**; the plan does not depend on it (the contract package is the schema source). Assumes the managed provider offers MySQL 8.4 LTS; MariaDB is **not** a drop-in substitute (different `JSON`, `CHECK` and `SKIP LOCKED` behaviour) and is out of scope. Drizzle's MySQL column API in the example was not checked against the pinned version (DOC-08 spike).

## Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |
| 2026-10-02 | Owner decision: MySQL 8.4 instead of PostgreSQL; MongoDB considered and rejected; ids, time, enum and migration rules rewritten for MySQL |
| 2026-10-02 | Phase 5: conventions and all 66 tables specified in DOC-09.0 … 09.9; translations stored as an `i18n` JSON column per table |
